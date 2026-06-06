import { contextBridge, ipcRenderer } from 'electron'
import type { Column, Task, ThemeMode, RegisteredProject } from '../src/shared/types'
import type { FileEntry, FileTreeItem } from './ipc/files'

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

  spawnTerminal: (taskId: string, projectPath: string): Promise<{ pid: number | null }> =>
    ipcRenderer.invoke('terminal:spawn', { taskId, projectPath }),
  sendTerminalInput: (taskId: string, input: string): Promise<void> =>
    ipcRenderer.invoke('terminal:input', { taskId, input }),
  resizeTerminal: (taskId: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke('terminal:resize', { taskId, cols, rows }),
  killTerminal: (taskId: string): Promise<void> =>
    ipcRenderer.invoke('terminal:kill', { taskId }),

  onTerminalOutput: (callback: (data: { taskId: string; data: string }) => void): void => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { taskId: string; data: string },
    ): void => callback(data)
    ipcRenderer.on('terminal:output', handler)
  },
  removeTerminalOutputListener: (): void => {
    ipcRenderer.removeAllListeners('terminal:output')
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
