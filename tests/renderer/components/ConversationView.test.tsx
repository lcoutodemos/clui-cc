// @vitest-environment jsdom

import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConversationView } from '../../../src/renderer/components/ConversationView'
import { useSessionStore } from '../../../src/renderer/stores/sessionStore'
import { renderWithProviders, resetTestState, makeMessage, makeTab } from '../testUtils'

describe('ConversationView', () => {
  beforeEach(() => {
    resetTestState()
  })

  it('renders user and assistant messages for the active tab', () => {
    useSessionStore.setState({
      tabs: [
        makeTab({
          id: 'tab-1',
          messages: [
            makeMessage({ id: 'user-1', role: 'user', content: 'Hello' }),
            makeMessage({ id: 'assistant-1', role: 'assistant', content: 'Hi there' }),
          ],
        }),
      ],
      activeTabId: 'tab-1',
    })

    renderWithProviders(<ConversationView />)

    expect(screen.getByTestId('message-user')).toHaveTextContent('Hello')
    expect(screen.getByTestId('message-assistant')).toHaveTextContent('Hi there')
  })

  it('offers to load older messages when the render cap is exceeded', () => {
    const messages = Array.from({ length: 120 }, (_, index) =>
      makeMessage({
        id: `msg-${index}`,
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${index}`,
      }),
    )

    useSessionStore.setState({
      tabs: [makeTab({ id: 'tab-1', messages })],
      activeTabId: 'tab-1',
    })

    renderWithProviders(<ConversationView />)

    expect(screen.getByText(/Load 20 older messages/)).toBeInTheDocument()
  })

  it('retries the last user prompt after a failed run', () => {
    const sendMessage = vi.fn()
    useSessionStore.setState({
      sendMessage,
      tabs: [
        makeTab({
          id: 'tab-1',
          status: 'failed',
          messages: [
            makeMessage({ id: 'user-1', role: 'user', content: 'Retry me' }),
            makeMessage({ id: 'system-1', role: 'system', content: 'Failure' }),
          ],
        }),
      ],
      activeTabId: 'tab-1',
    })

    renderWithProviders(<ConversationView />)

    fireEvent.click(screen.getByText('Retry'))

    expect(sendMessage).toHaveBeenCalledWith('Retry me')
  })

  it('renders queued prompts below the conversation timeline', () => {
    useSessionStore.setState({
      tabs: [
        makeTab({
          id: 'tab-1',
          messages: [makeMessage({ id: 'user-1', role: 'user', content: 'Working' })],
          queuedPrompts: ['Follow-up task'],
        }),
      ],
      activeTabId: 'tab-1',
    })

    renderWithProviders(<ConversationView />)

    expect(screen.getByText('Follow-up task')).toBeInTheDocument()
  })
})
