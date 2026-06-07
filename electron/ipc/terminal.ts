import { ipcMain, BrowserWindow, app } from 'electron'
import * as os from 'node:os'
import * as path from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { getDatabase } from '../database/init'
import * as pty from '@cocktailpeanut/node-pty-prebuilt-multiarch'
import type { AgentStatus, AgentActivity } from '../../src/shared/types'

interface PtyRun {
  taskId: string
  childProcess: pty.IPty
  status: AgentStatus
  createdAt: number
  activity: AgentActivity
  lastOutputAt: number
  idleTimer: ReturnType<typeof setTimeout> | null
}

const runs = new Map<string, PtyRun>()

// ── Output Batching ──────────────────────────────────────────────────
// Instead of firing an IPC message per PTY data chunk (thousands/sec),
// we accumulate output into a buffer and flush every 16ms (~60fps).
// This reduces IPC serialization overhead by ~100x.

const OUTPUT_FLUSH_INTERVAL = 16 // ms
const OUTPUT_BUFFER_MAX = 256 * 1024 // 256KB max buffer per task
const outputBuffers = new Map<string, string>()
let flushTimer: ReturnType<typeof setInterval> | null = null

function startOutputFlusher(): void {
  if (flushTimer) return
  flushTimer = setInterval(() => {
    for (const [taskId, data] of outputBuffers) {
      if (data.length > 0) {
        broadcast('agent:pty:output', { taskId, data })
        outputBuffers.set(taskId, '')
      }
    }
    // Stop timer when no active buffers
    if (outputBuffers.size === 0 && flushTimer) {
      clearInterval(flushTimer)
      flushTimer = null
    }
  }, OUTPUT_FLUSH_INTERVAL)
}

function appendOutput(taskId: string, chunk: string): void {
  let combined = (outputBuffers.get(taskId) ?? '') + chunk
  // Enforce max buffer size — drop oldest content to prevent memory growth
  if (combined.length > OUTPUT_BUFFER_MAX) {
    combined = combined.slice(-OUTPUT_BUFFER_MAX)
  }
  outputBuffers.set(taskId, combined)
  startOutputFlusher()
}

function flushOutput(taskId: string): void {
  const data = outputBuffers.get(taskId)
  if (data && data.length > 0) {
    broadcast('agent:pty:output', { taskId, data })
  }
  outputBuffers.delete(taskId)
}

// ── Activity Detection ───────────────────────────────────────────────
// Detects the real-time operational state of the OMP agent by analyzing
// PTY output patterns (spinner chars, tool headers, text flow, silence).

/** How many ms of silence before we consider the agent "waiting" at prompt */
const IDLE_THRESHOLD_MS = 3000

/**
 * Heuristic patterns to detect what the OMP agent is doing.
 * These are matched against each raw PTY output chunk.
 */
function detectActivity(chunk: string): AgentActivity | null {
  // Strip ANSI escape codes for pattern matching
  const clean = chunk.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '')

  // Tool use patterns: OMP shows tool headers like "⚡ bash", "✏ edit", "📝 write", etc.
  if (/[⚡✏📝🔍🌐🔧▶]\s*(bash|edit|write|read|grep|find|web_search|browser|python|task|lsp)/i.test(clean)) {
    return 'tool_use'
  }

  // Thinking/spinner patterns: OMP shows spinner characters or "thinking" indicators
  if (/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⣾⣽⣻⢿⡿⣟⣯⣷]/u.test(chunk) || /thinking|reasoning/i.test(clean)) {
    return 'thinking'
  }

  // If there's substantial printable text (not just control chars), agent is responding
  const printable = clean.replace(/[\r\n\s]/g, '')
  if (printable.length > 2) {
    return 'responding'
  }

  return null
}

function updateActivity(taskId: string, activity: AgentActivity): void {
  const run = runs.get(taskId)
  if (!run) return
  if (run.activity === activity) return // no change
  run.activity = activity
  broadcast('agent:activity', { taskId, activity })
}

function resetIdleTimer(taskId: string): void {
  const run = runs.get(taskId)
  if (!run) return

  // Clear existing timer
  if (run.idleTimer) {
    clearTimeout(run.idleTimer)
  }

  run.lastOutputAt = Date.now()

  // Set new timer: if no output for IDLE_THRESHOLD_MS, mark as 'waiting'
  run.idleTimer = setTimeout(() => {
    const currentRun = runs.get(taskId)
    if (currentRun && currentRun.status === 'running') {
      updateActivity(taskId, 'waiting')
    }
  }, IDLE_THRESHOLD_MS)
}

// ── Helpers ──────────────────────────────────────────────────────────

const MAX_CONCURRENT = 3

function resolveOmpBinary(): string {
  if (process.platform === 'win32') {
    const candidates = [
      path.join(os.homedir(), '.bun', 'bin', 'omp.exe'),
      path.join(os.homedir(), '.bun', 'bin', 'omp.cmd'),
    ]
    for (const c of candidates) {
      if (existsSync(c)) return c
    }
    return 'omp.cmd' // node-pty on Windows usually needs the exact extension
  }
  return 'omp'
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

function sendAgentStatus(taskId: string, status: AgentStatus): void {
  try {
    const db = getDatabase()
    db.prepare('UPDATE tasks SET agent_status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), taskId)
  } catch (err) {
    console.error('[agent] failed to persist agent status', err)
  }
  broadcast('agent:status', { taskId, status })
}

function killPty(taskId: string): void {
  const run = runs.get(taskId)
  if (!run) return
  try {
    run.childProcess.kill()
  } catch {
    // already dead
  }
  flushOutput(taskId)
}

async function killPtyAsync(taskId: string): Promise<void> {
  const run = runs.get(taskId)
  if (!run) return
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      flushOutput(taskId)
      resolve()
    }, 2000)
    run.childProcess.onExit(() => {
      clearTimeout(timeout)
      flushOutput(taskId)
      resolve()
    })
    try {
      run.childProcess.kill()
    } catch {
      clearTimeout(timeout)
      flushOutput(taskId)
      resolve()
    }
  })
}

/**
 * Evict the oldest NON-RUNNING session if at the concurrent limit.
 * Running sessions are NEVER evicted — we don't cut off active agent work.
 * If all sessions are running, the limit becomes a soft cap (no eviction).
 */
async function evictOldestIfNeeded(): Promise<void> {
  if (runs.size < MAX_CONCURRENT) return

  // Find the oldest session that is NOT running (completed/error/idle)
  let candidateId: string | null = null
  let candidateTime = Infinity
  for (const [id, run] of runs) {
    if (run.status === 'running') continue // ← protect running agents
    if (run.createdAt < candidateTime) {
      candidateTime = run.createdAt
      candidateId = id
    }
  }

  if (candidateId) {
    await killPtyAsync(candidateId)
    sendAgentStatus(candidateId, 'idle')
    runs.delete(candidateId)
  }
  // If candidateId is null, all sessions are running — soft cap, allow exceeding
}

// ── IPC Handlers ─────────────────────────────────────────────────────

export function registerTerminalHandlers(): void {
  ipcMain.handle(
    'agent:pty:spawn',
    async (_event: unknown, input: { taskId: string; projectPath: string; cols: number; rows: number }): Promise<void> => {
      const { taskId, projectPath, cols = 80, rows = 24 } = input

      // If this task already has a running session, skip respawn
      const existing = runs.get(taskId)
      if (existing && existing.status === 'running') {
        return
      }

      // Evict oldest session if at the concurrent limit
      await evictOldestIfNeeded()

      const ompPath = resolveOmpBinary()
      const cwd = projectPath && existsSync(projectPath) ? projectPath : process.cwd()

      try {
        const sessionDir = path.join(app.getPath('userData'), 'omp-sessions')
        if (!existsSync(sessionDir)) {
          mkdirSync(sessionDir, { recursive: true })
        }
        const sessionFile = path.join(sessionDir, `${taskId}.jsonl`)
        
        const ompArgs = process.platform === 'win32' ? ['/c', ompPath, '--resume', sessionFile] : ['--resume', sessionFile]
        
        // Clean environment variables to prevent Electron/Vite dev tooling pollution
        const cleanEnv = { ...process.env }
        delete cleanEnv.NODE_OPTIONS
        delete cleanEnv.ELECTRON_RUN_AS_NODE
        delete cleanEnv.ELECTRON_NO_ASAR
        for (const key of Object.keys(cleanEnv)) {
          if (key.startsWith('VITE_') || key.startsWith('ELECTRON_')) {
            delete cleanEnv[key]
          }
        }

        const childProcess = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : ompPath, ompArgs, {
          name: 'xterm-color',
          cols,
          rows,
          cwd,
          env: {
            ...cleanEnv,
            OMP_TASK_ID: taskId,
            OMP_PROJECT_PATH: cwd,
            OMP_SESSION_PER_TASK: '1',
            FORCE_COLOR: '1',
            NO_UPDATE: '1',
          } as Record<string, string>,
        })

        const run: PtyRun = {
          taskId,
          childProcess,
          status: 'running',
          createdAt: Date.now(),
          activity: 'waiting',
          lastOutputAt: Date.now(),
          idleTimer: null,
        }
        runs.set(taskId, run)

        sendAgentStatus(taskId, 'running')

        // Use batched output instead of direct broadcast
        // Also detect agent activity from output patterns
        childProcess.onData((data) => {
          appendOutput(taskId, data)

          // Detect activity from output content
          const detected = detectActivity(data)
          if (detected) {
            updateActivity(taskId, detected)
          }

          // Reset the idle timer (will fire 'waiting' after silence)
          resetIdleTimer(taskId)
        })

        childProcess.onExit((e) => {
          // Clear idle timer
          const exitRun = runs.get(taskId)
          if (exitRun?.idleTimer) clearTimeout(exitRun.idleTimer)

          // Flush remaining buffered output before status change
          flushOutput(taskId)
          const finalStatus: AgentStatus = e.exitCode === 0 ? 'completed' : 'error'
          sendAgentStatus(taskId, finalStatus)
          runs.delete(taskId)
        })

      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        appendOutput(taskId, `\r\n\x1b[31m[failed to spawn omp]\x1b[0m ${message}\r\n`)
        flushOutput(taskId)
        sendAgentStatus(taskId, 'error')
      }
    },
  )

  ipcMain.handle('agent:pty:data', (_event: unknown, input: { taskId: string; data: string }): void => {
    const run = runs.get(input.taskId)
    if (run && run.childProcess) {
      run.childProcess.write(input.data)
    }
  })

  ipcMain.handle('agent:pty:resize', (_event: unknown, input: { taskId: string; cols: number; rows: number }): void => {
    const run = runs.get(input.taskId)
    if (run && run.childProcess) {
      run.childProcess.resize(input.cols, input.rows)
    }
  })

  ipcMain.handle('agent:pty:kill', async (_event: unknown, taskId: string): Promise<void> => {
    await killPtyAsync(taskId)
    sendAgentStatus(taskId, 'idle')
    runs.delete(taskId)
  })

  ipcMain.handle('agent:status', (_event: unknown, taskId: string): AgentStatus => {
    return runs.get(taskId)?.status ?? 'idle'
  })

  ipcMain.handle('agent:activity', (_event: unknown, taskId: string): AgentActivity | null => {
    const run = runs.get(taskId)
    if (!run) return null
    return run.activity
  })
}

export function shutdownAllSessions(): void {
  for (const taskId of Array.from(runs.keys())) {
    killPty(taskId)
    runs.delete(taskId)
  }
  // Clear any remaining flush timer
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  outputBuffers.clear()
}
