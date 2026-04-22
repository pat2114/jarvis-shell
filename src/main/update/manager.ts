import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'

export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'available'; version: string }
  | { phase: 'not-available'; currentVersion: string }
  | { phase: 'downloading'; percent: number; transferredMB: number; totalMB: number }
  | { phase: 'downloaded'; version: string }
  | { phase: 'error'; message: string }

type Broadcaster = (state: UpdateState) => void

let currentState: UpdateState = { phase: 'idle' }
let broadcaster: Broadcaster | null = null
let pollTimer: NodeJS.Timeout | null = null

function setState(next: UpdateState): void {
  currentState = next
  broadcaster?.(next)
}

export function getUpdateState(): UpdateState {
  return currentState
}

export function initUpdater(getMainWindow: () => BrowserWindow | null): void {
  if (is.dev) {
    setState({ phase: 'not-available', currentVersion: app.getVersion() })
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  broadcaster = (state): void => {
    const mw = getMainWindow()
    mw?.webContents.send('update:state', state)
  }

  autoUpdater.on('checking-for-update', () => setState({ phase: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    setState({ phase: 'available', version: info.version })
  )
  autoUpdater.on('update-not-available', (info) =>
    setState({ phase: 'not-available', currentVersion: info.version })
  )
  autoUpdater.on('download-progress', (progress) =>
    setState({
      phase: 'downloading',
      percent: Math.round(progress.percent),
      transferredMB: Math.round(progress.transferred / 1024 / 1024),
      totalMB: Math.round(progress.total / 1024 / 1024)
    })
  )
  autoUpdater.on('update-downloaded', (info) =>
    setState({ phase: 'downloaded', version: info.version })
  )
  autoUpdater.on('error', (err) => setState({ phase: 'error', message: err.message }))

  // Initial check a few seconds after launch so the UI has time to render.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      setState({ phase: 'error', message: (err as Error).message })
    })
  }, 5_000)

  // Periodic re-checks every 30 minutes.
  pollTimer = setInterval(
    () => {
      autoUpdater.checkForUpdates().catch(() => {
        /* swallow — reported via error event above */
      })
    },
    30 * 60 * 1000
  )
}

export function checkForUpdatesManual(): void {
  if (is.dev) return
  autoUpdater.checkForUpdates().catch((err) => {
    setState({ phase: 'error', message: (err as Error).message })
  })
}

export function installDownloadedUpdate(): void {
  autoUpdater.quitAndInstall()
}

export function shutdown(): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  broadcaster = null
}
