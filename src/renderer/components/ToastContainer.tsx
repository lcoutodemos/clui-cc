import React from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'
import { usePopoverLayer } from './PopoverLayer'
import { useNotificationStore } from '../stores/notificationStore'
import { Toast } from './Toast'

export function ToastContainer() {
  const toasts = useNotificationStore((s) => s.toasts)
  const popoverLayer = usePopoverLayer()

  if (!popoverLayer) return null

  return createPortal(
    <div
      data-clui-ui
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>,
    popoverLayer,
  )
}
