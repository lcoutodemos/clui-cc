import { create } from 'zustand'
import { DEFAULT_EXPORT_OPTIONS } from '../../shared/session-export'
import type { ExportOptions, SessionExportData } from '../../shared/types'

interface ExportState {
  isOpen: boolean
  data: SessionExportData | null
  options: ExportOptions
  error: string | null
  openDialog: (data: SessionExportData) => void
  closeDialog: () => void
  setOptions: (updates: Partial<ExportOptions>) => void
  setError: (error: string | null) => void
}

export const useExportStore = create<ExportState>((set) => ({
  isOpen: false,
  data: null,
  options: DEFAULT_EXPORT_OPTIONS,
  error: null,

  openDialog: (data) => set({
    isOpen: true,
    data,
    options: DEFAULT_EXPORT_OPTIONS,
    error: null,
  }),

  closeDialog: () => set({
    isOpen: false,
    data: null,
    error: null,
  }),

  setOptions: (updates) => set((state) => ({
    options: {
      ...state.options,
      ...updates,
    },
  })),

  setError: (error) => set({ error }),
}))
