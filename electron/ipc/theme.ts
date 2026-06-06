import { ipcMain } from 'electron'
import Store from 'electron-store'

interface ThemeStore {
  theme: 'light' | 'dark'
}

let store: Store<ThemeStore>

export function registerThemeHandlers(): void {
  store = new Store<ThemeStore>({ defaults: { theme: 'dark' } })

  ipcMain.handle('theme:get', (): 'light' | 'dark' => {
    return store.get('theme')
  })

  ipcMain.handle('theme:set', (_event: unknown, theme: 'light' | 'dark'): void => {
    store.set('theme', theme)
  })
}
