import React, { useEffect, useMemo, useState } from 'react'
import { Keyboard, ArrowCounterClockwise, X } from '@phosphor-icons/react'
import { keyboardEventToShortcut } from '../../shared/keyboard-shortcuts'
import { useShortcutStore } from '../stores/shortcutStore'
import { useColors } from '../theme'

const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  view: 'View',
  actions: 'Actions',
}

export function ShortcutSettings() {
  const colors = useColors()
  const bindings = useShortcutStore((s) => s.bindings)
  const captureTargetId = useShortcutStore((s) => s.captureTargetId)
  const pendingConflict = useShortcutStore((s) => s.pendingConflict)
  const closeSettings = useShortcutStore((s) => s.closeSettings)
  const startCapture = useShortcutStore((s) => s.startCapture)
  const cancelCapture = useShortcutStore((s) => s.cancelCapture)
  const applyCapturedKeys = useShortcutStore((s) => s.applyCapturedKeys)
  const confirmOverride = useShortcutStore((s) => s.confirmOverride)
  const resetAll = useShortcutStore((s) => s.resetAll)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!captureTargetId) return

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        cancelCapture()
        return
      }

      const shortcut = keyboardEventToShortcut(event)
      if (!shortcut) return

      applyCapturedKeys(shortcut)
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [captureTargetId, applyCapturedKeys, cancelCapture])

  const filteredBindings = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return bindings
    return bindings.filter((binding) =>
      binding.label.toLowerCase().includes(query)
      || binding.currentKeys.toLowerCase().includes(query)
      || binding.category.toLowerCase().includes(query),
    )
  }, [bindings, search])

  const groupedBindings = useMemo(() => {
    return ['navigation', 'view', 'actions']
      .map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        items: filteredBindings.filter((binding) => binding.category === category),
      }))
      .filter((group) => group.items.length > 0)
  }, [filteredBindings])

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Keyboard size={20} style={{ color: colors.accent }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
              Keyboard Shortcuts
            </div>
            <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
              Rebind internal app actions
            </div>
          </div>
        </div>
        <button
          onClick={closeSettings}
          aria-label="Close keyboard shortcuts"
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ color: colors.textTertiary }}
          title="Close keyboard shortcuts"
        >
          <X size={15} />
        </button>
      </div>

      <div style={{ padding: 16, borderBottom: `1px solid ${colors.containerBorder}` }}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search shortcuts..."
          className="w-full rounded-xl px-3 py-2 text-[12px]"
          style={{
            background: colors.surfacePrimary,
            color: colors.textPrimary,
            border: `1px solid ${colors.containerBorder}`,
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {groupedBindings.length === 0 ? (
          <div
            className="rounded-2xl px-4 py-6 text-center"
            style={{ background: colors.surfacePrimary, color: colors.textTertiary, border: `1px solid ${colors.containerBorder}` }}
          >
            No shortcuts match that search.
          </div>
        ) : (
          <div className="grid gap-4">
            {groupedBindings.map((group) => (
              <div key={group.category}>
                <div className="text-[10px] uppercase tracking-[0.12em] mb-2" style={{ color: colors.textTertiary }}>
                  {group.label}
                </div>
                <div className="grid gap-2">
                  {group.items.map((binding) => {
                    const isCapturing = captureTargetId === binding.id
                    const hasConflict = pendingConflict?.targetId === binding.id
                    return (
                      <div
                        key={binding.id}
                        className="rounded-2xl p-3"
                        style={{
                          background: colors.surfacePrimary,
                          border: `1px solid ${isCapturing ? colors.accent : colors.containerBorder}`,
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
                              {binding.label}
                            </div>
                            <div className="text-[11px] mt-1" style={{ color: colors.textTertiary }}>
                              Default: {binding.defaultKeys}
                            </div>
                          </div>

                          {isCapturing ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px]" style={{ color: colors.accent }}>
                                Press new shortcut...
                              </span>
                              <button
                                onClick={cancelCapture}
                                className="rounded-xl px-3 py-2 text-[12px]"
                                style={{ color: colors.textSecondary, background: colors.surfaceSecondary }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span
                                className="px-2.5 py-1 rounded-full text-[11px] font-mono"
                                style={{ color: colors.textPrimary, background: colors.surfaceSecondary }}
                              >
                                {binding.currentKeys}
                              </span>
                              <button
                                onClick={() => startCapture(binding.id)}
                                className="rounded-xl px-3 py-2 text-[12px]"
                                style={{ color: colors.textSecondary, background: colors.surfaceSecondary }}
                              >
                                Edit
                              </button>
                            </div>
                          )}
                        </div>

                        {hasConflict && pendingConflict && (
                          <div
                            className="mt-3 rounded-xl p-3 text-[11px]"
                            style={{ background: colors.surfaceSecondary, color: colors.textSecondary }}
                          >
                            <div>
                              {pendingConflict.keys} is already used by {pendingConflict.conflict.label}.
                            </div>
                            <div className="flex items-center justify-end gap-2 mt-2">
                              <button
                                onClick={cancelCapture}
                                className="rounded-xl px-3 py-2 text-[12px]"
                                style={{ color: colors.textSecondary, background: colors.surfacePrimary }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={confirmOverride}
                                className="rounded-xl px-3 py-2 text-[12px] font-medium"
                                style={{ background: colors.accent, color: colors.textOnAccent }}
                              >
                                Override
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <button
          onClick={resetAll}
          className="rounded-xl px-3 py-2 text-[12px] font-medium flex items-center gap-2"
          style={{ background: colors.surfaceSecondary, color: colors.textSecondary }}
        >
          <ArrowCounterClockwise size={14} />
          Reset All to Defaults
        </button>
      </div>
    </div>
  )
}
