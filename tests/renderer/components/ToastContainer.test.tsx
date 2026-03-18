// @vitest-environment jsdom

import React from 'react'
import { screen } from '@testing-library/react'
import { act } from 'react-dom/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { ToastContainer } from '../../../src/renderer/components/ToastContainer'
import { useNotificationStore } from '../../../src/renderer/stores/notificationStore'
import { renderWithProviders, resetTestState } from '../testUtils'

describe('ToastContainer', () => {
  beforeEach(() => {
    resetTestState()
  })

  it('renders all active toasts into the popover layer', () => {
    useNotificationStore.setState({
      toasts: [
        { id: 'toast-1', type: 'success', title: 'Saved', createdAt: Date.now() },
        { id: 'toast-2', type: 'info', title: 'Synced', createdAt: Date.now() },
      ],
    })

    renderWithProviders(<ToastContainer />)

    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByText('Synced')).toBeInTheDocument()
  })

  it('updates when the notification store changes', () => {
    useNotificationStore.setState({
      toasts: [{ id: 'toast-1', type: 'success', title: 'Saved', createdAt: Date.now() }],
    })

    renderWithProviders(<ToastContainer />)
    expect(screen.getByText('Saved')).toBeInTheDocument()

    act(() => {
      useNotificationStore.setState({ toasts: [] })
    })

    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('renders nothing when there are no toasts to show', () => {
    renderWithProviders(<ToastContainer />)

    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })
})
