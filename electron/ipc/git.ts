import { ipcMain, BrowserWindow } from 'electron'
import { exec, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as path from 'node:path'
import { existsSync, readFileSync, appendFileSync } from 'node:fs'
import { getDatabase } from '../database/init'

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
      // Run porcelain v1 with ignored files
      const { stdout } = await execFileAsync('git', ['status', '--porcelain', '--ignored'], { cwd: dirPath })
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

  ipcMain.handle('git:getBranches', async (_event: unknown, dirPath: string): Promise<string[]> => {
    try {
      const { stdout } = await execFileAsync('git', ['branch', '--format=%(refname:short)'], { cwd: dirPath })
      return stdout.trim().split('\n').map((b) => b.trim()).filter(Boolean)
    } catch (err) {
      console.error('[git] Failed to get branches:', err)
      return []
    }
  })

  ipcMain.handle(
    'git:checkoutBranch',
    async (_event: unknown, dirPath: string, branchName: string): Promise<{ success: boolean; error?: string }> => {
      const res = await runGit(dirPath, ['checkout', branchName])
      return res.success ? { success: true } : { success: false, error: res.stderr }
    },
  )

  ipcMain.handle(
    'git:createBranch',
    async (_event: unknown, dirPath: string, branchName: string): Promise<{ success: boolean; error?: string }> => {
      const res = await runGit(dirPath, ['checkout', '-b', branchName])
      return res.success ? { success: true } : { success: false, error: res.stderr }
    },
  )

  ipcMain.handle(
    'git:createWorktree',
    async (
      _event: unknown,
      dirPath: string,
      taskId: string,
      branchName: string,
    ): Promise<{ success: boolean; path?: string; error?: string }> => {
      try {
        const worktreePath = path.join(dirPath, '.viboard', 'worktrees', taskId).replace(/\\/g, '/')
        
        // Ensure .viboard/ is added to the project's .gitignore
        ensureGitignore(dirPath)

        // 1. Check if branch exists
        const { stdout: branchesOut } = await execFileAsync('git', ['branch', '--list', branchName], { cwd: dirPath })
        const branchExists = branchesOut.trim().length > 0

        // 2. Add worktree
        const args = ['worktree', 'add', worktreePath]
        if (!branchExists) {
          args.push('-b', branchName)
        } else {
          args.push(branchName)
        }

        const res = await runGit(dirPath, args)
        if (!res.success) {
          return { success: false, error: res.stderr }
        }

        // Update DB status to 'installing'
        const db = getDatabase()
        db.prepare("UPDATE tasks SET worktree_path = ?, worktree_branch = ?, worktree_status = 'installing', worktree_error = NULL, updated_at = ? WHERE id = ?")
          .run(worktreePath, branchName, Date.now(), taskId)

        broadcast('task:worktree-status', { taskId, status: 'installing', path: worktreePath })

        // 3. Asynchronously run dependency installation
        runDependencyInstall(worktreePath, taskId).catch((err) => {
          console.error(`[git:worktree] dependency installation failed for task ${taskId}:`, err)
        })

        return { success: true, path: worktreePath }
      } catch (err: any) {
        return { success: false, error: err.message || String(err) }
      }
    },
  )

  ipcMain.handle(
    'git:removeWorktree',
    async (_event: unknown, dirPath: string, taskId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const worktreePath = path.join(dirPath, '.viboard', 'worktrees', taskId).replace(/\\/g, '/')
        
        // Remove worktree using git worktree remove --force
        const res = await runGit(dirPath, ['worktree', 'remove', '--force', worktreePath])
        // Prune worktrees to clean metadata
        await runGit(dirPath, ['worktree', 'prune'])

        // Update DB
        const db = getDatabase()
        db.prepare("UPDATE tasks SET worktree_path = NULL, worktree_branch = NULL, worktree_status = 'none', worktree_error = NULL, updated_at = ? WHERE id = ?")
          .run(Date.now(), taskId)

        broadcast('task:worktree-status', { taskId, status: 'none', path: null })

        return { success: true }
      } catch (err: any) {
        return { success: false, error: err.message || String(err) }
      }
    },
  )
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

async function runDependencyInstall(worktreePath: string, taskId: string): Promise<void> {
  const hasPnpm = existsSync(path.join(worktreePath, 'pnpm-lock.yaml'))
  const hasYarn = existsSync(path.join(worktreePath, 'yarn.lock'))
  const hasPackageLock = existsSync(path.join(worktreePath, 'package-lock.json'))

  let cmd = 'npm install'
  if (hasPnpm) {
    cmd = 'pnpm install'
  } else if (hasYarn) {
    cmd = 'yarn install'
  } else if (hasPackageLock) {
    cmd = 'npm install'
  }

  console.log(`[git:worktree] running dependency install for task ${taskId}: ${cmd} in ${worktreePath}`)

  return new Promise<void>((resolve, reject) => {
    exec(cmd, { cwd: worktreePath }, (error, _stdout, _stderr) => {
      const db = getDatabase()
      const now = Date.now()

      if (error) {
        console.error(`[git:worktree] install failed for task ${taskId}:`, error.message)
        db.prepare("UPDATE tasks SET worktree_status = 'failed', worktree_error = ?, updated_at = ? WHERE id = ?")
          .run(error.message, now, taskId)
        broadcast('task:worktree-status', { taskId, status: 'failed', error: error.message })
        reject(error)
      } else {
        console.log(`[git:worktree] install completed successfully for task ${taskId}`)
        db.prepare("UPDATE tasks SET worktree_status = 'created', worktree_error = NULL, updated_at = ? WHERE id = ?")
          .run(now, taskId)
        broadcast('task:worktree-status', { taskId, status: 'created', path: worktreePath })
        resolve()
      }
    })
  })
}

function ensureGitignore(projectPath: string): void {
  try {
    const gitignorePath = path.join(projectPath, '.gitignore')
    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, 'utf8')
      if (!content.includes('.viboard/')) {
        const lineToAppend = content.endsWith('\n') ? '.viboard/\n' : '\n.viboard/\n'
        appendFileSync(gitignorePath, lineToAppend)
        console.log('[git:worktree] Added .viboard/ to .gitignore')
      }
    }
  } catch (err) {
    console.error('[git:worktree] Failed to update .gitignore:', err)
  }
}

