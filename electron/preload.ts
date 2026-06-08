import { contextBridge, ipcRenderer } from 'electron'
import type {
  Column,
  Task,
  ThemeMode,
  RegisteredProject,
  AgentOutputEvent,
  AgentActivity,
  AgentType,
  AgentCliConfig,
  AppSettings,
  ProjectTag,
} from '../src/shared/types'
import type { FileEntry, FileTreeItem } from './ipc/files'

type AgentStatus = 'idle' | 'running' | 'completed' | 'error'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IpcHandler = (...args: any[]) => void

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

  getGitStatus: (dirPath: string): Promise<Record<string, string>> =>
    ipcRenderer.invoke('git:getStatus', dirPath),
  getGitHeadContent: (dirPath: string, filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('git:getHeadContent', dirPath, filePath),
  getGitBranch: (dirPath: string): Promise<string> =>
    ipcRenderer.invoke('git:getCurrentBranch', dirPath),
  gitAdd: (dirPath: string, filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('git:add', dirPath, filePath),
  gitUnstage: (dirPath: string, filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('git:unstage', dirPath, filePath),
  gitDiscard: (dirPath: string, filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('git:discard', dirPath, filePath),
  gitCommit: (dirPath: string, message: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('git:commit', dirPath, message),
  gitPush: (dirPath: string): Promise<{ success: boolean; error?: string; output?: string }> =>
    ipcRenderer.invoke('git:push', dirPath),
  gitPull: (dirPath: string): Promise<{ success: boolean; error?: string; output?: string }> =>
    ipcRenderer.invoke('git:pull', dirPath),
  gitFetch: (dirPath: string): Promise<{ success: boolean; error?: string; output?: string }> =>
    ipcRenderer.invoke('git:fetch', dirPath),
  gitInit: (dirPath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('git:init', dirPath),

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
  reorderTasks: (items: { id: string; columnId: string; order: number }[]): Promise<void> =>
    ipcRenderer.invoke('task:reorder', items),

  // Tags operations
  getProjectTags: (projectPath?: string): Promise<ProjectTag[]> =>
    ipcRenderer.invoke('tag:list', projectPath),
  createProjectTag: (data: { projectPath: string; name: string; color: string }): Promise<ProjectTag> =>
    ipcRenderer.invoke('tag:create', data),
  updateProjectTag: (id: string, data: { name?: string; color?: string }): Promise<ProjectTag> =>
    ipcRenderer.invoke('tag:update', id, data),
  deleteProjectTag: (id: string): Promise<void> => ipcRenderer.invoke('tag:delete', id),

  // ── Global App Settings ──────────────────────────────────────────
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', patch),

  // ── Terminal PTY methods ─────────────────────────────────────────
  spawnAgentPty: (
    taskId: string,
    projectPath: string,
    cols: number,
    rows: number,
    agentType: AgentType,
    globalAgentConfig: Partial<AgentCliConfig> | undefined,
    taskAgentConfig: Partial<AgentCliConfig> | undefined,
  ): Promise<void> =>
    ipcRenderer.invoke('agent:pty:spawn', {
      taskId,
      projectPath,
      cols,
      rows,
      agentType,
      globalAgentConfig,
      taskAgentConfig,
    }),
  sendAgentPtyData: (taskId: string, data: string): Promise<void> =>
    ipcRenderer.invoke('agent:pty:data', { taskId, data }),
  resizeAgentPty: (taskId: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke('agent:pty:resize', { taskId, cols, rows }),
  killAgentPty: (taskId: string): Promise<void> =>
    ipcRenderer.invoke('agent:pty:kill', taskId),

  // Scoped listener pattern: returns the handler so the caller can
  // remove *just that specific handler* instead of nuking all listeners.
  onAgentPtyOutput: (callback: (data: { taskId: string; data: string }) => void): IpcHandler => {
    const handler = (_event: Electron.IpcRendererEvent, data: { taskId: string; data: string }): void =>
      callback(data)
    ipcRenderer.on('agent:pty:output', handler)
    return handler
  },
  removeAgentPtyOutputListener: (handler?: IpcHandler): void => {
    if (handler) {
      ipcRenderer.removeListener('agent:pty:output', handler)
    } else {
      ipcRenderer.removeAllListeners('agent:pty:output')
    }
  },

  onAgentStatus: (callback: (data: { taskId: string; status: AgentStatus }) => void): IpcHandler => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { taskId: string; status: AgentStatus },
    ): void => callback(data)
    ipcRenderer.on('agent:status', handler)
    return handler
  },
  removeAgentStatusListener: (handler?: IpcHandler): void => {
    if (handler) {
      ipcRenderer.removeListener('agent:status', handler)
    } else {
      ipcRenderer.removeAllListeners('agent:status')
    }
  },

  onAgentActivity: (callback: (data: { taskId: string; activity: AgentActivity }) => void): IpcHandler => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { taskId: string; activity: AgentActivity },
    ): void => callback(data)
    ipcRenderer.on('agent:activity', handler)
    return handler
  },
  removeAgentActivityListener: (handler?: IpcHandler): void => {
    if (handler) {
      ipcRenderer.removeListener('agent:activity', handler)
    } else {
      ipcRenderer.removeAllListeners('agent:activity')
    }
  },

  getTheme: (): Promise<ThemeMode> => ipcRenderer.invoke('theme:get'),
  setTheme: (theme: ThemeMode): Promise<void> => ipcRenderer.invoke('theme:set', theme),

  watchProject: (path: string): Promise<void> => ipcRenderer.invoke('project:watch', path),
  unwatchProject: (): Promise<void> => ipcRenderer.invoke('project:unwatch'),

  onProjectFileChanged: (callback: () => void): IpcHandler => {
    const handler = (): void => callback()
    ipcRenderer.on('project:file-changed', handler)
    return handler
  },
  removeProjectFileChangedListener: (handler?: IpcHandler): void => {
    if (handler) {
      ipcRenderer.removeListener('project:file-changed', handler)
    } else {
      ipcRenderer.removeAllListeners('project:file-changed')
    }
  },
  log: {
    info: (...args: unknown[]): void => {
      const isDev = process.env.NODE_ENV === 'development' || !!(process as any).defaultApp
      if (isDev) {
        ipcRenderer.send('log:info', ...args)
      }
    },
    error: (...args: unknown[]): void => {
      const isDev = process.env.NODE_ENV === 'development' || !!(process as any).defaultApp
      if (isDev) {
        ipcRenderer.send('log:error', ...args)
      }
    },
    warn: (...args: unknown[]): void => {
      const isDev = process.env.NODE_ENV === 'development' || !!(process as any).defaultApp
      if (isDev) {
        ipcRenderer.send('log:warn', ...args)
      }
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
