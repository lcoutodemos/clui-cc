// @vitest-environment jsdom

import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandPalette } from '../../../src/renderer/components/CommandPalette'
import { useCommandPaletteStore } from '../../../src/renderer/stores/commandPaletteStore'
import { useSessionStore } from '../../../src/renderer/stores/sessionStore'
import { renderWithProviders, resetTestState, makeTab } from '../testUtils'

describe('CommandPalette', () => {
  beforeEach(() => {
    resetTestState()
    useCommandPaletteStore.setState({ isOpen: true, searchQuery: '', selectedIndex: 0, recentCommandIds: [] })
    useSessionStore.setState({
      tabs: [makeTab({ id: 'tab-1', title: 'Chat' })],
      tabOrder: ['tab-1'],
      activeTabId: 'tab-1',
    })
  })

  it('renders the palette and search input when opened', () => {
    renderWithProviders(<CommandPalette />)

    expect(screen.getByPlaceholderText('Search commands...')).toBeInTheDocument()
    expect(screen.getByText('Marketplace')).toBeInTheDocument()
  })

  it('filters commands from the search box', () => {
    renderWithProviders(<CommandPalette />)

    fireEvent.change(screen.getByPlaceholderText('Search commands...'), { target: { value: 'market' } })

    expect(screen.getByText('Marketplace')).toBeInTheDocument()
    expect(screen.queryByText('New Tab')).not.toBeInTheDocument()
  })

  it('executes a command and closes the palette', () => {
    const toggleMarketplace = vi.fn()
    useSessionStore.setState({ toggleMarketplace })

    renderWithProviders(<CommandPalette />)

    fireEvent.change(screen.getByPlaceholderText('Search commands...'), { target: { value: 'market' } })
    fireEvent.click(screen.getByText('Marketplace'))

    expect(toggleMarketplace).toHaveBeenCalledTimes(1)
    expect(useCommandPaletteStore.getState().isOpen).toBe(false)
  })

  it('closes on Escape', () => {
    renderWithProviders(<CommandPalette />)

    fireEvent.keyDown(screen.getByPlaceholderText('Search commands...'), { key: 'Escape' })

    expect(useCommandPaletteStore.getState().isOpen).toBe(false)
  })
})
