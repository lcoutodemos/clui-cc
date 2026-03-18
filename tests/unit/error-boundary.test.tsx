// @vitest-environment jsdom

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import * as ErrorBoundaryModule from '../../src/renderer/components/ErrorBoundary'
import { getColors, useThemeStore } from '../../src/renderer/theme'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { ErrorBoundary } = ErrorBoundaryModule

class CrashOnRender extends React.Component<{ message?: string }> {
  render() {
    throw new Error(this.props.message ?? 'Renderer exploded')
  }
}

function hexToRgb(hex: string): string {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgb(${r}, ${g}, ${b})`
}

describe('ErrorBoundary', () => {
  let container: HTMLDivElement
  let root: Root
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  const clipboardWriteText = vi.fn<() => Promise<void>>()
  const openExternal = vi.fn<(url: string) => Promise<boolean>>()
  const reloadApplication = vi.fn()

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteText },
    })

    vi.spyOn(ErrorBoundaryModule.errorBoundaryActions, 'reloadApplication').mockImplementation(reloadApplication)
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    window.clui = { openExternal } as typeof window.clui
    useThemeStore.getState().setThemeMode('dark')
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    clipboardWriteText.mockReset()
    openExternal.mockReset()
    reloadApplication.mockReset()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function render(ui: React.ReactNode) {
    await act(async () => {
      root.render(ui)
    })
  }

  it('renders children when no component fails', async () => {
    await render(
      <ErrorBoundary>
        <div>safe child</div>
      </ErrorBoundary>,
    )

    expect(container.textContent).toContain('safe child')
    expect(container.textContent).not.toContain('Something went wrong')
  })

  it('shows the fallback UI, logs the error, and respects the current theme', async () => {
    useThemeStore.getState().setThemeMode('light')

    await render(
      <ErrorBoundary>
        <CrashOnRender message={'Cannot read property foo\nsecond line'} />
      </ErrorBoundary>,
    )

    expect(container.textContent).toContain('Something went wrong')
    expect(container.textContent).toContain('A component failed to render. Your session data is safe.')
    expect(container.textContent).toContain('Cannot read property foo')

    const card = container.querySelector('[data-testid="error-boundary-card"]') as HTMLDivElement | null
    expect(card).not.toBeNull()
    expect(card?.style.backgroundColor).toBe(hexToRgb(getColors(false).containerBg))

    const boundaryCall = consoleErrorSpy.mock.calls.find((call) => call[0] === '[ErrorBoundary]')
    expect(boundaryCall).toBeDefined()
    expect(String(boundaryCall?.[2] ?? '')).toContain('CrashOnRender')
  })

  it('copies full diagnostics and shows temporary copied feedback', async () => {
    vi.useFakeTimers()
    clipboardWriteText.mockResolvedValue(undefined)

    await render(
      <ErrorBoundary>
        <CrashOnRender message="Copy me" />
      </ErrorBoundary>,
    )

    const copyButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Copy Error')
    expect(copyButton).toBeDefined()

    await act(async () => {
      copyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(clipboardWriteText).toHaveBeenCalledTimes(1)
    expect(String(clipboardWriteText.mock.calls[0]?.[0] ?? '')).toContain('Copy me')
    expect(copyButton?.textContent).toBe('Copied')

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(copyButton?.textContent).toBe('Copy Error')
  })

  it('reloads the app and opens the bug-report URL from the fallback actions', async () => {
    openExternal.mockResolvedValue(true)

    await render(
      <ErrorBoundary>
        <CrashOnRender message="Need recovery" />
      </ErrorBoundary>,
    )

    const reloadButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Reload App')
    const reportButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Report Bug')

    expect(reloadButton).toBeDefined()
    expect(reportButton).toBeDefined()

    await act(async () => {
      reloadButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      reportButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(reloadApplication).toHaveBeenCalledTimes(1)
    expect(openExternal).toHaveBeenCalledWith('https://github.com/lfrmonteiro99/clui-cc-windows/issues/new')
  })
})
