// @vitest-environment jsdom

import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkflowManager } from '../../../src/renderer/components/WorkflowManager'
import { useWorkflowStore } from '../../../src/renderer/stores/workflowStore'
import { renderWithProviders, resetTestState, makeWorkflow } from '../testUtils'

describe('WorkflowManager', () => {
  beforeEach(() => {
    resetTestState()
  })

  it('shows the empty state when no workflows exist', () => {
    renderWithProviders(<WorkflowManager />)

    expect(screen.getByText('No workflows yet. Create your first workflow chain.')).toBeInTheDocument()
  })

  it('filters workflows by search query', () => {
    useWorkflowStore.setState({
      workflows: [
        makeWorkflow({ id: 'wf-1', name: 'Deploy app' }),
        makeWorkflow({ id: 'wf-2', name: 'Write release notes' }),
      ],
    })

    renderWithProviders(<WorkflowManager />)

    fireEvent.change(screen.getByPlaceholderText('Search workflows...'), { target: { value: 'deploy' } })

    expect(screen.getByText('Deploy app')).toBeInTheDocument()
    expect(screen.queryByText('Write release notes')).not.toBeInTheDocument()
  })

  it('routes run, edit, delete, and create actions through the store', () => {
    const runWorkflow = vi.fn()
    const openEditor = vi.fn()
    const deleteWorkflow = vi.fn()
    useWorkflowStore.setState({
      workflows: [makeWorkflow({ id: 'wf-1', name: 'Deploy app' })],
      runWorkflow,
      openEditor,
      deleteWorkflow,
    })

    renderWithProviders(<WorkflowManager />)

    fireEvent.click(screen.getByTitle('Run workflow'))
    fireEvent.click(screen.getByTitle('Edit workflow'))
    fireEvent.click(screen.getByTitle('Delete workflow'))
    fireEvent.click(screen.getByText('Create New Workflow'))

    expect(runWorkflow).toHaveBeenCalledWith('wf-1')
    expect(openEditor).toHaveBeenCalledTimes(2)
    expect(deleteWorkflow).toHaveBeenCalledWith('wf-1')
  })

  it('disables workflow execution controls while another workflow is running', () => {
    useWorkflowStore.setState({
      workflows: [makeWorkflow({ id: 'wf-1', name: 'Deploy app' })],
      activeExecution: {
        workflowId: 'wf-1',
        currentStepIndex: 0,
        totalSteps: 2,
        status: 'running',
        startedAt: Date.now(),
      },
    })

    renderWithProviders(<WorkflowManager />)

    expect(screen.getByTitle('Run workflow')).toBeDisabled()
  })
})
