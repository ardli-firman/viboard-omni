/**
 * Claude Code Agent Driver
 *
 * Implements the AgentDriver for Anthropic Claude Code CLI.
 *
 * Behaviour:
 *   - Auto-resolves `claude` / `claude.cmd` / `claude.exe` from PATH or common install locations
 *   - Session persistence via `--session-id <uuid>` (since viboard task IDs are UUIDs)
 *   - Activity detection: spinner + tool header patterns
 */

import * as os from 'node:os'
import * as path from 'node:path'
import { existsSync } from 'node:fs'
import type { AgentDriver } from '../types'
import { stripAnsi } from '../types'

const claudeDriver: AgentDriver = {
  type: 'claude',
  label: 'Claude Code',
  description:
    'Anthropic Claude Code CLI. Uses --session-id <uuid> for session persistence.',

  resolveBinary(config, platform) {
    if (config.binaryPath) return config.binaryPath
    if (platform === 'win32') {
      const candidates = [
        path.join(os.homedir(), '.bun', 'bin', 'claude.cmd'),
        path.join(os.homedir(), '.bun', 'bin', 'claude.exe'),
        path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
        path.join(os.homedir(), 'AppData', 'Local', 'npm', 'claude.cmd'),
      ]
      for (const c of candidates) {
        if (existsSync(c)) return c
      }
      return 'claude.cmd'
    }
    return 'claude'
  },

  buildSpawnCommand(config, platform, sessionFile) {
    const bin = this.resolveBinary(config, platform)
    const extra = config.extraArgs ?? []
    const sessionMode = config.sessionMode ?? 'none'

    const argList: string[] = [...extra]

    // Resumes the session using --session-id <uuid>
    if (sessionMode === 'resume-file') {
      const taskId = path.basename(sessionFile, '.jsonl')
      const sessionArg = config.sessionArg ?? '--session-id'
      argList.push(sessionArg, taskId)
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

    // Tool use detection: Claude Code prints lines starting with tool status
    // e.g. "Bash: running command...", "Edit: editing file...", "Read: reading file..."
    if (
      /\b(bash|edit|write|read|grep|find|web_search|browser|python|task|lsp):\s*(running|editing|reading|searching|executing)/i.test(
        clean,
      ) ||
      /\b(calling|executing)\s+tool\b/i.test(clean)
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

export default claudeDriver
