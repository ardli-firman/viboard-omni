import { create } from 'zustand'

interface TerminalSession {
  taskId: string
  isActive: boolean
  pid: number | null
}

interface TerminalState {
  sessions: Record<string, TerminalSession>
  activeTaskId: string | null
  panelOpen: boolean
  openPanel: (taskId: string) => void
  closePanel: () => void
  registerSession: (taskId: string, pid: number | null) => void
  removeSession: (taskId: string) => void
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

  registerSession: (taskId, pid) => {
    set((s) => ({
      sessions: {
        ...s.sessions,
        [taskId]: { taskId, isActive: true, pid },
      },
    }))
  },

  removeSession: (taskId) => {
    set((s) => {
      const { [taskId]: _, ...rest } = s.sessions
      return { sessions: rest }
    })
  },

  setActiveTaskId: (taskId) => {
    set({ activeTaskId: taskId })
  },
}))
