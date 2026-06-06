import { create } from 'zustand'
import type { Column, Task, AgentType, AgentStatus, RegisteredProject } from '@shared/types'

interface ProjectState {
  projects: RegisteredProject[]
  currentProject: string | null
  columns: Column[]
  tasks: Task[]
  loading: boolean
  projectsLoaded: boolean
  loadProjects: () => Promise<void>
  addProject: () => Promise<string | null>
  removeProject: (path: string) => Promise<void>
  openProject: (path: string) => Promise<void>
  closeProject: () => void
  loadData: (projectPath: string) => Promise<void>
  addColumn: (title: string, color?: string) => Promise<void>
  updateColumn: (id: string, data: { title?: string; color?: string }) => Promise<void>
  deleteColumn: (id: string) => Promise<void>
  reorderColumns: (items: { id: string; order: number }[]) => void
  addTask: (data: { title: string; description: string; columnId: string; tags: string[] }) => Promise<void>
  updateTask: (id: string, data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  moveTask: (taskId: string, columnId: string, order: number) => Promise<void>
  setAgentStatus: (taskId: string, status: AgentStatus) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  columns: [],
  tasks: [],
  loading: false,
  projectsLoaded: false,

  loadProjects: async () => {
    try {
      const projects = await window.electronAPI.listProjects()
      set({ projects, projectsLoaded: true })
    } catch (err) {
      console.error('Failed to load projects:', err)
      set({ projectsLoaded: true })
    }
  },

  addProject: async () => {
    const result = await window.electronAPI.addProject()
    if (!result) return null
    set((s) => {
      const existing = s.projects.find((p) => p.path === result.path)
      return {
        projects: existing
          ? s.projects.map((p) => (p.path === result.path ? result : p))
          : [result, ...s.projects],
      }
    })
    await get().openProject(result.path)
    return result.path
  },

  removeProject: async (path) => {
    await window.electronAPI.removeProject(path)
    set((s) => {
      const next = s.projects.filter((p) => p.path !== path)
      const close = s.currentProject === path
      return {
        projects: next,
        currentProject: close ? null : s.currentProject,
        columns: close ? [] : s.columns,
        tasks: close ? [] : s.tasks,
      }
    })
  },

  openProject: async (path) => {
    set({
      currentProject: path,
      columns: [],
      tasks: [],
      loading: true,
    })
    window.electronAPI.touchProject(path)
    await get().loadData(path)
  },

  closeProject: () => {
    set({
      currentProject: null,
      columns: [],
      tasks: [],
      loading: false,
    })
  },

  loadData: async (projectPath) => {
    set({ loading: true })
    try {
      const [columns, tasks] = await Promise.all([
        window.electronAPI.getColumns(projectPath),
        window.electronAPI.getTasks(projectPath),
      ])
      set({ columns, tasks, loading: false })
    } catch (err) {
      console.error('Failed to load data:', err)
      set({ loading: false })
    }
  },

  addColumn: async (title, color) => {
    const projectPath = get().currentProject
    if (!projectPath) throw new Error('No project open')
    try {
      const order = get().columns.length
      const column = await window.electronAPI.createColumn({ title, order, color, projectPath })
      set((s) => ({ columns: [...s.columns, column] }))
    } catch (err) {
      console.error('[addColumn] Error:', err)
      throw err
    }
  },

  updateColumn: async (id, data) => {
    const updated = await window.electronAPI.updateColumn(id, data)
    set((s) => ({ columns: s.columns.map((c) => (c.id === id ? updated : c)) }))
  },


  reorderColumns: (items) => {
    set((s) => ({
      columns: items
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((item) => s.columns.find((c) => c.id === item.id)!)
        .filter(Boolean),
    }))
    window.electronAPI.reorderColumns(items).catch((err) => {
      console.error('Failed to persist column reorder:', err)
    })
  },
  deleteColumn: async (id) => {
    await window.electronAPI.deleteColumn(id)
    set((s) => ({
      columns: s.columns.filter((c) => c.id !== id),
      tasks: s.tasks.filter((t) => t.columnId !== id),
    }))
  },

  addTask: async (data) => {
    const projectPath = get().currentProject
    if (!projectPath) throw new Error('No project open')
    const tasksInCol = get().tasks.filter((t) => t.columnId === data.columnId)
    const order = tasksInCol.length
    const task = await window.electronAPI.createTask({
      title: data.title,
      description: data.description,
      columnId: data.columnId,
      order,
      projectPath,
      agentType: 'pi-agent' as AgentType,
      agentStatus: 'idle' as AgentStatus,
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
