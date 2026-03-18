import { create } from 'zustand'

export interface Toast {
  id: string
  type: 'success' | 'info' | 'warning' | 'error'
  title: string
  message?: string
  duration?: number // ms, default 4000
  createdAt: number
}

interface NotificationState {
  toasts: Toast[]
  desktopEnabled: boolean
  toastsEnabled: boolean

  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => void
  removeToast: (id: string) => void
  setDesktopEnabled: (enabled: boolean) => void
  setToastsEnabled: (enabled: boolean) => void
}

const MAX_TOASTS = 3
const NOTIFICATION_PREFS_KEY = 'clui-notification-prefs'

function loadPrefs(): { desktopEnabled: boolean; toastsEnabled: boolean } {
  try {
    const raw = localStorage.getItem(NOTIFICATION_PREFS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        desktopEnabled: typeof parsed.desktopEnabled === 'boolean' ? parsed.desktopEnabled : true,
        toastsEnabled: typeof parsed.toastsEnabled === 'boolean' ? parsed.toastsEnabled : true,
      }
    }
  } catch {}
  return { desktopEnabled: true, toastsEnabled: true }
}

function savePrefs(prefs: { desktopEnabled: boolean; toastsEnabled: boolean }): void {
  try {
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs))
  } catch {}
}

const savedPrefs = loadPrefs()

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],
  desktopEnabled: savedPrefs.desktopEnabled,
  toastsEnabled: savedPrefs.toastsEnabled,

  addToast: (toast) => {
    if (!get().toastsEnabled) return

    const id = crypto.randomUUID()
    const newToast: Toast = {
      ...toast,
      id,
      createdAt: Date.now(),
    }

    set((s) => {
      const updated = [...s.toasts, newToast]
      // Enforce max 3 visible — remove oldest when exceeded
      if (updated.length > MAX_TOASTS) {
        return { toasts: updated.slice(updated.length - MAX_TOASTS) }
      }
      return { toasts: updated }
    })

    // Auto-dismiss after duration
    const duration = toast.duration ?? 4000
    setTimeout(() => {
      get().removeToast(id)
    }, duration)
  },

  removeToast: (id) => {
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    }))
  },

  setDesktopEnabled: (enabled) => {
    set({ desktopEnabled: enabled })
    savePrefs({ desktopEnabled: enabled, toastsEnabled: get().toastsEnabled })
  },

  setToastsEnabled: (enabled) => {
    set({ toastsEnabled: enabled })
    savePrefs({ desktopEnabled: get().desktopEnabled, toastsEnabled: enabled })
  },
}))
