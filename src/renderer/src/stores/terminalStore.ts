import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AgentStatus } from '@shared/types'

interface TerminalState {
  activeTaskId: string | null
  panelOpen: boolean
  status: Record<string, AgentStatus>
  panelHeight: number

  openPanel: (taskId: string) => void
  closePanel: () => void
  setStatus: (taskId: string, status: AgentStatus) => void
  setPanelHeight: (updater: number | ((prev: number) => number)) => void
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      activeTaskId: null,
      panelOpen: false,
      status: {},
      panelHeight: 420,

      openPanel: (taskId) => set({ activeTaskId: taskId, panelOpen: true }),

      closePanel: () => set({ panelOpen: false }),

      setStatus: (taskId, status) => set((s) => ({ status: { ...s.status, [taskId]: status } })),

      setPanelHeight: (updater) =>
        set((s) => {
          const newHeight = typeof updater === 'function' ? updater(s.panelHeight) : updater
          // Limit height between 200px and 1200px
          return { panelHeight: Math.max(200, Math.min(newHeight, 1200)) }
        }),
    }),
    {
      name: 'viboard-terminal-store',
      partialize: (state) => ({
        panelHeight: state.panelHeight,
      }),
    }
  )
)
