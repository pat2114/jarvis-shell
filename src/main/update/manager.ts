import { app, BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import { IncomingMessage } from 'http'
import { URL } from 'url'

export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'available'; version: string }
  | { phase: 'not-available'; currentVersion: string }
  | { phase: 'downloading'; percent: number; transferredMB: number; totalMB: number }
  | { phase: 'downloaded'; version: string }
  | { phase: 'error'; message: string }

type Broadcaster = (state: UpdateState) => void

const GITHUB_RELEASES_URL = 'https://api.github.com/repos/pat2114/atelier/releases/latest'
const ASSET_NAME = 'Atelier-windows-x64.zip'
const USER_AGENT = 'atelier-updater'
const CHECK_INTERVAL_MS = 30 * 60 * 1000
const INITIAL_CHECK_DELAY_MS = 15_000

let currentState: UpdateState = { phase: 'idle' }
let broadcaster: Broadcaster | null = null
let pollTimer: NodeJS.Timeout | null = null
let initialTimer: NodeJS.Timeout | null = null
let checkInFlight: Promise<void> | null = null
let downloadedZipPath: string | null = null
let downloadedVersion: string | null = null

function setState(next: UpdateState): void {
  currentState = next
  broadcaster?.(next)
}

export function getUpdateState(): UpdateState {
  return currentState
}

function getUpdatesDir(): string {
  return path.join(app.getPath('userData'), 'updates')
}

function cleanupOldDownloads(keepVersion: string | null): void {
  const dir = getUpdatesDir()
  try {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry)
      try {
        const stat = fs.statSync(full)
        if (stat.isDirectory() && entry !== keepVersion) {
          fs.rmSync(full, { recursive: true, force: true })
        }
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

function parseSemver(v: string): number[] {
  const clean = v.replace(/^v/i, '').split('-')[0].split('+')[0]
  return clean.split('.').map((p) => {
    const n = parseInt(p, 10)
    return Number.isFinite(n) ? n : 0
  })
}

function semverGreater(a: string, b: string): boolean {
  const aa = parseSemver(a)
  const bb = parseSemver(b)
  const len = Math.max(aa.length, bb.length)
  for (let i = 0; i < len; i++) {
    const ai = aa[i] ?? 0
    const bi = bb[i] ?? 0
    if (ai > bi) return true
    if (ai < bi) return false
  }
  return false
}

type GitHubAsset = {
  name: string
  browser_download_url: string
  size: number
}

type GitHubRelease = {
  tag_name: string
  assets: GitHubAsset[]
}

function httpsGetFollow(url: string, headers: Record<string, string>): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const tryFetch = (target: string, redirects: number): void => {
      if (redirects > 5) {
        reject(new Error('Too many redirects'))
        return
      }
      const parsed = new URL(target)
      const req = https.get(
        {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          headers: { 'User-Agent': USER_AGENT, ...headers }
        },
        (res) => {
          const status = res.statusCode ?? 0
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume()
            const next = new URL(res.headers.location, target).toString()
            tryFetch(next, redirects + 1)
            return
          }
          if (status < 200 || status >= 300) {
            res.resume()
            reject(new Error(`HTTP ${status} for ${target}`))
            return
          }
          resolve(res)
        }
      )
      req.on('error', reject)
      req.setTimeout(60_000, () => {
        req.destroy(new Error('Request timed out'))
      })
    }
    tryFetch(url, 0)
  })
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const res = await httpsGetFollow(GITHUB_RELEASES_URL, {
    Accept: 'application/vnd.github+json'
  })
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    res.on('data', (c: Buffer) => chunks.push(c))
    res.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8')
        const parsed = JSON.parse(body) as GitHubRelease
        resolve(parsed)
      } catch (err) {
        reject(err as Error)
      }
    })
    res.on('error', reject)
  })
}

async function downloadAsset(
  url: string,
  destPath: string,
  onProgress: (transferred: number, total: number) => void
): Promise<{ bytes: number; expected: number }> {
  const res = await httpsGetFollow(url, { Accept: 'application/octet-stream' })
  const expected = parseInt((res.headers['content-length'] as string) || '0', 10) || 0
  fs.mkdirSync(path.dirname(destPath), { recursive: true })
  const out = fs.createWriteStream(destPath)
  let transferred = 0
  let lastEmit = 0
  return new Promise((resolve, reject) => {
    res.on('data', (chunk: Buffer) => {
      transferred += chunk.length
      const now = Date.now()
      if (now - lastEmit >= 200) {
        lastEmit = now
        onProgress(transferred, expected)
      }
    })
    res.on('error', (err) => {
      out.destroy()
      fs.rm(destPath, { force: true }, () => reject(err))
    })
    out.on('error', (err) => {
      res.destroy()
      fs.rm(destPath, { force: true }, () => reject(err))
    })
    out.on('finish', () => {
      onProgress(transferred, expected || transferred)
      resolve({ bytes: transferred, expected })
    })
    res.pipe(out)
  })
}

function buildApplyScript(zipPath: string, installDir: string, exeName: string): string {
  // PowerShell apply helper. Single-quoted literals for paths so backslashes
  // and $ are literal. Waits 3s so the app has time to exit, expands the zip
  // over the install dir, launches the new exe, and then deletes itself.
  const logPath = path.join(getUpdatesDir(), 'apply.log')
  const script = `$ErrorActionPreference = 'Stop'
$zip = '${zipPath.replace(/'/g, "''")}'
$installDir = '${installDir.replace(/'/g, "''")}'
$exe = Join-Path $installDir '${exeName.replace(/'/g, "''")}'
$log = '${logPath.replace(/'/g, "''")}'
$self = $MyInvocation.MyCommand.Path
try {
  Start-Sleep -Seconds 3
  if (!(Test-Path $zip)) { throw "Zip not found at $zip" }
  if (!(Test-Path $installDir)) { throw "Install dir not found at $installDir" }
  Expand-Archive -LiteralPath $zip -DestinationPath $installDir -Force
  if (Test-Path $exe) {
    Start-Process -FilePath $exe
  } else {
    Add-Content -Path $log -Value "[$(Get-Date -Format o)] Updated but exe missing at $exe"
  }
} catch {
  try {
    Add-Content -Path $log -Value "[$(Get-Date -Format o)] Apply failed: $($_.Exception.Message)"
    Add-Content -Path $log -Value $_.ScriptStackTrace
  } catch {}
} finally {
  try { Remove-Item -LiteralPath $self -Force -ErrorAction SilentlyContinue } catch {}
}
`
  return script
}

async function runCheck(): Promise<void> {
  if (checkInFlight) return checkInFlight
  const current = app.getVersion()
  setState({ phase: 'checking' })
  const task = (async (): Promise<void> => {
    try {
      const release = await fetchLatestRelease()
      if (!release || !release.tag_name) {
        setState({ phase: 'error', message: 'Invalid release payload from GitHub' })
        return
      }
      const latestVersion = release.tag_name.replace(/^v/i, '')
      if (!semverGreater(latestVersion, current)) {
        setState({ phase: 'not-available', currentVersion: current })
        return
      }
      const asset = release.assets?.find(
        (a) => a.name?.toLowerCase() === ASSET_NAME.toLowerCase()
      )
      if (!asset) {
        setState({
          phase: 'error',
          message: `Release ${latestVersion} has no asset matching ${ASSET_NAME}`
        })
        return
      }
      setState({ phase: 'available', version: latestVersion })

      // Already downloaded and ready for this version?
      const versionDir = path.join(getUpdatesDir(), latestVersion)
      const zipPath = path.join(versionDir, ASSET_NAME)
      cleanupOldDownloads(latestVersion)
      if (
        downloadedZipPath === zipPath &&
        downloadedVersion === latestVersion &&
        fs.existsSync(zipPath)
      ) {
        setState({ phase: 'downloaded', version: latestVersion })
        return
      }
      // Remove any stale partial.
      try {
        if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true })
      } catch {
        /* ignore */
      }

      let lastPercent = -1
      const { bytes, expected } = await downloadAsset(
        asset.browser_download_url,
        zipPath,
        (transferred, total) => {
          const percent = total > 0 ? Math.round((transferred / total) * 100) : 0
          if (percent !== lastPercent) {
            lastPercent = percent
            setState({
              phase: 'downloading',
              percent,
              transferredMB: Math.round(transferred / 1024 / 1024),
              totalMB: Math.round((total || transferred) / 1024 / 1024)
            })
          }
        }
      )

      if (expected > 0 && bytes !== expected) {
        try {
          fs.rmSync(zipPath, { force: true })
        } catch {
          /* ignore */
        }
        setState({
          phase: 'error',
          message: `Download size mismatch: got ${bytes} bytes, expected ${expected}`
        })
        return
      }

      downloadedZipPath = zipPath
      downloadedVersion = latestVersion
      setState({ phase: 'downloaded', version: latestVersion })
    } catch (err) {
      setState({ phase: 'error', message: (err as Error).message || String(err) })
    }
  })()
  checkInFlight = task.finally(() => {
    checkInFlight = null
  })
  return checkInFlight
}

export function initUpdater(getMainWindow: () => BrowserWindow | null): void {
  broadcaster = (state): void => {
    const mw = getMainWindow()
    mw?.webContents.send('update:state', state)
  }

  if (is.dev) {
    setState({ phase: 'not-available', currentVersion: app.getVersion() })
    return
  }

  try {
    fs.mkdirSync(getUpdatesDir(), { recursive: true })
  } catch {
    /* ignore */
  }
  cleanupOldDownloads(null)

  initialTimer = setTimeout(() => {
    void runCheck()
  }, INITIAL_CHECK_DELAY_MS)

  pollTimer = setInterval(() => {
    void runCheck()
  }, CHECK_INTERVAL_MS)
}

export function checkForUpdatesManual(): void {
  if (is.dev) return
  void runCheck()
}

export function installDownloadedUpdate(): void {
  if (is.dev) return
  if (!downloadedZipPath || !downloadedVersion || !fs.existsSync(downloadedZipPath)) {
    setState({ phase: 'error', message: 'No downloaded update available to install' })
    return
  }
  try {
    const exePath = app.getPath('exe')
    const installDir = path.dirname(exePath)
    const exeName = path.basename(exePath)
    const scriptPath = path.join(getUpdatesDir(), 'apply.ps1')
    const script = buildApplyScript(downloadedZipPath, installDir, exeName)
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true })
    fs.writeFileSync(scriptPath, script, 'utf8')

    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      }
    )
    child.unref()
  } catch (err) {
    setState({ phase: 'error', message: (err as Error).message || String(err) })
    return
  }
  app.quit()
}

export function shutdown(): void {
  if (pollTimer) clearInterval(pollTimer)
  if (initialTimer) clearTimeout(initialTimer)
  pollTimer = null
  initialTimer = null
  broadcaster = null
}
