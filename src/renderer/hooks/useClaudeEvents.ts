import { useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import type { NormalizedEvent } from '../../shared/types'

/**
 * Subscribes to all ControlPlane events via IPC and routes them
 * to the Zustand store.
 *
 * text_chunk events are batched per animation frame to avoid
 * flooding React with one state update per chunk during streaming.
 */
export function useClaudeEvents() {
  const handleNormalizedEvent = useSessionStore((s) => s.handleNormalizedEvent)
  const handleStatusChange = useSessionStore((s) => s.handleStatusChange)
  const handleError = useSessionStore((s) => s.handleError)

  // RAF batching for text_chunk events
  const chunkBufferRef = useRef<Map<string, string>>(new Map())
  const rafIdRef = useRef<number>(0)

  useEffect(() => {
    const flushChunks = () => {
      rafIdRef.current = 0
      const buffer = chunkBufferRef.current
      if (buffer.size === 0) return

      // Flush all accumulated text per tab in one go
      for (const [tabId, text] of buffer) {
        handleNormalizedEvent(tabId, { type: 'text_chunk', text } as NormalizedEvent)
      }
      buffer.clear()
    }

    const unsubEvent = window.clui.onEvent((tabId, event) => {
      if (event.type === 'text_chunk') {
        // Buffer text chunks and flush on next animation frame
        const buffer = chunkBufferRef.current
        const existing = buffer.get(tabId) || ''
        buffer.set(tabId, existing + (event as any).text)

        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(flushChunks)
        }
      } else {
        // All other events pass through immediately
        handleNormalizedEvent(tabId, event)
      }
    })

    const unsubStatus = window.clui.onTabStatusChange((tabId, newStatus, oldStatus) => {
      handleStatusChange(tabId, newStatus, oldStatus)
    })

    const unsubError = window.clui.onError((tabId, error) => {
      handleError(tabId, error)
    })

    const unsubSkill = window.clui.onSkillStatus((status) => {
      if (status.state === 'failed') {
        console.warn(`[CLUI] Skill install failed: ${status.name} — ${status.error}`)
      }
    })

    let whisperToastShown = false
    const unsubWhisper = window.clui.onWhisperStatus((status) => {
      const { useNotificationStore } = require('../stores/notificationStore')
      const addToast = useNotificationStore.getState().addToast
      if (status.stage === 'downloading-binary' && !whisperToastShown) {
        whisperToastShown = true
        addToast({ type: 'info', title: 'Downloading voice engine...', duration: 8000 })
      } else if (status.stage === 'ready' && whisperToastShown) {
        addToast({ type: 'success', title: 'Voice input ready' })
      } else if (status.stage === 'error') {
        addToast({ type: 'warning', title: 'Voice download failed', message: status.error || 'Retry on next launch' })
      }
    })

    return () => {
      unsubEvent()
      unsubStatus()
      unsubError()
      unsubSkill()
      unsubWhisper()
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      chunkBufferRef.current.clear()
    }
  }, [handleNormalizedEvent, handleStatusChange, handleError])

  // Note: window.clui.start() is called via sessionStore.initStaticInfo() in App.tsx.
  // No duplicate call needed here.
}
