import { ipcMain } from 'electron'
import type { ProjectTag } from '../../src/shared/types'
import { getDatabase } from '../database/init'
import { v4 as uuid } from 'uuid'

interface TagRow {
  id: string
  project_path: string
  name: string
  color: string
}

function rowToTag(row: TagRow): ProjectTag {
  return {
    id: row.id,
    projectPath: row.project_path,
    name: row.name,
    color: row.color,
  }
}

const DEFAULT_TAGS = [
  { name: 'High Priority', color: '#ef4444' },
  { name: 'Medium Priority', color: '#f59e0b' },
  { name: 'Low Priority', color: '#64748b' },
  { name: 'Bug', color: '#dc2626' },
  { name: 'Feature', color: '#3b82f6' },
  { name: 'Refactor', color: '#8b5cf6' },
]

function ensureDefaultTags(projectPath: string): ProjectTag[] {
  const db = getDatabase()
  const row = db
    .prepare('SELECT COUNT(*) as cnt FROM project_tags WHERE project_path = ?')
    .get(projectPath) as { cnt: number }

  if (row.cnt > 0) {
    const rows = db
      .prepare('SELECT id, project_path, name, color FROM project_tags WHERE project_path = ?')
      .all(projectPath) as TagRow[]
    return rows.map(rowToTag)
  }

  const stmt = db.prepare(
    'INSERT INTO project_tags (id, project_path, name, color) VALUES (?, ?, ?, ?)'
  )

  const createdTags: ProjectTag[] = []
  const insert = db.transaction((tags: typeof DEFAULT_TAGS, pp: string) => {
    tags.forEach((tag) => {
      const id = uuid()
      stmt.run(id, pp, tag.name, tag.color)
      createdTags.push({
        id,
        projectPath: pp,
        name: tag.name,
        color: tag.color,
      })
    })
  })

  insert(DEFAULT_TAGS, projectPath)
  console.log('[tags:seed] Seeded default tags for project', projectPath)
  return createdTags
}

export function registerTagHandlers(): void {
  console.log('[tags] Registering IPC handlers')

  ipcMain.handle('tag:list', (_event: unknown, projectPath?: string): ProjectTag[] => {
    console.log('[tag:list] Loading tags for project:', projectPath)
    if (!projectPath) return []
    try {
      return ensureDefaultTags(projectPath)
    } catch (err) {
      console.error('[tag:list] Failed to load tags:', err)
      return []
    }
  })

  ipcMain.handle(
    'tag:create',
    (_event: unknown, data: { projectPath: string; name: string; color: string }): ProjectTag => {
      console.log('[tag:create] Creating tag:', data.name, 'color:', data.color, 'project:', data.projectPath)
      const db = getDatabase()
      const id = uuid()
      try {
        db.prepare(
          'INSERT INTO project_tags (id, project_path, name, color) VALUES (?, ?, ?, ?)'
        ).run(id, data.projectPath, data.name, data.color)
        
        const result = {
          id,
          projectPath: data.projectPath,
          name: data.name,
          color: data.color,
        }
        console.log('[tag:create] Success:', id)
        return result
      } catch (err) {
        console.error('[tag:create] Failed:', err)
        throw err
      }
    }
  )

  ipcMain.handle(
    'tag:update',
    (_event: unknown, id: string, data: { name?: string; color?: string }): ProjectTag => {
      console.log('[tag:update] Updating tag:', id, data)
      const db = getDatabase()
      const existing = db.prepare('SELECT * FROM project_tags WHERE id = ?').get(id) as TagRow | undefined
      if (!existing) throw new Error(`Tag ${id} not found`)

      const name = data.name ?? existing.name
      const color = data.color ?? existing.color

      try {
        db.prepare(
          'UPDATE project_tags SET name = ?, color = ? WHERE id = ?'
        ).run(name, color, id)

        const result = {
          id,
          projectPath: existing.project_path,
          name,
          color,
        }
        console.log('[tag:update] Success:', id)
        return result
      } catch (err) {
        console.error('[tag:update] Failed:', err)
        throw err
      }
    }
  )

  ipcMain.handle('tag:delete', (_event: unknown, id: string): void => {
    console.log('[tag:delete] Deleting tag:', id)
    const db = getDatabase()
    try {
      db.prepare('DELETE FROM project_tags WHERE id = ?').run(id)
      console.log('[tag:delete] Success:', id)
    } catch (err) {
      console.error('[tag:delete] Failed:', err)
      throw err
    }
  })
}
