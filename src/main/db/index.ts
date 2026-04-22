import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import type { ProjectId, StepId, StepStatus } from '../../shared/pipeline'
import type { Project, StepRecord } from '../../shared/types'

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (db) return db
  const userDataDir = app.getPath('userData')
  mkdirSync(userDataDir, { recursive: true })
  const dbPath = join(userDataDir, 'atelier.sqlite')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA_SQL)
  return db
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  current_step_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS step_records (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL,
  output TEXT,
  feedback TEXT,
  error_message TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_step_records_project ON step_records(project_id);
`

type ProjectRow = {
  id: string
  company_name: string
  website_url: string
  created_at: number
  current_step_id: string
}

type StepRow = {
  project_id: string
  step_id: string
  status: string
  output: string | null
  feedback: string | null
  error_message: string | null
  updated_at: number
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    companyName: row.company_name,
    websiteUrl: row.website_url,
    createdAt: row.created_at,
    currentStepId: row.current_step_id
  }
}

function rowToStep(row: StepRow): StepRecord {
  return {
    projectId: row.project_id,
    stepId: row.step_id,
    status: row.status as StepStatus,
    output: row.output ? JSON.parse(row.output) : null,
    feedback: row.feedback,
    errorMessage: row.error_message,
    updatedAt: row.updated_at
  }
}

export function listProjects(): Project[] {
  const rows = getDb()
    .prepare(`SELECT * FROM projects ORDER BY created_at DESC`)
    .all() as ProjectRow[]
  return rows.map(rowToProject)
}

export function getProject(id: ProjectId): Project | null {
  const row = getDb()
    .prepare(`SELECT * FROM projects WHERE id = ?`)
    .get(id) as ProjectRow | undefined
  return row ? rowToProject(row) : null
}

export function createProject(input: {
  id: string
  companyName: string
  websiteUrl: string
  currentStepId: StepId
}): Project {
  const createdAt = Date.now()
  getDb()
    .prepare(
      `INSERT INTO projects (id, company_name, website_url, created_at, current_step_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(input.id, input.companyName, input.websiteUrl, createdAt, input.currentStepId)
  return {
    id: input.id,
    companyName: input.companyName,
    websiteUrl: input.websiteUrl,
    createdAt,
    currentStepId: input.currentStepId
  }
}

export function setCurrentStep(projectId: ProjectId, stepId: StepId): void {
  getDb()
    .prepare(`UPDATE projects SET current_step_id = ? WHERE id = ?`)
    .run(stepId, projectId)
}

export function listSteps(projectId: ProjectId): StepRecord[] {
  const rows = getDb()
    .prepare(`SELECT * FROM step_records WHERE project_id = ?`)
    .all(projectId) as StepRow[]
  return rows.map(rowToStep)
}

export function getStep(projectId: ProjectId, stepId: StepId): StepRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM step_records WHERE project_id = ? AND step_id = ?`)
    .get(projectId, stepId) as StepRow | undefined
  return row ? rowToStep(row) : null
}

export function upsertStep(record: {
  projectId: ProjectId
  stepId: StepId
  status: StepStatus
  output?: unknown
  feedback?: string | null
  errorMessage?: string | null
}): void {
  const serialized =
    record.output !== undefined ? JSON.stringify(record.output ?? null) : null
  getDb()
    .prepare(
      `INSERT INTO step_records (project_id, step_id, status, output, feedback, error_message, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, step_id) DO UPDATE SET
         status = excluded.status,
         output = COALESCE(excluded.output, step_records.output),
         feedback = excluded.feedback,
         error_message = excluded.error_message,
         updated_at = excluded.updated_at`
    )
    .run(
      record.projectId,
      record.stepId,
      record.status,
      serialized,
      record.feedback ?? null,
      record.errorMessage ?? null,
      Date.now()
    )
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
