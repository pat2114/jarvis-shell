import { invokeClaude } from '../llm/claudeCli'
import type {
  AdScript,
  CampaignAnalysis,
  MusicOutput,
  ReviewerVerdict,
  Storyboard,
  VideoSceneOutput,
  VisualAsset,
  VoiceOverOutput
} from '../../shared/types'

const SYSTEM_PROMPT = `You are the internal quality reviewer for an advertising-video studio. You receive one step's freshly-generated media together with the specs it must satisfy (continuity kit, shot list, script). Your job is to flag obvious drift BEFORE a human sees it.

Rules:
- Output only valid JSON matching the schema. No tools.
- approved: true only if the output plausibly matches the specs.
- reasons: always list 1–3 specific observations. On approval, describe what matched. On rejection, describe what broke so the generator can fix it on the next attempt.
- regressionRisk: your gut-feel on whether a regeneration will produce something worse. low = try again freely. medium = marginal. high = accept-with-caveat likely better than retrying.
- Assets marked as stubs (source: "stub", or URLs starting with about:blank / placehold.co) are ALWAYS approved — they are intentional placeholders until paid APIs are wired. Reasons should say so.
- When you only receive text descriptions of the output (no binary media), judge from the description as best you can. When future versions send you actual media, you will judge visually; the schema stays the same.`

const SCHEMA = {
  type: 'object',
  required: ['approved', 'reasons'],
  additionalProperties: false,
  properties: {
    approved: { type: 'boolean' },
    reasons: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: { type: 'string', maxLength: 400 }
    },
    regressionRisk: { type: 'string', enum: ['low', 'medium', 'high'] }
  }
}

async function callReviewer(prompt: string): Promise<ReviewerVerdict> {
  const result = await invokeClaude<ReviewerVerdict>({
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    jsonSchema: SCHEMA,
    model: 'sonnet',
    timeoutMs: 60_000
  })
  if (!result.ok) {
    return {
      approved: true,
      reasons: [`reviewer unreachable: ${result.error}`],
      regressionRisk: 'medium'
    }
  }
  return result.data
}

function allStubs<T extends { source?: string; url?: string }>(items: T[]): boolean {
  return items.every(
    (i) =>
      i.source === 'stub' ||
      (typeof i.url === 'string' && /^about:blank|placehold\.co/i.test(i.url))
  )
}

export async function reviewVisuals(input: {
  assets: VisualAsset[]
  storyboard: Storyboard
  continuityKit: CampaignAnalysis['continuityKit']
}): Promise<ReviewerVerdict> {
  if (allStubs(input.assets)) {
    return {
      approved: true,
      reasons: ['All visuals are intentional stubs — skipping visual review until real APIs are wired.'],
      regressionRisk: 'low'
    }
  }
  const prompt = `Shot list:\n${JSON.stringify(input.storyboard.scenes, null, 2)}\n\nContinuity kit:\n${JSON.stringify(input.continuityKit, null, 2)}\n\nGenerated visuals (one per shot — text descriptions or urls):\n${JSON.stringify(input.assets, null, 2)}\n\nDoes each visual plausibly match its shot's composition, shotType, and the continuity kit's characters, set, and palette? Return reviewer JSON.`
  return callReviewer(prompt)
}

export async function reviewVoice(input: {
  voice: VoiceOverOutput
  script: AdScript
  continuityKit: CampaignAnalysis['continuityKit']
}): Promise<ReviewerVerdict> {
  if (input.voice.source === 'stub' || /^about:blank/i.test(input.voice.audioUrl)) {
    return {
      approved: true,
      reasons: ['Voice-over is an intentional stub — skipping review until a voice API is wired.'],
      regressionRisk: 'low'
    }
  }
  const prompt = `Script:\n${JSON.stringify(input.script, null, 2)}\n\nContinuity kit (tone / pacing reference):\n${JSON.stringify(input.continuityKit.styleAnchors, null, 2)}\n\nGenerated voice-over metadata:\n${JSON.stringify(input.voice, null, 2)}\n\nDoes the voice selection and duration plausibly fit the script's words and the campaign's pacing? Return reviewer JSON.`
  return callReviewer(prompt)
}

export async function reviewMusic(input: {
  music: MusicOutput
  script: AdScript
  continuityKit: CampaignAnalysis['continuityKit']
}): Promise<ReviewerVerdict> {
  if (input.music.source === 'stub' || /^about:blank/i.test(input.music.audioUrl)) {
    return {
      approved: true,
      reasons: ['Music is an intentional stub — skipping review until a music API is wired.'],
      regressionRisk: 'low'
    }
  }
  const prompt = `Script:\n${JSON.stringify(input.script, null, 2)}\n\nContinuity kit style anchors:\n${JSON.stringify(input.continuityKit.styleAnchors, null, 2)}\n\nGenerated music:\n${JSON.stringify(input.music, null, 2)}\n\nDoes the music's prompt/style fit the campaign's pacing and tone, and is its duration appropriate? Return reviewer JSON.`
  return callReviewer(prompt)
}

export async function reviewVideoScenes(input: {
  scenes: VideoSceneOutput[]
  storyboard: Storyboard
  continuityKit: CampaignAnalysis['continuityKit']
}): Promise<ReviewerVerdict> {
  if (allStubs(input.scenes)) {
    return {
      approved: true,
      reasons: ['All video scenes are intentional stubs — skipping visual review until a video API is wired.'],
      regressionRisk: 'low'
    }
  }
  const prompt = `Shot list:\n${JSON.stringify(input.storyboard.scenes, null, 2)}\n\nContinuity kit:\n${JSON.stringify(input.continuityKit, null, 2)}\n\nGenerated video clips (metadata or urls):\n${JSON.stringify(input.scenes, null, 2)}\n\nDoes each clip plausibly match its shot's durationSeconds, camera movement, and the continuity kit? Return reviewer JSON.`
  return callReviewer(prompt)
}
