import React from 'react'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function createMotionComponent(tag: string) {
  return React.forwardRef<HTMLElement, Record<string, unknown>>(function MotionComponent(props, ref) {
    const {
      animate,
      axis,
      drag,
      dragConstraints,
      dragElastic,
      dragMomentum,
      exit,
      initial,
      layout,
      layoutId,
      onLayoutAnimationComplete,
      onReorder,
      transition,
      value,
      whileDrag,
      children,
      ...rest
    } = props

    return React.createElement(tag, { ref, ...rest }, children)
  })
}

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy({}, {
    get: (_target, prop) => createMotionComponent(String(prop)),
  }),
  Reorder: {
    Group: createMotionComponent('div'),
    Item: createMotionComponent('div'),
  },
}))

if (typeof window !== 'undefined') {
  window.requestAnimationFrame = window.requestAnimationFrame || ((cb: FrameRequestCallback) => window.setTimeout(() => cb(Date.now()), 0))
  window.cancelAnimationFrame = window.cancelAnimationFrame || ((id: number) => window.clearTimeout(id))
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))

  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })

  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: class IntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return [] }
      root = null
      rootMargin = '0px'
      thresholds = []
    },
  })

  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  })

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    },
  })
}

afterEach(() => {
  cleanup()
})
