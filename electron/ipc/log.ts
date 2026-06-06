import { ipcMain } from 'electron'

export function registerLogHandlers(): void {
  ipcMain.on('log:info', (_event, ...args: unknown[]) => {
    console.log('[renderer]', ...args)
  })

  ipcMain.on('log:error', (_event, ...args: unknown[]) => {
    console.error('[renderer]', ...args)
  })

  ipcMain.on('log:warn', (_event, ...args: unknown[]) => {
    console.warn('[renderer]', ...args)
  })
}
