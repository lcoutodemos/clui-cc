import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, Trash, Plus, Lightning, Lock, X } from '@phosphor-icons/react'
import { useColors } from '../theme'

interface Props {
  onClose: () => void
}

type PresetKey = 'permissive' | 'balanced' | 'strict'

export function PermissionEditor({ onClose }: Props) {
  const colors = useColors()
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [newPattern, setNewPattern] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const loadPermissions = useCallback(async () => {
    setLoading(true)
    try {
      const perms = await window.clui.getPermissions()
      setPermissions(perms.allow)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  const handleRemove = async (pattern: string) => {
    try {
      await window.clui.removePermission(pattern)
      setPermissions((prev) => prev.filter((p) => p !== pattern))
    } catch {}
  }

  const handleAdd = async () => {
    const trimmed = newPattern.trim()
    if (!trimmed || permissions.includes(trimmed)) return
    try {
      await window.clui.addPermission(trimmed)
      setPermissions((prev) => [...prev, trimmed])
      setNewPattern('')
      setShowAdd(false)
    } catch {}
  }

  const handlePreset = async (preset: PresetKey) => {
    try {
      await window.clui.applyPermissionPreset(preset)
      await loadPermissions()
    } catch {}
  }

  return (
    <motion.div
      data-testid="permission-editor"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.12 }}
      data-clui-ui
      className="rounded-xl overflow-hidden"
      style={{
        background: colors.popoverBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: colors.popoverShadow,
        border: `1px solid ${colors.popoverBorder}`,
        width: 320,
        maxHeight: 420,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${colors.popoverBorder}` }}>
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={14} style={{ color: colors.accent }} />
          <span className="text-[12px] font-semibold" style={{ color: colors.textPrimary }}>
            Permissions
          </span>
          <span
            data-testid="permission-count"
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ background: colors.surfacePrimary, color: colors.textTertiary }}
          >
            {permissions.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded-full cursor-pointer transition-colors"
          style={{ color: colors.textTertiary }}
          onMouseEnter={(e) => { e.currentTarget.style.background = colors.surfaceHover }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Quick presets */}
      <div className="flex gap-1 px-3 py-2" style={{ borderBottom: `1px solid ${colors.popoverBorder}` }}>
        <button
          data-testid="permission-editor-preset-permissive"
          onClick={() => handlePreset('permissive')}
          className="text-[9px] font-medium px-2 py-1 rounded-full cursor-pointer transition-colors flex items-center gap-1"
          style={{ background: colors.surfacePrimary, color: colors.textSecondary, border: `1px solid ${colors.surfaceSecondary}` }}
          title="Auto-approve everything"
        >
          <Lightning size={9} />
          Permissive
        </button>
        <button
          data-testid="permission-editor-preset-balanced"
          onClick={() => handlePreset('balanced')}
          className="text-[9px] font-medium px-2 py-1 rounded-full cursor-pointer transition-colors flex items-center gap-1"
          style={{ background: colors.surfacePrimary, color: colors.textSecondary, border: `1px solid ${colors.surfaceSecondary}` }}
          title="Auto-approve reads + git + gh"
        >
          <ShieldCheck size={9} />
          Balanced
        </button>
        <button
          data-testid="permission-editor-preset-strict"
          onClick={() => handlePreset('strict')}
          className="text-[9px] font-medium px-2 py-1 rounded-full cursor-pointer transition-colors flex items-center gap-1"
          style={{ background: colors.surfacePrimary, color: colors.textSecondary, border: `1px solid ${colors.surfaceSecondary}` }}
          title="Minimal auto-approvals"
        >
          <Lock size={9} />
          Strict
        </button>
      </div>

      {/* Permission list */}
      <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
        {loading ? (
          <div className="px-3 py-4 text-center">
            <span className="text-[11px]" style={{ color: colors.textTertiary }}>Loading...</span>
          </div>
        ) : permissions.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <span className="text-[11px]" style={{ color: colors.textTertiary }}>No permissions configured</span>
          </div>
        ) : (
          <div className="px-2 py-1">
            <AnimatePresence>
              {permissions.map((pattern) => (
                <motion.div
                  key={pattern}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.12 }}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg group"
                  style={{ borderBottom: `1px solid ${colors.surfacePrimary}` }}
                >
                  <span className="text-[10px] font-mono truncate flex-1" style={{ color: colors.textSecondary }}>
                    {pattern}
                  </span>
                  <button
                    onClick={() => handleRemove(pattern)}
                    className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-full cursor-pointer transition-all"
                    style={{ color: colors.statusError }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = colors.permissionDenyBg }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <Trash size={10} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add new */}
      <div className="px-3 py-2" style={{ borderTop: `1px solid ${colors.popoverBorder}` }}>
        <AnimatePresence>
          {showAdd ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex gap-1 overflow-hidden"
            >
              <input
                data-testid="permission-add-input"
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAdd(false) }}
                placeholder="e.g. Bash(gh:*)"
                autoFocus
                className="flex-1 text-[10px] font-mono px-2 py-1 rounded-md outline-none"
                style={{
                  background: colors.surfacePrimary,
                  color: colors.textPrimary,
                  border: `1px solid ${colors.inputFocusBorder}`,
                }}
              />
              <button
                data-testid="permission-add-confirm"
                onClick={handleAdd}
                className="text-[10px] font-medium px-2 py-1 rounded-md cursor-pointer"
                style={{ background: colors.permissionAllowBg, color: colors.statusComplete, border: `1px solid ${colors.permissionAllowBorder}` }}
              >
                Add
              </button>
            </motion.div>
          ) : (
            <button
              data-testid="permission-add-button"
              onClick={() => setShowAdd(true)}
              className="text-[10px] font-medium px-2 py-1 rounded-full cursor-pointer transition-colors flex items-center gap-1 w-full justify-center"
              style={{ background: colors.surfacePrimary, color: colors.textTertiary, border: `1px solid ${colors.surfaceSecondary}` }}
            >
              <Plus size={10} />
              Add Permission
            </button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
