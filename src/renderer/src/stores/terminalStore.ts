import { create } from 'zustand'
import type { AgentStatus } from '@shared/types'

interface TerminalSession {
  taskId: string
  isActive: boolean
  pid: number | null
  status: AgentStatus
}

interface TerminalState {
  sessions: Record<string, TerminalSession>
  activeTaskId: string | null
  panelOpen: boolean
  openPanel: (taskId: string) => void
  closePanel: () => void
  registerSession: (taskId: string, pid: number | null, status: AgentStatus) => void
  removeSession: (taskId: string) => void
  setSessionStatus: (taskId: string, status: AgentStatus) => void
  setActiveTaskId: (taskId: string | null) => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  sessions: {},
  activeTaskId: null,
  panelOpen: false,

  openPanel: (taskId) => {
    set({ activeTaskId: taskId, panelOpen: true })
  },

  closePanel: () => {
    set({ panelOpen: false, activeTaskId: null })
  },

  registerSession: (taskId, pid, status) => {
    set((s) => ({
      sessions: {
        ...s.sessions,
        [taskId]: { taskId, isActive: true, pid, status },
      },
    }))
  },

  removeSession: (taskId) => {
    set((s) => {
      const { [taskId]: _, ...rest } = s.sessions
      return { sessions: rest }
    })
  },

  setSessionStatus: (taskId, status) => {
    set((s) => {
      const existing = s.sessions[taskId]
      if (!existing) {
        return {
          sessions: {
            ...s.sessions,
            [taskId]: { taskId, isActive: status === 'running', pid: null, status },
          },
        }
      }
      return {
        sessions: {
          ...s.sessions,
          [taskId]: {
            ...existing,
            isActive: status === 'running',
            status,
          },
        },
      }
    })
  },

  setActiveTaskId: (taskId) => {
    set({ activeTaskId: taskId })
  },
}))
