/**
 * Gemini CLI Driver
 *
 * Implements the AgentDriver for Google Gemini CLI (geminicli.com).
 *
 * Behaviour:
 *   - Auto-resolves `gemini` / `gemini.cmd` from PATH or common install locations
 *   - Session resume via `--resume` flag (no file argument — resumes last session)
 *   - Activity detection: spinner + tool header patterns
 */

import * as os from 'node:os'
import * as path from 'node:path'
import { existsSync } from 'node:fs'
import type { AgentDriver } from '../types'
import { stripAnsi } from '../types'

const geminiCliDriver: AgentDriver = {
  type: 'gemini-cli',
  label: 'Gemini CLI',
  description:
    'Google Gemini CLI (geminicli.com). Uses --resume for session resume.',

  resolveBinary(config, platform) {
    if (config.binaryPath) return config.binaryPath
    if (platform === 'win32') {
      const candidates = [
        path.join(os.homedir(), '.bun', 'bin', 'gemini.cmd'),
        path.join(os.homedir(), '.bun', 'bin', 'gemini.exe'),
        path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'gemini.cmd'),
        path.join(os.homedir(), 'AppData', 'Local', 'gemini', 'gemini.exe'),
      ]
      for (const c of candidates) {
        if (existsSync(c)) return c
      }
      return 'gemini.cmd'
    }
    return 'gemini'
  },

  buildSpawnCommand(config, platform, _sessionFile) {
    const bin = this.resolveBinary(config, platform)
    const extra = config.extraArgs ?? []
    const sessionMode = config.sessionMode ?? 'none'

    const argList: string[] = [...extra]

    // Gemini CLI uses --resume (no file argument) to resume the last session
    if (sessionMode === 'resume-file') {
      argList.push('--resume')
    }

    if (platform === 'win32') {
      return {
        file: 'cmd.exe',
        args: ['/c', bin, ...argList],
      }
    }
    return {
      file: bin,
      args: argList,
    }
  },

  buildEnv(config, _taskId, _cwd) {
    return {
      FORCE_COLOR: '1',
      ...(config.extraEnv ?? {}),
    }
  },

  detectActivity(chunk) {
    const clean = stripAnsi(chunk)

    // Tool use: Gemini CLI shows tool emoji headers like ⚡ bash, ✏ edit, etc.
    if (
      /[⚡✏📝🔍🌐🔧▶]\s*(bash|edit|write|read|grep|find|web_search|browser|python|task|lsp)/i.test(
        clean,
      )
    ) {
      return 'tool_use'
    }

    // Thinking / spinner characters (Braille dots)
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

export default geminiCliDriver
