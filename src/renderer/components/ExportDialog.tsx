import React, { useMemo, useState } from 'react'
import { DownloadSimple, FileCode, BracketsCurly, X } from '@phosphor-icons/react'
import { buildSessionExportContent, getFilteredExportMessages } from '../../shared/session-export'
import { useColors } from '../theme'
import { useExportStore } from '../stores/exportStore'
import { useSessionStore } from '../stores/sessionStore'

function ToggleRow({
  label,
  checked,
  onChange,
  colors,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  colors: ReturnType<typeof useColors>
}) {
  return (
    <label className="flex items-center gap-2 text-[12px]" style={{ color: colors.textSecondary }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

export function ExportDialog() {
  const colors = useColors()
  const data = useExportStore((s) => s.data)
  const options = useExportStore((s) => s.options)
  const error = useExportStore((s) => s.error)
  const closeDialog = useExportStore((s) => s.closeDialog)
  const setOptions = useExportStore((s) => s.setOptions)
  const setError = useExportStore((s) => s.setError)
  const addSystemMessage = useSessionStore((s) => s.addSystemMessage)
  const [isSaving, setIsSaving] = useState(false)

  const filteredMessages = useMemo(
    () => (data ? getFilteredExportMessages(data.messages, options) : []),
    [data, options],
  )
  const preview = useMemo(
    () => (data ? buildSessionExportContent(data, options) : ''),
    [data, options],
  )

  if (!data) return null

  const handleExport = async () => {
    if (filteredMessages.length === 0) {
      setError('Nothing to export with the current filters.')
      return
    }

    setIsSaving(true)
    setError(null)
    const result = await window.clui.exportSession(data, options)
    setIsSaving(false)

    if (!result.ok) {
      setError(result.error || 'Failed to export session.')
      return
    }

    if (!result.path) {
      return
    }

    addSystemMessage(`Session exported to ${result.path}`)
    closeDialog()
  }

  return (
    <div
      data-clui-ui
      style={{
        height: 500,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 18px 10px',
          borderBottom: `1px solid ${colors.containerBorder}`,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
            Export Session
          </div>
          <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
            {data.title || 'Untitled session'}
          </div>
        </div>
        <button
          onClick={closeDialog}
          aria-label="Close export dialog"
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ color: colors.textTertiary }}
          title="Close export dialog"
        >
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4" style={{ padding: 16, borderBottom: `1px solid ${colors.containerBorder}` }}>
        <div>
          <div className="text-[11px] font-medium mb-2" style={{ color: colors.textPrimary }}>
            Format
          </div>
          <div className="grid gap-2">
            <button
              onClick={() => setOptions({ format: 'markdown' })}
              className="rounded-xl px-3 py-2 text-[12px] flex items-center gap-2 text-left"
              style={{
                background: options.format === 'markdown' ? colors.accentLight : colors.surfacePrimary,
                border: `1px solid ${options.format === 'markdown' ? colors.accent : colors.containerBorder}`,
                color: options.format === 'markdown' ? colors.accent : colors.textPrimary,
              }}
            >
              <FileCode size={14} />
              Markdown (.md)
            </button>
            <button
              onClick={() => setOptions({ format: 'json' })}
              className="rounded-xl px-3 py-2 text-[12px] flex items-center gap-2 text-left"
              style={{
                background: options.format === 'json' ? colors.accentLight : colors.surfacePrimary,
                border: `1px solid ${options.format === 'json' ? colors.accent : colors.containerBorder}`,
                color: options.format === 'json' ? colors.accent : colors.textPrimary,
              }}
            >
              <BracketsCurly size={14} />
              JSON (.json)
            </button>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-medium mb-2" style={{ color: colors.textPrimary }}>
            Include
          </div>
          <div className="grid gap-2">
            <ToggleRow label="User messages" checked={options.includeUserMessages} onChange={(checked) => setOptions({ includeUserMessages: checked })} colors={colors} />
            <ToggleRow label="Assistant responses" checked={options.includeAssistantMessages} onChange={(checked) => setOptions({ includeAssistantMessages: checked })} colors={colors} />
            <ToggleRow label="Tool calls" checked={options.includeToolCalls} onChange={(checked) => setOptions({ includeToolCalls: checked })} colors={colors} />
            <ToggleRow label="Cost and tokens" checked={options.includeMetadata} onChange={(checked) => setOptions({ includeMetadata: checked })} colors={colors} />
          </div>
        </div>
      </div>

      <div style={{ padding: 16, paddingBottom: 8 }}>
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium" style={{ color: colors.textPrimary }}>
            Preview
          </div>
          <div className="text-[10px]" style={{ color: colors.textTertiary }}>
            {filteredMessages.length} item{filteredMessages.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px 16px', flex: 1, minHeight: 0 }}>
        <pre
          className="rounded-2xl p-3 text-[11px] whitespace-pre-wrap overflow-auto h-full"
          style={{
            margin: 0,
            background: colors.surfacePrimary,
            color: colors.textSecondary,
            border: `1px solid ${colors.containerBorder}`,
          }}
        >
          {filteredMessages.length === 0 ? 'Nothing to export with the current filters.' : preview}
        </pre>
      </div>

      <div
        className="flex items-center justify-between gap-3"
        style={{
          padding: '0 16px 16px',
        }}
      >
        <div className="text-[11px]" style={{ color: error ? colors.statusError : colors.textTertiary }}>
          {error || 'Export the current session to Markdown or JSON.'}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={closeDialog}
            className="rounded-xl px-3 py-2 text-[12px]"
            style={{ color: colors.textSecondary, background: colors.surfaceSecondary }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleExport()}
            disabled={isSaving}
            className="rounded-xl px-3 py-2 text-[12px] font-medium flex items-center gap-2"
            style={{
              background: colors.accent,
              color: colors.textOnAccent,
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            <DownloadSimple size={14} />
            {isSaving ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}
