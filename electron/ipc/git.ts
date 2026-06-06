import { ipcMain } from 'electron'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import * as path from 'node:path'

const execAsync = promisify(exec)

export interface GitStatus {
  [filePath: string]: string // e.g. 'M', 'A', '??', 'D'
}

export function registerGitHandlers(): void {
  console.log('[git] Registering IPC handlers')

  ipcMain.handle('git:getStatus', async (_event: unknown, dirPath: string): Promise<GitStatus> => {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: dirPath })
      const status: GitStatus = {}
      
      const lines = stdout.split('\n')
      for (const line of lines) {
        if (!line.trim()) continue
        const code = line.substring(0, 2).trim()
        const file = line.substring(3).trim()
        
        let cleanFile = file
        if (cleanFile.startsWith('"') && cleanFile.endsWith('"')) {
          cleanFile = cleanFile.substring(1, cleanFile.length - 1)
        }
        
        status[cleanFile] = code
      }
      
      return status
    } catch (err: any) {
      if (err.message && err.message.includes('not a git repository')) {
        // Silently ignore if not a git repository
        return {}
      }
      console.error('[git] Failed to get status (perhaps not a git repo):', err)
      return {}
    }
  })

  ipcMain.handle('git:getHeadContent', async (_event: unknown, dirPath: string, filePath: string): Promise<string | null> => {
    try {
      const relativePath = path.isAbsolute(filePath) ? path.relative(dirPath, filePath) : filePath
      const gitPath = relativePath.replace(/\\/g, '/')
      
      const { stdout } = await execAsync(`git show HEAD:"${gitPath}"`, { cwd: dirPath, maxBuffer: 1024 * 1024 * 10 })
      return stdout
    } catch (err) {
      console.error('[git] Failed to get HEAD content for', filePath, err)
      return null
    }
  })
}
