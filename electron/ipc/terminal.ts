import { ipcMain, BrowserWindow } from 'electron'
import * as os from 'node:os'
import * as path from 'node:path'
import { existsSync } from 'node:fs'
import * as pty from 'node-pty'
import type {
  TerminalOutput,
  TerminalSpawnInput,
  TerminalInput,
  TerminalResizeInput,
  TerminalKillInput,
} from '../../src/shared/types'

interface AgentSession {
  pty: pty.IPty
  pid: number
  taskId: string
  projectPath: string
  agentStatus: 'idle' | 'running' | 'completed' | 'error'
  exited: boolean
}

const activeSessions = new Map<string, AgentSession>()

function resolveOmpBinary(): string {
  // Prefer the omp shim on PATH (works for users with the bun global bin on PATH).
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

function sendToRenderer(taskId: string, data: string): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      const payload: TerminalOutput = { taskId, data }
      win.webContents.send('terminal:output', payload)
    }
  }
}

function sendAgentStatus(taskId: string, status: 'idle' | 'running' | 'completed' | 'error'): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('agent:status', { taskId, status })
    }
  }
}

function killSession(taskId: string): void {
  const session = activeSessions.get(taskId)
  if (!session) return
  try {
    session.pty.kill()
  } catch {
    // process already dead
  }
  activeSessions.delete(taskId)
}

export function registerTerminalHandlers(): void {
  ipcMain.handle(
    'terminal:spawn',
    (_event: unknown, input: TerminalSpawnInput): { pid: number | null; agentStatus: 'idle' | 'running' | 'error' } => {
      const { taskId, projectPath } = input

      if (activeSessions.has(taskId)) {
        killSession(taskId)
      }

      const ompPath = resolveOmpBinary()
      const cwd = projectPath && existsSync(projectPath) ? projectPath : process.cwd()

      try {
        const ptyProcess = pty.spawn(ompPath, [], {
          name: 'xterm-256color',
          cols: 100,
          rows: 30,
          cwd,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            OMP_TASK_ID: taskId,
            OMP_PROJECT_PATH: cwd,
            OMP_SESSION_PER_TASK: '1',
          } as Record<string, string>,
        })

        const session: AgentSession = {
          pty: ptyProcess,
          pid: ptyProcess.pid,
          taskId,
          projectPath: cwd,
          agentStatus: 'running',
          exited: false,
        }
        activeSessions.set(taskId, session)

        sendAgentStatus(taskId, 'running')

        ptyProcess.onData((chunk: string) => {
          sendToRenderer(taskId, chunk)
        })

        ptyProcess.onExit(({ exitCode, signal }) => {
          const sess = activeSessions.get(taskId)
          if (sess) sess.exited = true
          const finalStatus: 'completed' | 'error' = exitCode === 0 ? 'completed' : 'error'
          sendToRenderer(taskId, `\r\n\x1b[33m[OMP session ended: code=${exitCode} signal=${signal ?? 'none'}]\x1b[0m\r\n`)
          sendAgentStatus(taskId, finalStatus)
          activeSessions.delete(taskId)
        })

        return { pid: ptyProcess.pid, agentStatus: 'running' }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        sendToRenderer(taskId, `\r\n\x1b[31m[Failed to spawn omp: ${message}]\x1b[0m\r\n`)
        sendAgentStatus(taskId, 'error')
        return { pid: null, agentStatus: 'error' }
      }
    },
  )

  ipcMain.handle('terminal:input', (_event: unknown, input: TerminalInput): void => {
    const session = activeSessions.get(input.taskId)
    if (session && !session.exited) {
      session.pty.write(input.input)
    }
  })

  ipcMain.handle('terminal:resize', (_event: unknown, input: TerminalResizeInput): void => {
    const session = activeSessions.get(input.taskId)
    if (session && !session.exited) {
      try {
        session.pty.resize(input.cols, input.rows)
      } catch {
        // ignore resize errors
      }
    }
  })

  ipcMain.handle('terminal:kill', (_event: unknown, input: TerminalKillInput): void => {
    killSession(input.taskId)
    sendAgentStatus(input.taskId, 'idle')
  })

  ipcMain.handle('terminal:status', (_event: unknown, taskId: string): 'idle' | 'running' | 'completed' | 'error' => {
    const session = activeSessions.get(taskId)
    return session ? session.agentStatus : 'idle'
  })
}

export function shutdownAllSessions(): void {
  for (const taskId of Array.from(activeSessions.keys())) {
    killSession(taskId)
  }
}
