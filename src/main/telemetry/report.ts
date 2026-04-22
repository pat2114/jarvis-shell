import { app } from 'electron'
import { logger, tailLog } from '../log/logger'
import { getProjectState } from '../pipeline/runner'
import { getKey } from '../setup/keyStore'

const ISSUE_ENDPOINT = 'https://api.github.com/repos/pat2114/atelier/issues'

export type TelemetryReport = {
  id: string
  source: 'error-boundary' | 'agent-error' | 'main-process' | 'repair-escalation'
  message: string
  stack?: string
  stepId?: string
  projectId?: string
  context?: Record<string, unknown>
  appVersion: string
  timestamp: number
}

function getTelemetryToken(): string | null {
  // 1. User-provided token in the encrypted key store (highest priority — lets users
  //    keep telemetry working if the built-in token expires or gets rate-limited).
  try {
    const fromUser = getKey('githubTelemetryToken')
    if (fromUser && fromUser.trim()) return fromUser.trim()
  } catch {
    // safeStorage may not be available in some edge cases; fall through
  }
  // 2. Baked-in token from build time (MAIN_VITE_JARVIS_TELEMETRY_TOKEN).
  const fromBuild = import.meta.env.MAIN_VITE_JARVIS_TELEMETRY_TOKEN
  if (typeof fromBuild === 'string' && fromBuild.trim()) return fromBuild.trim()
  // 3. Runtime env var (dev sessions).
  const fromEnv = process.env.JARVIS_TELEMETRY_TOKEN
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  return null
}

export async function sendTelemetry(input: Omit<TelemetryReport, 'id' | 'appVersion' | 'timestamp'>): Promise<void> {
  const report: TelemetryReport = {
    ...input,
    id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    appVersion: app.getVersion(),
    timestamp: Date.now()
  }

  await logger.error('telemetry', 'reporting', {
    source: report.source,
    message: report.message,
    stepId: report.stepId
  })

  const token = getTelemetryToken()
  if (!token) {
    // No token configured — write locally so the user can still retrieve it.
    return
  }

  let projectSnapshot: unknown = null
  if (report.projectId) {
    try {
      projectSnapshot = getProjectState(report.projectId)
    } catch {
      // ignore
    }
  }
  const logs = await tailLog(200)

  const title = `[crash] ${report.message.slice(0, 80)}`
  const body = [
    `**Report ID**: \`${report.id}\``,
    `**Source**: ${report.source}`,
    `**App version**: ${report.appVersion}`,
    `**Timestamp**: ${new Date(report.timestamp).toISOString()}`,
    `**Step**: ${report.stepId ?? '(n/a)'}`,
    '',
    '**Message**:',
    '```',
    report.message,
    '```'
  ]
  if (report.stack) {
    body.push('', '**Stack**:', '```', report.stack.slice(0, 6000), '```')
  }
  if (report.context) {
    body.push('', '**Context**:', '```json', JSON.stringify(report.context, null, 2), '```')
  }
  if (projectSnapshot) {
    body.push(
      '',
      '**Project snapshot**:',
      '```json',
      JSON.stringify(projectSnapshot, null, 2).slice(0, 4000),
      '```'
    )
  }
  body.push('', '**Recent logs**:', '```', logs.join('\n').slice(-6000), '```')

  try {
    const res = await fetch(ISSUE_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'atelier-telemetry'
      },
      body: JSON.stringify({
        title,
        body: body.join('\n'),
        labels: ['auto-report', report.source]
      })
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      await logger.error('telemetry', 'github issue create failed', {
        status: res.status,
        body: text.slice(0, 500)
      })
    } else {
      await logger.info('telemetry', 'issue created', { status: res.status })
    }
  } catch (err) {
    await logger.error('telemetry', 'network error', { message: (err as Error).message })
  }
}
