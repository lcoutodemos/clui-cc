import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class MemoryStorage implements Storage {
  private map = new Map<string, string>()

  get length(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
}

let uuidCounter = 0

async function loadNotificationStore() {
  return import('../../src/renderer/stores/notificationStore')
}

describe('notificationStore', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    uuidCounter = 0
    storage = new MemoryStorage()

    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    })

    // crypto.randomUUID must be available in test environment
    if (!globalThis.crypto?.randomUUID) {
      Object.defineProperty(globalThis, 'crypto', {
        value: {
          randomUUID: () => `test-uuid-${++uuidCounter}`,
        },
        configurable: true,
        writable: true,
      })
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(globalThis, 'localStorage')
  })

  it('addToast adds a toast with generated id and createdAt', async () => {
    const { useNotificationStore } = await loadNotificationStore()

    useNotificationStore.getState().addToast({
      type: 'success',
      title: 'Test toast',
      message: 'This is a test',
    })

    const toasts = useNotificationStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({
      type: 'success',
      title: 'Test toast',
      message: 'This is a test',
    })
    expect(toasts[0].id).toBeTruthy()
    expect(typeof toasts[0].createdAt).toBe('number')
  })

  it('removeToast removes by id', async () => {
    const { useNotificationStore } = await loadNotificationStore()

    useNotificationStore.getState().addToast({ type: 'info', title: 'First' })
    useNotificationStore.getState().addToast({ type: 'warning', title: 'Second' })

    expect(useNotificationStore.getState().toasts).toHaveLength(2)

    const firstId = useNotificationStore.getState().toasts[0].id
    useNotificationStore.getState().removeToast(firstId)

    const remaining = useNotificationStore.getState().toasts
    expect(remaining).toHaveLength(1)
    expect(remaining[0].title).toBe('Second')
  })

  it('enforces max 3 toasts — removes oldest when exceeded', async () => {
    const { useNotificationStore } = await loadNotificationStore()

    useNotificationStore.getState().addToast({ type: 'info', title: 'Toast 1' })
    useNotificationStore.getState().addToast({ type: 'info', title: 'Toast 2' })
    useNotificationStore.getState().addToast({ type: 'info', title: 'Toast 3' })
    useNotificationStore.getState().addToast({ type: 'info', title: 'Toast 4' })

    const toasts = useNotificationStore.getState().toasts
    expect(toasts).toHaveLength(3)
    // Oldest (Toast 1) should have been removed
    expect(toasts[0].title).toBe('Toast 2')
    expect(toasts[1].title).toBe('Toast 3')
    expect(toasts[2].title).toBe('Toast 4')
  })

  it('toast has correct structure with id and createdAt generated', async () => {
    const { useNotificationStore } = await loadNotificationStore()

    useNotificationStore.getState().addToast({
      type: 'error',
      title: 'Error occurred',
      message: 'Something went wrong',
      duration: 5000,
    })

    const toast = useNotificationStore.getState().toasts[0]
    expect(toast).toBeDefined()
    expect(toast.id).toBeTruthy()
    expect(typeof toast.id).toBe('string')
    expect(toast.createdAt).toBeGreaterThan(0)
    expect(toast.type).toBe('error')
    expect(toast.title).toBe('Error occurred')
    expect(toast.message).toBe('Something went wrong')
    expect(toast.duration).toBe(5000)
  })

  it('does not add toasts when toastsEnabled is false', async () => {
    const { useNotificationStore } = await loadNotificationStore()

    useNotificationStore.getState().setToastsEnabled(false)
    useNotificationStore.getState().addToast({ type: 'info', title: 'Should not appear' })

    expect(useNotificationStore.getState().toasts).toHaveLength(0)
  })

  it('persists preferences to localStorage', async () => {
    const { useNotificationStore } = await loadNotificationStore()

    useNotificationStore.getState().setDesktopEnabled(false)
    useNotificationStore.getState().setToastsEnabled(false)

    const stored = JSON.parse(storage.getItem('clui-notification-prefs') || '{}')
    expect(stored.desktopEnabled).toBe(false)
    expect(stored.toastsEnabled).toBe(false)
  })
})
