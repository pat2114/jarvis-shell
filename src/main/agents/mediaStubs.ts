import type {
  AdScript,
  CampaignAnalysis,
  MusicOutput,
  Storyboard,
  VideoSceneOutput,
  VisualAsset,
  VoiceOverOutput
} from '../../shared/types'
import { requireOutput, type PipelineContext } from './registry'

const STUB_IMAGE = 'https://placehold.co/1280x720/png?text=AI+Image+Stub'
const STUB_VIDEO = 'https://placehold.co/1280x720/png?text=AI+Video+Stub'
const STUB_AUDIO = 'about:blank#stub-audio'

export async function runVisualsStub(ctx: PipelineContext): Promise<VisualAsset[]> {
  const story = requireOutput<Storyboard>(ctx, 'agent-4', 'storyboard')
  // Continuity kit is the shape each real call would consume; read it now so
  // downstream wiring stays stable when real image-gen APIs land.
  const analysis = requireOutput<CampaignAnalysis>(ctx, 'agent-2', 'campaign analysis')
  void analysis.continuityKit
  return story.scenes.map((scene) => ({
    sceneOrder: scene.order,
    kind: 'image' as const,
    source: 'stub' as const,
    url: STUB_IMAGE,
    note:
      'Stub: real Agent 5 needs an image-gen API key (Flux / Imagen / DALL·E / Stable Diffusion).'
  }))
}

export async function runVoiceStub(ctx: PipelineContext): Promise<VoiceOverOutput> {
  const script = requireOutput<AdScript>(ctx, 'agent-3', 'script')
  void script
  return {
    audioUrl: STUB_AUDIO,
    durationSeconds: ctx.durationSeconds,
    voice: 'stub-voice (real agent needs ElevenLabs / Hume key)',
    source: 'stub'
  }
}

export async function runMusicStub(ctx: PipelineContext): Promise<MusicOutput> {
  return {
    audioUrl: STUB_AUDIO,
    durationSeconds: ctx.durationSeconds,
    prompt:
      'warm acoustic bed with soft percussion, major key, rises subtly under the CTA (stub prompt)',
    style: 'stub (real agent needs Suno or Udio key)',
    source: 'stub'
  }
}

export async function runVideoGenStub(ctx: PipelineContext): Promise<VideoSceneOutput[]> {
  const story = requireOutput<Storyboard>(ctx, 'agent-4', 'storyboard')
  return story.scenes.map((scene) => ({
    sceneOrder: scene.order,
    videoUrl: STUB_VIDEO,
    durationSeconds: scene.durationSeconds,
    source: 'stub' as const
  }))
}
