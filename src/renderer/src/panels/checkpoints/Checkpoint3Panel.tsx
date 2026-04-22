import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Storyboard } from '@shared/types'
import { CheckpointFrame, Field } from './CheckpointFrame'
import type { CheckpointPanelProps } from './types'
import { estimateCost } from '@/pipeline/costEstimate'

export function Checkpoint3Panel({
  projectState,
  onApprove,
  onRevise
}: CheckpointPanelProps): React.JSX.Element | null {
  const storyboardStep = projectState.steps.find((s) => s.stepId === 'agent-4')
  const storyboard = storyboardStep?.output as Storyboard | null | undefined
  const reviewerFlag = storyboardStep?.reviewerFlag ?? null
  if (!storyboard) return null

  const duration = projectState.project.durationSeconds
  const overLong = duration > 180
  const cost = estimateCost({
    durationSeconds: duration,
    sceneCount: storyboard.scenes.length
  })

  return (
    <CheckpointFrame
      eyebrow="Checkpoint 3"
      title="Storyboard review"
      description={`A shot-by-shot plan totalling ${storyboard.totalSeconds}s across ${storyboard.scenes.length} scenes. Approve to move to visuals, or request a revision.`}
      onApprove={onApprove}
      onRevise={onRevise}
    >
      {reviewerFlag && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Internal quality check flagged this — review carefully.
        </div>
      )}

      <div className="rounded-md border border-border/60 bg-card/50 px-3 py-2 text-xs text-muted-foreground">
        This storyboard will cost roughly ${cost.lowUSD}–{cost.highUSD} to generate ({cost.shotCount}{' '}
        shots, including internal retries).
      </div>

      {overLong && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Videos over 3 minutes may show cross-shot drift — faces, wardrobe, or set details can
          shift between cuts. Use your judgment; you can always mark specific shots as &apos;use
          existing footage&apos; at Checkpoint 4.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {storyboard.scenes.map((scene) => (
          <Card key={scene.order}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">Scene {scene.order}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{scene.shotType}</Badge>
                  <Badge variant="secondary">{scene.cameraMovement}</Badge>
                  <Badge variant="ghost">{scene.durationSeconds}s</Badge>
                  <Badge variant={scene.source === 'existing' ? 'secondary' : 'outline'}>
                    {scene.source === 'existing' ? 'Existing footage' : 'Generated'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Scene text" value={scene.sceneText} />
              <Field label="Composition" value={scene.composition} />
              <Field label="Visual" value={scene.visualDescription} />
            </CardContent>
          </Card>
        ))}
      </div>
    </CheckpointFrame>
  )
}
