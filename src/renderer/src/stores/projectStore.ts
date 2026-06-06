import { create } from 'zustand'
import type { Column, Task, AgentType, AgentStatus } from '@shared/types'

interface ProjectState {
  columns: Column[]
  tasks: Task[]
  loading: boolean
  initialized: boolean
  loadData: () => Promise<void>
  addColumn: (title: string, color?: string) => Promise<void>
  updateColumn: (id: string, data: { title?: string; color?: string }) => Promise<void>
  deleteColumn: (id: string) => Promise<void>
  addTask: (data: { title: string; description: string; columnId: string; projectPath: string; agentType: AgentType; tags: string[] }) => Promise<void>
  updateTask: (id: string, data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  moveTask: (taskId: string, columnId: string, order: number) => Promise<void>
  setAgentStatus: (taskId: string, status: AgentStatus) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  columns: [],
  tasks: [],
  loading: false,
  initialized: false,

  loadData: async () => {
    if (get().initialized) return
    set({ loading: true })
    try {
      const [columns, tasks] = await Promise.all([
        window.electronAPI.getColumns(),
        window.electronAPI.getTasks(),
      ])
      set({ columns, tasks, loading: false, initialized: true })
    } catch (err) {
      console.error('Failed to load data:', err)
      set({ loading: false })
    }
  },

  addColumn: async (title, color) => {
    const log = window.electronAPI?.log ?? { info: (..._a: unknown[]): void => {}, error: (..._a: unknown[]): void => {}, warn: (..._a: unknown[]): void => {} }
    log.info('[addColumn] Creating:', title)
    try {
      const order = get().columns.length
      log.info('[addColumn] Sending IPC, order:', order)
      const column = await window.electronAPI.createColumn({ title, order, color })
      log.info('[addColumn] IPC success:', JSON.stringify(column))
      set((s) => ({ columns: [...s.columns, column] }))
      log.info('[addColumn] Store updated')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error('[addColumn] Error:', msg)
      throw err
    }
  },

  updateColumn: async (id, data) => {
    const updated = await window.electronAPI.updateColumn(id, data)
    set((s) => ({ columns: s.columns.map((c) => (c.id === id ? updated : c)) }))
  },

  deleteColumn: async (id) => {
    await window.electronAPI.deleteColumn(id)
    set((s) => ({
      columns: s.columns.filter((c) => c.id !== id),
      tasks: s.tasks.filter((t) => t.columnId !== id),
    }))
  },

  addTask: async (data) => {
    const tasksInCol = get().tasks.filter((t) => t.columnId === data.columnId)
    const order = tasksInCol.length
    const task = await window.electronAPI.createTask({
      title: data.title,
      description: data.description,
      columnId: data.columnId,
      order,
      projectPath: data.projectPath,
      agentType: data.agentType,
      agentStatus: 'idle',
      tags: data.tags,
    })
    set((s) => ({ tasks: [...s.tasks, task] }))
  },

  updateTask: async (id, data) => {
    const updated = await window.electronAPI.updateTask(id, data)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }))
  },

  deleteTask: async (id) => {
    await window.electronAPI.deleteTask(id)
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
  },

  moveTask: async (taskId, columnId, order) => {
    const moved = await window.electronAPI.moveTask(taskId, columnId, order)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? moved : t)) }))
  },

  setAgentStatus: (taskId, status) => {
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, agentStatus: status } : t)),
    }))
  },
}))
