// @vitest-environment jsdom

import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TabStrip } from '../../../src/renderer/components/TabStrip'
import { useSessionStore } from '../../../src/renderer/stores/sessionStore'
import { useTabGroupStore } from '../../../src/renderer/stores/tabGroupStore'
import { renderWithProviders, resetTestState, makeTab } from '../testUtils'

describe('TabStrip', () => {
  beforeEach(() => {
    resetTestState()
  })

  it('renders the current tabs and marks the active one', () => {
    useSessionStore.setState({
      tabs: [
        makeTab({ id: 'tab-1', title: 'Alpha' }),
        makeTab({ id: 'tab-2', title: 'Beta' }),
      ],
      tabOrder: ['tab-1', 'tab-2'],
      activeTabId: 'tab-1',
    })

    renderWithProviders(<TabStrip />)

    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Alpha')
    expect(screen.getByRole('tab', { selected: false })).toHaveTextContent('Beta')
  })

  it('selects another tab when it is clicked', () => {
    const selectTab = vi.fn()
    useSessionStore.setState({
      selectTab,
      tabs: [
        makeTab({ id: 'tab-1', title: 'Alpha' }),
        makeTab({ id: 'tab-2', title: 'Beta' }),
      ],
      tabOrder: ['tab-1', 'tab-2'],
      activeTabId: 'tab-1',
    })

    renderWithProviders(<TabStrip />)

    fireEvent.click(screen.getByRole('tab', { selected: false }))

    expect(selectTab).toHaveBeenCalledWith('tab-2')
  })

  it('creates a new tab from the plus button', () => {
    const createTab = vi.fn()
    useSessionStore.setState({
      createTab,
      tabs: [makeTab({ id: 'tab-1', title: 'Solo' })],
      tabOrder: ['tab-1'],
      activeTabId: 'tab-1',
    })

    renderWithProviders(<TabStrip />)

    fireEvent.click(screen.getByTestId('tab-new-button'))

    expect(createTab).toHaveBeenCalledTimes(1)
  })

  it('renders tab groups before grouped tabs', () => {
    useTabGroupStore.setState({
      groups: [{ id: 'group-1', name: 'Backend', collapsed: false, order: 0, color: 'blue' }],
    })
    useSessionStore.setState({
      tabs: [
        makeTab({ id: 'tab-1', title: 'Alpha', groupId: 'group-1' }),
        makeTab({ id: 'tab-2', title: 'Beta' }),
      ],
      tabOrder: ['tab-1', 'tab-2'],
      activeTabId: 'tab-1',
    })

    renderWithProviders(<TabStrip />)

    expect(screen.getByText('Backend')).toBeInTheDocument()
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Alpha')
  })
})
