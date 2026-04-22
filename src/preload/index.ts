import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type TokenState = {
  mode: 'light' | 'dark'
  density: number
  fontScale: number
  radius: number
  accentHue: number
  accentChroma: number
  backgroundHue: number
  backgroundChroma: number
}

type ThemeAgentResult = { reply: string; changes: Partial<TokenState> }
type ThemeAgentResponse =
  | { ok: true; data: ThemeAgentResult; rawText: string }
  | { ok: false; error: string; rawText?: string }

const api = {
  preview: {
    open: (templateId: string): void => ipcRenderer.send('preview:open', templateId),
    apply: (templateId: string): void => ipcRenderer.send('preview:apply', templateId),
    discard: (): void => ipcRenderer.send('preview:discard'),
    onApplied: (cb: (templateId: string) => void): (() => void) => {
      const listener = (_: unknown, templateId: string): void => cb(templateId)
      ipcRenderer.on('preview:applied', listener)
      return () => ipcRenderer.removeListener('preview:applied', listener)
    }
  },
  agent: {
    interpretTheme: (input: string, tokens: TokenState): Promise<ThemeAgentResponse> =>
      ipcRenderer.invoke('agent:theme-interpret', { input, tokens })
  },
  pipeline: {
    listProjects: (): Promise<unknown> => ipcRenderer.invoke('pipeline:list-projects'),
    getState: (projectId: string): Promise<unknown> =>
      ipcRenderer.invoke('pipeline:get-state', projectId),
    createProject: (input: { companyName: string; websiteUrl: string }): Promise<unknown> =>
      ipcRenderer.invoke('pipeline:create-project', input),
    approve: (projectId: string, checkpointId: string): Promise<unknown> =>
      ipcRenderer.invoke('pipeline:approve', { projectId, checkpointId }),
    revise: (projectId: string, checkpointId: string, feedback: string): Promise<unknown> =>
      ipcRenderer.invoke('pipeline:revise', { projectId, checkpointId, feedback }),
    onUpdated: (cb: (state: unknown) => void): (() => void) => {
      const listener = (_: unknown, state: unknown): void => cb(state)
      ipcRenderer.on('pipeline:updated', listener)
      return () => ipcRenderer.removeListener('pipeline:updated', listener)
    }
  },
  setup: {
    runChecks: (): Promise<unknown> => ipcRenderer.invoke('setup:run-checks'),
    getKeyCatalog: (): Promise<unknown> => ipcRenderer.invoke('setup:get-key-catalog'),
    getKeyStatuses: (): Promise<unknown> => ipcRenderer.invoke('setup:get-key-statuses'),
    setKey: (slot: string, value: string): Promise<unknown> =>
      ipcRenderer.invoke('setup:set-key', { slot, value }),
    clearKey: (slot: string): Promise<unknown> => ipcRenderer.invoke('setup:clear-key', slot),
    hasKey: (slot: string): Promise<unknown> => ipcRenderer.invoke('setup:has-key', slot)
  },
  help: {
    open: (): void => ipcRenderer.send('help:open'),
    sendMessage: (payload: {
      projectId: string | null
      messages: { role: 'user' | 'assistant'; text: string }[]
      userMessage: string
    }): Promise<unknown> => ipcRenderer.invoke('help:send-message', payload)
  },
  update: {
    getState: (): Promise<unknown> => ipcRenderer.invoke('update:get-state'),
    check: (): void => ipcRenderer.send('update:check'),
    install: (): void => ipcRenderer.send('update:install'),
    onState: (cb: (state: unknown) => void): (() => void) => {
      const listener = (_: unknown, state: unknown): void => cb(state)
      ipcRenderer.on('update:state', listener)
      return () => ipcRenderer.removeListener('update:state', listener)
    }
  },
  telemetry: {
    report: (input: {
      source: 'error-boundary' | 'agent-error' | 'main-process' | 'repair-escalation'
      message: string
      stack?: string
      stepId?: string
      projectId?: string
      context?: Record<string, unknown>
    }): Promise<unknown> => ipcRenderer.invoke('telemetry:report', input)
  },
  log: {
    tail: (lines?: number): Promise<unknown> => ipcRenderer.invoke('log:tail', lines)
  }
}

export type AppAPI = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
