import { create } from 'zustand'

interface PermissionDeps {
  setPermissionMode: (mode: 'ask' | 'auto') => void
  respondPermission: (tabId: string, questionId: string, optionId: string) => Promise<boolean> | boolean
  afterRespond?: (tabId: string, questionId: string) => void
}

const defaultPermissionDeps: PermissionDeps = {
  setPermissionMode: (mode) => window.clui.setPermissionMode(mode),
  respondPermission: (tabId, questionId, optionId) => window.clui.respondPermission(tabId, questionId, optionId),
}

export interface PermissionStoreState {
  permissionMode: 'ask' | 'auto'
  setPermissionMode: (mode: 'ask' | 'auto') => void
  respondPermission: (tabId: string, questionId: string, optionId: string) => void
}

export function configurePermissionStore(overrides: Partial<PermissionDeps>): void {
  Object.assign(defaultPermissionDeps, overrides)
}

export function createPermissionStore(deps: PermissionDeps = defaultPermissionDeps) {
  return create<PermissionStoreState>((set) => ({
    permissionMode: 'ask',
    setPermissionMode: (mode) => {
      set({ permissionMode: mode })
      deps.setPermissionMode(mode)
    },
    respondPermission: (tabId, questionId, optionId) => {
      void deps.respondPermission(tabId, questionId, optionId)
      deps.afterRespond?.(tabId, questionId)
    },
  }))
}

export const usePermissionStore = createPermissionStore()
