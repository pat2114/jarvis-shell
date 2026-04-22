import { Download, Loader2, Sparkles } from 'lucide-react'
import { useSetup, type InstallId } from '@/setup/useSetup'
import { ChecksList, KeysList, SectionWrap } from '@/setup/SetupSections'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

function installLabel(id: InstallId | null, isSigningIn: boolean): string {
  if (isSigningIn) return 'Signing in to Claude…'
  if (id === 'claude-code') return 'Installing Claude Code…'
  if (id === 'ffmpeg') return 'Installing FFmpeg…'
  return 'Working on it…'
}

function ActiveProgressCard(): React.JSX.Element | null {
  const { installing, installLog, isSigningIn } = useSetup()
  if (!installing && !isSigningIn) return null

  const tail = installLog.slice(-3)
  const label = installLabel(installing, isSigningIn)

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-primary" />
          <div className="flex flex-col">
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs text-muted-foreground">
              {isSigningIn
                ? 'A terminal window opened — finish sign-in in your browser. We will pick up from here.'
                : 'This runs silently in the background. You can keep reading while it works.'}
            </div>
          </div>
        </div>
        {!isSigningIn && tail.length > 0 && (
          <div className="rounded-md border border-border bg-muted px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {tail.map((line, i) => (
              <div key={i} className="truncate">
                {line}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function OnboardingPanel(): React.JSX.Element {
  const { status, isReady, installing, isSigningIn, installEverything } = useSetup()
  const required = status?.required ?? []
  const optional = status?.optional ?? []
  const showHero = !isReady && !installing && !isSigningIn

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-3.5" />
          Setup
        </div>
        <h1 className="text-2xl font-semibold">Set up Atelier</h1>
        <p className="text-sm text-muted-foreground">
          A couple of dependencies and (optional) API keys. Nothing leaves your machine except the
          calls you make.
        </p>
      </header>

      {showHero && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold">Install everything</div>
              <p className="text-xs text-muted-foreground">
                One click. I&apos;ll install Claude Code, sign you in, and set up FFmpeg.
              </p>
            </div>
            <Button onClick={() => void installEverything()} className="sm:shrink-0">
              <Download /> Install everything
            </Button>
          </CardContent>
        </Card>
      )}

      <ActiveProgressCard />

      <SectionWrap>
        <ChecksList
          heading="Required"
          description="These must be working before Atelier can run."
          tone="required"
          checks={required}
          showRecheck
        />

        <ChecksList
          heading="Optional"
          description="Nice to have. Jarvis will run without these, but some steps may be skipped."
          tone="optional"
          checks={optional}
        />

        <KeysList
          heading="API keys"
          description="Stored encrypted on your machine using your OS keychain. You can add these now or later from Settings."
        />
      </SectionWrap>

      <footer className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        Once everything is ready, the app will open automatically. This panel refreshes itself after
        each install or sign-in.
      </footer>
    </div>
  )
}
