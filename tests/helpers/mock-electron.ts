/**
 * Electron API mocks for testing main-process code outside of Electron.
 *
 * Usage: vi.mock('electron', () => mockElectron()) in your test file.
 */

import { vi } from 'vitest'

export function mockElectron() {
  return {
    app: {
      getPath: vi.fn((name: string) => {
        const paths: Record<string, string> = {
          userData: '/mock/userData',
          temp: '/mock/temp',
          home: '/mock/home',
        }
        return paths[name] ?? `/mock/${name}`
      }),
      getVersion: vi.fn(() => '33.0.0'),
      getName: vi.fn(() => 'clui'),
      isReady: vi.fn(() => true),
      on: vi.fn(),
      quit: vi.fn(),
    },
    BrowserWindow: vi.fn().mockImplementation(() => ({
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      close: vi.fn(),
      destroy: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isVisible: vi.fn(() => true),
      webContents: {
        send: vi.fn(),
        on: vi.fn(),
        openDevTools: vi.fn(),
      },
      setIgnoreMouseEvents: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      setBounds: vi.fn(),
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: 800, height: 600 })),
    })),
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
      removeHandler: vi.fn(),
    },
    globalShortcut: {
      register: vi.fn(() => true),
      unregister: vi.fn(),
      unregisterAll: vi.fn(),
      isRegistered: vi.fn(() => false),
    },
    Tray: vi.fn().mockImplementation(() => ({
      setContextMenu: vi.fn(),
      setToolTip: vi.fn(),
      setImage: vi.fn(),
      setTemplateImage: vi.fn(),
      on: vi.fn(),
      destroy: vi.fn(),
    })),
    Menu: {
      buildFromTemplate: vi.fn(() => ({})),
    },
    nativeImage: {
      createFromPath: vi.fn(() => ({
        setTemplateImage: vi.fn(),
      })),
    },
    screen: {
      getPrimaryDisplay: vi.fn(() => ({
        workAreaSize: { width: 1920, height: 1080 },
        scaleFactor: 1,
      })),
    },
    shell: {
      openExternal: vi.fn(),
    },
    net: {
      request: vi.fn(),
    },
  }
}
