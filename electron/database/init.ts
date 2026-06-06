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
  return db
}

function migrateSchema(): void {
  // Add updated_at to columns table for databases created before schema v2
  try {
    db.exec('ALTER TABLE columns ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0')
    console.log('[db] Migration: added updated_at to columns table')
  } catch {
    // Column already exists, no migration needed
  }
}

function createTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS columns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      color TEXT,
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
      agent_type TEXT NOT NULL DEFAULT 'pi-agent',
      agent_status TEXT NOT NULL DEFAULT 'idle',
      custom_agent_command TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
    );
  `)
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}
