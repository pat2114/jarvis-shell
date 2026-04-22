import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export type KeySlot =
  | 'anthropicApiKey'
  | 'elevenlabsKey'
  | 'sunoKey'
  | 'replicateToken'
  | 'runwayKey'
  | 'githubTelemetryToken'

export type KeyMeta = {
  slot: KeySlot
  label: string
  description: string
  docsUrl: string
  usedBy: string[]
  optional: boolean
}

export const KEY_CATALOG: KeyMeta[] = [
  {
    slot: 'replicateToken',
    label: 'Replicate token',
    description:
      'Covers image generation (Flux / SDXL) and some video models. One key unlocks the visuals agent.',
    docsUrl: 'https://replicate.com/account/api-tokens',
    usedBy: ['Visuals'],
    optional: true
  },
  {
    slot: 'elevenlabsKey',
    label: 'ElevenLabs API key',
    description: 'Voice-over generation.',
    docsUrl: 'https://elevenlabs.io/app/settings/api-keys',
    usedBy: ['Voice-over'],
    optional: true
  },
  {
    slot: 'sunoKey',
    label: 'Suno API key',
    description:
      'Music generation. Use Suno (not Sora — Sora is a video model, not music).',
    docsUrl: 'https://suno.com',
    usedBy: ['Music'],
    optional: true
  },
  {
    slot: 'runwayKey',
    label: 'Runway API key',
    description:
      'Video-scene generation. Alternative: route video via Replicate. Budget aware — $15–30 per 30s spot.',
    docsUrl: 'https://dev.runwayml.com',
    usedBy: ['Video generation'],
    optional: true
  },
  {
    slot: 'anthropicApiKey',
    label: 'Anthropic API key (fallback)',
    description:
      'Only needed if you want to run LLM calls outside your Claude subscription. Normally leave empty.',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    usedBy: ['LLM routing fallback'],
    optional: true
  },
  {
    slot: 'githubTelemetryToken',
    label: 'GitHub crash-report token (advanced)',
    description:
      'Optional. Atelier has a built-in token for auto-reporting crashes — if it ever expires or hits a limit, paste your own fine-grained PAT here to keep auto-reporting working. Needs Issues: Read and write on pat2114/atelier (or your fork).',
    docsUrl:
      'https://github.com/settings/personal-access-tokens/new?description=Atelier+crash+reports',
    usedBy: ['Crash reporting fallback'],
    optional: true
  }
]

type StoredEntry = {
  cipher: string // base64-encoded encrypted key
  updatedAt: number
}

type Store = {
  version: number
  entries: Partial<Record<KeySlot, StoredEntry>>
}

let cachedStore: Store | null = null

function storePath(): string {
  return join(app.getPath('userData'), 'keys.json')
}

function readStore(): Store {
  if (cachedStore) return cachedStore
  const p = storePath()
  if (!existsSync(p)) {
    cachedStore = { version: 1, entries: {} }
    return cachedStore
  }
  try {
    const raw = readFileSync(p, 'utf8')
    cachedStore = JSON.parse(raw) as Store
    if (!cachedStore.entries) cachedStore.entries = {}
    return cachedStore
  } catch {
    cachedStore = { version: 1, entries: {} }
    return cachedStore
  }
}

function writeStore(): void {
  if (!cachedStore) return
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(storePath(), JSON.stringify(cachedStore, null, 2), 'utf8')
}

function canEncrypt(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function setKey(slot: KeySlot, value: string): void {
  const store = readStore()
  if (!value) {
    delete store.entries[slot]
    writeStore()
    return
  }
  if (!canEncrypt()) {
    throw new Error(
      'OS encryption not available — refusing to store an API key in plain text. Try again later or on a different user session.'
    )
  }
  const cipher = safeStorage.encryptString(value).toString('base64')
  store.entries[slot] = { cipher, updatedAt: Date.now() }
  writeStore()
}

export function getKey(slot: KeySlot): string | null {
  const entry = readStore().entries[slot]
  if (!entry) return null
  if (!canEncrypt()) return null
  try {
    return safeStorage.decryptString(Buffer.from(entry.cipher, 'base64'))
  } catch {
    return null
  }
}

export function clearKey(slot: KeySlot): void {
  const store = readStore()
  delete store.entries[slot]
  writeStore()
}

export type KeyStatus = {
  slot: KeySlot
  present: boolean
  updatedAt: number | null
}

export function getKeyStatuses(): KeyStatus[] {
  const store = readStore()
  return KEY_CATALOG.map((meta) => ({
    slot: meta.slot,
    present: Boolean(store.entries[meta.slot]),
    updatedAt: store.entries[meta.slot]?.updatedAt ?? null
  }))
}

export function getKeyCatalog(): KeyMeta[] {
  return KEY_CATALOG
}
