/**
 * Settings IPC Handler
 *
 * Persists global AppSettings to userData/settings.json.
 * Provides:
 *   settings:get  → AppSettings
 *   settings:set  → void (merges partial update)
 */

import { ipcMain, app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppSettings } from '../../src/shared/types'

const SETTINGS_FILE = 'settings.json'

const DEFAULT_SETTINGS: AppSettings = {
  defaultAgentType: 'oh-my-pi',
  agentConfigs: {
    'oh-my-pi': {
      agentType: 'oh-my-pi',
      binaryPath: null,
      extraArgs: [],
      extraEnv: {},
      sessionMode: 'resume-file',
      sessionArg: '--resume',
      sessionEnvVar: null,
    },
    'gemini-cli': {
      agentType: 'gemini-cli',
      binaryPath: null,
      extraArgs: [],
      extraEnv: {},
      sessionMode: 'none',
      sessionArg: null,
      sessionEnvVar: null,
    },
    'pi-agent': {
      agentType: 'pi-agent',
      binaryPath: null,
      extraArgs: [],
      extraEnv: {},
      sessionMode: 'none',
      sessionArg: null,
      sessionEnvVar: null,
    },
    hermes: {
      agentType: 'hermes',
      binaryPath: null,
      extraArgs: [],
      extraEnv: {},
      sessionMode: 'none',
      sessionArg: null,
      sessionEnvVar: null,
    },
    opencode: {
      agentType: 'opencode',
      binaryPath: null,
      extraArgs: [],
      extraEnv: {},
      sessionMode: 'none',
      sessionArg: null,
      sessionEnvVar: null,
    },
    claude: {
      agentType: 'claude',
      binaryPath: null,
      extraArgs: [],
      extraEnv: {},
      sessionMode: 'resume-file',
      sessionArg: '--session-id',
      sessionEnvVar: null,
    },
    custom: {
      agentType: 'custom',
      binaryPath: null,
      extraArgs: [],
      extraEnv: {},
      sessionMode: 'none',
      sessionArg: null,
      sessionEnvVar: null,
    },
  },
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

function readSettings(): AppSettings {
  const file = getSettingsPath()
  if (!existsSync(file)) return { ...DEFAULT_SETTINGS }
  try {
    const raw = readFileSync(file, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    // Deep merge with defaults so new keys are always present
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      agentConfigs: {
        ...DEFAULT_SETTINGS.agentConfigs,
        ...(parsed.agentConfigs ?? {}),
      },
    }
  } catch (err) {
    console.error('[settings] Failed to read settings:', err)
    return { ...DEFAULT_SETTINGS }
  }
}

function writeSettings(settings: AppSettings): void {
  try {
    writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
  } catch (err) {
    console.error('[settings] Failed to write settings:', err)
  }
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', (): AppSettings => {
    return readSettings()
  })

  ipcMain.handle('settings:set', (_event: unknown, patch: Partial<AppSettings>): AppSettings => {
    const current = readSettings()
    const next: AppSettings = {
      ...current,
      ...patch,
      agentConfigs: {
        ...current.agentConfigs,
        ...(patch.agentConfigs ?? {}),
      },
    }
    writeSettings(next)
    return next
  })
}
