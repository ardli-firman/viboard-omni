import { app, BrowserWindow, Tray, Menu, Notification } from 'electron'
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
import { registerSettingsHandlers } from './ipc/settings'
import { registerTagHandlers } from './ipc/tags'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function createTray(): void {
  const iconPath = join(__dirname, '../../build/icon.png')
  tray = new Tray(iconPath)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open ViBoard Omni',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          if (!mainWindow.isVisible()) mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('ViBoard Omni')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../build/icon.png'),
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

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()

      new Notification({
        title: 'ViBoard Omni',
        body: 'Application is running in the background (system tray).',
        icon: join(__dirname, '../../build/icon.png')
      }).show()
    }
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

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })

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
    registerSettingsHandlers()
    registerColumnHandlers()
    registerTaskHandlers()
    registerTagHandlers()
    registerTerminalHandlers()
    registerThemeHandlers()
    registerLogHandlers()
    
    createWindow()
    createTray()

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
    isQuitting = true
    shutdownAllSessions()
  })
}
