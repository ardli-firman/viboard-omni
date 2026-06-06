import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase } from './database/init'
import { registerColumnHandlers } from './ipc/columns'
import { registerTaskHandlers } from './ipc/tasks'
import { registerTerminalHandlers, shutdownAllSessions } from './ipc/terminal'
import { registerThemeHandlers } from './ipc/theme'
import { registerLogHandlers } from './ipc/log'
import { registerFileHandlers } from './ipc/files'
import { registerProjectHandlers } from './ipc/project'
import { registerGitHandlers } from './ipc/git'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.viboard.omni')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  
  // Initialize database
  initDatabase()

  registerProjectHandlers()
  registerFileHandlers()
  registerGitHandlers()
  registerColumnHandlers()
  registerTaskHandlers()
  registerTerminalHandlers()
  registerThemeHandlers()
  registerLogHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  shutdownAllSessions()
})
