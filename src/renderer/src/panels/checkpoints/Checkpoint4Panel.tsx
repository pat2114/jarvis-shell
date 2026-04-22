import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ImageOff } from 'lucide-react'
import type { VisualAsset } from '@shared/types'
import { CheckpointFrame, StubBanner } from './CheckpointFrame'
import type { CheckpointPanelProps } from './types'

export function Checkpoint4Panel({
  projectState,
  onApprove,
  onRevise
}: CheckpointPanelProps): React.JSX.Element | null {
  const step = projectState.steps.find((s) => s.stepId === 'agent-5')
  const visuals = step?.output as VisualAsset[] | null | undefined
  const reviewerFlag = step?.reviewerFlag ?? null
  if (!visuals) return null

  return (
    <CheckpointFrame
      eyebrow="Checkpoint 4"
      title="Visuals review"
      description="Images lined up for each scene. Approve to move to voice-over and music."
      onApprove={onApprove}
      onRevise={onRevise}
    >
      {reviewerFlag && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Internal quality check flagged this — review carefully.
        </div>
      )}
      <StubBanner>
        These are stubs — real visuals need an image-generation API key wired in.
      </StubBanner>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visuals.map((asset) => (
          <Card key={asset.sceneOrder}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">Scene {asset.sceneOrder}</CardTitle>
                <Badge variant={asset.source === 'existing' ? 'secondary' : 'outline'}>
                  {asset.source === 'existing'
                    ? 'Existing'
                    : asset.source === 'stub'
                      ? 'Stub'
                      : 'Generated'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="aspect-video overflow-hidden rounded-md border border-border bg-muted">
                {asset.url ? (
                  <img
                    src={asset.url}
                    alt={`Scene ${asset.sceneOrder}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageOff className="size-6" />
                  </div>
                )}
              </div>
              {asset.note && (
                <p className="text-xs text-muted-foreground">{asset.note}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </CheckpointFrame>
  )
}
