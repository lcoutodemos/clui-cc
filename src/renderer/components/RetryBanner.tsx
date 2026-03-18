import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowsClockwise, ArrowCounterClockwise, Square, X } from '@phosphor-icons/react'
import { useSessionStore } from '../stores/sessionStore'
import { useColors } from '../theme'

export function RetryBanner({ tabId }: { tabId: string }) {
  const colors = useColors()
  const retryState = useSessionStore((s) => s.tabs.find((t) => t.id === tabId)?.retryState ?? null)
  const retryTab = useSessionStore((s) => s.retryTab)
  const stopRetrying = useSessionStore((s) => s.stopRetrying)
  const closeTab = useSessionStore((s) => s.closeTab)
  const [remainingMs, setRemainingMs] = useState(0)

  useEffect(() => {
    if (!retryState?.nextRetryAt) {
      setRemainingMs(0)
      return
    }

    const tick = () => setRemainingMs(Math.max(0, retryState.nextRetryAt! - Date.now()))
    tick()
    const timer = window.setInterval(tick, 100)
    return () => window.clearInterval(timer)
  }, [retryState?.nextRetryAt])

  if (!retryState) return null

  const isFinished = retryState.exhausted || retryState.stopped
  const hasCountdown = retryState.nextRetryAt !== null && !isFinished
  const seconds = Math.ceil(remainingMs / 1000)

  let headline = 'Reconnecting...'
  if (retryState.exhausted) {
    headline = 'Session crashed. Retries exhausted.'
  } else if (retryState.stopped) {
    headline = 'Auto-resume stopped.'
  } else if (retryState.attempt > 1) {
    headline = `Reconnecting... Attempt ${retryState.attempt}/${retryState.maxAttempts}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.16 }}
      className="mx-4 mb-2"
    >
      <div
        className="rounded-xl px-3 py-2"
        style={{
          background: colors.permissionHeaderBg,
          border: `1px solid ${colors.permissionBorder}`,
          boxShadow: colors.permissionShadow,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: colors.textPrimary }}>
              <ArrowsClockwise size={13} className={!isFinished ? 'animate-spin' : ''} />
              <span>{headline}</span>
            </div>
            <div className="mt-1 text-[11px]" style={{ color: colors.textSecondary }}>
              {hasCountdown
                ? `Next retry in ${seconds}s`
                : retryState.lastError || 'Waiting for manual action.'}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!isFinished ? (
              <button
                onClick={() => stopRetrying(tabId)}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors"
                style={{
                  background: colors.surfacePrimary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.surfaceSecondary}`,
                }}
              >
                <Square size={10} weight="fill" />
                Stop
              </button>
            ) : (
              <>
                <button
                  onClick={() => retryTab(tabId)}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors"
                  style={{
                    background: colors.accentLight,
                    color: colors.accent,
                    border: `1px solid ${colors.accentBorderMedium}`,
                  }}
                >
                  <ArrowCounterClockwise size={11} />
                  Retry Manually
                </button>
                <button
                  onClick={() => closeTab(tabId)}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors"
                  style={{
                    background: colors.surfacePrimary,
                    color: colors.textTertiary,
                    border: `1px solid ${colors.surfaceSecondary}`,
                  }}
                >
                  <X size={11} />
                  Close Tab
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
