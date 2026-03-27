import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Warning, ArrowClockwise, Globe, Copy, Check } from '@phosphor-icons/react'
import { useSessionStore } from '../stores/sessionStore'
import { useColors } from '../theme'

const TRANSITION = { duration: 0.26, ease: [0.4, 0, 0.1, 1] as const }

export function SetupWizard() {
  const staticInfo = useSessionStore((s) => s.staticInfo)
  const initStaticInfo = useSessionStore((s) => s.initStaticInfo)
  const setAuthBypassed = useSessionStore((s) => s.setAuthBypassed)
  const colors = useColors()

  if (!staticInfo) return null

  const { isNodeInstalled, isClaudeInstalled, isAuthValid } = staticInfo

  const steps = [
    {
      title: 'Node.js Runtime',
      installed: isNodeInstalled,
      description: 'Required to run Electron and Claude Code dependencies.',
      link: 'https://nodejs.org/',
    },
    {
      title: 'Claude CLI',
      installed: isClaudeInstalled,
      description: 'The core engine that powers Clui CC. Install via npm.',
      command: 'npm install -g @anthropic-ai/claude-code',
      link: 'https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview',
    },
    {
      title: 'Authentication',
      installed: isAuthValid,
      description: 'You must be logged into Claude Code to use Clui CC.',
      command: 'claude auth login',
    },
  ]

  return (
    <div className="flex flex-col justify-end h-full w-full pb-10" style={{ background: 'transparent' }}>
      <div style={{ width: 460, margin: '0 auto', position: 'relative' }}>
        <motion.div
          data-clui-ui
          className="glass-surface overflow-hidden flex flex-col drag-region"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={TRANSITION}
          style={{ 
            borderRadius: 20, 
            border: `1px solid ${colors.containerBorder}`,
            background: colors.containerBg,
            boxShadow: colors.cardShadow,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            marginBottom: 10
          }}
        >
          {/* Header */}
          <div className="px-5 py-3 border-b border-white/5 flex flex-col justify-center no-drag conversation-selectable" style={{ minHeight: 48, borderColor: colors.containerBorder, background: colors.surfaceHover }}>
            <h1 className="text-[13px] font-semibold tracking-wide" style={{ color: colors.textPrimary }}>Setup Required</h1>
            <p className="text-[10px] mt-0.5" style={{ color: colors.textTertiary }}>
              Please complete these steps to get your environment ready.
            </p>
          </div>

          {/* Steps Body */}
          <div className="p-5 space-y-6 overflow-y-auto no-drag conversation-selectable" style={{ maxHeight: 380 }}>
            {steps.map((step, i) => (
              <div key={i} className="flex gap-3 group/step">
                <div className="mt-0.5 flex-shrink-0">
                  {step.installed ? (
                    <div className="flex items-center justify-center rounded-full w-[20px] h-[20px]">
                      <CheckCircle size={18} weight="fill" style={{ color: colors.statusComplete }} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-full w-[20px] h-[20px]">
                      <XCircle size={18} weight="fill" style={{ color: colors.statusError }} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[13px]" style={{ color: colors.textPrimary }}>{step.title}</h3>
                  <p className="text-[11px] mt-1 mb-2 leading-relaxed" style={{ color: colors.textTertiary }}>{step.description}</p>
                  {!step.installed && (
                    <div className="space-y-2.5 mt-2">
                      {step.command && (
                        <CommandBlock command={step.command} colors={colors} />
                      )}
                      {step.link && (
                        <a 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); window.clui.openExternal(step.link!) }}
                          className="text-[10px] flex items-center gap-1 hover:underline w-fit transition-all hover:opacity-80" 
                          style={{ color: colors.accent }}
                        >
                          <Globe size={12} weight="bold" /> 
                          <span>View Instructions</span>
                        </a>
                      )}
                      {step.title === 'Authentication' && (
                        <button
                          onClick={() => setAuthBypassed(true)}
                          className="text-[10px] flex items-center gap-1 hover:underline w-fit transition-all hover:opacity-80 mt-1"
                          style={{ color: colors.textSecondary }}
                        >
                          <span>Skip Login (Use Local LLM or API Key)</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer / Action */}
          <div className="p-4 border-t no-drag" style={{ borderColor: colors.containerBorder, background: colors.surfaceHover }}>
            <button
              onClick={() => initStaticInfo()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all active:scale-[0.98] hover:brightness-110"
              style={{ 
                background: colors.sendBg, 
                color: colors.textOnAccent,
                boxShadow: `0 4px 14px ${colors.sendBg}33`,
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              <ArrowClockwise size={15} weight="bold" />
              Check Again
            </button>
            <p className="text-[9px] text-center mt-3 tracking-wide" style={{ color: colors.textTertiary }}>
              RESTART CLUI CC AFTER INSTALLING DEPENDENCIES
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function CommandBlock({ command, colors }: { command: string, colors: any }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <div 
      className="flex items-center gap-2 p-2.5 rounded-xl border no-drag transition-colors"
      style={{ 
        background: colors.codeBg, 
        borderColor: colors.containerBorder,
      }}
    >
      <code className="flex-1 text-[10px] font-mono break-all line-clamp-2" style={{ color: colors.textSecondary }}>
        {command}
      </code>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 p-1.5 rounded-lg transition-all active:scale-90"
        style={{ 
          color: copied ? colors.statusComplete : colors.textTertiary,
          background: copied ? colors.statusCompleteBg : 'transparent',
          border: 'none',
          cursor: 'pointer'
        }}
        title="Copy command"
      >
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.div
              key="check"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <Check size={14} weight="bold" />
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <Copy size={14} weight="bold" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </div>
  )
}
