import { contextBridge, ipcRenderer } from 'electron'
import type { Column, Task, ThemeMode } from '../src/shared/types'

const api = {
  selectProjectFolder: (): Promise<string | null> => ipcRenderer.invoke('project:selectFolder'),

  getColumns: (projectPath?: string): Promise<Column[]> => ipcRenderer.invoke('column:list', projectPath),
  createColumn: (data: { title: string; order: number; color?: string; projectPath?: string }): Promise<Column> =>
    ipcRenderer.invoke('column:create', data),
  updateColumn: (id: string, data: { title?: string; order?: number; color?: string }): Promise<Column> =>
    ipcRenderer.invoke('column:update', id, data),
  deleteColumn: (id: string): Promise<void> => ipcRenderer.invoke('column:delete', id),

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
