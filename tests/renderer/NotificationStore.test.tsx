// Store tests — no DOM needed

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotificationStore } from '../../src/renderer/stores/notificationStore'

describe('NotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      toasts: [],
      desktopEnabled: true,
      toastsEnabled: true,
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with empty toasts', () => {
    expect(useNotificationStore.getState().toasts).toHaveLength(0)
  })

  it('addToast() creates toast with id and createdAt', () => {
    useNotificationStore.getState().addToast({ type: 'success', title: 'Done' })
    const toasts = useNotificationStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].type).toBe('success')
    expect(toasts[0].title).toBe('Done')
    expect(toasts[0].id).toBeDefined()
    expect(toasts[0].createdAt).toBeGreaterThan(0)
  })

  it('removeToast() removes by id', () => {
    useNotificationStore.getState().addToast({ type: 'info', title: 'Test' })
    const id = useNotificationStore.getState().toasts[0].id
    useNotificationStore.getState().removeToast(id)
    expect(useNotificationStore.getState().toasts).toHaveLength(0)
  })

  it('enforces max 3 toasts', () => {
    const add = useNotificationStore.getState().addToast
    add({ type: 'info', title: '1' })
    add({ type: 'info', title: '2' })
    add({ type: 'info', title: '3' })
    add({ type: 'info', title: '4' })
    expect(useNotificationStore.getState().toasts.length).toBeLessThanOrEqual(3)
  })

  it('respects toastsEnabled flag', () => {
    useNotificationStore.getState().setToastsEnabled(false)
    useNotificationStore.getState().addToast({ type: 'error', title: 'Nope' })
    expect(useNotificationStore.getState().toasts).toHaveLength(0)
  })
})
