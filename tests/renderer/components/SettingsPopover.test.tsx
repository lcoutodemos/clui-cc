// @vitest-environment jsdom

import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPopover } from '../../../src/renderer/components/SettingsPopover'
import { useNotificationStore } from '../../../src/renderer/stores/notificationStore'
import { useSessionStore } from '../../../src/renderer/stores/sessionStore'
import { useShortcutStore } from '../../../src/renderer/stores/shortcutStore'
import { useSnippetStore } from '../../../src/renderer/stores/snippetStore'
import { useThemeStore } from '../../../src/renderer/theme'
import { renderWithProviders, resetTestState, installCluiMock } from '../testUtils'

describe('SettingsPopover', () => {
  beforeEach(() => {
    resetTestState()
  })

  it('opens the popover from the settings trigger', () => {
    renderWithProviders(<SettingsPopover />)

    fireEvent.click(screen.getByTestId('settings-button'))

    expect(screen.getByText('Notification sound')).toBeInTheDocument()
    expect(screen.getByText('Permissions')).toBeInTheDocument()
  })

  it('toggles theme and notification preferences', () => {
    renderWithProviders(<SettingsPopover />)

    fireEvent.click(screen.getByTestId('settings-button'))
    fireEvent.click(screen.getByLabelText('Toggle dark theme'))
    fireEvent.click(screen.getByLabelText('Toggle desktop notifications'))

    expect(useThemeStore.getState().themeMode).toBe('light')
    expect(useNotificationStore.getState().desktopEnabled).toBe(false)
  })

  it('opens the permission editor and loads current permissions', async () => {
    installCluiMock({
      getPermissions: vi.fn().mockResolvedValue({ allow: ['Bash(gh:*)', 'Read(*)'], deny: [] }),
    })

    renderWithProviders(<SettingsPopover />)

    fireEvent.click(screen.getByTestId('settings-button'))
    fireEvent.click(screen.getByTestId('settings-permissions-button'))

    await waitFor(() => {
      expect(screen.getByTestId('permission-editor')).toBeInTheDocument()
    })
    expect(screen.getByTestId('permission-count')).toHaveTextContent('2')
  })

  it('routes shortcuts, snippets, and usage actions through their stores', () => {
    const toggleCostDashboard = vi.fn()
    useSessionStore.setState({ toggleCostDashboard, isExpanded: false })

    renderWithProviders(<SettingsPopover />)

    fireEvent.click(screen.getByTestId('settings-button'))
    fireEvent.click(screen.getByText('Keyboard Shortcuts'))
    expect(useShortcutStore.getState().settingsOpen).toBe(true)

    fireEvent.click(screen.getByTestId('settings-button'))
    fireEvent.click(screen.getByText('Snippets'))
    expect(useSnippetStore.getState().managerOpen).toBe(true)

    fireEvent.click(screen.getByTestId('settings-button'))
    fireEvent.click(screen.getByText('Usage'))
    expect(toggleCostDashboard).toHaveBeenCalledTimes(1)
  })
})
