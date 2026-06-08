/**
 * Pi Agent CLI Driver
 *
 * Implements the AgentDriver for Pi Agent CLI (pi.dev).
 *
 * Behaviour:
 *   - Auto-resolves `pi` / `pi.cmd` / `pi.exe` from PATH or common install locations
 *   - Session persistence via `--session <session-file>`
 *   - Activity detection: Braille spinner + tool header patterns
 */

import * as os from 'node:os'
import * as path from 'node:path'
import { existsSync } from 'node:fs'
import type { AgentDriver } from '../types'
import { stripAnsi } from '../types'

const piAgentDriver: AgentDriver = {
  type: 'pi-agent',
  label: 'Pi Agent CLI',
  description:
    'Pi Agent CLI (pi.dev). Uses --session <session-file> for session persistence.',

  resolveBinary(config, platform) {
    if (config.binaryPath) return config.binaryPath
    if (platform === 'win32') {
      const candidates = [
        path.join(os.homedir(), '.bun', 'bin', 'pi.cmd'),
        path.join(os.homedir(), '.bun', 'bin', 'pi.exe'),
        path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'pi.cmd'),
      ]
      for (const c of candidates) {
        if (existsSync(c)) return c
      }
      return 'pi.cmd'
    }
    return 'pi'
  },

  buildSpawnCommand(config, platform, sessionFile) {
    const bin = this.resolveBinary(config, platform)
    const sessionArg = config.sessionArg ?? '--session'
    const extra = config.extraArgs ?? []

    if (platform === 'win32') {
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
      FORCE_COLOR: '1',
      PI_OFFLINE: '1',
      PI_SKIP_VERSION_CHECK: '1',
      ...(config.extraEnv ?? {}),
    }
  },

  detectActivity(chunk) {
    const clean = stripAnsi(chunk)

    // Tool use: pi shows tool emoji headers like ⚡ bash, ✏ edit, etc.
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

export default piAgentDriver
