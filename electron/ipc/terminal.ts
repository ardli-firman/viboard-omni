import { ipcMain, BrowserWindow, app } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import * as os from 'node:os'
import * as path from 'node:path'
import { existsSync } from 'node:fs'
import { getDatabase } from '../database/init'
import type {
  AgentStatus,
  AgentOutputEvent,
  AgentPromptInput,
} from '../../src/shared/types'

interface AgentRun {
  taskId: string
  sessionId: string | null
  promptId: number
  child: ChildProcessWithoutNullStreams
  status: AgentStatus
  buffer: string
}

const runs = new Map<string, AgentRun>()
let nextPromptId = 1

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

function sendAgentOutput(event: AgentOutputEvent): void {
  broadcast('agent:output', event)
}

function loadSessionId(taskId: string): string | null {
  try {
    const db = getDatabase()
    const row = db
      .prepare('SELECT agent_session_id FROM tasks WHERE id = ?')
      .get(taskId) as { agent_session_id: string | null } | undefined
    return row?.agent_session_id ?? null
  } catch {
    return null
  }
}

function saveSessionId(taskId: string, sessionId: string): void {
  try {
    const db = getDatabase()
    db.prepare('UPDATE tasks SET agent_session_id = ?, updated_at = ? WHERE id = ?').run(
      sessionId,
      Date.now(),
      taskId,
    )
  } catch (err) {
    console.error('[agent] failed to persist session id', err)
  }
}

function emitError(taskId: string, promptId: number, message: string): void {
  sendAgentOutput({
    taskId,
    promptId,
    type: 'error',
    message,
  })
}

function killRun(taskId: string): void {
  const run = runs.get(taskId)
  if (!run) return
  try {
    run.child.kill()
  } catch {
    // already dead
  }
  runs.delete(taskId)
}

function processLine(taskId: string, promptId: number, line: string): void {
  if (!line) return
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(line)
  } catch {
    emitError(taskId, promptId, `[non-json line] ${line.slice(0, 200)}`)
    return
  }

  const type = parsed.type as string | undefined
  if (type === 'session' && typeof parsed.id === 'string') {
    const run = runs.get(taskId)
    if (run) {
      run.sessionId = parsed.id
      saveSessionId(taskId, parsed.id)
    }
  }

  sendAgentOutput({ taskId, promptId, raw: parsed })
}

function handleStdout(taskId: string, promptId: number, chunk: Buffer): void {
  const run = runs.get(taskId)
  if (!run) return
  run.buffer += chunk.toString('utf-8')
  let newlineIndex = run.buffer.indexOf('\n')
  while (newlineIndex !== -1) {
    const line = run.buffer.slice(0, newlineIndex).replace(/\r$/, '')
    run.buffer = run.buffer.slice(newlineIndex + 1)
    processLine(taskId, promptId, line)
    newlineIndex = run.buffer.indexOf('\n')
  }
}

function handleStderr(taskId: string, promptId: number, chunk: Buffer): void {
  const message = chunk.toString('utf-8').trimEnd()
  if (message) {
    emitError(taskId, promptId, `[omp stderr] ${message}`)
    if (message.includes('Session "') && message.includes('" not found')) {
      // Clear the session ID because it's expired/lost from the backend
      try {
        const db = getDatabase()
        db.prepare('UPDATE tasks SET agent_session_id = NULL, updated_at = ? WHERE id = ?').run(
          Date.now(),
          taskId,
        )
      } catch (err) {
        console.error('[agent] failed to reset session id', err)
      }
      sendAgentOutput({ taskId, promptId, type: 'session_cleared' })
    }
  }
}

export function registerTerminalHandlers(): void {
  ipcMain.handle(
    'agent:prompt',
    (_event: unknown, input: AgentPromptInput): { promptId: number; sessionId: string | null } => {
      const { taskId, projectPath, prompt } = input

      if (runs.has(taskId)) {
        killRun(taskId)
      }

      const promptId = nextPromptId++
      const sessionId = loadSessionId(taskId)
      const ompPath = resolveOmpBinary()
      const cwd = projectPath && existsSync(projectPath) ? projectPath : process.cwd()

      // First prompt: no session yet, let omp create one (we capture its id from the
      // `session` event). Subsequent prompts: --resume <id> to continue conversation.
      const args: string[] = ['--mode=json']
      if (sessionId) {
        args.push('--resume', sessionId)
      }
      args.push('-p', prompt)

      try {
        const child = spawn(ompPath, args, {
          cwd,
          windowsHide: true,
          env: {
            ...process.env,
            OMP_TASK_ID: taskId,
            OMP_PROJECT_PATH: cwd,
            OMP_SESSION_PER_TASK: '1',
          } as Record<string, string>,
        })

        const run: AgentRun = {
          taskId,
          sessionId,
          promptId,
          child,
          status: 'running',
          buffer: '',
        }
        runs.set(taskId, run)

        sendAgentStatus(taskId, 'running')
        sendAgentOutput({ taskId, promptId, type: 'prompt', prompt })

        child.stdout.on('data', (chunk) => handleStdout(taskId, promptId, chunk))
        child.stderr.on('data', (chunk) => handleStderr(taskId, promptId, chunk))

        child.on('error', (err) => {
          emitError(taskId, promptId, `[spawn error] ${err.message}`)
        })

        child.on('close', (code, signal) => {
          const current = runs.get(taskId)
          if (current && current.buffer.trim().length > 0) {
            processLine(taskId, promptId, current.buffer.trim())
            current.buffer = ''
          }
          const finalStatus: AgentStatus = code === 0 ? 'completed' : 'error'
          sendAgentOutput({
            taskId,
            promptId,
            type: 'closed',
            exitCode: code,
            signal,
          })
          sendAgentStatus(taskId, finalStatus)
          runs.delete(taskId)
        })

        return { promptId, sessionId }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        emitError(taskId, promptId, `[failed to spawn omp] ${message}`)
        sendAgentStatus(taskId, 'error')
        return { promptId, sessionId: null }
      }
    },
  )

  ipcMain.handle('agent:kill', (_event: unknown, taskId: string): void => {
    killRun(taskId)
    sendAgentStatus(taskId, 'idle')
  })

  ipcMain.handle('agent:status', (_event: unknown, taskId: string): AgentStatus => {
    return runs.get(taskId)?.status ?? 'idle'
  })

  ipcMain.handle('agent:reset', (_event: unknown, taskId: string): void => {
    try {
      const db = getDatabase()
      db.prepare('UPDATE tasks SET agent_session_id = NULL, updated_at = ? WHERE id = ?').run(
        Date.now(),
        taskId,
      )
    } catch (err) {
      console.error('[agent] failed to reset session id', err)
    }
    killRun(taskId)
    sendAgentStatus(taskId, 'idle')
  })
}

export function shutdownAllSessions(): void {
  for (const taskId of Array.from(runs.keys())) {
    killRun(taskId)
  }
}
