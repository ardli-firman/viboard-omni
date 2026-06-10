import { ipcMain, app } from 'electron'

export function registerLogHandlers(): void {
  const isDev = !app.isPackaged

  ipcMain.on('log:info', (_event, ...args: unknown[]) => {
    if (isDev) {
      console.log('[renderer]', ...args)
    }
  })

  ipcMain.on('log:error', (_event, ...args: unknown[]) => {
    if (isDev) {
      console.error('[renderer]', ...args)
    }
  })

  ipcMain.on('log:warn', (_event, ...args: unknown[]) => {
    if (isDev) {
      console.warn('[renderer]', ...args)
    }
  })
}
