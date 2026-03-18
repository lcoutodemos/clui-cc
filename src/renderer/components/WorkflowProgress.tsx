import React from 'react'
import { Stop } from '@phosphor-icons/react'
import { useColors } from '../theme'
import { useWorkflowStore } from '../stores/workflowStore'

export function WorkflowProgress() {
  const colors = useColors()
  const activeExecution = useWorkflowStore((s) => s.activeExecution)
  const workflows = useWorkflowStore((s) => s.workflows)
  const stopWorkflow = useWorkflowStore((s) => s.stopWorkflow)

  if (!activeExecution) return null

  const workflow = workflows.find((w) => w.id === activeExecution.workflowId)
  if (!workflow) return null

  const sortedSteps = [...workflow.steps].sort((a, b) => a.order - b.order)
  const currentStep = sortedSteps[activeExecution.currentStepIndex]
  const progress = activeExecution.totalSteps > 0
    ? ((activeExecution.currentStepIndex + (activeExecution.status === 'completed' ? 1 : 0)) / activeExecution.totalSteps) * 100
    : 0

  const isTerminal = activeExecution.status !== 'running'
  const statusLabel = isTerminal ? activeExecution.status : 'running'

  return (
    <div
      data-clui-ui
      style={{
        padding: '8px 14px',
        borderBottom: `1px solid ${colors.containerBorder}`,
        background: colors.accentLight,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium truncate" style={{ color: colors.textPrimary }}>
            Workflow: {workflow.name} — Step {activeExecution.currentStepIndex + 1}/{activeExecution.totalSteps}
            {currentStep && (
              <span style={{ color: colors.textTertiary }}>
                : {currentStep.prompt.length > 60 ? currentStep.prompt.substring(0, 57) + '...' : currentStep.prompt}
              </span>
            )}
          </div>
        </div>
        {!isTerminal && (
          <button
            onClick={stopWorkflow}
            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background: colors.stopBg,
              color: colors.textOnAccent,
            }}
            title="Stop workflow"
          >
            <Stop size={12} weight="fill" />
          </button>
        )}
        {isTerminal && (
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
            style={{
              background: statusLabel === 'completed' ? colors.statusCompleteBg : colors.statusErrorBg,
              color: statusLabel === 'completed' ? colors.statusComplete : colors.statusError,
            }}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div
        className="mt-1.5 rounded-full overflow-hidden"
        style={{
          height: 3,
          background: colors.surfacePrimary,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, progress)}%`,
            background: colors.accent,
            borderRadius: 9999,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}
