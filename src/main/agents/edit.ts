import { invokeClaude } from '../llm/claudeCli'
import type {
  AdScript,
  FinalCut,
  MusicOutput,
  Storyboard,
  VideoSceneOutput,
  VoiceOverOutput
} from '../../shared/types'
import { requireOutput, type PipelineContext } from './registry'

const SYSTEM_PROMPT = `You are an edit-planning agent. You receive finalized media assets and produce a concise edit plan for a 30-second ad spot. Output only valid JSON matching the schema. Do not use tools.

Rules:
- scenes[].start/end: absolute seconds on the final timeline.
- audio.voiceGain / musicGain: 0..1 linear. Music should duck under voice by 10–16 dB.
- format: 16:9 MP4 is the default.
- finalVideoUrl: set to "pending-render" — this plan is what an FFmpeg step would execute.`

const SCHEMA = {
  type: 'object',
  required: ['videoUrl', 'durationSeconds', 'format'],
  additionalProperties: false,
  properties: {
    videoUrl: { type: 'string' },
    durationSeconds: { type: 'number', minimum: 8, maximum: 1810 },
    format: { type: 'string' }
  }
}

export async function runEditAgent(ctx: PipelineContext): Promise<FinalCut> {
  const story = requireOutput<Storyboard>(ctx, 'agent-4', 'storyboard')
  const script = requireOutput<AdScript>(ctx, 'agent-3', 'script')
  const scenes = requireOutput<VideoSceneOutput[]>(ctx, 'agent-7', 'video scenes')
  const voice = requireOutput<VoiceOverOutput>(ctx, 'agent-6', 'voice-over')
  const music = requireOutput<MusicOutput>(ctx, 'agent-6a', 'music')

  const feedbackNote = ctx.feedback ? `\n\nREVISION FEEDBACK: ${ctx.feedback}` : ''
  const prompt = `Storyboard:\n${JSON.stringify(story, null, 2)}\n\nScript:\n${JSON.stringify(script, null, 2)}\n\nVideo scenes:\n${JSON.stringify(scenes, null, 2)}\n\nVoice-over:\n${JSON.stringify(voice, null, 2)}\n\nMusic:\n${JSON.stringify(music, null, 2)}${feedbackNote}\n\nReturn the final-cut JSON only. videoUrl should be "pending-render" since FFmpeg execution is not wired yet.`

  const result = await invokeClaude<FinalCut>({
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    jsonSchema: SCHEMA,
    model: 'sonnet',
    timeoutMs: 60_000
  })
  if (!result.ok) throw new Error(`edit agent failed: ${result.error}`)
  return result.data
}
