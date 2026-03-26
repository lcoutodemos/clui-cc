import { vi, beforeEach } from 'vitest'

// ─── Mock localStorage (vitest 4.x jsdom requires explicit impl) ───
const localStorageStore: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => { localStorageStore[key] = String(value) },
  removeItem: (key: string) => { delete localStorageStore[key] },
  clear: () => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]) },
  key: (i: number) => Object.keys(localStorageStore)[i] ?? null,
  get length() { return Object.keys(localStorageStore).length },
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true, configurable: true })

// ─── Mock Audio API — must use function syntax to support `new Audio()` ───
global.Audio = vi.fn().mockImplementation(function (this: any) {
  this.volume = 1.0
  this.currentTime = 0
  this.play = vi.fn().mockResolvedValue(undefined)
}) as unknown as typeof Audio

// ─── Mock window.clui (Electron IPC bridge) ───
const mockClui = {
  resetTabSession: vi.fn(),
  createTab: vi.fn().mockResolvedValue({ tabId: 'mock-tab-id' }),
  prompt: vi.fn().mockResolvedValue(undefined),
  cancel: vi.fn().mockResolvedValue(true),
  loadSession: vi.fn().mockResolvedValue([]),
  listSessions: vi.fn().mockResolvedValue([]),
  isVisible: vi.fn().mockResolvedValue(false),
  setPermissionMode: vi.fn(),
  respondPermission: vi.fn().mockResolvedValue(true),
  closeTab: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue({
    version: '1.0.0',
    auth: {},
    mcpServers: [],
    projectPath: '/home/user',
    homePath: '/home/user',
  }),
  getAutoStart: vi.fn().mockResolvedValue({ enabled: false, startMinimized: false }),
  setAutoStart: vi.fn().mockResolvedValue({ enabled: false, startMinimized: false }),
  setShortcut: vi.fn().mockResolvedValue({ primary: { ok: true }, secondary: { ok: true } }),
  getShortcut: vi.fn().mockResolvedValue({ primary: 'Alt+Space', secondary: 'CommandOrControl+Shift+K' }),
  getTheme: vi.fn().mockResolvedValue({ isDark: true }),
  onThemeChange: vi.fn().mockReturnValue(() => {}),
  hideWindow: vi.fn(),
  setIgnoreMouseEvents: vi.fn(),
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'clui', { value: mockClui, writable: true, configurable: true })
}

// ─── Reset mocks and localStorage between tests ───
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})
