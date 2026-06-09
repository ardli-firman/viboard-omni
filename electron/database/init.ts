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

  // Check if this is a fresh database (no tables created yet)
  const tablesCountRow = db
    .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .get() as { count: number }
  const isFresh = !tablesCountRow || tablesCountRow.count === 0

  if (isFresh) {
    console.log('[db] Fresh database detected. Initializing latest schema.')
    createTables()
    db.pragma('user_version = 7') // Initialize user_version to the latest version
  } else {
    // Run schema migrations for existing databases
    migrateSchema()
  }

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

interface Migration {
  version: number
  description: string
  run: (db: Database.Database) => void
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  try {
    const columns = db.pragma(`table_info(${table})`) as { name: string }[]
    return columns.some((col) => col.name === column)
  } catch (err) {
    console.error(`[db] Failed to check if column ${column} exists in table ${table}:`, err)
    return false
  }
}

const MIGRATIONS: Migration[] = [
  {
    version: 2,
    description: 'Add updated_at to columns table',
    run: (db) => {
      if (!columnExists(db, 'columns', 'updated_at')) {
        db.exec('ALTER TABLE columns ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0')
      }
    },
  },
  {
    version: 3,
    description: 'Add project_path to columns table',
    run: (db) => {
      if (!columnExists(db, 'columns', 'project_path')) {
        db.exec("ALTER TABLE columns ADD COLUMN project_path TEXT NOT NULL DEFAULT ''")
      }
    },
  },
  {
    version: 4,
    description: 'Add agent_session_id to tasks table',
    run: (db) => {
      if (!columnExists(db, 'tasks', 'agent_session_id')) {
        db.exec('ALTER TABLE tasks ADD COLUMN agent_session_id TEXT DEFAULT NULL')
      }
    },
  },
  {
    version: 5,
    description: 'Add agent_config to tasks table',
    run: (db) => {
      if (!columnExists(db, 'tasks', 'agent_config')) {
        db.exec('ALTER TABLE tasks ADD COLUMN agent_config TEXT DEFAULT NULL')
      }
    },
  },
  {
    version: 6,
    description: "Rename legacy 'pi-agent' to 'oh-my-pi'",
    run: (db) => {
      if (columnExists(db, 'tasks', 'agent_type')) {
        db.prepare(`UPDATE tasks SET agent_type = 'oh-my-pi' WHERE agent_type = 'pi-agent'`).run()
      }
    },
  },
  {
    version: 7,
    description: 'Add subtasks column to tasks table',
    run: (db) => {
      if (!columnExists(db, 'tasks', 'subtasks')) {
        db.exec("ALTER TABLE tasks ADD COLUMN subtasks TEXT NOT NULL DEFAULT '[]'")
      }
    },
  },
]

function migrateSchema(): void {
  const versionRow = db.prepare('PRAGMA user_version').get() as { user_version: number }
  const currentVersion = versionRow ? versionRow.user_version : 0
  const latestVersion = 7

  if (currentVersion >= latestVersion) {
    return
  }

  console.log(`[db] Current database version: ${currentVersion}. Migrating to: ${latestVersion}`)

  // Run migrations in a transaction to ensure atomic updates
  const runMigrationTx = db.transaction(() => {
    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        console.log(`[db] Running migration v${migration.version}: ${migration.description}`)
        migration.run(db)
        db.pragma(`user_version = ${migration.version}`)
      }
    }
  })

  try {
    runMigrationTx()
    console.log('[db] Database migrations completed successfully.')
  } catch (err) {
    console.error('[db] Database migration failed. Transaction rolled back:', err)
    throw err
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
      agent_config TEXT DEFAULT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      subtasks TEXT NOT NULL DEFAULT '[]',
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
