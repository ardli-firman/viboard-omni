import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AgentStatus, AgentActivity } from '@shared/types'

interface TerminalState {
  activeTaskId: string | null
  panelOpen: boolean
  status: Record<string, AgentStatus>
  activity: Record<string, AgentActivity>
  panelHeight: number

  openPanel: (taskId: string) => void
  closePanel: () => void
  setStatus: (taskId: string, status: AgentStatus) => void
  setActivity: (taskId: string, activity: AgentActivity) => void
  setPanelHeight: (updater: number | ((prev: number) => number)) => void
  /** Remove all non-running statuses to prevent the map from growing forever. */
  clearCompletedStatuses: () => void
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
      activeTaskId: null,
      panelOpen: false,
      status: {},
      activity: {},
      panelHeight: 420,

      openPanel: (taskId) => set({ activeTaskId: taskId, panelOpen: true }),

      closePanel: () => set({ panelOpen: false }),

      setStatus: (taskId, status) => set((s) => ({ status: { ...s.status, [taskId]: status } })),

      setActivity: (taskId, activity) => set((s) => ({ activity: { ...s.activity, [taskId]: activity } })),

      setPanelHeight: (updater) =>
        set((s) => {
          const newHeight = typeof updater === 'function' ? updater(s.panelHeight) : updater
          // Limit height between 200px and 1200px
          return { panelHeight: Math.max(200, Math.min(newHeight, 1200)) }
        }),

      clearCompletedStatuses: () =>
        set((s) => {
          const activeStatus: Record<string, AgentStatus> = {}
          const activeActivity: Record<string, AgentActivity> = {}
          for (const [taskId, status] of Object.entries(s.status)) {
            if (status === 'running') {
              activeStatus[taskId] = status
              if (s.activity[taskId]) {
                activeActivity[taskId] = s.activity[taskId]
              }
            }
          }
          return { status: activeStatus, activity: activeActivity }
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
