import { ipcMain } from 'electron'
import type { Task, AgentType, AgentStatus } from '../../src/shared/types'
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
  custom_agent_command: string | null
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
    customAgentCommand: row.custom_agent_command ?? undefined,
    tags: JSON.parse(row.tags) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function registerTaskHandlers(): void {
  ipcMain.handle('task:list', (_event: unknown, projectPath?: string): Task[] => {
    const db = getDatabase()
    let rows: TaskRow[]
    if (projectPath) {
      rows = db
        .prepare('SELECT id, title, description, column_id, "order", project_path, agent_type, agent_status, custom_agent_command, tags, created_at, updated_at FROM tasks WHERE project_path = ? ORDER BY "order" ASC')
        .all(projectPath) as TaskRow[]
    } else {
      rows = db
        .prepare('SELECT id, title, description, column_id, "order", project_path, agent_type, agent_status, custom_agent_command, tags, created_at, updated_at FROM tasks ORDER BY "order" ASC')
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
        `INSERT INTO tasks (id, title, description, column_id, "order", project_path, agent_type, agent_status, custom_agent_command, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        data.title,
        data.description ?? '',
        data.columnId,
        data.order,
        data.projectPath ?? '',
        data.agentType ?? 'pi-agent',
        data.agentStatus ?? 'idle',
        data.customAgentCommand ?? null,
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
        agentType: (data.agentType ?? 'pi-agent') as AgentType,
        agentStatus: (data.agentStatus ?? 'idle') as AgentStatus,
        customAgentCommand: data.customAgentCommand,
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
      const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
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
      const tags = data.tags ?? (JSON.parse(existing.tags) as string[])

      db.prepare(
        `UPDATE tasks SET title = ?, description = ?, column_id = ?, "order" = ?, project_path = ?, agent_type = ?, agent_status = ?, custom_agent_command = ?, tags = ?, updated_at = ? WHERE id = ?`,
      ).run(
        title,
        description,
        columnId,
        order,
        projectPath,
        agentType,
        agentStatus,
        customAgentCommand,
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
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined
    if (!row) throw new Error(`Task ${taskId} not found after move`)
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      columnId: row.column_id,
      order: row.order,
      projectPath: row.project_path,
      agentType: row.agent_type as AgentType,
      agentStatus: row.agent_status as AgentStatus,
      customAgentCommand: row.custom_agent_command ?? undefined,
      tags: JSON.parse(row.tags) as string[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  })
}