// @vitest-environment jsdom

import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CostDashboard } from '../../../src/renderer/components/CostDashboard'
import { renderWithProviders, resetTestState, installCluiMock, makeCostSummary } from '../testUtils'

describe('CostDashboard', () => {
  beforeEach(() => {
    resetTestState()
  })

  it('loads and renders summary data from the backend', async () => {
    installCluiMock({
      getCostSummary: vi.fn().mockResolvedValue(makeCostSummary({
        totalCostUsd: 1.234,
        totalDurationMs: 120000,
        totalInputTokens: 1200,
        totalOutputTokens: 300,
        runCount: 3,
        byDay: [{ date: '2026-03-18', costUsd: 1.234, runs: 3 }],
        byModel: { 'claude-sonnet-4-6': { costUsd: 1.234, runs: 3 } },
        byProject: { 'C:/Users/test/repo/app': { costUsd: 1.234, runs: 3 } },
      })),
    })

    renderWithProviders(<CostDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Total Cost')).toBeInTheDocument()
    })

    expect(screen.getByText('$1.23')).toBeInTheDocument()
    expect(screen.getByText('repo/app')).toBeInTheDocument()
  })

  it('shows the empty state when no usage data exists', async () => {
    installCluiMock({
      getCostSummary: vi.fn().mockResolvedValue(makeCostSummary()),
    })

    renderWithProviders(<CostDashboard />)

    await waitFor(() => {
      expect(screen.getByText('No usage data yet')).toBeInTheDocument()
    })
  })

  it('reloads data when the time range changes', async () => {
    const getCostSummary = vi.fn().mockResolvedValue(makeCostSummary())
    installCluiMock({ getCostSummary })

    renderWithProviders(<CostDashboard />)

    await waitFor(() => {
      expect(getCostSummary).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByText('All Time'))

    await waitFor(() => {
      expect(getCostSummary).toHaveBeenCalledTimes(2)
    })
    expect(getCostSummary.mock.calls[1][0]).toBeUndefined()
  })

  it('renders the by-model breakdown when model data exists', async () => {
    installCluiMock({
      getCostSummary: vi.fn().mockResolvedValue(makeCostSummary({
        totalCostUsd: 0.25,
        runCount: 1,
        byModel: {
          'claude-haiku-4-5-20251001': { costUsd: 0.25, runs: 1 },
        },
      })),
    })

    renderWithProviders(<CostDashboard />)

    await waitFor(() => {
      expect(screen.getByText('By Model')).toBeInTheDocument()
    })
    expect(screen.getByText('claude-haiku-4-5-20251001')).toBeInTheDocument()
  })
})
