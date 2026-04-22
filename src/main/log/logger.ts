import { app } from 'electron'
import { appendFile, mkdir, readFile, rename, stat } from 'node:fs/promises'
import { join } from 'node:path'

const MAX_LINE_CHARS = 4000
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB
const RING_DEPTH = 3

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

let initialized = false
let logDir: string | null = null

function logFilePath(): string {
  if (!logDir) throw new Error('logger not initialized')
  return join(logDir, 'app.log')
}

async function ensureInit(): Promise<void> {
  if (initialized) return
  logDir = join(app.getPath('userData'), 'logs')
  await mkdir(logDir, { recursive: true })
  initialized = true
}

async function rotateIfNeeded(): Promise<void> {
  try {
    const st = await stat(logFilePath())
    if (st.size < MAX_FILE_BYTES) return
  } catch {
    return
  }
  for (let i = RING_DEPTH; i >= 1; i--) {
    const src = join(logDir!, i === 1 ? 'app.log' : `app.log.${i - 1}`)
    const dst = join(logDir!, `app.log.${i}`)
    try {
      await rename(src, dst)
    } catch {
      // ignore missing predecessors
    }
  }
}

function truncate(line: string): string {
  return line.length <= MAX_LINE_CHARS ? line : line.slice(0, MAX_LINE_CHARS) + '…[truncated]'
}

async function write(level: LogLevel, category: string, message: string, data?: unknown): Promise<void> {
  try {
    await ensureInit()
    await rotateIfNeeded()
    const ts = new Date().toISOString()
    const payload = data !== undefined ? ' ' + truncate(safeStringify(data)) : ''
    const line = `[${ts}] [${level}] [${category}] ${truncate(message)}${payload}\n`
    await appendFile(logFilePath(), line, 'utf8')
  } catch {
    // logger must never throw
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const logger = {
  debug: (category: string, message: string, data?: unknown): Promise<void> =>
    write('debug', category, message, data),
  info: (category: string, message: string, data?: unknown): Promise<void> =>
    write('info', category, message, data),
  warn: (category: string, message: string, data?: unknown): Promise<void> =>
    write('warn', category, message, data),
  error: (category: string, message: string, data?: unknown): Promise<void> =>
    write('error', category, message, data)
}

export async function tailLog(lines = 500): Promise<string[]> {
  try {
    await ensureInit()
    const raw = await readFile(logFilePath(), 'utf8')
    const all = raw.split('\n').filter(Boolean)
    return all.slice(-lines)
  } catch {
    return []
  }
}
