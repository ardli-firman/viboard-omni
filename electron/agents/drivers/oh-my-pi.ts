/**
 * Oh My Pi Driver
 *
 * Implements the AgentDriver for oh-my-pi (github.com/can1357/oh-my-pi).
 *
 * Behaviour:
 *   - Auto-resolves `omp` / `omp.exe` / `omp.cmd` from `~/.bun/bin/`
 *   - Session persistence via `--resume <session-file>`
 *   - Activity detection: reads oh-my-pi's specific spinner + tool header patterns
 */

import * as os from 'node:os'
import * as path from 'node:path'
import { existsSync } from 'node:fs'
import type { AgentDriver } from '../types'
import { stripAnsi } from '../types'

const ohMyPiDriver: AgentDriver = {
  type: 'oh-my-pi',
  label: 'Oh My Pi (omp)',
  description:
    'oh-my-pi agent CLI (github.com/can1357/oh-my-pi). Uses --resume <session-file> for session persistence.',

  resolveBinary(config, platform) {
    if (config.binaryPath) return config.binaryPath
    if (platform === 'win32') {
      const candidates = [
        path.join(os.homedir(), '.bun', 'bin', 'omp.exe'),
        path.join(os.homedir(), '.bun', 'bin', 'omp.cmd'),
      ]
      for (const c of candidates) {
        if (existsSync(c)) return c
      }
      return 'omp.cmd' // fallback: rely on PATH
    }
    return 'omp'
  },

  buildSpawnCommand(config, platform, sessionFile) {
    const bin = this.resolveBinary(config, platform)
    const sessionArg = config.sessionArg ?? '--resume'
    const extra = config.extraArgs ?? []

    if (platform === 'win32') {
      // node-pty on Windows spawns via cmd.exe /c
      return {
        file: 'cmd.exe',
        args: ['/c', bin, ...extra, sessionArg, sessionFile],
      }
    }
    return {
      file: bin,
      args: [...extra, sessionArg, sessionFile],
    }
  },

  buildEnv(config, taskId, cwd) {
    return {
      OMP_TASK_ID: taskId,
      OMP_PROJECT_PATH: cwd,
      OMP_SESSION_PER_TASK: '1',
      FORCE_COLOR: '1',
      NO_UPDATE: '1',
      ...(config.extraEnv ?? {}),
    }
  },

  detectActivity(chunk) {
    const clean = stripAnsi(chunk)

    // Tool use: OMP shows headers like "⚡ bash", "✏ edit", "📝 write", etc.
    if (
      /[⚡✏📝🔍🌐🔧▶]\s*(bash|edit|write|read|grep|find|web_search|browser|python|task|lsp)/i.test(
        clean,
      )
    ) {
      return 'tool_use'
    }

    // Thinking / spinner characters
    if (
      /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⣾⣽⣻⢿⡿⣟⣯⣷]/u.test(chunk) ||
      /thinking|reasoning/i.test(clean)
    ) {
      return 'thinking'
    }

    // Substantial printable text → agent is responding
    const printable = clean.replace(/[\r\n\s]/g, '')
    if (printable.length > 2) {
      return 'responding'
    }

    return null
  },
}

export default ohMyPiDriver
