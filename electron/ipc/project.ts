import { app, ipcMain, dialog, BrowserWindow } from 'electron'
import { existsSync, readFileSync, writeFileSync, statSync, watch, FSWatcher } from 'node:fs'
import { join, basename } from 'node:path'
import { getDatabase } from '../database/init'
import { v4 as uuid } from 'uuid'
import type { RegisteredProject } from '../../src/shared/types'

const STORE_FILE = 'projects.json'

function getStorePath(): string {
  return join(app.getPath('userData'), STORE_FILE)
}

function readStore(): RegisteredProject[] {
  const file = getStorePath()
  if (!existsSync(file)) return []
  try {
    const raw = readFileSync(file, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is RegisteredProject =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as RegisteredProject).path === 'string' &&
        typeof (p as RegisteredProject).name === 'string' &&
        typeof (p as RegisteredProject).addedAt === 'number' &&
        typeof (p as RegisteredProject).lastOpenedAt === 'number',
    )
  } catch (err) {
    console.error('[project] Failed to read projects store:', err)
    return []
  }
}

function writeStore(projects: RegisteredProject[]): void {
  try {
    writeFileSync(getStorePath(), JSON.stringify(projects, null, 2), 'utf-8')
  } catch (err) {
    console.error('[project] Failed to write projects store:', err)
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}
const DEFAULT_COLUMNS: { title: string; color: string }[] = [
  { title: 'Todo', color: '#3b82f6' },
  { title: 'In Progress', color: '#f59e0b' },
  { title: 'Done', color: '#10b981' },
]

function ensureDefaultBoard(projectPath: string): void {
  const db = getDatabase()
  const row = db
    .prepare('SELECT COUNT(*) as cnt FROM columns WHERE project_path = ?')
    .get(projectPath) as { cnt: number }
  if (row.cnt > 0) return

  const now = Date.now()
  const stmt = db.prepare(
    'INSERT INTO columns (id, title, "order", color, project_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
  const insert = db.transaction((cols: typeof DEFAULT_COLUMNS, pp: string) => {
    cols.forEach((c, idx) => {
      stmt.run(uuid(), c.title, idx, c.color, pp, now, now)
    })
  })
  insert(DEFAULT_COLUMNS, projectPath)
  console.log('[project:add] Seeded default board for', projectPath)
}


async function pickFolder(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Add Project Folder',
    buttonLabel: 'Add Project',
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const path = result.filePaths[0]
  if (!isDirectory(path)) {
    console.error('[project] Not a directory:', path)
    return null
  }
  return path
}

export function registerProjectHandlers(): void {
  console.log('[project] Registering IPC handlers')

  ipcMain.handle('project:list', (): RegisteredProject[] => {
    return readStore().sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
  })

  ipcMain.handle('project:add', async (): Promise<RegisteredProject | null> => {
    const path = await pickFolder()
    if (!path) return null
    const projects = readStore()
    const existing = projects.find((p) => p.path === path)
    if (existing) {
      existing.lastOpenedAt = Date.now()
      writeStore(projects)
      return existing
    }
    const project: RegisteredProject = {
      path,
      name: basename(path) || path,
      addedAt: Date.now(),
      lastOpenedAt: Date.now(),
    }
    projects.push(project)
    writeStore(projects)
    ensureDefaultBoard(path)
    console.log('[project:add] Added:', path)
    return project
  })

  ipcMain.handle('project:remove', (_event: unknown, path: string): boolean => {
    const projects = readStore()
    const next = projects.filter((p) => p.path !== path)
    if (next.length === projects.length) return false
    writeStore(next)
    console.log('[project:remove] Removed:', path)
    return true
  })

  ipcMain.handle('project:touch', (_event: unknown, path: string): void => {
    const projects = readStore()
    const p = projects.find((x) => x.path === path)
    if (p) {
      p.lastOpenedAt = Date.now()
      writeStore(projects)
    }
  })

  // Backward compat: returns the picked path only (does not register)
  ipcMain.handle('project:selectFolder', async (): Promise<string | null> => {
    return pickFolder()
  })

  ipcMain.handle('project:watch', (_event: unknown, path: string): void => {
    startWatching(path)
  })

  ipcMain.handle('project:unwatch', (): void => {
    stopWatching()
  })
}

let activeWatcher: FSWatcher | null = null

function startWatching(dirPath: string): void {
  if (activeWatcher) {
    try {
      activeWatcher.close()
    } catch {}
    activeWatcher = null
  }

  try {
    let debounceTimeout: NodeJS.Timeout | null = null
    activeWatcher = watch(dirPath, { recursive: true }, (_eventType, filename) => {
      if (!filename) return

      const normalized = filename.replace(/\\/g, '/')
      
      // Performance optimization: ignore node_modules instantly
      if (normalized.includes('node_modules')) return

      // Handle .git folder changes (commits, branches, staging/unstaging)
      if (normalized.includes('.git')) {
        const isGitRefOrIndex = 
          normalized.endsWith('.git/index') || 
          normalized.endsWith('.git/HEAD') || 
          normalized.includes('.git/refs/') ||
          normalized === 'index' ||
          normalized === 'HEAD' ||
          normalized.endsWith('index') ||
          normalized.endsWith('HEAD')
        
        if (!isGitRefOrIndex) return
      }

      // Debounce updates by 300ms to group multiple rapid changes (e.g. compilation/save all)
      if (debounceTimeout) clearTimeout(debounceTimeout)
      debounceTimeout = setTimeout(() => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          win.webContents.send('project:file-changed')
        }
      }, 300)
    })
    console.log('[watcher] Started watching project:', dirPath)
  } catch (err) {
    console.error('[watcher] Failed to start watcher:', err)
  }
}

function stopWatching(): void {
  if (activeWatcher) {
    try {
      activeWatcher.close()
      console.log('[watcher] Stopped watching')
    } catch {}
    activeWatcher = null
  }
}

app.on('before-quit', () => {
  stopWatching()
})
