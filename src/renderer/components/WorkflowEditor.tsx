import React, { useState, useEffect } from 'react'
import { Plus, X, ArrowUp, ArrowDown } from '@phosphor-icons/react'
import { useColors } from '../theme'
import { useWorkflowStore } from '../stores/workflowStore'

interface StepDraft {
  id: string
  prompt: string
}

export function WorkflowEditor() {
  const colors = useColors()
  const editingWorkflow = useWorkflowStore((s) => s.editingWorkflow)
  const addWorkflow = useWorkflowStore((s) => s.addWorkflow)
  const updateWorkflow = useWorkflowStore((s) => s.updateWorkflow)
  const closeEditor = useWorkflowStore((s) => s.closeEditor)

  const [name, setName] = useState('')
  const [steps, setSteps] = useState<StepDraft[]>([{ id: crypto.randomUUID(), prompt: '' }])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editingWorkflow) {
      setName(editingWorkflow.name)
      const sorted = [...editingWorkflow.steps].sort((a, b) => a.order - b.order)
      setSteps(sorted.map((s) => ({ id: s.id, prompt: s.prompt })))
    } else {
      setName('')
      setSteps([{ id: crypto.randomUUID(), prompt: '' }])
    }
    setError(null)
  }, [editingWorkflow])

  const addStep = () => {
    setSteps((prev) => [...prev, { id: crypto.randomUUID(), prompt: '' }])
  }

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id))
  }

  const updateStep = (id: string, prompt: string) => {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, prompt } : s))
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    setSteps((prev) => {
      const next = [...prev]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= next.length) return prev
      const temp = next[index]
      next[index] = next[targetIndex]
      next[targetIndex] = temp
      return next
    })
  }

  const handleSave = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Workflow name is required.')
      return
    }
    if (steps.length === 0) {
      setError('At least one step is required.')
      return
    }
    if (steps.some((s) => !s.prompt.trim())) {
      setError('All steps must have a non-empty prompt.')
      return
    }

    if (editingWorkflow) {
      const ok = updateWorkflow(editingWorkflow.id, {
        name: trimmedName,
        steps: steps.map((s) => ({ prompt: s.prompt })),
      })
      if (!ok) {
        setError('Failed to update workflow.')
        return
      }
    } else {
      const created = addWorkflow(trimmedName, steps.map((s) => ({ prompt: s.prompt })))
      if (!created) {
        setError('Failed to create workflow. Ensure name and steps are valid.')
        return
      }
    }

    closeEditor()
  }

  return (
    <div
      data-clui-ui
      style={{
        height: 470,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 18px 10px',
        borderBottom: `1px solid ${colors.containerBorder}`,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
          {editingWorkflow ? 'Edit Workflow' : 'New Workflow'}
        </div>
        <button
          onClick={closeEditor}
          aria-label="Close editor"
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ color: colors.textTertiary }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Name input */}
      <div style={{ padding: '12px 18px 0' }}>
        <label className="text-[11px] font-medium" style={{ color: colors.textSecondary }}>
          Workflow Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Code Review Pipeline"
          className="w-full rounded-xl px-3 py-2 text-[12px] mt-1"
          style={{
            background: colors.surfacePrimary,
            color: colors.textPrimary,
            border: `1px solid ${colors.containerBorder}`,
          }}
        />
      </div>

      {/* Steps */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
        <div className="text-[11px] font-medium mb-2" style={{ color: colors.textSecondary }}>
          Steps ({steps.length})
        </div>
        <div className="grid gap-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex items-start gap-2"
            >
              <div
                className="flex flex-col items-center gap-0.5 pt-2"
                style={{ minWidth: 20 }}
              >
                <button
                  onClick={() => moveStep(index, 'up')}
                  disabled={index === 0}
                  className="w-5 h-5 rounded flex items-center justify-center"
                  style={{
                    color: index === 0 ? colors.btnDisabled : colors.textTertiary,
                    background: 'transparent',
                  }}
                  title="Move up"
                >
                  <ArrowUp size={11} weight="bold" />
                </button>
                <span className="text-[10px] font-mono" style={{ color: colors.textTertiary }}>
                  {index + 1}
                </span>
                <button
                  onClick={() => moveStep(index, 'down')}
                  disabled={index === steps.length - 1}
                  className="w-5 h-5 rounded flex items-center justify-center"
                  style={{
                    color: index === steps.length - 1 ? colors.btnDisabled : colors.textTertiary,
                    background: 'transparent',
                  }}
                  title="Move down"
                >
                  <ArrowDown size={11} weight="bold" />
                </button>
              </div>
              <textarea
                value={step.prompt}
                onChange={(e) => updateStep(step.id, e.target.value)}
                placeholder={`Step ${index + 1} prompt...`}
                className="flex-1 rounded-xl px-3 py-2 text-[12px] resize-none"
                rows={2}
                style={{
                  background: colors.surfacePrimary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.containerBorder}`,
                }}
              />
              <button
                onClick={() => removeStep(step.id)}
                disabled={steps.length <= 1}
                className="w-6 h-6 rounded-full flex items-center justify-center mt-2"
                style={{
                  color: steps.length <= 1 ? colors.btnDisabled : colors.statusError,
                  background: 'transparent',
                }}
                title="Remove step"
              >
                <X size={12} weight="bold" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addStep}
          className="w-full rounded-xl px-3 py-2 text-[12px] font-medium flex items-center gap-2 justify-center mt-3"
          style={{
            background: colors.accentLight,
            color: colors.accent,
            border: `1px dashed ${colors.accentBorderMedium}`,
          }}
        >
          <Plus size={14} />
          Add Step
        </button>
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 18px 16px',
        borderTop: `1px solid ${colors.containerBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{ flex: 1 }}>
          {error && (
            <div className="text-[11px]" style={{ color: colors.statusError }}>
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={closeEditor}
            className="rounded-xl px-4 py-2 text-[12px]"
            style={{
              color: colors.textSecondary,
              background: colors.surfaceSecondary,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl px-4 py-2 text-[12px] font-medium"
            style={{
              background: colors.accent,
              color: colors.textOnAccent,
            }}
          >
            {editingWorkflow ? 'Save Changes' : 'Create Workflow'}
          </button>
        </div>
      </div>
    </div>
  )
}
