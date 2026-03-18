// @vitest-environment jsdom

import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Toast } from '../../../src/renderer/components/Toast'
import { useNotificationStore } from '../../../src/renderer/stores/notificationStore'
import { renderWithProviders, resetTestState } from '../testUtils'

describe('Toast', () => {
  beforeEach(() => {
    resetTestState()
  })

  it('renders the toast title and optional message', () => {
    renderWithProviders(
      <Toast toast={{ id: 'toast-1', type: 'success', title: 'Saved', message: 'Everything is good', createdAt: Date.now() }} />,
    )

    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByText('Everything is good')).toBeInTheDocument()
  })

  it('removes the toast when the close button is clicked', () => {
    const removeToast = vi.fn()
    useNotificationStore.setState({ removeToast })

    const { container } = renderWithProviders(
      <Toast toast={{ id: 'toast-1', type: 'info', title: 'Heads up', createdAt: Date.now() }} />,
    )

    fireEvent.click(container.querySelector('button') as HTMLButtonElement)

    expect(removeToast).toHaveBeenCalledWith('toast-1')
  })

  it('auto-dismisses after its duration', () => {
    vi.useFakeTimers()
    const removeToast = vi.fn()
    useNotificationStore.setState({ removeToast })

    renderWithProviders(
      <Toast toast={{ id: 'toast-1', type: 'warning', title: 'Watch out', createdAt: Date.now(), duration: 1000 }} />,
    )

    vi.advanceTimersByTime(1000)

    expect(removeToast).toHaveBeenCalledWith('toast-1')
  })

  it('pauses and resumes the auto-dismiss timer on hover', () => {
    vi.useFakeTimers()
    const removeToast = vi.fn()
    useNotificationStore.setState({ removeToast })

    const { container } = renderWithProviders(
      <Toast toast={{ id: 'toast-1', type: 'error', title: 'Boom', createdAt: Date.now(), duration: 1000 }} />,
    )

    const toast = container.firstElementChild as HTMLElement
    fireEvent.mouseEnter(toast)
    vi.advanceTimersByTime(1200)
    expect(removeToast).not.toHaveBeenCalled()

    fireEvent.mouseLeave(toast)
    vi.advanceTimersByTime(1000)
    expect(removeToast).toHaveBeenCalledWith('toast-1')
  })
})
