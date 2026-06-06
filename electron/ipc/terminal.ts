import { ipcMain, BrowserWindow } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import type {
  TerminalOutput,
  TerminalSpawnInput,
  TerminalInput,
  TerminalResizeInput,
  TerminalKillInput,
} from '../../src/shared/types'

const activeTerminals = new Map<string, ChildProcess>()

export function registerTerminalHandlers(): void {
  ipcMain.handle('terminal:spawn', (_event: unknown, input: TerminalSpawnInput): { pid: number | null } => {
    const { taskId, projectPath } = input
    if (activeTerminals.has(taskId)) {
      killTerminal(taskId)
    }
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'
    const shellArgs = process.platform === 'win32' ? [] : ['-i']

    const child = spawn(shell, shellArgs, {
      cwd: projectPath || undefined,
      env: { ...process.env, TERM: 'xterm-256color' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    activeTerminals.set(taskId, child)
    const pid = child.pid ?? null

    child.stdout?.on('data', (chunk: Buffer) => {
      sendToRenderer(taskId, chunk.toString('utf-8'))
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      sendToRenderer(taskId, chunk.toString('utf-8'))
    })
    child.on('close', () => {
      sendToRenderer(taskId, `\r\n\x1b[33m[Process exited]\x1b[0m\r\n`)
      activeTerminals.delete(taskId)
    })

    return { pid }
  })

  ipcMain.handle('terminal:input', (_event: unknown, input: TerminalInput): void => {
    const child = activeTerminals.get(input.taskId)
    if (child?.stdin) {
      child.stdin.write(input.input)
    }
  })

  ipcMain.handle('terminal:resize', (_event: unknown, _input: TerminalResizeInput): void => {
    // no-op for basic child_process; real resize needs node-pty later
  })

  ipcMain.handle('terminal:kill', (_event: unknown, input: TerminalKillInput): void => {
    killTerminal(input.taskId)
  })
}

function killTerminal(taskId: string): void {
  const child = activeTerminals.get(taskId)
  if (child) {
    try {
      child.stdin?.end()
      child.kill()
    } catch {
      // process already dead
    }
    activeTerminals.delete(taskId)
  }
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