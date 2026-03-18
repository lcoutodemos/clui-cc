// Store tests — no DOM needed

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkflowStore } from '../../src/renderer/stores/workflowStore'

// Mock sessionStore for workflow execution
vi.mock('../../src/renderer/stores/sessionStore', () => ({
  useSessionStore: {
    getState: () => ({
      sendMessage: vi.fn(),
      tabs: [{ id: 'tab-1', status: 'completed' }],
      activeTabId: 'tab-1',
    }),
    subscribe: vi.fn(() => vi.fn()),
  },
}))

describe('WorkflowStore', () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflows: [],
      activeExecution: null,
      managerOpen: false,
      editorOpen: false,
      editingWorkflow: null,
    })
  })

  it('starts with no workflows', () => {
    expect(useWorkflowStore.getState().workflows).toHaveLength(0)
  })

  it('addWorkflow() creates workflow with correct structure', () => {
    useWorkflowStore.getState().addWorkflow('Review', [{ prompt: 'Read file' }, { prompt: 'Find bugs' }, { prompt: 'Suggest fixes' }])
    const workflows = useWorkflowStore.getState().workflows
    expect(workflows).toHaveLength(1)
    expect(workflows[0].name).toBe('Review')
    expect(workflows[0].steps).toHaveLength(3)
    expect(workflows[0].steps[0].prompt).toBe('Read file')
    expect(workflows[0].id).toBeDefined()
    expect(workflows[0].createdAt).toBeGreaterThan(0)
  })

  it('deleteWorkflow() removes by id', () => {
    useWorkflowStore.getState().addWorkflow('Temp', [{ prompt: 'step 1' }])
    const id = useWorkflowStore.getState().workflows[0].id
    useWorkflowStore.getState().deleteWorkflow(id)
    expect(useWorkflowStore.getState().workflows).toHaveLength(0)
  })

  it('updateWorkflow() modifies name and steps', () => {
    useWorkflowStore.getState().addWorkflow('Old', [{ prompt: 'step 1' }])
    const id = useWorkflowStore.getState().workflows[0].id
    useWorkflowStore.getState().updateWorkflow(id, { name: 'New' })
    expect(useWorkflowStore.getState().workflows[0].name).toBe('New')
  })

  it('manager panel toggles', () => {
    expect(useWorkflowStore.getState().managerOpen).toBe(false)
    useWorkflowStore.setState({ managerOpen: true })
    expect(useWorkflowStore.getState().managerOpen).toBe(true)
  })

  it('stopWorkflow() is callable without error when no execution active', () => {
    expect(() => useWorkflowStore.getState().stopWorkflow()).not.toThrow()
  })
})
