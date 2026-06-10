import { create } from 'zustand'
import type { Column, Task, AgentType, AgentStatus, RegisteredProject, ProjectTag } from '@shared/types'
import { useSettingsStore } from './settingsStore'

interface ProjectState {
  projects: RegisteredProject[]
  currentProject: string | null
  columns: Column[]
  tasks: Task[]
  tags: ProjectTag[]
  loading: boolean
  projectsLoaded: boolean
  loadProjects: () => Promise<void>
  addProject: () => Promise<string | null>
  removeProject: (path: string) => Promise<void>
  reorderProjects: (orderedPaths: string[]) => Promise<void>
  openProject: (path: string) => Promise<void>
  closeProject: () => void
  loadData: (projectPath: string) => Promise<void>
  addColumn: (title: string, color?: string) => Promise<void>
  updateColumn: (id: string, data: { title?: string; color?: string }) => Promise<void>
  deleteColumn: (id: string) => Promise<void>
  reorderColumns: (items: { id: string; order: number }[]) => void
  addTask: (data: { title: string; description: string; columnId: string; tags: string[]; agentType?: AgentType; agentConfig?: Partial<import('@shared/types').AgentCliConfig> }) => Promise<void>
  updateTask: (id: string, data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  moveTask: (taskId: string, columnId: string, order: number) => Promise<void>
  setAgentStatus: (taskId: string, status: AgentStatus) => void
  setTaskWorktreeStatus: (taskId: string, status: Task['worktreeStatus'], path: string | null, error?: string) => void
  addProjectTag: (name: string, color: string) => Promise<void>
  updateProjectTag: (id: string, data: { name?: string; color?: string }) => Promise<void>
  deleteProjectTag: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  columns: [],
  tasks: [],
  tags: [],
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
        tags: close ? [] : s.tags,
      }
    })
  },

  reorderProjects: async (orderedPaths) => {
    set((s) => {
      const ordered = orderedPaths
        .map((pPath) => s.projects.find((p) => p.path === pPath))
        .filter((p): p is RegisteredProject => !!p)
      const missing = s.projects.filter((p) => !orderedPaths.includes(p.path))
      return { projects: [...ordered, ...missing] }
    })
    try {
      await window.electronAPI.reorderProjects(orderedPaths)
    } catch (err) {
      console.error('Failed to reorder projects:', err)
      await get().loadProjects()
    }
  },

  openProject: async (path) => {
    set({
      currentProject: path,
      columns: [],
      tasks: [],
      tags: [],
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
      tags: [],
      loading: false,
    })
  },

  loadData: async (projectPath) => {
    set({ loading: true })
    try {
      const [columns, tasks, tags] = await Promise.all([
        window.electronAPI.getColumns(projectPath),
        window.electronAPI.getTasks(projectPath),
        window.electronAPI.getProjectTags(projectPath),
      ])
      set({ columns, tasks, tags: tags || [], loading: false })
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
        .map((item) => {
          const col = s.columns.find((c) => c.id === item.id)
          return col ? { ...col, order: item.order } : null
        })
        .filter((c): c is Column => c !== null),
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
    // Use provided agent type or fall back to global default
    const defaultAgentType: AgentType =
      data.agentType ?? useSettingsStore.getState().settings.defaultAgentType ?? 'oh-my-pi'
    const task = await window.electronAPI.createTask({
      title: data.title,
      description: data.description,
      columnId: data.columnId,
      order,
      projectPath,
      agentType: defaultAgentType,
      agentStatus: 'idle' as AgentStatus,
      agentConfig: data.agentConfig,
      tags: data.tags,
      subtasks: [],
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

  setTaskWorktreeStatus: (taskId, status, path, error) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              worktreeStatus: status,
              worktreePath: path ?? undefined,
              worktreeError: error ?? undefined,
            }
          : t,
      ),
    }))
  },

  addProjectTag: async (name, color) => {
    const projectPath = get().currentProject
    if (!projectPath) throw new Error('No project open')
    try {
      const tag = await window.electronAPI.createProjectTag({ projectPath, name, color })
      set((s) => ({ tags: [...s.tags, tag] }))
    } catch (err) {
      console.error('[addProjectTag] Error:', err)
      throw err
    }
  },

  updateProjectTag: async (id, data) => {
    try {
      const updated = await window.electronAPI.updateProjectTag(id, data)
      set((s) => ({ tags: s.tags.map((t) => (t.id === id ? updated : t)) }))
    } catch (err) {
      console.error('[updateProjectTag] Error:', err)
      throw err
    }
  },

  deleteProjectTag: async (id) => {
    try {
      await window.electronAPI.deleteProjectTag(id)
      set((s) => ({
        tags: s.tags.filter((t) => t.id !== id),
        // Clean up from local tasks
        tasks: s.tasks.map((t) =>
          t.tags.includes(id) ? { ...t, tags: t.tags.filter((tid) => tid !== id) } : t
        ),
      }))
    } catch (err) {
      console.error('[deleteProjectTag] Error:', err)
      throw err
    }
  },
}))
