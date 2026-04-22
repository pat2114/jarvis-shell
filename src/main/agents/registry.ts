import type { StepDef, StepId } from '../../shared/pipeline'
import { getProject, listSteps } from '../db'
import type {
  CampaignAnalysis,
  AdScript,
  ReviewerVerdict,
  Storyboard,
  StepRecord
} from '../../shared/types'
import { runResearchAgent } from './research'
import { runAnalysisAgent } from './analysis'
import { runScriptAgent } from './script'
import { runStoryboardAgent } from './storyboard'
import { runEditAgent } from './edit'
import { runVisualsStub, runVoiceStub, runMusicStub, runVideoGenStub } from './mediaStubs'
import { runOutreachStub, runCorrespondenceStub, runDeliveryStub } from './outreachStubs'
import {
  reviewMusic,
  reviewVideoScenes,
  reviewVisuals,
  reviewVoice
} from './reviewers'

export type PipelineContext = {
  projectId: string
  companyName: string
  websiteUrl: string
  durationSeconds: number
  steps: Record<StepId, StepRecord>
  feedback: string | null
  priorReviewerFeedback: string | null
}

export type AgentRunResult = {
  output: unknown
  reviewerFlag?: { reasons: string[]; attempts: number } | null
}

function buildContext(projectId: string): PipelineContext {
  const project = getProject(projectId)
  if (!project) throw new Error(`project not found: ${projectId}`)
  const stepsArr = listSteps(projectId)
  const stepsMap: Record<string, StepRecord> = {}
  for (const s of stepsArr) stepsMap[s.stepId] = s
  return {
    projectId,
    companyName: project.companyName,
    websiteUrl: project.websiteUrl,
    durationSeconds: project.durationSeconds,
    steps: stepsMap,
    feedback: null,
    priorReviewerFeedback: null
  }
}

async function attemptWithReview<T>(
  ctx: PipelineContext,
  generator: (ctx: PipelineContext) => Promise<T>,
  reviewer: (output: T) => Promise<ReviewerVerdict>,
  maxAttempts = 3
): Promise<AgentRunResult> {
  let lastOutput: T | null = null
  let lastVerdict: ReviewerVerdict | null = null
  let attempt = 0
  let workingCtx: PipelineContext = { ...ctx, priorReviewerFeedback: null }

  while (attempt < maxAttempts) {
    attempt += 1
    lastOutput = await generator(workingCtx)
    lastVerdict = await reviewer(lastOutput)
    if (lastVerdict.approved) {
      return { output: lastOutput, reviewerFlag: null }
    }
    workingCtx = {
      ...workingCtx,
      priorReviewerFeedback: lastVerdict.reasons.join(' — ')
    }
  }

  return {
    output: lastOutput,
    reviewerFlag: {
      reasons: lastVerdict?.reasons ?? ['reviewer rejected output'],
      attempts: attempt
    }
  }
}

export async function runAgent(step: StepDef, projectId: string): Promise<AgentRunResult> {
  const ctx = buildContext(projectId)
  const feedback = ctx.steps[step.id]?.feedback ?? null
  ctx.feedback = feedback

  switch (step.id) {
    case 'agent-1':
      return { output: await runResearchAgent(ctx) }
    case 'agent-2':
      return { output: await runAnalysisAgent(ctx) }
    case 'agent-3':
      return { output: await runScriptAgent(ctx) }
    case 'agent-4':
      return { output: await runStoryboardAgent(ctx) }
    case 'agent-5': {
      const analysis = requireOutput<CampaignAnalysis>(ctx, 'agent-2', 'campaign analysis')
      const storyboard = requireOutput<Storyboard>(ctx, 'agent-4', 'storyboard')
      return attemptWithReview(
        ctx,
        (c) => runVisualsStub(c),
        (assets) =>
          reviewVisuals({ assets, storyboard, continuityKit: analysis.continuityKit })
      )
    }
    case 'agent-6': {
      const analysis = requireOutput<CampaignAnalysis>(ctx, 'agent-2', 'campaign analysis')
      const script = requireOutput<AdScript>(ctx, 'agent-3', 'script')
      return attemptWithReview(
        ctx,
        (c) => runVoiceStub(c),
        (voice) =>
          reviewVoice({ voice, script, continuityKit: analysis.continuityKit })
      )
    }
    case 'agent-6a': {
      const analysis = requireOutput<CampaignAnalysis>(ctx, 'agent-2', 'campaign analysis')
      const script = requireOutput<AdScript>(ctx, 'agent-3', 'script')
      return attemptWithReview(
        ctx,
        (c) => runMusicStub(c),
        (music) =>
          reviewMusic({ music, script, continuityKit: analysis.continuityKit })
      )
    }
    case 'agent-7': {
      const analysis = requireOutput<CampaignAnalysis>(ctx, 'agent-2', 'campaign analysis')
      const storyboard = requireOutput<Storyboard>(ctx, 'agent-4', 'storyboard')
      return attemptWithReview(
        ctx,
        (c) => runVideoGenStub(c),
        (scenes) =>
          reviewVideoScenes({ scenes, storyboard, continuityKit: analysis.continuityKit })
      )
    }
    case 'agent-8':
      return { output: await runEditAgent(ctx) }
    case 'agent-9':
      return { output: await runOutreachStub(ctx) }
    case 'agent-10':
      return { output: await runCorrespondenceStub(ctx) }
    case 'agent-11':
      throw new Error(
        'Payment verification is blocked: needs bank/payment-provider credentials you haven\'t connected yet.'
      )
    case 'agent-12':
      return { output: await runDeliveryStub(ctx) }
    default:
      throw new Error(`no agent implementation for step: ${step.id}`)
  }
}

export function requireOutput<T>(ctx: PipelineContext, stepId: StepId, label: string): T {
  const rec = ctx.steps[stepId]
  if (!rec || rec.output === null || rec.output === undefined) {
    throw new Error(`${label} not available — step ${stepId} has no output yet`)
  }
  return rec.output as T
}
