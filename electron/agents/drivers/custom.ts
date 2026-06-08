/**
 * Custom Command Driver
 *
 * Fully user-defined agent CLI. The user supplies the binary path,
 * extra arguments, and environment variables via Settings or per-task config.
 *
 * Activity detection is passive (any substantial output = 'responding').
 */

import type { AgentDriver } from '../types'
import { stripAnsi } from '../types'

const customDriver: AgentDriver = {
  type: 'custom',
  label: 'Custom Command',
  description:
    'Fully custom agent CLI. Provide binary path, arguments, and environment variables.',

  resolveBinary(config, _platform) {
    // 'echo' is a safe no-op default that won't crash if the user forgets to set a path
    return config.binaryPath ?? 'echo'
  },

  buildSpawnCommand(config, platform, sessionFile) {
    const bin = this.resolveBinary(config, platform)
    const extra = config.extraArgs ?? []
    const sessionMode = config.sessionMode ?? 'none'
    const sessionArg = config.sessionArg ?? null

    const argList: string[] = [...extra]
    if (sessionMode === 'resume-file' && sessionArg) {
      argList.push(sessionArg, sessionFile)
    }

    if (platform === 'win32') {
      return { file: 'cmd.exe', args: ['/c', bin, ...argList] }
    }
    return { file: bin, args: argList }
  },

  buildEnv(config, taskId, _cwd) {
    const sessionMode = config.sessionMode ?? 'none'
    const base: Record<string, string> = {
      FORCE_COLOR: '1',
      ...(config.extraEnv ?? {}),
    }
    if (sessionMode === 'env-var' && config.sessionEnvVar) {
      base[config.sessionEnvVar] = taskId
    }
    return base
  },

  detectActivity(chunk) {
    const clean = stripAnsi(chunk)
    const printable = clean.replace(/[\r\n\s]/g, '')
    if (printable.length > 2) return 'responding'
    return null
  },
}

export default customDriver
