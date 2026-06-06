import { ipcMain, dialog } from 'electron'
import { statSync } from 'node:fs'

export function registerProjectHandlers(): void {
  console.log('[project] Registering IPC handlers')

  ipcMain.handle('project:selectFolder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Open Project Folder',
      buttonLabel: 'Open Project',
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      console.log('[project:selectFolder] Cancelled')
      return null
    }
    const path = result.filePaths[0]
    try {
      const stat = statSync(path)
      if (!stat.isDirectory()) {
        console.error('[project:selectFolder] Not a directory:', path)
        return null
      }
    } catch (err) {
      console.error('[project:selectFolder] Invalid path:', path, err)
      return null
    }
    console.log('[project:selectFolder] Selected:', path)
    return path
  })
}
