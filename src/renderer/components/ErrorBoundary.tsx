import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { WarningCircle } from '@phosphor-icons/react'
import { spacing, useColors } from '../theme'

export const REPORT_BUG_URL = 'https://github.com/lfrmonteiro99/clui-cc-windows/issues/new'

interface ErrorBoundaryState {
  error: Error | null
  componentStack: string
}

interface ErrorFallbackProps {
  error: Error
  componentStack: string
}

function buildDiagnostics(error: Error, componentStack: string): string {
  return [
    `message: ${error.message || 'Unknown renderer error'}`,
    error.stack ? `stack:\n${error.stack}` : 'stack:\n(none)',
    componentStack ? `componentStack:${componentStack}` : 'componentStack:\n(none)',
  ].join('\n\n')
}

export const errorBoundaryActions = {
  reloadApplication() {
    window.location.reload()
  },
  reportBug() {
    return window.clui.openExternal(REPORT_BUG_URL)
  },
}

function ErrorFallback({ error, componentStack }: ErrorFallbackProps) {
  const colors = useColors()
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<number | null>(null)
  const diagnostics = useMemo(() => buildDiagnostics(error, componentStack), [componentStack, error])

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  const handleReload = () => {
    errorBoundaryActions.reloadApplication()
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(diagnostics)
    setCopied(true)
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current)
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false)
      resetTimerRef.current = null
    }, 2000)
  }

  const handleReportBug = () => {
    void errorBoundaryActions.reportBug()
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-8">
      <motion.div
        data-testid="error-boundary-card"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="glass-surface w-full"
        style={{
          maxWidth: spacing.contentWidth,
          minHeight: 300,
          backgroundColor: colors.containerBg,
          border: `1px solid ${colors.containerBorder}`,
          borderRadius: 20,
          boxShadow: colors.containerShadow,
          color: colors.textPrimary,
          padding: '28px 24px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 16,
        }}
      >
        <WarningCircle size={48} weight="regular" style={{ color: colors.accent, flexShrink: 0 }} />
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-base font-semibold" style={{ color: colors.textPrimary }}>
            Something went wrong
          </h1>
          <p className="text-[13px] leading-[1.5]" style={{ color: colors.textSecondary, maxWidth: 320 }}>
            A component failed to render. Your session data is safe.
          </p>
        </div>

        <pre
          data-testid="error-boundary-details"
          className="w-full overflow-hidden whitespace-pre-wrap break-words text-left"
          style={{
            backgroundColor: colors.surfaceSecondary,
            color: colors.textSecondary,
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: 11,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 3,
          }}
        >
          {error.stack || error.message}
        </pre>

        <button
          onClick={handleReload}
          className="w-full cursor-pointer rounded-full border-0 px-4 py-2.5 text-[13px] font-semibold"
          style={{
            backgroundColor: colors.sendBg,
            color: colors.textOnAccent,
          }}
        >
          Reload App
        </button>

        <div className="flex items-center justify-center gap-2 text-[12px]">
          <button
            onClick={() => {
              void handleCopy()
            }}
            className="cursor-pointer border-0 bg-transparent p-0"
            style={{ color: colors.textTertiary }}
          >
            {copied ? 'Copied' : 'Copy Error'}
          </button>
          <span style={{ color: colors.textTertiary }}>&middot;</span>
          <button
            onClick={handleReportBug}
            className="cursor-pointer border-0 bg-transparent p-0"
            style={{ color: colors.textTertiary }}
          >
            Report Bug
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    componentStack: '',
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      error,
      componentStack: '',
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ componentStack: info.componentStack })
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} componentStack={this.state.componentStack} />
    }

    return this.props.children
  }
}
