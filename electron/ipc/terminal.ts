import { ipcMain, BrowserWindow, app } from 'electron'
import * as path from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { getDatabase } from '../database/init'
import * as pty from '@cocktailpeanut/node-pty-prebuilt-multiarch'
import type { AgentStatus, AgentActivity, AgentType, AgentCliConfig, AppSettings } from '../../src/shared/types'
import { getDriver, getDriverDefaults } from '../agents/registry'

interface PtyRun {
  taskId: string
  childProcess: pty.IPty
  status: AgentStatus
  createdAt: number
  activity: AgentActivity
  lastOutputAt: number
  idleTimer: ReturnType<typeof setTimeout> | null
  /** The driver type used for this run — for activity detection */
  agentType: AgentType
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
    if (outputBuffers.size === 0 && flushTimer) {
      clearInterval(flushTimer)
      flushTimer = null
    }
  }, OUTPUT_FLUSH_INTERVAL)
}

function appendOutput(taskId: string, chunk: string): void {
  let combined = (outputBuffers.get(taskId) ?? '') + chunk
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
// Delegated to the active driver for each run.

/** How many ms of silence before we consider the agent "waiting" at prompt */
const IDLE_THRESHOLD_MS = 3000

function updateActivity(taskId: string, activity: AgentActivity): void {
  const run = runs.get(taskId)
  if (!run) return
  if (run.activity === activity) return
  run.activity = activity
  broadcast('agent:activity', { taskId, activity })
}

function resetIdleTimer(taskId: string): void {
  const run = runs.get(taskId)
  if (!run) return

  if (run.idleTimer) {
    clearTimeout(run.idleTimer)
  }

  run.lastOutputAt = Date.now()

  run.idleTimer = setTimeout(() => {
    const currentRun = runs.get(taskId)
    if (currentRun && currentRun.status === 'running') {
      updateActivity(taskId, 'waiting')
    }
  }, IDLE_THRESHOLD_MS)
}

// ── Helpers ──────────────────────────────────────────────────────────

const MAX_CONCURRENT = 3

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
 */
async function evictOldestIfNeeded(): Promise<void> {
  if (runs.size < MAX_CONCURRENT) return

  let candidateId: string | null = null
  let candidateTime = Infinity
  for (const [id, run] of runs) {
    if (run.status === 'running') continue
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
}

// ── Config Resolution ─────────────────────────────────────────────────────────
/**
 * Resolve the final merged config for a spawn:
 *   driver defaults  ←  global settings  ←  task overrides
 *
 * @param agentType    The selected agent type
 * @param globalConfig Per-type config from AppSettings.agentConfigs
 * @param taskConfig   Per-task override from Task.agentConfig
 */
function resolveConfig(
  agentType: AgentType,
  globalConfig: Partial<AgentCliConfig> | undefined,
  taskConfig: Partial<AgentCliConfig> | undefined,
): Partial<AgentCliConfig> {
  const driverDefaults = getDriverDefaults(agentType)
  return {
    ...driverDefaults,
    ...(globalConfig ?? {}),
    ...(taskConfig ?? {}),
    agentType,
    // Merge extra env and extra args additively
    extraEnv: {
      ...(driverDefaults.extraEnv ?? {}),
      ...(globalConfig?.extraEnv ?? {}),
      ...(taskConfig?.extraEnv ?? {}),
    },
    extraArgs: [
      ...(driverDefaults.extraArgs ?? []),
      ...(globalConfig?.extraArgs ?? []),
      ...(taskConfig?.extraArgs ?? []),
    ],
  }
}

// ── IPC Handlers ─────────────────────────────────────────────────────

export function registerTerminalHandlers(): void {
  ipcMain.handle(
    'agent:pty:spawn',
    async (
      _event: unknown,
      input: {
        taskId: string
        projectPath: string
        cols: number
        rows: number
        agentType: AgentType
        globalAgentConfig: Partial<AgentCliConfig> | undefined
        taskAgentConfig: Partial<AgentCliConfig> | undefined
      },
    ): Promise<void> => {
      const {
        taskId,
        projectPath,
        cols = 80,
        rows = 24,
        agentType = 'oh-my-pi',
        globalAgentConfig,
        taskAgentConfig,
      } = input

      // Skip respawn for already-running session
      const existing = runs.get(taskId)
      if (existing && existing.status === 'running') {
        return
      }

      await evictOldestIfNeeded()

      const cwd = projectPath && existsSync(projectPath) ? projectPath : process.cwd()

      // Safety: if the agentType is not in the registry (e.g. legacy 'pi-agent' rows
      // that weren't caught by the DB migration), fall back to 'oh-my-pi'.
      const KNOWN_TYPES: AgentType[] = ['oh-my-pi', 'gemini-cli', 'pi-agent', 'hermes', 'custom']
      const safeAgentType: AgentType = KNOWN_TYPES.includes(agentType as AgentType)
        ? agentType
        : 'oh-my-pi'

      // Resolve driver and merged config
      const driver = getDriver(safeAgentType)
      const mergedConfig = resolveConfig(safeAgentType, globalAgentConfig, taskAgentConfig)

      // Build session file path (used by drivers that support session persistence)
      const sessionDir = path.join(app.getPath('userData'), 'agent-sessions', safeAgentType)
      if (!existsSync(sessionDir)) {
        mkdirSync(sessionDir, { recursive: true })
      }
      const sessionFile = path.join(sessionDir, `${taskId}.jsonl`)

      try {
        const { file, args } = driver.buildSpawnCommand(mergedConfig, process.platform, sessionFile)
        const driverEnv = driver.buildEnv(mergedConfig, taskId, cwd)

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

        console.log(`[agent:spawn] driver=${safeAgentType} file=${file} args=${JSON.stringify(args)} cwd=${cwd}`)

        const childProcess = pty.spawn(file, args, {
          name: 'xterm-color',
          cols,
          rows,
          cwd,
          env: {
            ...cleanEnv,
            ...driverEnv,
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
          agentType: safeAgentType,
        }
        runs.set(taskId, run)

        sendAgentStatus(taskId, 'running')

        childProcess.onData((data) => {
          appendOutput(taskId, data)

          // Delegate activity detection to the driver
          const currentRun = runs.get(taskId)
          if (currentRun) {
            const detected = driver.detectActivity(data)
            if (detected) {
              updateActivity(taskId, detected)
            }
          }

          resetIdleTimer(taskId)
        })

        childProcess.onExit((e) => {
          const exitRun = runs.get(taskId)
          if (exitRun && exitRun.childProcess === childProcess) {
            if (exitRun.idleTimer) clearTimeout(exitRun.idleTimer)
            flushOutput(taskId)
            const finalStatus: AgentStatus = e.exitCode === 0 ? 'completed' : 'error'
            sendAgentStatus(taskId, finalStatus)
            runs.delete(taskId)
          } else {
            flushOutput(taskId)
          }
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        appendOutput(taskId, `\r\n\x1b[31m[viboard] Failed to spawn agent (${safeAgentType})\x1b[0m ${message}\r\n`)
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
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  outputBuffers.clear()
}
