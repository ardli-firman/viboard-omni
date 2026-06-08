import { create } from 'zustand'
import type { AppSettings, AgentType, AgentCliConfig } from '@shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  defaultAgentType: 'oh-my-pi',
  agentConfigs: {},
}

interface SettingsState {
  settings: AppSettings
  loaded: boolean

  loadSettings: () => Promise<void>
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>
  /** Update global config for a specific agent type */
  updateAgentConfig: (type: AgentType, config: Partial<AgentCliConfig>) => Promise<void>
  /** Set the global default agent type */
  setDefaultAgentType: (type: AgentType) => Promise<void>
  /** Return the resolved config for a given type (global config merged with driver defaults) */
  getAgentConfig: (type: AgentType) => Partial<AgentCliConfig> | undefined
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  loadSettings: async () => {
    try {
      const settings = await window.electronAPI.getSettings()
      set({ settings, loaded: true })
    } catch (err) {
      console.error('[settingsStore] Failed to load settings:', err)
      set({ loaded: true })
    }
  },

  saveSettings: async (patch) => {
    try {
      const next = await window.electronAPI.saveSettings(patch)
      set({ settings: next })
    } catch (err) {
      console.error('[settingsStore] Failed to save settings:', err)
    }
  },

  updateAgentConfig: async (type, config) => {
    const current = get().settings
    const updated = await window.electronAPI.saveSettings({
      agentConfigs: {
        ...current.agentConfigs,
        [type]: {
          ...(current.agentConfigs[type] ?? {}),
          ...config,
        },
      },
    })
    set({ settings: updated })
  },

  setDefaultAgentType: async (type) => {
    const updated = await window.electronAPI.saveSettings({ defaultAgentType: type })
    set({ settings: updated })
  },

  getAgentConfig: (type) => {
    return get().settings.agentConfigs[type]
  },
}))
