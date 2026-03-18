// @vitest-environment jsdom

import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DiffViewer } from '../../../src/renderer/components/DiffViewer'
import { renderWithProviders, resetTestState } from '../testUtils'

describe('DiffViewer', () => {
  it('renders nothing when both versions are identical', () => {
    resetTestState()
    const { container } = renderWithProviders(
      <DiffViewer filePath="src/app.ts" oldString="same" newString="same" />,
    )

    expect(container.querySelector('button')).toBeNull()
    expect(container).not.toHaveTextContent('app.ts')
  })

  it('shows diff summary counts for a small diff', () => {
    resetTestState()
    renderWithProviders(
      <DiffViewer filePath="src/app.ts" oldString={'one\ntwo'} newString={'one\nthree'} defaultCollapsed={false} />,
    )

    expect(screen.getByText('+1')).toBeInTheDocument()
    expect(screen.getByText('-1')).toBeInTheDocument()
    expect(screen.getByText('app.ts')).toBeInTheDocument()
  })

  it('starts collapsed for large diffs and expands on click', () => {
    resetTestState()
    const oldString = Array.from({ length: 60 }, (_, index) => `line-${index}`).join('\n')
    const newString = Array.from({ length: 60 }, (_, index) => `changed-${index}`).join('\n')

    renderWithProviders(
      <DiffViewer filePath="src/large.ts" oldString={oldString} newString={newString} />,
    )

    expect(screen.getByText(/Show \d+ lines changed/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /large\.ts/i }))

    expect(screen.getByText('lines changed')).toBeInTheDocument()
  })

  it('honors defaultCollapsed when explicitly provided', () => {
    resetTestState()
    renderWithProviders(
      <DiffViewer filePath="src/app.ts" oldString={'a\nb'} newString={'a\nc'} defaultCollapsed={false} />,
    )

    expect(screen.queryByText(/Show \d+ lines changed/)).not.toBeInTheDocument()
    expect(screen.getByText('lines changed')).toBeInTheDocument()
  })
})
