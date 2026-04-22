import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { interpretTheme, type TokenState } from './llm/themeAgent'
import { askHelp, type HelpMessage } from './llm/helpAgent'
import {
  checkForUpdatesManual,
  getUpdateState,
  initUpdater,
  installDownloadedUpdate,
  shutdown as shutdownUpdater
} from './update/manager'
import { sendTelemetry, type TelemetryReport } from './telemetry/report'
import { logger, tailLog } from './log/logger'
import {
  approveCheckpoint,
  executeStep,
  getProjectState,
  initProject,
  onProjectUpdate,
  reviseCheckpoint
} from './pipeline/runner'
import { listProjects } from './db'
import { runChecks } from './setup/checks'
import {
  clearKey,
  getKey,
  getKeyCatalog,
  getKeyStatuses,
  setKey,
  type KeySlot
} from './setup/keyStore'

let mainWindow: BrowserWindow | null = null
let previewWindow: BrowserWindow | null = null
let helpWindow: BrowserWindow | null = null

function broadcastProjectUpdate(projectId: string): void {
  const state = getProjectState(projectId)
  mainWindow?.webContents.send('pipeline:updated', state)
}

function loadRenderer(win: BrowserWindow, query = ''): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + query)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), {
      search: query.startsWith('?') ? query.slice(1) : query
    })
  }
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadRenderer(mainWindow)
}

function createHelpWindow(): void {
  if (helpWindow && !helpWindow.isDestroyed()) {
    helpWindow.focus()
    return
  }
  helpWindow = new BrowserWindow({
    width: 480,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    title: 'Jarvis — Co-pilot',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  helpWindow.on('ready-to-show', () => helpWindow?.show())
  helpWindow.on('closed', () => {
    helpWindow = null
  })
  loadRenderer(helpWindow, '?help=1')
}

function createPreviewWindow(templateId: string): void {
  if (previewWindow && !previewWindow.isDestroyed()) {
    previewWindow.focus()
    loadRenderer(previewWindow, `?preview=${templateId}`)
    return
  }

  previewWindow = new BrowserWindow({
    width: 960,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    title: 'Layout Preview',
    parent: mainWindow ?? undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  previewWindow.on('ready-to-show', () => previewWindow?.show())
  previewWindow.on('closed', () => {
    previewWindow = null
  })

  loadRenderer(previewWindow, `?preview=${templateId}`)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('preview:open', (_evt, templateId: string) => {
    createPreviewWindow(templateId)
  })

  ipcMain.on('preview:apply', (_evt, templateId: string) => {
    mainWindow?.webContents.send('preview:applied', templateId)
    previewWindow?.close()
  })

  ipcMain.on('preview:discard', () => {
    previewWindow?.close()
  })

  ipcMain.handle(
    'agent:theme-interpret',
    async (_evt, payload: { input: string; tokens: TokenState }) => {
      return interpretTheme(payload.input, payload.tokens)
    }
  )

  ipcMain.handle('pipeline:list-projects', async () => {
    return listProjects()
  })

  ipcMain.handle('pipeline:get-state', async (_evt, projectId: string) => {
    return getProjectState(projectId)
  })

  ipcMain.handle(
    'pipeline:create-project',
    async (_evt, input: { companyName: string; websiteUrl: string }) => {
      const state = initProject(input)
      void executeStep(state.project.id, state.project.currentStepId).catch(() => {
        /* errors persisted */
      })
      return state
    }
  )

  ipcMain.handle(
    'pipeline:approve',
    async (_evt, payload: { projectId: string; checkpointId: string }) => {
      await approveCheckpoint(payload.projectId, payload.checkpointId)
      return getProjectState(payload.projectId)
    }
  )

  ipcMain.handle(
    'pipeline:revise',
    async (_evt, payload: { projectId: string; checkpointId: string; feedback: string }) => {
      await reviseCheckpoint(payload.projectId, payload.checkpointId, payload.feedback)
      return getProjectState(payload.projectId)
    }
  )

  onProjectUpdate((projectId) => {
    broadcastProjectUpdate(projectId)
  })

  initUpdater(() => mainWindow)

  ipcMain.handle('update:get-state', async () => getUpdateState())
  ipcMain.on('update:check', () => checkForUpdatesManual())
  ipcMain.on('update:install', () => installDownloadedUpdate())

  ipcMain.handle(
    'telemetry:report',
    async (_evt, input: Omit<TelemetryReport, 'id' | 'appVersion' | 'timestamp'>) => {
      await sendTelemetry(input)
      return { ok: true as const }
    }
  )

  ipcMain.handle('log:tail', async (_evt, lines?: number) => {
    return tailLog(typeof lines === 'number' ? lines : 200)
  })

  void logger.info('app', 'main process started', { version: app.getVersion() })

  ipcMain.handle('setup:run-checks', async () => {
    return runChecks()
  })

  ipcMain.handle('setup:get-key-catalog', async () => {
    return getKeyCatalog()
  })

  ipcMain.handle('setup:get-key-statuses', async () => {
    return getKeyStatuses()
  })

  ipcMain.handle('setup:set-key', async (_evt, payload: { slot: KeySlot; value: string }) => {
    try {
      setKey(payload.slot, payload.value)
      return { ok: true as const }
    } catch (err) {
      return { ok: false as const, error: (err as Error).message }
    }
  })

  ipcMain.handle('setup:clear-key', async (_evt, slot: KeySlot) => {
    clearKey(slot)
    return { ok: true as const }
  })

  ipcMain.handle('setup:has-key', async (_evt, slot: KeySlot) => {
    return getKey(slot) !== null
  })

  ipcMain.on('help:open', () => {
    createHelpWindow()
  })

  ipcMain.handle(
    'help:send-message',
    async (
      _evt,
      payload: { projectId: string | null; messages: HelpMessage[]; userMessage: string }
    ) => {
      return askHelp(payload)
    }
  )

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  shutdownUpdater()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

process.on('uncaughtException', (err) => {
  void logger.error('uncaughtException', err.message, { stack: err.stack })
  void sendTelemetry({
    source: 'main-process',
    message: err.message,
    stack: err.stack
  })
})

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason)
  const stack = reason instanceof Error ? reason.stack : undefined
  void logger.error('unhandledRejection', msg, { stack })
  void sendTelemetry({ source: 'main-process', message: msg, stack })
})
