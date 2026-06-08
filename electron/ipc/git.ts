import { ipcMain } from 'electron'
import { exec, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as path from 'node:path'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

export interface GitStatus {
  [filePath: string]: string // 2-character status code from git status --porcelain
}

async function runGit(
  dirPath: string,
  args: string[],
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd: dirPath,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      maxBuffer: 1024 * 1024 * 10,
    })
    return { success: true, stdout, stderr }
  } catch (err: any) {
    return {
      success: false,
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || 'Unknown error',
    }
  }
}

export function registerGitHandlers(): void {
  console.log('[git] Registering IPC handlers')

  ipcMain.handle('git:getStatus', async (_event: unknown, dirPath: string): Promise<GitStatus> => {
    try {
      // Run porcelain v1
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: dirPath })
      const status: GitStatus = {}

      const lines = stdout.split('\n')
      for (const line of lines) {
        if (!line.trim()) continue
        // The first 2 characters are the status code
        const code = line.substring(0, 2)
        const file = line.substring(3).trim()

        let cleanFile = file
        // Handle renamed files: "R  old_path -> new_path"
        if (code.startsWith('R') && file.includes(' -> ')) {
          const parts = file.split(' -> ')
          cleanFile = parts[parts.length - 1].trim()
        }

        if (cleanFile.startsWith('"') && cleanFile.endsWith('"')) {
          cleanFile = cleanFile.substring(1, cleanFile.length - 1)
        }

        status[cleanFile] = code
      }

      return status
    } catch (err: any) {
      if (err.message && err.message.includes('not a git repository')) {
        return {}
      }
      console.error('[git] Failed to get status:', err)
      return {}
    }
  })

  ipcMain.handle(
    'git:getHeadContent',
    async (_event: unknown, dirPath: string, filePath: string): Promise<string | null> => {
      try {
        const relativePath = path.isAbsolute(filePath)
          ? path.relative(dirPath, filePath)
          : filePath
        const gitPath = relativePath.replace(/\\/g, '/')

        const { stdout } = await execFileAsync('git', ['show', `HEAD:${gitPath}`], {
          cwd: dirPath,
          maxBuffer: 1024 * 1024 * 10,
        })
        return stdout
      } catch (err) {
        console.error('[git] Failed to get HEAD content for', filePath, err)
        return null
      }
    },
  )

  ipcMain.handle('git:getCurrentBranch', async (_event: unknown, dirPath: string): Promise<string> => {
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: dirPath,
      })
      return stdout.trim()
    } catch (err) {
      try {
        // If it's a new repo with no commits yet
        const { stdout } = await execFileAsync('git', ['symbolic-ref', '--short', 'HEAD'], {
          cwd: dirPath,
        })
        return stdout.trim()
      } catch {
        return ''
      }
    }
  })

  ipcMain.handle(
    'git:add',
    async (_event: unknown, dirPath: string, filePath: string): Promise<{ success: boolean; error?: string }> => {
      const res = await runGit(dirPath, ['add', filePath])
      return res.success ? { success: true } : { success: false, error: res.stderr }
    },
  )

  ipcMain.handle(
    'git:unstage',
    async (_event: unknown, dirPath: string, filePath: string): Promise<{ success: boolean; error?: string }> => {
      const res = await runGit(dirPath, ['restore', '--staged', filePath])
      return res.success ? { success: true } : { success: false, error: res.stderr }
    },
  )

  ipcMain.handle(
    'git:discard',
    async (_event: unknown, dirPath: string, filePath: string): Promise<{ success: boolean; error?: string }> => {
      const res = await runGit(dirPath, ['restore', filePath])
      return res.success ? { success: true } : { success: false, error: res.stderr }
    },
  )

  ipcMain.handle(
    'git:commit',
    async (_event: unknown, dirPath: string, message: string): Promise<{ success: boolean; error?: string }> => {
      const res = await runGit(dirPath, ['commit', '-m', message])
      return res.success ? { success: true } : { success: false, error: res.stderr }
    },
  )

  ipcMain.handle(
    'git:push',
    async (_event: unknown, dirPath: string): Promise<{ success: boolean; error?: string; output?: string }> => {
      const res = await runGit(dirPath, ['push'])
      return res.success
        ? { success: true, output: res.stdout }
        : { success: false, error: res.stderr }
    },
  )

  ipcMain.handle(
    'git:pull',
    async (_event: unknown, dirPath: string): Promise<{ success: boolean; error?: string; output?: string }> => {
      const res = await runGit(dirPath, ['pull'])
      return res.success
        ? { success: true, output: res.stdout }
        : { success: false, error: res.stderr }
    },
  )

  ipcMain.handle(
    'git:fetch',
    async (_event: unknown, dirPath: string): Promise<{ success: boolean; error?: string; output?: string }> => {
      const res = await runGit(dirPath, ['fetch'])
      return res.success
        ? { success: true, output: res.stdout }
        : { success: false, error: res.stderr }
    },
  )

  ipcMain.handle(
    'git:init',
    async (_event: unknown, dirPath: string): Promise<{ success: boolean; error?: string }> => {
      const res = await runGit(dirPath, ['init'])
      return res.success ? { success: true } : { success: false, error: res.stderr }
    },
  )
}

