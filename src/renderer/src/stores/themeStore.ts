import { create } from 'zustand'
import type { ThemeMode } from '@shared/types'

interface ThemeState {
  theme: ThemeMode
  initialized: boolean
  init: () => Promise<void>
  toggle: () => Promise<void>
}

function applyTheme(theme: ThemeMode): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',
  initialized: false,

  init: async () => {
    const saved = await window.electronAPI.getTheme()
    set({ theme: saved, initialized: true })
    applyTheme(saved)
  },

  toggle: async () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    await window.electronAPI.setTheme(next)
    set({ theme: next })
    applyTheme(next)
  },
}))
