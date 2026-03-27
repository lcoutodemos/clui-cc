import { useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'

const HEALTH_POLL_INTERVAL_MS = 1500

/**
 * Health reconciliation loop: periodically compares running tabs
 * against backend health and unsticks UI when external CLI/session
 * changes happen.
 *
 * Copied from reference architecture (CopilotPill.tsx lines 1242-1271).
 */
export function useHealthReconciliation() {
  useEffect(() => {
    const timer = setInterval(async () => {
      const { tabs } = useSessionStore.getState()
      const runningTabs = tabs.filter(
        (t) => (t.status === 'running' || t.status === 'connecting') && t.activeRequestId
      )
      if (runningTabs.length === 0) return

      try {
        const health = await window.clui.tabHealth()
        if (!health?.tabs || !Array.isArray(health.tabs)) return

        const stateByTab = new Map(
          health.tabs.map((h) => [h.tabId, h])
        )

        // If the backend has no tabs (likely a restart), re-register all current tabs from the store.
        const { tabs: currentTabs, activeTabId, preferredModel } = useSessionStore.getState()
        if (activeTabId && !stateByTab.has(activeTabId)) {
          // Re-register every tab we have in the store so the backend knows about them.
          for (const t of currentTabs) {
            await window.clui.createTab(t.id)
            if (t.workingDirectory) {
              window.clui.initSession(t.id, {
                prompt: 'init',
                model: preferredModel || undefined,
                projectPath: t.workingDirectory
              })
            }
          }
          return // Let the next poll tick handle status reconciliation
        }

        // Build updated tabs, tracking whether anything actually changed
        let changed = false
        const newTabs = currentTabs.map((t) => {
          if (t.status !== 'running' && t.status !== 'connecting') return t

          const healthEntry = stateByTab.get(t.id)
          if (!healthEntry) return t

          // Backend says dead but UI thinks it's running → unstick
          if (healthEntry.status === 'dead') {
            changed = true
            return { ...t, status: 'dead' as const, currentActivity: 'Session ended', activeRequestId: null }
          }

          // Backend says idle but UI thinks it's running → unstick
          if (healthEntry.status === 'idle' && !healthEntry.alive) {
            changed = true
            return { ...t, status: 'completed' as const, currentActivity: '', activeRequestId: null }
          }

          // Backend says failed → unstick
          if (healthEntry.status === 'failed') {
            changed = true
            return { ...t, status: 'failed' as const, currentActivity: '', activeRequestId: null }
          }

          return t
        })

        // Only write state when something actually changed
        if (changed) {
          useSessionStore.setState({ tabs: newTabs })
        }
      } catch {
        // Ignore transient health check errors
      }
    }, HEALTH_POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [])
}
