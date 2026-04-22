import { invokeClaude } from '../llm/claudeCli'
import type { CampaignAnalysis, CompanyResearch } from '../../shared/types'
import { requireOutput, type PipelineContext } from './registry'

const SYSTEM_PROMPT = `You are an analysis agent. You receive structured company research and decide a single, specific direction for an advertising video, together with a production bible (continuity kit) that every downstream shot will be built against. Output only valid JSON matching the schema. Do not use tools.

Rules:
- coreMessage: one sentence that captures what makes this company specifically worth advertising.
- targetAudience: concrete people, not buzzwords. Age range, location, daily habit.
- adMessage: the one idea the ad will convey. Short enough to say in a breath.
- videoStyle: sensory and specific — materials, camera feel, editing rhythm.
- continuityKit.setDescription: 2–4 sentences of the primary location — materials, era, clutter vs clean, time of day. Specific enough that a visuals agent could redraw it from scratch.
- continuityKit.characters: every recurring on-camera person. For each: role ("owner", "customer, early 30s"), appearance (face, hair, build, age), wardrobe (garments, colours, materials), signatureDetails (glasses, a ring, a tool-belt loop — the small things a viewer latches onto across cuts).
- continuityKit.styleAnchors.cameraFeel: sentence of lens/film/handheld/tripod vocabulary.
- continuityKit.styleAnchors.colorPalette: named palette in prose ("warm oak, graphite, a single thread of cobalt").
- continuityKit.styleAnchors.lightingNotes: practical description — time of day, sources, shadow quality.
- continuityKit.styleAnchors.pacing: editing rhythm — short cuts vs long takes, how breath and silence are used.
- continuityKit.referenceImageUrls: empty array unless research gave you concrete usable image URLs.
- If revision feedback is present, incorporate it explicitly.
- Write in the same language the research is in.`

const SCHEMA = {
  type: 'object',
  required: ['coreMessage', 'targetAudience', 'adMessage', 'videoStyle', 'continuityKit'],
  additionalProperties: false,
  properties: {
    coreMessage: { type: 'string', maxLength: 300 },
    targetAudience: { type: 'string', maxLength: 300 },
    adMessage: { type: 'string', maxLength: 300 },
    videoStyle: { type: 'string', maxLength: 400 },
    continuityKit: {
      type: 'object',
      required: ['setDescription', 'characters', 'styleAnchors', 'referenceImageUrls'],
      additionalProperties: false,
      properties: {
        setDescription: { type: 'string', maxLength: 800 },
        characters: {
          type: 'array',
          minItems: 0,
          maxItems: 8,
          items: {
            type: 'object',
            required: ['role', 'appearance', 'wardrobe', 'signatureDetails'],
            additionalProperties: false,
            properties: {
              role: { type: 'string', maxLength: 120 },
              appearance: { type: 'string', maxLength: 400 },
              wardrobe: { type: 'string', maxLength: 400 },
              signatureDetails: { type: 'string', maxLength: 400 }
            }
          }
        },
        styleAnchors: {
          type: 'object',
          required: ['cameraFeel', 'colorPalette', 'lightingNotes', 'pacing'],
          additionalProperties: false,
          properties: {
            cameraFeel: { type: 'string', maxLength: 300 },
            colorPalette: { type: 'string', maxLength: 300 },
            lightingNotes: { type: 'string', maxLength: 300 },
            pacing: { type: 'string', maxLength: 300 }
          }
        },
        referenceImageUrls: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    }
  }
}

export async function runAnalysisAgent(ctx: PipelineContext): Promise<CampaignAnalysis> {
  const research = requireOutput<CompanyResearch>(ctx, 'agent-1', 'company research')
  const feedbackNote = ctx.feedback ? `\n\nREVISION FEEDBACK: ${ctx.feedback}` : ''
  const durationNote = `\n\nTarget video length: ${ctx.durationSeconds} seconds. Scale the continuity kit detail to match — longer pieces need richer character and set descriptions because more shots will reference them.`
  const prompt = `Company research:\n${JSON.stringify(research, null, 2)}${durationNote}${feedbackNote}\n\nReturn campaign analysis JSON (including continuityKit) only.`

  const result = await invokeClaude<CampaignAnalysis>({
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    jsonSchema: SCHEMA,
    model: 'sonnet',
    timeoutMs: 90_000
  })
  if (!result.ok) throw new Error(`analysis agent failed: ${result.error}`)
  return result.data
}
