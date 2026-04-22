import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { CampaignAnalysis, CompanyResearch } from '@shared/types'
import { CheckpointFrame, Field } from './CheckpointFrame'
import type { CheckpointPanelProps } from './types'
import { ChevronDown, ChevronRight } from 'lucide-react'

export function Checkpoint1Panel({
  projectState,
  onApprove,
  onRevise
}: CheckpointPanelProps): React.JSX.Element | null {
  const research = projectState.steps.find((s) => s.stepId === 'agent-1')?.output as
    | CompanyResearch
    | null
    | undefined
  const analysis = projectState.steps.find((s) => s.stepId === 'agent-2')?.output as
    | CampaignAnalysis
    | null
    | undefined
  const analysisStep = projectState.steps.find((s) => s.stepId === 'agent-2')
  const reviewerFlag = analysisStep?.reviewerFlag ?? null
  const [bibleOpen, setBibleOpen] = useState(false)

  if (!research || !analysis) return null

  return (
    <CheckpointFrame
      eyebrow="Checkpoint 1"
      title="Research & analysis review"
      description="I've looked at the company and drafted a campaign direction and a production bible. Approve to continue to the script, or ask for a revision."
      onApprove={onApprove}
      onRevise={onRevise}
    >
      {reviewerFlag && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Internal quality check flagged this — review carefully.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{research.companyName}</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <a
              href={projectState.project.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:underline"
            >
              {projectState.project.websiteUrl}
            </a>
            <span>·</span>
            <span>
              {research.usableMediaCount} of {research.existingMediaCount} media items usable
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Summary" value={research.summary} />
          <Field label="What they sell" value={research.sells} />
          <Field label="Customers" value={research.customers} />
          <Field label="Style & language" value={research.styleAndLanguage} />
          {research.socialLinks.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Socials
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                {research.socialLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-accent hover:text-accent-foreground"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proposed campaign direction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Core message" value={analysis.coreMessage} />
          <Field label="Target audience" value={analysis.targetAudience} />
          <Field label="Ad message" value={analysis.adMessage} />
          <Field label="Video style" value={analysis.videoStyle} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Production bible</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setBibleOpen((v) => !v)}
            >
              {bibleOpen ? <ChevronDown /> : <ChevronRight />}
              {bibleOpen ? 'Hide' : 'Show'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Every shot downstream pulls from this so the set, characters, and style stay
            consistent across cuts.
          </p>
        </CardHeader>
        {bibleOpen && (
          <CardContent className="space-y-4">
            <Field label="Set" value={analysis.continuityKit.setDescription} />

            {analysis.continuityKit.characters.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Characters
                </div>
                {analysis.continuityKit.characters.map((c, i) => (
                  <div
                    key={`${c.role}-${i}`}
                    className="rounded-md border border-border/60 p-3 text-sm space-y-2"
                  >
                    <div className="font-medium">{c.role}</div>
                    <Field label="Appearance" value={c.appearance} />
                    <Field label="Wardrobe" value={c.wardrobe} />
                    <Field label="Signature details" value={c.signatureDetails} />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Style anchors
              </div>
              <Field label="Camera feel" value={analysis.continuityKit.styleAnchors.cameraFeel} />
              <Field
                label="Color palette"
                value={analysis.continuityKit.styleAnchors.colorPalette}
              />
              <Field
                label="Lighting"
                value={analysis.continuityKit.styleAnchors.lightingNotes}
              />
              <Field label="Pacing" value={analysis.continuityKit.styleAnchors.pacing} />
            </div>

            {analysis.continuityKit.referenceImageUrls.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Reference images
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  {analysis.continuityKit.referenceImageUrls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-accent hover:text-accent-foreground"
                    >
                      {url}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </CheckpointFrame>
  )
}
