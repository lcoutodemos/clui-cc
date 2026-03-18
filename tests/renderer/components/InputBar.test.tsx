// @vitest-environment jsdom

import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InputBar } from '../../../src/renderer/components/InputBar'
import { useSessionStore } from '../../../src/renderer/stores/sessionStore'
import { renderWithProviders, resetTestState, makeTab } from '../testUtils'

describe('InputBar', () => {
  beforeEach(() => {
    resetTestState()
    useSessionStore.setState({
      tabs: [makeTab({ id: 'tab-1', title: 'Chat' })],
      activeTabId: 'tab-1',
      staticInfo: {
        version: '1.0.0',
        email: 'user@example.com',
        subscriptionType: 'pro',
        projectPath: 'C:/repo',
        homePath: 'C:/Users/test',
      },
    })
  })

  it('renders the composer for the active tab', () => {
    renderWithProviders(<InputBar />)

    expect(screen.getByTestId('composer')).toBeInTheDocument()
    expect(screen.getByTestId('composer-input')).toBeInTheDocument()
  })

  it('shows slash command suggestions while typing a command', () => {
    renderWithProviders(<InputBar />)

    fireEvent.change(screen.getByTestId('composer-input'), { target: { value: '/cl' } })

    expect(screen.getByText('/clear')).toBeInTheDocument()
  })

  it('sends the prompt through the session store', () => {
    const sendMessage = vi.fn()
    useSessionStore.setState({ sendMessage })

    renderWithProviders(<InputBar />)

    fireEvent.change(screen.getByTestId('composer-input'), { target: { value: 'Ship it' } })
    fireEvent.click(screen.getByTestId('composer-send'))

    expect(sendMessage).toHaveBeenCalledWith('Ship it')
  })

  it('handles the /model command and updates the preferred model', () => {
    const addSystemMessage = vi.fn()
    const setPreferredModel = vi.fn()
    useSessionStore.setState({ addSystemMessage, setPreferredModel })

    renderWithProviders(<InputBar />)

    fireEvent.change(screen.getByTestId('composer-input'), { target: { value: '/model sonnet' } })
    fireEvent.keyDown(screen.getByTestId('composer-input'), { key: 'Enter' })

    expect(setPreferredModel).toHaveBeenCalledWith('claude-sonnet-4-6')
    expect(addSystemMessage).toHaveBeenCalledWith(expect.stringContaining('Model switched to Sonnet 4.6'))
  })
})
