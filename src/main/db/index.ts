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
  runMigrations(db)
  return db
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  current_step_id TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 30
);

CREATE TABLE IF NOT EXISTS step_records (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL,
  output TEXT,
  feedback TEXT,
  error_message TEXT,
  updated_at INTEGER NOT NULL,
  reviewer_flag TEXT,
  PRIMARY KEY (project_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_step_records_project ON step_records(project_id);
`

function runMigrations(handle: Database.Database): void {
  const projectCols = handle
    .prepare(`PRAGMA table_info(projects)`)
    .all() as { name: string }[]
  if (!projectCols.some((c) => c.name === 'duration_seconds')) {
    handle.exec(
      `ALTER TABLE projects ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 30`
    )
  }

  const stepCols = handle
    .prepare(`PRAGMA table_info(step_records)`)
    .all() as { name: string }[]
  if (!stepCols.some((c) => c.name === 'reviewer_flag')) {
    handle.exec(`ALTER TABLE step_records ADD COLUMN reviewer_flag TEXT`)
  }
}

type ProjectRow = {
  id: string
  company_name: string
  website_url: string
  created_at: number
  current_step_id: string
  duration_seconds: number
}

type StepRow = {
  project_id: string
  step_id: string
  status: string
  output: string | null
  feedback: string | null
  error_message: string | null
  updated_at: number
  reviewer_flag: string | null
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    companyName: row.company_name,
    websiteUrl: row.website_url,
    createdAt: row.created_at,
    currentStepId: row.current_step_id,
    durationSeconds: row.duration_seconds
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
    updatedAt: row.updated_at,
    reviewerFlag: row.reviewer_flag ? JSON.parse(row.reviewer_flag) : null
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
  durationSeconds: number
}): Project {
  const createdAt = Date.now()
  getDb()
    .prepare(
      `INSERT INTO projects (id, company_name, website_url, created_at, current_step_id, duration_seconds)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.id,
      input.companyName,
      input.websiteUrl,
      createdAt,
      input.currentStepId,
      input.durationSeconds
    )
  return {
    id: input.id,
    companyName: input.companyName,
    websiteUrl: input.websiteUrl,
    createdAt,
    currentStepId: input.currentStepId,
    durationSeconds: input.durationSeconds
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
  reviewerFlag?: { reasons: string[]; attempts: number } | null
}): void {
  const serialized =
    record.output !== undefined ? JSON.stringify(record.output ?? null) : null
  const reviewerFlagSerialized =
    record.reviewerFlag === undefined
      ? null
      : record.reviewerFlag === null
        ? null
        : JSON.stringify(record.reviewerFlag)
  getDb()
    .prepare(
      `INSERT INTO step_records (project_id, step_id, status, output, feedback, error_message, updated_at, reviewer_flag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, step_id) DO UPDATE SET
         status = excluded.status,
         output = COALESCE(excluded.output, step_records.output),
         feedback = excluded.feedback,
         error_message = excluded.error_message,
         updated_at = excluded.updated_at,
         reviewer_flag = excluded.reviewer_flag`
    )
    .run(
      record.projectId,
      record.stepId,
      record.status,
      serialized,
      record.feedback ?? null,
      record.errorMessage ?? null,
      Date.now(),
      reviewerFlagSerialized
    )
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
