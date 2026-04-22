import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Music } from 'lucide-react'
import type { MusicOutput } from '@shared/types'
import { CheckpointFrame, Field, StubBanner } from './CheckpointFrame'
import type { CheckpointPanelProps } from './types'

export function Checkpoint5aPanel({
  projectState,
  onApprove,
  onRevise
}: CheckpointPanelProps): React.JSX.Element | null {
  const step = projectState.steps.find((s) => s.stepId === 'agent-6a')
  const music = step?.output as MusicOutput | null | undefined
  const reviewerFlag = step?.reviewerFlag ?? null
  if (!music) return null

  return (
    <CheckpointFrame
      eyebrow="Checkpoint 5a"
      title="Music review"
      description="A music bed matched to the ad. Approve to move on."
      onApprove={onApprove}
      onRevise={onRevise}
    >
      {reviewerFlag && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Internal quality check flagged this — review carefully.
        </div>
      )}
      <StubBanner>Stub — real music generation needs a Suno or Udio API key.</StubBanner>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Music className="size-4" />
              {music.style || 'Soundtrack'}
            </CardTitle>
            <Badge variant="ghost">{music.durationSeconds}s</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {music.prompt && <Field label="Prompt" value={music.prompt} />}
          {music.style && <Field label="Style" value={music.style} />}
        </CardContent>
      </Card>
    </CheckpointFrame>
  )
}
