import { app, ipcMain, dialog } from 'electron'
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
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
}
