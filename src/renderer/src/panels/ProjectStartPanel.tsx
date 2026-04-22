import { useMemo, useState, type FormEvent } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePipeline } from '@/pipeline/usePipeline'
import { estimateCost } from '@/pipeline/costEstimate'
import { Loader2, Sparkles } from 'lucide-react'

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

type Preset = { label: string; seconds: number }
const PRESETS: Preset[] = [
  { label: '30s', seconds: 30 },
  { label: '60s', seconds: 60 },
  { label: '3 min', seconds: 180 },
  { label: '10 min', seconds: 600 }
]

function clampDuration(raw: number): number {
  if (!Number.isFinite(raw)) return 30
  return Math.max(10, Math.min(1800, Math.round(raw)))
}

export function ProjectStartPanel(): React.JSX.Element {
  const { createProject } = usePipeline()
  const [companyName, setCompanyName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [durationSeconds, setDurationSeconds] = useState<number>(30)
  const [durationInput, setDurationInput] = useState<string>('30')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const cost = useMemo(() => estimateCost({ durationSeconds }), [durationSeconds])
  const overLong = durationSeconds > 180

  const applyPreset = (seconds: number): void => {
    setDurationSeconds(seconds)
    setDurationInput(String(seconds))
  }

  const onDurationChange = (value: string): void => {
    setDurationInput(value)
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      setDurationSeconds(clampDuration(parsed))
    }
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setError(null)

    const name = companyName.trim()
    const url = websiteUrl.trim()
    if (!name) {
      setError('Please enter a company name.')
      return
    }
    if (!isValidUrl(url)) {
      setError('Please enter a valid website URL (including https://).')
      return
    }

    setSubmitting(true)
    try {
      await createProject(name, url, clampDuration(durationSeconds))
    } catch (err) {
      setError((err as Error).message || 'Something went wrong — try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-3.5" />
          New project
        </div>
        <h1 className="text-2xl font-semibold">Let&apos;s make an ad.</h1>
        <p className="text-sm text-muted-foreground">
          Tell me about the company. I&apos;ll research their website and socials, propose a campaign
          direction, then walk you through the script, storyboard, visuals, voice, music, and final
          cut — one checkpoint at a time. You approve each step.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="company-name" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Company name
              </label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Fahrradwerkstatt Neubau"
                disabled={submitting}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="website-url" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Website
              </label>
              <Input
                id="website-url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                disabled={submitting}
                inputMode="url"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="duration-seconds"
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Length
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Button
                    key={p.seconds}
                    type="button"
                    variant={durationSeconds === p.seconds ? 'default' : 'outline'}
                    onClick={() => applyPreset(p.seconds)}
                    disabled={submitting}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="duration-seconds"
                  type="number"
                  min={10}
                  max={1800}
                  value={durationInput}
                  onChange={(e) => onDurationChange(e.target.value)}
                  disabled={submitting}
                  className="max-w-[8rem]"
                />
                <span className="text-sm text-muted-foreground">seconds</span>
              </div>
              <p className="text-xs text-muted-foreground">
                About ~{cost.shotCount} shots, ${cost.lowUSD}–{cost.highUSD} including internal
                retries.
              </p>
            </div>

            {overLong && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                Videos over 3 minutes may show cross-shot drift — faces, wardrobe, or set details
                can shift between cuts. Use your judgment; you can always mark specific shots as
                &apos;use existing footage&apos; at Checkpoint 4.
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" /> Starting…
                  </>
                ) : (
                  <>Begin research</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
