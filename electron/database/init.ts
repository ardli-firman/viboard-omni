import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

let db: Database.Database

export function initDatabase(): Database.Database {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'databases')
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }
  const dbPath = join(dbDir, 'viboard.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  createTables()
  migrateSchema()

  // Clean up any stale "running" statuses on startup
  try {
    const result = db.prepare("UPDATE tasks SET agent_status = 'idle' WHERE agent_status = 'running'").run()
    if (result.changes > 0) {
      console.log(`[db] Reset ${result.changes} stale running task status(es) to idle on startup`)
    }
  } catch (err) {
    console.error('[db] Failed to reset stale task statuses on startup:', err)
  }

  return db
}

function migrateSchema(): void {
  const versionRow = db.prepare('PRAGMA user_version').get() as { user_version: number }
  const currentVersion = versionRow ? versionRow.user_version : 0

  // v2: Add updated_at to columns table
  try {
    db.exec('ALTER TABLE columns ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0')
    console.log('[db] Migration: added updated_at to columns table')
  } catch {
    // Column already exists
  }

  // v3: Add project_path to columns table
  try {
    db.exec("ALTER TABLE columns ADD COLUMN project_path TEXT NOT NULL DEFAULT ''")
    console.log('[db] Migration: added project_path to columns table')
  } catch {
    // Column already exists
  }

  // v4: Add agent_session_id to tasks table for OMP session persistence
  try {
    db.exec('ALTER TABLE tasks ADD COLUMN agent_session_id TEXT DEFAULT NULL')
    console.log('[db] Migration: added agent_session_id to tasks table')
  } catch {
    // Column already exists
  }

  // v5: Add agent_config JSON column for per-task agent CLI overrides
  try {
    db.exec('ALTER TABLE tasks ADD COLUMN agent_config TEXT DEFAULT NULL')
    console.log('[db] Migration: added agent_config to tasks table')
  } catch {
    // Column already exists
  }

  // v6: Rename legacy 'pi-agent' agent_type to 'oh-my-pi'
  //     Tasks created before the driver refactor had 'pi-agent' hardcoded.
  if (currentVersion < 6) {
    try {
      const result = db.prepare(`UPDATE tasks SET agent_type = 'oh-my-pi' WHERE agent_type = 'pi-agent'`).run()
      if (result.changes > 0) {
        console.log(`[db] Migration v6: updated ${result.changes} task(s) from pi-agent → oh-my-pi`)
      }
      db.pragma('user_version = 6')
      console.log('[db] Migration: database version set to 6')
    } catch (err) {
      console.error('[db] Migration v6 failed:', err)
    }
  }
}

function createTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS columns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      color TEXT,
      project_path TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      column_id TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      project_path TEXT DEFAULT '',
      agent_type TEXT NOT NULL DEFAULT 'oh-my-pi',
      agent_status TEXT NOT NULL DEFAULT 'idle',
      agent_session_id TEXT DEFAULT NULL,
      custom_agent_command TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_tags (
      id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL
    );
  `)
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}
