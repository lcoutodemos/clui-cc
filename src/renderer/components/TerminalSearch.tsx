import React, { useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { MagnifyingGlass, CaretUp, CaretDown, X } from '@phosphor-icons/react'
import { useColors } from '../theme'

interface Props {
  onSearch: (term: string) => { resultIndex: number; resultCount: number }
  onNext: () => { resultIndex: number; resultCount: number }
  onPrev: () => { resultIndex: number; resultCount: number }
  onClose: () => void
}

export function TerminalSearch({ onSearch, onNext, onPrev, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [resultIndex, setResultIndex] = useState(-1)
  const [resultCount, setResultCount] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const colors = useColors()

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
    return () => clearTimeout(debounceRef.current)
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (val.trim()) {
        const result = onSearch(val)
        setResultIndex(result.resultIndex)
        setResultCount(result.resultCount)
      } else {
        setResultIndex(-1)
        setResultCount(0)
      }
    }, 150)
  }, [onSearch])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const result = onNext()
      setResultIndex(result.resultIndex)
      setResultCount(result.resultCount)
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      const result = onPrev()
      setResultIndex(result.resultIndex)
      setResultCount(result.resultCount)
    }
  }, [onNext, onPrev, onClose])

  const handleNext = () => {
    const result = onNext()
    setResultIndex(result.resultIndex)
    setResultCount(result.resultCount)
  }

  const handlePrev = () => {
    const result = onPrev()
    setResultIndex(result.resultIndex)
    setResultCount(result.resultCount)
  }

  const noMatch = query.trim().length > 0 && resultCount === 0

  return (
    <motion.div
      data-clui-ui
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
        width: 280,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 8px',
        background: colors.popoverBg,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${colors.popoverBorder}`,
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <MagnifyingGlass size={14} style={{ color: colors.textMuted, flexShrink: 0 }} />

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Find..."
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: colors.textPrimary,
          fontSize: 12,
          fontFamily: 'inherit',
          minWidth: 0,
        }}
      />

      {/* Match counter */}
      {query.trim().length > 0 && (
        <span
          style={{
            fontSize: 11,
            color: noMatch ? '#f87171' : colors.textSecondary,
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {noMatch ? '0/0' : `${resultIndex + 1}/${resultCount}`}
        </span>
      )}

      {/* Nav buttons */}
      <button
        onClick={handlePrev}
        disabled={resultCount === 0}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: resultCount === 0 ? 'default' : 'pointer',
          color: resultCount === 0 ? colors.textMuted : colors.textSecondary,
          opacity: resultCount === 0 ? 0.4 : 1,
          padding: 2,
          display: 'flex',
          borderRadius: 3,
        }}
        aria-label="Previous match"
      >
        <CaretUp size={14} />
      </button>
      <button
        onClick={handleNext}
        disabled={resultCount === 0}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: resultCount === 0 ? 'default' : 'pointer',
          color: resultCount === 0 ? colors.textMuted : colors.textSecondary,
          opacity: resultCount === 0 ? 0.4 : 1,
          padding: 2,
          display: 'flex',
          borderRadius: 3,
        }}
        aria-label="Next match"
      >
        <CaretDown size={14} />
      </button>

      {/* Close */}
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: colors.textSecondary,
          padding: 2,
          display: 'flex',
          borderRadius: 3,
        }}
        aria-label="Close search"
      >
        <X size={14} />
      </button>
    </motion.div>
  )
}
