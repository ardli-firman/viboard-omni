import { ipcMain } from 'electron'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'

export interface FileEntry {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  size: number
  extension: string
}

export interface FileTreeItem {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  size: number
  extension: string
  children?: FileTreeItem[]
}

function getFileEntry(basePath: string, entryPath: string): FileEntry {
  const fullPath = join(basePath, entryPath)
  const stats = statSync(fullPath)
  return {
    name: basename(fullPath),
    path: fullPath,
    relativePath: entryPath,
    isDirectory: stats.isDirectory(),
    size: stats.size,
    extension: stats.isDirectory()
      ? ''
      : '.' + (basename(fullPath).split('.').pop() ?? '').toLowerCase(),
  }
}

function isBinary(ext: string): boolean {
  const binaryExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.webm',
    '.zip', '.tar', '.gz', '.7z', '.rar',
    '.exe', '.dll', '.so', '.dylib', '.wasm',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.o', '.a', '.lib', '.obj',
  ])
  return binaryExtensions.has(ext.toLowerCase())
}

function shouldIgnore(name: string): boolean {
  const ignored = new Set([
    '.git', 'node_modules', '.DS_Store', 'Thumbs.db',
    '.gitkeep',
  ])
  return ignored.has(name)
}

function buildTree(basePath: string, depth: number = 0): FileTreeItem[] {
  if (depth > 20) return []

  try {
    const entries = readdirSync(basePath)
    const items: FileTreeItem[] = []

    for (const name of entries) {
      if (shouldIgnore(name)) continue
      const fullPath = join(basePath, name)
      try {
        const stats = statSync(fullPath)
        const isDir = stats.isDirectory()
        const ext = isDir
          ? ''
          : name.includes('.') ? '.' + name.split('.').pop()!.toLowerCase() : ''
        const entry: FileTreeItem = {
          name,
          path: fullPath,
          relativePath: '',
          isDirectory: isDir,
          size: stats.size,
          extension: ext,
        }

        if (isDir) {
          entry.children = buildTree(fullPath, depth + 1)
        }

        items.push(entry)
      } catch {
        // skip inaccessible entries
      }
    }

    items.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return items
  } catch {
    return []
  }
}

function computeRelativePath(tree: FileTreeItem[], basePath: string): void {
  for (const item of tree) {
    item.relativePath = relative(basePath, item.path).replace(/\\/g, '/')
    if (item.children) {
      computeRelativePath(item.children, basePath)
    }
  }
}

export function registerFileHandlers(): void {
  console.log('[files] Registering IPC handlers')

  ipcMain.handle('file:listDir', (_event: unknown, dirPath: string): FileEntry[] => {
    try {
      const entries = readdirSync(dirPath)
      const items: FileEntry[] = []

      for (const name of entries) {
        if (shouldIgnore(name)) continue
        try {
          items.push(getFileEntry(dirPath, name))
        } catch {
          // skip inaccessible
        }
      }

      items.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })

      return items
    } catch (err) {
      console.error('[files] Failed to list directory:', err)
      return []
    }
  })

  ipcMain.handle('file:readFile', (_event: unknown, filePath: string): string | null => {
    try {
      const stats = statSync(filePath)
      if (!stats.isFile()) return null

      const ext = filePath.includes('.')
        ? '.' + filePath.split('.').pop()!.toLowerCase()
        : ''
      if (isBinary(ext)) {
        return null
      }

      return readFileSync(filePath, 'utf-8')
    } catch (err) {
      console.error('[files] Failed to read file:', err)
      return null
    }
  })

  ipcMain.handle('file:getTree', (_event: unknown, dirPath: string): FileTreeItem[] => {
    const tree = buildTree(dirPath)
    computeRelativePath(tree, dirPath)
    return tree
  })

  ipcMain.handle('file:stat', (_event: unknown, filePath: string): FileEntry | null => {
    try {
      const parentDir = filePath.split(/[\\/]/).slice(0, -1).join('/')
      const name = basename(filePath)
      return getFileEntry(parentDir || '.', name)
    } catch {
      return null
    }
  })
}
