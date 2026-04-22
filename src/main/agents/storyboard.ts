import { invokeClaude } from '../llm/claudeCli'
import type {
  AdScript,
  CampaignAnalysis,
  CompanyResearch,
  Storyboard
} from '../../shared/types'
import { requireOutput, type PipelineContext } from './registry'

const SYSTEM_PROMPT = `You are a storyboard agent — a director breaking a script into a shot list. Output only valid JSON matching the schema. Do not use tools.

Rules:
- You will be told a target scene count. Produce exactly that many scenes, numbered 1..N in play order.
- scenes[].durationSeconds should sum to within ±2 seconds of the stated total duration.
- sceneText is the subset of the script's speakerText that plays during this scene. Prefer verbatim substrings; keep every word of the script covered across scenes.
- visualDescription is the WHAT — the action, subject, setting. One sensory sentence.
- shotType is the framing: one of wide, medium, close, extreme-close, over-shoulder, pov, tracking, aerial.
- cameraMovement: one of static, pan, dolly, handheld, zoom.
- composition is the HOW — framing specifics: subject placement, foreground/background, lens feel, depth. One sentence.
- source: "existing" only if the scene could plausibly use company-supplied imagery, "generated" otherwise. Err toward "generated".
- Every shot must stay consistent with the supplied continuity kit — same set, characters, palette, lighting.
- totalSeconds must equal the sum of durationSeconds.
- If revision feedback is present, apply it.`

const SCHEMA = {
  type: 'object',
  required: ['scenes', 'totalSeconds'],
  additionalProperties: false,
  properties: {
    totalSeconds: { type: 'number', minimum: 8, maximum: 1810 },
    scenes: {
      type: 'array',
      minItems: 5,
      maxItems: 60,
      items: {
        type: 'object',
        required: [
          'order',
          'sceneText',
          'visualDescription',
          'shotType',
          'cameraMovement',
          'composition',
          'source',
          'durationSeconds'
        ],
        additionalProperties: false,
        properties: {
          order: { type: 'integer', minimum: 1 },
          sceneText: { type: 'string', maxLength: 600 },
          visualDescription: { type: 'string', maxLength: 500 },
          shotType: {
            type: 'string',
            enum: ['wide', 'medium', 'close', 'extreme-close', 'over-shoulder', 'pov', 'tracking', 'aerial']
          },
          cameraMovement: {
            type: 'string',
            enum: ['static', 'pan', 'dolly', 'handheld', 'zoom']
          },
          composition: { type: 'string', maxLength: 500 },
          source: { type: 'string', enum: ['existing', 'generated'] },
          durationSeconds: { type: 'number', minimum: 1, maximum: 15 }
        }
      }
    }
  }
}

export function targetSceneCount(durationSeconds: number): number {
  const raw = Math.round(durationSeconds / 3.5)
  return Math.max(5, Math.min(60, raw))
}

export async function runStoryboardAgent(ctx: PipelineContext): Promise<Storyboard> {
  const research = requireOutput<CompanyResearch>(ctx, 'agent-1', 'company research')
  const analysis = requireOutput<CampaignAnalysis>(ctx, 'agent-2', 'campaign analysis')
  const script = requireOutput<AdScript>(ctx, 'agent-3', 'script')
  const duration = ctx.durationSeconds
  const sceneCount = targetSceneCount(duration)
  const feedbackNote = ctx.feedback ? `\n\nREVISION FEEDBACK: ${ctx.feedback}` : ''
  const reviewerNote = ctx.priorReviewerFeedback
    ? `\n\nINTERNAL REVIEWER FEEDBACK (address these before re-submitting): ${ctx.priorReviewerFeedback}`
    : ''
  const prompt = `Target total duration: ${duration} seconds.\nTarget scene count: exactly ${sceneCount} scenes.\n\nCompany: ${research.companyName}\nStyle & language: ${research.styleAndLanguage}\nExisting media available: ${research.usableMediaCount} usable of ${research.existingMediaCount}\n\nCampaign direction:\n${JSON.stringify(
    { coreMessage: analysis.coreMessage, targetAudience: analysis.targetAudience, adMessage: analysis.adMessage, videoStyle: analysis.videoStyle },
    null,
    2
  )}\n\nContinuity kit (apply to every shot):\n${JSON.stringify(analysis.continuityKit, null, 2)}\n\nScript:\n${JSON.stringify(script, null, 2)}${feedbackNote}${reviewerNote}\n\nReturn storyboard JSON only, with exactly ${sceneCount} scenes summing to ${duration} (±2) seconds.`

  const result = await invokeClaude<Storyboard>({
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    jsonSchema: SCHEMA,
    model: 'sonnet',
    timeoutMs: 120_000
  })
  if (!result.ok) throw new Error(`storyboard agent failed: ${result.error}`)
  return result.data
}
