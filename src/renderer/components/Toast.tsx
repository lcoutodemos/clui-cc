import React, { useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Info, Warning, XCircle, X } from '@phosphor-icons/react'
import { useColors } from '../theme'
import { useNotificationStore, type Toast as ToastType } from '../stores/notificationStore'

const TYPE_ICONS: Record<ToastType['type'], React.ComponentType<{ size: number; style?: React.CSSProperties }>> = {
  success: CheckCircle,
  info: Info,
  warning: Warning,
  error: XCircle,
}

function getTypeColor(type: ToastType['type'], colors: ReturnType<typeof useColors>): string {
  switch (type) {
    case 'success':
      return colors.statusComplete
    case 'info':
      return colors.accent
    case 'warning':
      return colors.statusPermission
    case 'error':
      return colors.statusError
  }
}

function getTypeBg(type: ToastType['type'], colors: ReturnType<typeof useColors>): string {
  switch (type) {
    case 'success':
      return colors.statusCompleteBg
    case 'info':
      return colors.accentLight
    case 'warning':
      return colors.statusRunningBg
    case 'error':
      return colors.statusErrorBg
  }
}

interface ToastProps {
  toast: ToastType
}

export function Toast({ toast }: ToastProps) {
  const colors = useColors()
  const removeToast = useNotificationStore((s) => s.removeToast)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remainingRef = useRef(toast.duration ?? 4000)
  const startedAtRef = useRef(Date.now())

  const startTimer = useCallback(() => {
    startedAtRef.current = Date.now()
    timerRef.current = setTimeout(() => {
      removeToast(toast.id)
    }, remainingRef.current)
  }, [removeToast, toast.id])

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      const elapsed = Date.now() - startedAtRef.current
      remainingRef.current = Math.max(0, remainingRef.current - elapsed)
    }
  }, [])

  useEffect(() => {
    startTimer()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [startTimer])

  const Icon = TYPE_ICONS[toast.type]
  const typeColor = getTypeColor(toast.type, colors)
  const typeBg = getTypeBg(toast.type, colors)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 280 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 280 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      data-clui-ui
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      style={{
        background: colors.popoverBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${colors.popoverBorder}`,
        borderLeft: `3px solid ${typeColor}`,
        borderRadius: 12,
        boxShadow: colors.popoverShadow,
        padding: '10px 12px',
        width: 280,
        pointerEvents: 'auto',
        cursor: 'default',
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: typeBg }}
        >
          <Icon size={14} style={{ color: typeColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium leading-tight" style={{ color: colors.textPrimary }}>
            {toast.title}
          </div>
          {toast.message && (
            <div className="text-[11px] mt-0.5 leading-snug" style={{ color: colors.textSecondary }}>
              {toast.message}
            </div>
          )}
        </div>
        <button
          onClick={() => removeToast(toast.id)}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors"
          style={{ color: colors.textTertiary }}
        >
          <X size={12} />
        </button>
      </div>
    </motion.div>
  )
}
