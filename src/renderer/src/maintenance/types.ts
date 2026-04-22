export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'available'; version: string }
  | { phase: 'not-available'; currentVersion: string }
  | { phase: 'downloading'; percent: number; transferredMB: number; totalMB: number }
  | { phase: 'downloaded'; version: string }
  | { phase: 'error'; message: string }

export type ManualCopy = {
  title?: string
  subtitle?: string
  etaSeconds?: number
}

export type MaintenanceKind = 'idle' | 'update' | 'error' | 'manual'

export type ErrorInfo = {
  message: string
  stack?: string
}
