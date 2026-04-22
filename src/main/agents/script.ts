import { invokeClaude } from '../llm/claudeCli'
import type { AdScript, CampaignAnalysis, CompanyResearch } from '../../shared/types'
import { requireOutput, type PipelineContext } from './registry'

const SYSTEM_PROMPT = `You are a script agent for an advertising spot. Write the exact words the narrator will say. Output only valid JSON matching the schema. Do not use tools.

Rules:
- speakerText: the full narration, paced to the target duration. Aim for roughly 2 spoken words per second at natural delivery — i.e. target word count ≈ 2 × durationSeconds × 0.9 (leave a little breathing room).
- coreLine: the one sentence within the speakerText that carries the ad's message. Must appear verbatim inside speakerText.
- callToAction: a single short sentence at the end. Must appear verbatim inside speakerText.
- onScreenText: 3–6 short phrases (<= 4 words each) that will appear as overlays.
- Tone and wardrobe/setting references must stay consistent with the supplied continuity kit.
- Write in the research's language.
- If revision feedback is present, apply it.`

const SCHEMA = {
  type: 'object',
  required: ['speakerText', 'coreLine', 'callToAction', 'onScreenText'],
  additionalProperties: false,
  properties: {
    speakerText: { type: 'string', minLength: 20, maxLength: 6000 },
    coreLine: { type: 'string', minLength: 5, maxLength: 300 },
    callToAction: { type: 'string', minLength: 5, maxLength: 200 },
    onScreenText: {
      type: 'array',
      minItems: 3,
      maxItems: 6,
      items: { type: 'string', maxLength: 40 }
    }
  }
}

export async function runScriptAgent(ctx: PipelineContext): Promise<AdScript> {
  const research = requireOutput<CompanyResearch>(ctx, 'agent-1', 'company research')
  const analysis = requireOutput<CampaignAnalysis>(ctx, 'agent-2', 'campaign analysis')
  const feedbackNote = ctx.feedback ? `\n\nREVISION FEEDBACK: ${ctx.feedback}` : ''
  const duration = ctx.durationSeconds
  const prompt = `Target duration: ${duration} seconds.\n\nCompany: ${research.companyName}\nSells: ${research.sells}\nCustomers: ${research.customers}\nStyle & language: ${research.styleAndLanguage}\n\nCampaign direction:\n${JSON.stringify({ coreMessage: analysis.coreMessage, targetAudience: analysis.targetAudience, adMessage: analysis.adMessage, videoStyle: analysis.videoStyle }, null, 2)}\n\nContinuity kit:\n${JSON.stringify(analysis.continuityKit, null, 2)}${feedbackNote}\n\nReturn ad script JSON only.`

  const result = await invokeClaude<AdScript>({
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    jsonSchema: SCHEMA,
    model: 'sonnet',
    timeoutMs: 90_000
  })
  if (!result.ok) throw new Error(`script agent failed: ${result.error}`)
  return result.data
}
