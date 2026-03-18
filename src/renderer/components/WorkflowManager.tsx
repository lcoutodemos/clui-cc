import React, { useMemo, useState } from 'react'
import { ListChecks, Play, PencilSimple, Trash, Plus, X } from '@phosphor-icons/react'
import { useColors } from '../theme'
import { useWorkflowStore } from '../stores/workflowStore'

export function WorkflowManager() {
  const colors = useColors()
  const workflows = useWorkflowStore((s) => s.workflows)
  const activeExecution = useWorkflowStore((s) => s.activeExecution)
  const closeManager = useWorkflowStore((s) => s.closeManager)
  const openEditor = useWorkflowStore((s) => s.openEditor)
  const deleteWorkflow = useWorkflowStore((s) => s.deleteWorkflow)
  const runWorkflow = useWorkflowStore((s) => s.runWorkflow)

  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return workflows
    return workflows.filter((w) =>
      w.name.toLowerCase().includes(query)
      || w.steps.some((s) => s.prompt.toLowerCase().includes(query))
    )
  }, [search, workflows])

  const isRunning = activeExecution?.status === 'running'

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ListChecks size={20} weight="regular" style={{ color: colors.accent }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
              Workflows
            </div>
            <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
              Chain prompts into sequential workflows
            </div>
          </div>
        </div>
        <button
          onClick={closeManager}
          aria-label="Close workflows"
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ color: colors.textTertiary }}
          title="Close workflows"
        >
          <X size={15} />
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 18px 10px' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search workflows..."
          className="w-full rounded-xl px-3 py-2 text-[12px]"
          style={{
            background: colors.surfacePrimary,
            color: colors.textPrimary,
            border: `1px solid ${colors.containerBorder}`,
          }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px' }}>
        {filtered.length === 0 ? (
          <div
            className="rounded-2xl px-4 py-6 text-center"
            style={{
              background: colors.surfacePrimary,
              color: colors.textTertiary,
              border: `1px solid ${colors.containerBorder}`,
            }}
          >
            {workflows.length === 0
              ? 'No workflows yet. Create your first workflow chain.'
              : 'No workflows match your search.'}
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((workflow) => {
              const isActiveWorkflow = activeExecution?.workflowId === workflow.id && isRunning
              return (
                <div
                  key={workflow.id}
                  className="rounded-2xl p-3"
                  style={{
                    background: colors.surfacePrimary,
                    border: `1px solid ${isActiveWorkflow ? colors.accent : colors.containerBorder}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
                        {workflow.name}
                      </div>
                      <div className="text-[11px] mt-1" style={{ color: colors.textTertiary }}>
                        {workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => runWorkflow(workflow.id)}
                        disabled={isRunning}
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          color: isRunning ? colors.btnDisabled : colors.accent,
                          background: colors.accentLight,
                        }}
                        title="Run workflow"
                      >
                        <Play size={14} weight="fill" />
                      </button>
                      <button
                        onClick={() => openEditor(workflow)}
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          color: colors.textTertiary,
                          background: colors.surfaceSecondary,
                        }}
                        title="Edit workflow"
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        onClick={() => deleteWorkflow(workflow.id)}
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          color: colors.statusError,
                          background: colors.surfaceSecondary,
                        }}
                        title="Delete workflow"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                  {/* Step preview */}
                  <div className="mt-2 grid gap-1">
                    {workflow.steps.slice(0, 3).map((step, idx) => (
                      <div
                        key={step.id}
                        className="text-[10px] truncate"
                        style={{ color: colors.textSecondary }}
                      >
                        <span style={{ color: colors.textTertiary }}>{idx + 1}.</span>{' '}
                        {step.prompt}
                      </div>
                    ))}
                    {workflow.steps.length > 3 && (
                      <div className="text-[10px]" style={{ color: colors.textTertiary }}>
                        +{workflow.steps.length - 3} more step{workflow.steps.length - 3 !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create button */}
      <div style={{
        padding: '12px 18px 16px',
        borderTop: `1px solid ${colors.containerBorder}`,
      }}>
        <button
          onClick={() => openEditor()}
          className="w-full rounded-xl px-3 py-2 text-[12px] font-medium flex items-center gap-2 justify-center"
          style={{
            background: colors.accent,
            color: colors.textOnAccent,
          }}
        >
          <Plus size={14} />
          Create New Workflow
        </button>
      </div>
    </div>
  )
}
