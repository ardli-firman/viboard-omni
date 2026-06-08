/**
 * Agent Driver Registry
 *
 * This file is intentionally thin — it only imports each driver and
 * assembles the lookup map. All driver logic lives in drivers/<name>.ts.
 *
 * ── How to add a new agent CLI ───────────────────────────────────────
 *  1. Create  electron/agents/drivers/<your-agent>.ts
 *     - Implement the AgentDriver interface (from ../types)
 *     - Export as default
 *  2. Add the AgentType literal to src/shared/types.ts  (AgentType union)
 *  3. Import your driver here and add it to AGENT_DRIVERS
 *  4. Add a getDriverDefaults entry below
 *  5. Add the UI metadata in:
 *     - src/renderer/src/components/Settings/AgentSettingsModal.tsx (AGENT_META)
 *     - src/renderer/src/components/Modal/TaskModal.tsx (AGENT_OPTIONS)
 * ─────────────────────────────────────────────────────────────────────
 */

import type { AgentType, AgentCliConfig } from '../../src/shared/types'
import type { AgentDriver } from './types'

// ── Driver imports ────────────────────────────────────────────────────────────
import ohMyPiDriver from './drivers/oh-my-pi'
import geminiCliDriver from './drivers/gemini-cli'
import piAgentDriver from './drivers/pi-agent'
import hermesDriver from './drivers/hermes'
import customDriver from './drivers/custom'

// ── Registry ──────────────────────────────────────────────────────────────────

export const AGENT_DRIVERS: Record<AgentType, AgentDriver> = {
  'oh-my-pi': ohMyPiDriver,
  'gemini-cli': geminiCliDriver,
  'pi-agent': piAgentDriver,
  'hermes': hermesDriver,
  'custom': customDriver,
}

/**
 * Retrieve a driver by AgentType, falling back to oh-my-pi if unknown.
 */
export function getDriver(type: AgentType): AgentDriver {
  return AGENT_DRIVERS[type] ?? AGENT_DRIVERS['oh-my-pi']
}

/**
 * Default AgentCliConfig for a given driver type.
 * Used when no global or task-level override exists.
 */
export function getDriverDefaults(type: AgentType): Partial<AgentCliConfig> {
  const defaults: Record<AgentType, Partial<AgentCliConfig>> = {
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
      sessionMode: 'resume-file',
      sessionArg: '--session',
      sessionEnvVar: null,
    },
    'hermes': {
      agentType: 'hermes',
      binaryPath: null,
      extraArgs: [],
      extraEnv: {},
      sessionMode: 'none',
      sessionArg: null,
      sessionEnvVar: null,
    },
    'custom': {
      agentType: 'custom',
      binaryPath: null,
      extraArgs: [],
      extraEnv: {},
      sessionMode: 'none',
      sessionArg: null,
      sessionEnvVar: null,
    },
  }
  return defaults[type] ?? defaults['oh-my-pi']
}

// Re-export the interface so terminal.ts can import from one place
export type { AgentDriver }
