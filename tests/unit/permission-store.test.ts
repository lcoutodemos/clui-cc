import { describe, expect, it, vi } from 'vitest'
import { createPermissionStore } from '../../src/renderer/stores/permissionStore'

describe('permissionStore', () => {
  it('persists permission mode through the injected dependency', () => {
    const setPermissionMode = vi.fn()
    const store = createPermissionStore({
      setPermissionMode,
      respondPermission: vi.fn(),
    })

    store.getState().setPermissionMode('auto')

    expect(store.getState().permissionMode).toBe('auto')
    expect(setPermissionMode).toHaveBeenCalledWith('auto')
  })

  it('routes permission responses through the injected dependency', () => {
    const respondPermission = vi.fn().mockResolvedValue(true)
    const store = createPermissionStore({
      setPermissionMode: vi.fn(),
      respondPermission,
    })

    store.getState().respondPermission('tab-1', 'question-1', 'allow')

    expect(respondPermission).toHaveBeenCalledWith('tab-1', 'question-1', 'allow')
  })
})
