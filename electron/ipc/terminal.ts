import { ipcMain, BrowserWindow, app } from 'electron'
import * as os from 'node:os'
import * as path from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { getDatabase } from '../database/init'
import * as pty from '@cocktailpeanut/node-pty-prebuilt-multiarch'
import type { AgentStatus } from '../../src/shared/types'

interface PtyRun {
  taskId: string
  childProcess: pty.IPty
  status: AgentStatus
}

const runs = new Map<string, PtyRun>()

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
    run.childProcess.onExit(() => {
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
      const { taskId, projectPath, cols = 80, rows = 24 } = input

      if (runs.has(taskId)) {
        await killPtyAsync(taskId)
      }
      const ompPath = resolveOmpBinary()
      const cwd = projectPath && existsSync(projectPath) ? projectPath : process.cwd()

      try {
        const sessionDir = path.join(app.getPath('userData'), 'omp-sessions')
        if (!existsSync(sessionDir)) {
          mkdirSync(sessionDir, { recursive: true })
        }
        const sessionFile = path.join(sessionDir, `${taskId}.jsonl`)
        
        const ompArgs = process.platform === 'win32' ? ['/c', ompPath, '--resume', sessionFile] : ['--resume', sessionFile]
        const childProcess = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : ompPath, ompArgs, {
          name: 'xterm-color',
          cols,
          rows,
          cwd,
          env: {
            ...process.env,
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
        }
        runs.set(taskId, run)

        sendAgentStatus(taskId, 'running')

        childProcess.onData((data) => {
          sendPtyOutput(taskId, data)
        })

        childProcess.onExit((e) => {
          const finalStatus: AgentStatus = e.exitCode === 0 ? 'completed' : 'error'
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
