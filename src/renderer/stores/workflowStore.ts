import { create } from 'zustand'
import { useSessionStore } from './sessionStore'

// ─── Types ───

export interface WorkflowStep {
  id: string
  prompt: string
  order: number
}

export interface Workflow {
  id: string
  name: string
  steps: WorkflowStep[]
  createdAt: number
  updatedAt: number
}

export interface WorkflowExecution {
  workflowId: string
  currentStepIndex: number
  totalSteps: number
  status: 'running' | 'completed' | 'stopped' | 'failed'
  startedAt: number
}

interface WorkflowState {
  workflows: Workflow[]
  activeExecution: WorkflowExecution | null
  managerOpen: boolean
  editorOpen: boolean
  editingWorkflow: Workflow | null

  // CRUD
  addWorkflow: (name: string, steps: Array<{ prompt: string }>) => Workflow | null
  updateWorkflow: (id: string, updates: { name?: string; steps?: Array<{ prompt: string }> }) => boolean
  deleteWorkflow: (id: string) => void

  // Execution
  runWorkflow: (workflowId: string) => void
  stopWorkflow: () => void

  // Panel
  openManager: () => void
  closeManager: () => void
  openEditor: (workflow?: Workflow) => void
  closeEditor: () => void
}

const STORAGE_KEY = 'clui-workflows'

// ─── Persistence ───

function loadWorkflows(): Workflow[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return []
      const w = entry as Partial<Workflow>
      if (typeof w.id !== 'string' || typeof w.name !== 'string' || !Array.isArray(w.steps)) {
        return []
      }
      return [{
        id: w.id,
        name: w.name.trim(),
        steps: w.steps.flatMap((s: unknown, idx: number) => {
          if (!s || typeof s !== 'object') return []
          const step = s as Partial<WorkflowStep>
          if (typeof step.prompt !== 'string') return []
          return [{
            id: typeof step.id === 'string' ? step.id : crypto.randomUUID(),
            prompt: step.prompt,
            order: typeof step.order === 'number' ? step.order : idx,
          }]
        }),
        createdAt: typeof w.createdAt === 'number' ? w.createdAt : Date.now(),
        updatedAt: typeof w.updatedAt === 'number' ? w.updatedAt : Date.now(),
      }]
    })
  } catch {
    return []
  }
}

function saveWorkflows(workflows: Workflow[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows))
  } catch {}
}

// ─── Execution engine ───

let executionAbortController: AbortController | null = null

function waitForTabCompletion(signal: AbortSignal): Promise<'completed' | 'failed' | 'dead'> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Workflow stopped'))
      return
    }

    const onAbort = () => {
      unsub()
      reject(new Error('Workflow stopped'))
    }
    signal.addEventListener('abort', onAbort, { once: true })

    const unsub = useSessionStore.subscribe((state, prevState) => {
      const activeTabId = state.activeTabId
      const tab = state.tabs.find((t) => t.id === activeTabId)
      const prevTab = prevState.tabs.find((t) => t.id === activeTabId)

      if (!tab || !prevTab) return

      // Detect transition from running/connecting to a terminal state
      const wasActive = prevTab.status === 'running' || prevTab.status === 'connecting'
      if (!wasActive) return

      if (tab.status === 'completed' || tab.status === 'idle') {
        unsub()
        signal.removeEventListener('abort', onAbort)
        resolve('completed')
      } else if (tab.status === 'failed') {
        unsub()
        signal.removeEventListener('abort', onAbort)
        resolve('failed')
      } else if (tab.status === 'dead') {
        unsub()
        signal.removeEventListener('abort', onAbort)
        resolve('dead')
      }
    })
  })
}

async function executeWorkflow(workflow: Workflow): Promise<void> {
  const abortController = new AbortController()
  executionAbortController = abortController
  const signal = abortController.signal

  const sortedSteps = [...workflow.steps].sort((a, b) => a.order - b.order)

  useWorkflowStore.setState({
    activeExecution: {
      workflowId: workflow.id,
      currentStepIndex: 0,
      totalSteps: sortedSteps.length,
      status: 'running',
      startedAt: Date.now(),
    },
  })

  for (let i = 0; i < sortedSteps.length; i++) {
    if (signal.aborted) break

    useWorkflowStore.setState((s) => ({
      activeExecution: s.activeExecution
        ? { ...s.activeExecution, currentStepIndex: i }
        : null,
    }))

    const step = sortedSteps[i]
    useSessionStore.getState().sendMessage(step.prompt)

    try {
      const result = await waitForTabCompletion(signal)
      if (result === 'failed' || result === 'dead') {
        useWorkflowStore.setState((s) => ({
          activeExecution: s.activeExecution
            ? { ...s.activeExecution, status: 'failed' }
            : null,
        }))
        executionAbortController = null
        return
      }
    } catch {
      // Aborted (stopped by user)
      useWorkflowStore.setState((s) => ({
        activeExecution: s.activeExecution
          ? { ...s.activeExecution, status: 'stopped' }
          : null,
      }))
      executionAbortController = null
      return
    }
  }

  useWorkflowStore.setState((s) => ({
    activeExecution: s.activeExecution
      ? { ...s.activeExecution, status: 'completed' }
      : null,
  }))
  executionAbortController = null
}

// ─── Store ───

const initialWorkflows = loadWorkflows()

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: initialWorkflows,
  activeExecution: null,
  managerOpen: false,
  editorOpen: false,
  editingWorkflow: null,

  addWorkflow: (name, steps) => {
    const trimmedName = name.trim()
    if (!trimmedName || steps.length === 0) return null
    if (steps.some((s) => !s.prompt.trim())) return null

    const workflow: Workflow = {
      id: crypto.randomUUID(),
      name: trimmedName,
      steps: steps.map((s, idx) => ({
        id: crypto.randomUUID(),
        prompt: s.prompt.trim(),
        order: idx,
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const workflows = [...get().workflows, workflow].sort((a, b) => b.updatedAt - a.updatedAt)
    saveWorkflows(workflows)
    set({ workflows })
    return workflow
  },

  updateWorkflow: (id, updates) => {
    const current = get().workflows.find((w) => w.id === id)
    if (!current) return false

    const nextName = (updates.name ?? current.name).trim()
    if (!nextName) return false

    let nextSteps = current.steps
    if (updates.steps) {
      if (updates.steps.length === 0) return false
      if (updates.steps.some((s) => !s.prompt.trim())) return false
      nextSteps = updates.steps.map((s, idx) => ({
        id: crypto.randomUUID(),
        prompt: s.prompt.trim(),
        order: idx,
      }))
    }

    const workflows = get().workflows
      .map((w) => w.id === id ? {
        ...w,
        name: nextName,
        steps: nextSteps,
        updatedAt: Date.now(),
      } : w)
      .sort((a, b) => b.updatedAt - a.updatedAt)

    saveWorkflows(workflows)
    set({ workflows })
    return true
  },

  deleteWorkflow: (id) => {
    const workflows = get().workflows.filter((w) => w.id !== id)
    saveWorkflows(workflows)
    set({ workflows })
  },

  runWorkflow: (workflowId) => {
    const workflow = get().workflows.find((w) => w.id === workflowId)
    if (!workflow || workflow.steps.length === 0) return
    if (get().activeExecution?.status === 'running') return

    void executeWorkflow(workflow)
  },

  stopWorkflow: () => {
    if (executionAbortController) {
      executionAbortController.abort()
      executionAbortController = null
    }
  },

  openManager: () => set({ managerOpen: true }),
  closeManager: () => set({ managerOpen: false }),
  openEditor: (workflow) => set({
    editorOpen: true,
    editingWorkflow: workflow ?? null,
  }),
  closeEditor: () => set({
    editorOpen: false,
    editingWorkflow: null,
  }),
}))
