import { PIPELINE_STEPS, getStep, nextStep } from '../../shared/pipeline'
import type { StepDef, StepId } from '../../shared/pipeline'
import type { StepRecord } from '../../shared/types'
import {
  createProject,
  getProject,
  getStep as getStepRecord,
  listSteps,
  setCurrentStep,
  upsertStep
} from '../db'
import { runAgent } from '../agents/registry'

type UpdateListener = (projectId: string) => void
const updateListeners = new Set<UpdateListener>()

export function onProjectUpdate(listener: UpdateListener): () => void {
  updateListeners.add(listener)
  return () => updateListeners.delete(listener)
}

function emitUpdate(projectId: string): void {
  for (const listener of updateListeners) {
    try {
      listener(projectId)
    } catch {
      // ignore listener errors
    }
  }
}

export type ProjectState = {
  project: {
    id: string
    companyName: string
    websiteUrl: string
    createdAt: number
    currentStepId: StepId
    durationSeconds: number
  }
  steps: StepRecord[]
}

function clampDuration(input: number | undefined): number {
  const raw = typeof input === 'number' && Number.isFinite(input) ? Math.round(input) : 30
  return Math.max(10, Math.min(1800, raw))
}

export function initProject(input: {
  companyName: string
  websiteUrl: string
  durationSeconds?: number
}): ProjectState {
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const firstStep = PIPELINE_STEPS[0]
  const project = createProject({
    id,
    companyName: input.companyName,
    websiteUrl: input.websiteUrl,
    currentStepId: firstStep.id,
    durationSeconds: clampDuration(input.durationSeconds)
  })
  for (const step of PIPELINE_STEPS) {
    upsertStep({
      projectId: id,
      stepId: step.id,
      status: 'pending'
    })
  }
  return { project, steps: listSteps(id) }
}

export function getProjectState(projectId: string): ProjectState | null {
  const project = getProject(projectId)
  if (!project) return null
  return { project, steps: listSteps(projectId) }
}

export async function executeStep(projectId: string, stepId: StepId): Promise<StepRecord> {
  const step = getStep(stepId)
  if (!step) throw new Error(`unknown step: ${stepId}`)
  if (step.kind !== 'agent') throw new Error(`step ${stepId} is a checkpoint, not an agent`)

  upsertStep({ projectId, stepId, status: 'running', reviewerFlag: null })
  setCurrentStep(projectId, stepId)
  emitUpdate(projectId)

  try {
    const result = await runAgent(step, projectId)
    const output = result.output
    const reviewerFlag = result.reviewerFlag ?? null
    const nextDef = nextStep(stepId)
    const hasCheckpointNext = nextDef?.kind === 'checkpoint' && nextDef.reviewsOutputOf === stepId
    const finalStatus = hasCheckpointNext ? 'awaiting-review' : 'approved'
    upsertStep({
      projectId,
      stepId,
      status: finalStatus,
      output,
      feedback: null,
      errorMessage: null,
      reviewerFlag
    })
    if (hasCheckpointNext && nextDef) {
      upsertStep({ projectId, stepId: nextDef.id, status: 'awaiting-review' })
      setCurrentStep(projectId, nextDef.id)
    } else if (nextDef) {
      setCurrentStep(projectId, nextDef.id)
    }
    emitUpdate(projectId)
    return getStepRecord(projectId, stepId)!
  } catch (err) {
    const message = (err as Error).message || String(err)
    upsertStep({
      projectId,
      stepId,
      status: 'error',
      errorMessage: message
    })
    emitUpdate(projectId)
    throw err
  }
}

export async function approveCheckpoint(
  projectId: string,
  checkpointId: StepId
): Promise<StepDef | null> {
  const def = getStep(checkpointId)
  if (!def || def.kind !== 'checkpoint') throw new Error(`not a checkpoint: ${checkpointId}`)
  upsertStep({ projectId, stepId: checkpointId, status: 'approved' })

  const next = nextStep(checkpointId)
  if (!next) {
    setCurrentStep(projectId, checkpointId)
    emitUpdate(projectId)
    return null
  }
  setCurrentStep(projectId, next.id)
  emitUpdate(projectId)
  if (next.kind === 'agent') {
    void executeStep(projectId, next.id).catch(() => {
      /* errors persisted on step record */
    })
  }
  return next
}

export async function reviseCheckpoint(
  projectId: string,
  checkpointId: StepId,
  feedback: string
): Promise<StepDef | null> {
  const def = getStep(checkpointId)
  if (!def || def.kind !== 'checkpoint') throw new Error(`not a checkpoint: ${checkpointId}`)
  if (!def.reviewsOutputOf) throw new Error(`checkpoint ${checkpointId} has no reviewsOutputOf`)

  upsertStep({
    projectId,
    stepId: checkpointId,
    status: 'rejected',
    feedback
  })
  // Re-run the agent under review with the feedback attached to its step record.
  upsertStep({
    projectId,
    stepId: def.reviewsOutputOf,
    status: 'pending',
    feedback
  })
  emitUpdate(projectId)
  const agentDef = getStep(def.reviewsOutputOf)!
  void executeStep(projectId, agentDef.id).catch(() => {
    /* errors persisted */
  })
  return agentDef
}
