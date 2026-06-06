import { ipcMain, BrowserWindow } from 'electron'
import * as os from 'node:os'
import * as path from 'node:path'
import { existsSync } from 'node:fs'
import { getDatabase } from '../database/init'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { AgentStatus } from '../../src/shared/types'

interface PtyRun {
  taskId: string
  childProcess: ChildProcessWithoutNullStreams
  status: AgentStatus
}

const runs = new Map<string, PtyRun>()

function resolveOmpBinary(): string {
  if (process.platform === 'win32') {
    const candidates = [
      path.join(os.homedir(), '.bun', 'bin', 'omp.exe'),
      path.join(os.homedir(), '.bun', 'bin', 'omp.cmd'),
      'omp.exe',
      'omp.cmd',
    ]
    for (const c of candidates) {
      if (c.includes(path.sep) && existsSync(c)) return c
    }
    return 'omp.exe'
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

function sendPtyOutput(taskId: string, data: string): void {
  broadcast('agent:pty:output', { taskId, data })
}

function killPty(taskId: string): void {
  const run = runs.get(taskId)
  if (!run) return
  try {
    run.childProcess.kill()
  } catch {
    // already dead
  }
}

async function killPtyAsync(taskId: string): Promise<void> {
  const run = runs.get(taskId)
  if (!run) return
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 2000)
    run.childProcess.on('close', () => {
      clearTimeout(timeout)
      resolve()
    })
    try {
      run.childProcess.kill()
    } catch {
      clearTimeout(timeout)
      resolve()
    }
  })
}

export function registerTerminalHandlers(): void {
  ipcMain.handle(
    'agent:pty:spawn',
    async (_event: unknown, input: { taskId: string; projectPath: string; cols: number; rows: number }): Promise<void> => {
      const { taskId, projectPath } = input

      if (runs.has(taskId)) {
        await killPtyAsync(taskId)
      }

      const ompPath = resolveOmpBinary()
      const cwd = projectPath && existsSync(projectPath) ? projectPath : process.cwd()

      try {
        // Fallback to child_process since node-pty compilation fails
        const childProcess = spawn(ompPath, [], {
          cwd,
          windowsHide: true,
          env: {
            ...process.env,
            OMP_TASK_ID: taskId,
            OMP_PROJECT_PATH: cwd,
            // Force basic interaction
            FORCE_COLOR: '1',
          } as Record<string, string>,
        })

        const run: PtyRun = {
          taskId,
          childProcess,
          status: 'running',
        }
        runs.set(taskId, run)

        sendAgentStatus(taskId, 'running')

        childProcess.stdout.on('data', (chunk) => {
          sendPtyOutput(taskId, chunk.toString('utf8'))
        })

        childProcess.stderr.on('data', (chunk) => {
          sendPtyOutput(taskId, chunk.toString('utf8'))
        })

        childProcess.on('error', (err) => {
          const message = err instanceof Error ? err.message : String(err)
          sendPtyOutput(taskId, `\r\n\x1b[31m[failed to spawn omp]\x1b[0m ${message}\r\n`)
          sendAgentStatus(taskId, 'error')
        })

        childProcess.on('close', (code) => {
          const finalStatus: AgentStatus = code === 0 ? 'completed' : 'error'
          sendAgentStatus(taskId, finalStatus)
          runs.delete(taskId)
        })

      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        sendPtyOutput(taskId, `\r\n\x1b[31m[failed to spawn omp]\x1b[0m ${message}\r\n`)
        sendAgentStatus(taskId, 'error')
      }
    },
  )

  ipcMain.handle('agent:pty:data', (_event: unknown, input: { taskId: string; data: string }): void => {
    const run = runs.get(input.taskId)
    if (run && run.childProcess.stdin && run.childProcess.stdin.writable) {
      run.childProcess.stdin.write(input.data)
    }
  })

  ipcMain.handle('agent:pty:resize', (_event: unknown, input: { taskId: string; cols: number; rows: number }): void => {
    // Resize not supported with basic child_process, ignore safely
  })

  ipcMain.handle('agent:pty:kill', async (_event: unknown, taskId: string): Promise<void> => {
    await killPtyAsync(taskId)
    sendAgentStatus(taskId, 'idle')
  })

  ipcMain.handle('agent:status', (_event: unknown, taskId: string): AgentStatus => {
    return runs.get(taskId)?.status ?? 'idle'
  })
}

export function shutdownAllSessions(): void {
  for (const taskId of Array.from(runs.keys())) {
    killPty(taskId)
  }
}
