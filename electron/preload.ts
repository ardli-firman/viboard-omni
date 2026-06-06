import { contextBridge, ipcRenderer } from 'electron'
import type { Column, Task, ThemeMode, RegisteredProject, AgentOutputEvent } from '../src/shared/types'
import type { FileEntry, FileTreeItem } from './ipc/files'

type AgentStatus = 'idle' | 'running' | 'completed' | 'error'

const api = {
  // Project list
  listProjects: (): Promise<RegisteredProject[]> => ipcRenderer.invoke('project:list'),
  addProject: (): Promise<RegisteredProject | null> => ipcRenderer.invoke('project:add'),
  removeProject: (path: string): Promise<boolean> => ipcRenderer.invoke('project:remove', path),
  touchProject: (path: string): Promise<void> => ipcRenderer.invoke('project:touch', path),

  // Folder picker (not auto-registered)
  selectProjectFolder: (): Promise<string | null> => ipcRenderer.invoke('project:selectFolder'),

  // File operations
  listDir: (dirPath: string): Promise<FileEntry[]> =>
    ipcRenderer.invoke('file:listDir', dirPath),
  readFile: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('file:readFile', filePath),
  readImage: (filePath: string): Promise<{ dataUrl: string; mimeType: string; size: number } | null> =>
    ipcRenderer.invoke('file:readImage', filePath),
  getFileTree: (dirPath: string): Promise<FileTreeItem[]> =>
    ipcRenderer.invoke('file:getTree', dirPath),
  statFile: (filePath: string): Promise<FileEntry | null> =>
    ipcRenderer.invoke('file:stat', filePath),

  getColumns: (projectPath?: string): Promise<Column[]> => ipcRenderer.invoke('column:list', projectPath),
  createColumn: (data: { title: string; order: number; color?: string; projectPath?: string }): Promise<Column> =>
    ipcRenderer.invoke('column:create', data),
  updateColumn: (id: string, data: { title?: string; order?: number; color?: string }): Promise<Column> =>
    ipcRenderer.invoke('column:update', id, data),
  deleteColumn: (id: string): Promise<void> => ipcRenderer.invoke('column:delete', id),
  reorderColumns: (items: { id: string; order: number }[]): Promise<void> =>
    ipcRenderer.invoke('column:reorder', items),

  getTasks: (projectPath?: string): Promise<Task[]> => ipcRenderer.invoke('task:list', projectPath),
  createTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> =>
    ipcRenderer.invoke('task:create', data),
  updateTask: (id: string, data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Task> =>
    ipcRenderer.invoke('task:update', id, data),
  deleteTask: (id: string): Promise<void> => ipcRenderer.invoke('task:delete', id),
  moveTask: (taskId: string, columnId: string, order: number): Promise<Task> =>
    ipcRenderer.invoke('task:move', taskId, columnId, order),

  // OMP agent session per task — chat-style, no terminal. One persistent session
  // per task; each prompt spawns a short-lived omp process that streams NDJSON
  // events back to the renderer.
  sendAgentPrompt: (
    taskId: string,
    projectPath: string,
    prompt: string,
  ): Promise<{ promptId: number; sessionId: string | null }> =>
    ipcRenderer.invoke('agent:prompt', { taskId, projectPath, prompt }),
  killAgent: (taskId: string): Promise<void> =>
    ipcRenderer.invoke('agent:kill', taskId),
  getAgentStatus: (taskId: string): Promise<AgentStatus> =>
    ipcRenderer.invoke('agent:status', taskId),
  resetAgentSession: (taskId: string): Promise<void> =>
    ipcRenderer.invoke('agent:reset', taskId),

  onAgentOutput: (callback: (data: AgentOutputEvent) => void): void => {
    const handler = (_event: Electron.IpcRendererEvent, data: AgentOutputEvent): void =>
      callback(data)
    ipcRenderer.on('agent:output', handler)
  },
  removeAgentOutputListener: (): void => {
    ipcRenderer.removeAllListeners('agent:output')
  },

  onAgentStatus: (callback: (data: { taskId: string; status: AgentStatus }) => void): void => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { taskId: string; status: AgentStatus },
    ): void => callback(data)
    ipcRenderer.on('agent:status', handler)
  },
  removeAgentStatusListener: (): void => {
    ipcRenderer.removeAllListeners('agent:status')
  },

  getTheme: (): Promise<ThemeMode> => ipcRenderer.invoke('theme:get'),
  setTheme: (theme: ThemeMode): Promise<void> => ipcRenderer.invoke('theme:set', theme),
  log: {
    info: (...args: unknown[]): void => {
      ipcRenderer.send('log:info', ...args)
    },
    error: (...args: unknown[]): void => {
      ipcRenderer.send('log:error', ...args)
    },
    warn: (...args: unknown[]): void => {
      ipcRenderer.send('log:warn', ...args)
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
