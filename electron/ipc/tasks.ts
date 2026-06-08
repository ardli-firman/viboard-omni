import { ipcMain } from 'electron'
import type { Task, AgentType, AgentStatus, AgentCliConfig } from '../../src/shared/types'
import { getDatabase } from '../database/init'
import { v4 as uuid } from 'uuid'

interface TaskRow {
  id: string
  title: string
  description: string
  column_id: string
  order: number
  project_path: string
  agent_type: string
  agent_status: string
  agent_session_id: string | null
  custom_agent_command: string | null
  agent_config: string | null
  tags: string
  created_at: number
  updated_at: number
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    columnId: row.column_id,
    order: row.order,
    projectPath: row.project_path,
    agentType: row.agent_type as AgentType,
    agentStatus: row.agent_status as AgentStatus,
    agentSessionId: row.agent_session_id ?? undefined,
    customAgentCommand: row.custom_agent_command ?? undefined,
    agentConfig: row.agent_config ? (JSON.parse(row.agent_config) as Partial<AgentCliConfig>) : undefined,
    tags: JSON.parse(row.tags) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const SELECT_COLS =
  'id, title, description, column_id, "order", project_path, agent_type, agent_status, agent_session_id, custom_agent_command, agent_config, tags, created_at, updated_at'

export function registerTaskHandlers(): void {
  ipcMain.handle('task:list', (_event: unknown, projectPath?: string): Task[] => {
    const db = getDatabase()
    let rows: TaskRow[]
    if (projectPath) {
      rows = db
        .prepare(`SELECT ${SELECT_COLS} FROM tasks WHERE project_path = ? ORDER BY "order" ASC`)
        .all(projectPath) as TaskRow[]
    } else {
      rows = db
        .prepare(`SELECT ${SELECT_COLS} FROM tasks ORDER BY "order" ASC`)
        .all() as TaskRow[]
    }
    return rows.map(rowToTask)
  })

  ipcMain.handle(
    'task:create',
    (_event: unknown, data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task => {
      const db = getDatabase()
      const id = uuid()
      const now = Date.now()
      db.prepare(
        `INSERT INTO tasks (id, title, description, column_id, "order", project_path, agent_type, agent_status, custom_agent_command, agent_config, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        data.title,
        data.description ?? '',
        data.columnId,
        data.order,
        data.projectPath ?? '',
        data.agentType ?? 'oh-my-pi',
        data.agentStatus ?? 'idle',
        data.customAgentCommand ?? null,
        data.agentConfig ? JSON.stringify(data.agentConfig) : null,
        JSON.stringify(data.tags ?? []),
        now,
        now,
      )
      return {
        id,
        title: data.title,
        description: data.description ?? '',
        columnId: data.columnId,
        order: data.order,
        projectPath: data.projectPath ?? '',
        agentType: (data.agentType ?? 'oh-my-pi') as AgentType,
        agentStatus: (data.agentStatus ?? 'idle') as AgentStatus,
        customAgentCommand: data.customAgentCommand,
        agentConfig: data.agentConfig,
        tags: data.tags ?? [],
        createdAt: now,
        updatedAt: now,
      }
    },
  )

  ipcMain.handle(
    'task:update',
    (
      _event: unknown,
      id: string,
      data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>,
    ): Task => {
      const db = getDatabase()
      const existing = db.prepare(`SELECT ${SELECT_COLS}, created_at FROM tasks WHERE id = ?`).get(id) as TaskRow | undefined
      if (!existing) throw new Error(`Task ${id} not found`)

      const now = Date.now()
      const title = data.title ?? existing.title
      const description = data.description ?? existing.description
      const columnId = data.columnId ?? existing.column_id
      const order = data.order ?? existing.order
      const projectPath = data.projectPath ?? existing.project_path
      const agentType = data.agentType ?? (existing.agent_type as AgentType)
      const agentStatus = data.agentStatus ?? (existing.agent_status as AgentStatus)
      const customAgentCommand =
        data.customAgentCommand !== undefined ? data.customAgentCommand : existing.custom_agent_command
      // agentConfig: explicit null clears it; undefined = keep existing
      const agentConfig =
        data.agentConfig !== undefined
          ? data.agentConfig
          : existing.agent_config
            ? (JSON.parse(existing.agent_config) as Partial<AgentCliConfig>)
            : undefined
      const tags = data.tags ?? (JSON.parse(existing.tags) as string[])

      db.prepare(
        `UPDATE tasks SET title = ?, description = ?, column_id = ?, "order" = ?, project_path = ?, agent_type = ?, agent_status = ?, custom_agent_command = ?, agent_config = ?, tags = ?, updated_at = ? WHERE id = ?`,
      ).run(
        title,
        description,
        columnId,
        order,
        projectPath,
        agentType,
        agentStatus,
        customAgentCommand,
        agentConfig ? JSON.stringify(agentConfig) : null,
        JSON.stringify(tags),
        now,
        id,
      )

      return {
        id,
        title,
        description,
        columnId,
        order,
        projectPath,
        agentType: agentType as AgentType,
        agentStatus: agentStatus as AgentStatus,
        customAgentCommand: customAgentCommand ?? undefined,
        agentConfig,
        tags,
        createdAt: existing.created_at,
        updatedAt: now,
      }
    },
  )

  ipcMain.handle('task:delete', (_event: unknown, id: string): void => {
    const db = getDatabase()
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  })

  ipcMain.handle('task:move', (_event: unknown, taskId: string, columnId: string, order: number): Task => {
    const db = getDatabase()
    const now = Date.now()
    db.prepare('UPDATE tasks SET column_id = ?, "order" = ?, updated_at = ? WHERE id = ?').run(
      columnId,
      order,
      now,
      taskId,
    )
    const row = db.prepare(`SELECT ${SELECT_COLS} FROM tasks WHERE id = ?`).get(taskId) as TaskRow | undefined
    if (!row) throw new Error(`Task ${taskId} not found after move`)
    return rowToTask(row)
  })

  ipcMain.handle(
    'task:reorder',
    (_event: unknown, items: { id: string; columnId: string; order: number }[]): void => {
      const db = getDatabase()
      try {
        const stmt = db.prepare('UPDATE tasks SET column_id = ?, "order" = ?, updated_at = ? WHERE id = ?')
        const now = Date.now()
        const txn = db.transaction((rows: { id: string; columnId: string; order: number }[]) => {
          for (const row of rows) {
            stmt.run(row.columnId, row.order, now, row.id)
          }
        })
        txn(items)
      } catch (err) {
        console.error('[task:reorder] Failed:', err)
        throw err
      }
    },
  )
}