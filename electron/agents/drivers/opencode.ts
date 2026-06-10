/**
 * OpenCode Driver
 *
 * Implements the AgentDriver for OpenCode (opencode.ai).
 *
 * Behaviour:
 *   - Auto-resolves `opencode` / `opencode.cmd` from PATH or common install locations
 *   - Session resume via `--continue` (resumes last session)
 *   - Activity detection: spinner + tool header patterns
 */

import * as os from 'node:os'
import * as path from 'node:path'
import { existsSync } from 'node:fs'
import type { AgentDriver } from '../types'
import { stripAnsi } from '../types'

const opencodeDriver: AgentDriver = {
  type: 'opencode',
  label: 'OpenCode',
  description:
    'OpenCode AI agent (opencode.ai). Uses --continue for session resume.',

  resolveBinary(config, platform) {
    if (config.binaryPath) return config.binaryPath
    if (platform === 'win32') {
      const candidates = [
        path.join(os.homedir(), '.bun', 'bin', 'opencode.cmd'),
        path.join(os.homedir(), '.bun', 'bin', 'opencode.exe'),
        path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'opencode.cmd'),
        path.join(os.homedir(), 'AppData', 'Local', 'opencode', 'opencode.exe'),
      ]
      for (const c of candidates) {
        if (existsSync(c)) return c
      }
      return 'opencode.cmd'
    }
    const candidates = [
      path.join(os.homedir(), '.bun', 'bin', 'opencode'),
      path.join(os.homedir(), '.local', 'share', 'npm', 'opencode'),
      '/opt/homebrew/bin/opencode',
      '/usr/local/bin/opencode',
    ]
    for (const c of candidates) {
      if (existsSync(c)) return c
    }
    return 'opencode'
  },

  buildSpawnCommand(config, platform, _sessionFile) {
    const bin = this.resolveBinary(config, platform)
    const extra = config.extraArgs ?? []
    const sessionMode = config.sessionMode ?? 'none'

    const argList: string[] = [...extra]

    // OpenCode uses --continue to resume the last session
    if (sessionMode === 'resume-file') {
      argList.push('--continue')
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
      OPENCODE_DISABLE_MOUSE: '1',
      OPENCODE_DISABLE_TERMINAL_TITLE: '1',
      ...(config.extraEnv ?? {}),
    }
  },

  detectActivity(chunk) {
    const clean = stripAnsi(chunk)

    // Tool use: OpenCode shows tool emoji headers like other AI CLIs
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

export default opencodeDriver
