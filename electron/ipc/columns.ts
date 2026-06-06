import { ipcMain } from 'electron'
import type { Column } from '../../src/shared/types'
import { getDatabase } from '../database/init'
import { v4 as uuid } from 'uuid'

interface ColumnRow {
  id: string
  title: string
  order: number
  color: string | null
  created_at: number
  updated_at: number
}

function rowToColumn(row: ColumnRow): Column {
  return {
    id: row.id,
    title: row.title,
    order: row.order,
    color: row.color ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function registerColumnHandlers(): void {
  console.log('[columns] Registering IPC handlers')

  ipcMain.handle('column:list', (): Column[] => {
    console.log('[column:list] Loading columns')
    const db = getDatabase()
    const rows = db
      .prepare(
        'SELECT id, title, "order", color, created_at, updated_at FROM columns ORDER BY "order" ASC',
      )
      .all() as ColumnRow[]
    const result = rows.map(rowToColumn)
    console.log('[column:list] Loaded', result.length, 'columns')
    return result
  })

  ipcMain.handle(
    'column:create',
    (_event: unknown, data: { title: string; order: number; color?: string }): Column => {
      console.log('[column:create] Creating column:', data.title, 'order:', data.order)
      const db = getDatabase()
      const id = uuid()
      const now = Date.now()
      try {
        db.prepare(
          'INSERT INTO columns (id, title, "order", color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(id, data.title, data.order, data.color ?? null, now, now)
        const result = {
          id,
          title: data.title,
          order: data.order,
          color: data.color,
          createdAt: now,
          updatedAt: now,
        }
        console.log('[column:create] Success:', id)
        return result
      } catch (err) {
        console.error('[column:create] Failed:', err)
        throw err
      }
    },
  )

  ipcMain.handle(
    'column:update',
    (_event: unknown, id: string, data: { title?: string; order?: number; color?: string }): Column => {
      console.log('[column:update] Updating column:', id, data)
      const db = getDatabase()
      const existing = db.prepare('SELECT * FROM columns WHERE id = ?').get(id) as ColumnRow | undefined
      if (!existing) throw new Error(`Column ${id} not found`)
      const title = data.title ?? existing.title
      const order = data.order ?? existing.order
      const color = data.color !== undefined ? data.color : existing.color
      const now = Date.now()
      try {
        db.prepare(
          'UPDATE columns SET title = ?, "order" = ?, color = ?, updated_at = ? WHERE id = ?',
        ).run(title, order, color, now, id)
        const result = {
          id,
          title,
          order,
          color: color ?? undefined,
          createdAt: existing.created_at,
          updatedAt: now,
        }
        console.log('[column:update] Success:', id)
        return result
      } catch (err) {
        console.error('[column:update] Failed:', err)
        throw err
      }
    },
  )

  ipcMain.handle('column:delete', (_event: unknown, id: string): void => {
    console.log('[column:delete] Deleting column:', id)
    const db = getDatabase()
    try {
      db.prepare('DELETE FROM columns WHERE id = ?').run(id)
      console.log('[column:delete] Success:', id)
    } catch (err) {
      console.error('[column:delete] Failed:', err)
      throw err
    }
  })
}
