import type { ProjectId, StepId, StepStatus } from './pipeline'

export type Project = {
  id: ProjectId
  companyName: string
  websiteUrl: string
  createdAt: number
  currentStepId: StepId
  durationSeconds: number
}

export type StepRecord = {
  projectId: ProjectId
  stepId: StepId
  status: StepStatus
  /** JSON-serialisable agent output (structure depends on agent). */
  output: unknown | null
  /** Revision feedback when status = 'rejected'. */
  feedback: string | null
  errorMessage: string | null
  updatedAt: number
  /** Set when the internal reviewer exhausted its retries but we still accepted the output. */
  reviewerFlag?: { reasons: string[]; attempts: number } | null
}

export type CompanyResearch = {
  companyName: string
  summary: string
  sells: string
  customers: string
  styleAndLanguage: string
  existingMediaCount: number
  usableMediaCount: number
  socialLinks: { label: string; url: string }[]
}

export type ContinuityKit = {
  setDescription: string
  characters: {
    role: string
    appearance: string
    wardrobe: string
    signatureDetails: string
  }[]
  styleAnchors: {
    cameraFeel: string
    colorPalette: string
    lightingNotes: string
    pacing: string
  }
  referenceImageUrls: string[]
}

export type CampaignAnalysis = {
  coreMessage: string
  targetAudience: string
  adMessage: string
  videoStyle: string
  continuityKit: ContinuityKit
}

export type AdScript = {
  speakerText: string
  coreLine: string
  callToAction: string
  onScreenText: string[]
}

export type ShotType =
  | 'wide'
  | 'medium'
  | 'close'
  | 'extreme-close'
  | 'over-shoulder'
  | 'pov'
  | 'tracking'
  | 'aerial'

export type CameraMovement = 'static' | 'pan' | 'dolly' | 'handheld' | 'zoom'

export type StoryboardScene = {
  order: number
  sceneText: string
  visualDescription: string
  shotType: ShotType
  cameraMovement: CameraMovement
  composition: string
  source: 'existing' | 'generated'
  durationSeconds: number
}

export type Storyboard = {
  scenes: StoryboardScene[]
  totalSeconds: number
}

export type VisualAsset = {
  sceneOrder: number
  kind: 'image' | 'video'
  source: 'existing' | 'generated' | 'stub'
  url: string
  note?: string
}

export type VoiceOverOutput = {
  audioUrl: string
  durationSeconds: number
  voice: string
  source?: 'generated' | 'stub'
}

export type MusicOutput = {
  audioUrl: string
  durationSeconds: number
  prompt: string
  style: string
  source?: 'generated' | 'stub'
}

export type VideoSceneOutput = {
  sceneOrder: number
  videoUrl: string
  durationSeconds: number
  source?: 'generated' | 'stub'
}

export type FinalCut = {
  videoUrl: string
  durationSeconds: number
  format: string
}

export type OutreachDraft = {
  to: string
  subject: string
  body: string
  sendMode: 'dry-run' | 'human-confirm' | 'automated'
}

export type CorrespondenceEntry = {
  id: string
  direction: 'inbound' | 'outbound'
  subject: string
  body: string
  timestamp: number
}

export type PaymentStatus = {
  state: 'unpaid' | 'pending' | 'paid'
  note?: string
}

export type DeliveryReceipt = {
  sent: boolean
  deliveredAt: number | null
  downloadUrl: string | null
}

export type ReviewerVerdict = {
  approved: boolean
  reasons: string[]
  regressionRisk?: 'low' | 'medium' | 'high'
}

/** Output shape per step ID. Keep in sync with agent implementations. */
export type StepOutputMap = {
  'agent-1': CompanyResearch
  'agent-2': CampaignAnalysis
  'agent-3': AdScript
  'agent-4': Storyboard
  'agent-5': VisualAsset[]
  'agent-6': VoiceOverOutput
  'agent-6a': MusicOutput
  'agent-7': VideoSceneOutput[]
  'agent-8': FinalCut
  'agent-9': OutreachDraft
  'agent-10': CorrespondenceEntry[]
  'agent-11': PaymentStatus
  'agent-12': DeliveryReceipt
}
