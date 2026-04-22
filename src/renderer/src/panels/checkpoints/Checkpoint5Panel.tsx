import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Volume2 } from 'lucide-react'
import type { VoiceOverOutput } from '@shared/types'
import { CheckpointFrame, StubBanner } from './CheckpointFrame'
import type { CheckpointPanelProps } from './types'

export function Checkpoint5Panel({
  projectState,
  onApprove,
  onRevise
}: CheckpointPanelProps): React.JSX.Element | null {
  const step = projectState.steps.find((s) => s.stepId === 'agent-6')
  const voice = step?.output as VoiceOverOutput | null | undefined
  const reviewerFlag = step?.reviewerFlag ?? null
  if (!voice) return null

  return (
    <CheckpointFrame
      eyebrow="Checkpoint 5"
      title="Voice-over review"
      description="Listen through the narration. Approve to move to video generation."
      onApprove={onApprove}
      onRevise={onRevise}
    >
      {reviewerFlag && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Internal quality check flagged this — review carefully.
        </div>
      )}
      <StubBanner>Stub — real voice needs an ElevenLabs or Hume API key.</StubBanner>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{voice.voice || 'Narrator'}</CardTitle>
            <Badge variant="ghost">{voice.durationSeconds}s</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-4">
            <Volume2 className="size-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="h-1.5 w-full rounded-full bg-muted" />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>0:00</span>
                <span>{Math.round(voice.durationSeconds)}s</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </CheckpointFrame>
  )
}
