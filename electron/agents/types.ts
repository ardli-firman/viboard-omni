/**
 * Agent Driver Types
 *
 * Shared interface and utilities for all agent CLI drivers.
 * Import this in every driver file.
 */

import type { AgentCliConfig, AgentActivity, AgentType } from '../../src/shared/types'

export type { AgentCliConfig, AgentActivity, AgentType }

// ── Interface ─────────────────────────────────────────────────────────────────

export interface AgentDriver {
  /** Unique identifier matching AgentType */
  readonly type: AgentType

  /** Human-readable label shown in UI */
  readonly label: string

  /** Brief description of the agent */
  readonly description: string

  /**
   * Resolve the binary path.
   * @param config User-provided config (binaryPath may be null → auto-resolve)
   * @param platform process.platform value
   */
  resolveBinary(config: Partial<AgentCliConfig>, platform: string): string

  /**
   * Build the full argument list for pty.spawn().
   * Includes wrapping in cmd.exe /c on Windows if needed.
   *
   * @param config      Merged config (global defaults + task overrides)
   * @param platform    process.platform
   * @param sessionFile Absolute path to the per-task session file
   */
  buildSpawnCommand(
    config: Partial<AgentCliConfig>,
    platform: string,
    sessionFile: string,
  ): { file: string; args: string[] }

  /**
   * Build environment variables to inject at spawn.
   * Driver defaults are merged with config.extraEnv (config wins).
   */
  buildEnv(
    config: Partial<AgentCliConfig>,
    taskId: string,
    cwd: string,
  ): Record<string, string>

  /**
   * Analyse a raw PTY output chunk and return the detected activity.
   * Return null if the chunk gives no signal.
   */
  detectActivity(chunk: string): AgentActivity | null
}

// ── Shared Utilities ──────────────────────────────────────────────────────────

/** Strip ANSI escape codes for plain-text pattern matching. */
export function stripAnsi(raw: string): string {
  return raw
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
}

/**
 * Factory for "slot" drivers — agents whose full implementation is TBD.
 * Provides a sensible passive activity detector and configurable spawn logic.
 * User supplies the binary path via Settings.
 */
export function makePassiveDriver(
  type: AgentType,
  label: string,
  description: string,
  defaultBinary: string,
): AgentDriver {
  return {
    type,
    label,
    description,

    resolveBinary(config, _platform) {
      return config.binaryPath ?? defaultBinary
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
}
