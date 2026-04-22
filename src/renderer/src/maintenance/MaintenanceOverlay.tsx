import { useState } from 'react'
import { Loader2, Settings, RefreshCw, RotateCcw, Download, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useMaintenance } from './MaintenanceProvider'
import type { ErrorInfo, ManualCopy, MaintenanceKind, UpdateState } from './types'

type OverlayOverride = {
  kind: MaintenanceKind
  updateState?: UpdateState | null
  errorInfo?: ErrorInfo | null
  manual?: ManualCopy
  onInstall?: () => void
  onDismissDownloaded?: () => void
  onDismissManual?: () => void
  onReload?: () => void
  onResetAndReload?: () => void
}

function formatEta(seconds: number | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null
  if (seconds < 60) return `~${Math.round(seconds)}s`
  const minutes = Math.round(seconds / 60)
  return `~${minutes} min`
}

function Shell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Maintenance"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm"
    >
      <Card className="w-full max-w-md shadow-xl">{children}</Card>
    </div>
  )
}

function IconBadge({
  children,
  spin = false
}: {
  children: React.ReactNode
  spin?: boolean
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary',
        spin && '[&_svg]:animate-spin'
      )}
    >
      {children}
    </div>
  )
}

function DetailsDisclosure({ stack }: { stack?: string }): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  if (!stack) return null
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        <ChevronDown
          className={cn('size-3.5 transition-transform', open && 'rotate-180')}
        />
        {open ? 'Hide details' : 'Details'}
      </button>
      {open && (
        <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground">
          {stack}
        </pre>
      )}
    </div>
  )
}

function UpdateBody({
  state,
  onInstall,
  onDismissDownloaded
}: {
  state: UpdateState | null
  onInstall: () => void
  onDismissDownloaded: () => void
}): React.JSX.Element {
  if (!state) {
    return (
      <Body
        icon={
          <IconBadge spin>
            <Loader2 />
          </IconBadge>
        }
        title="Just a moment"
        subtitle="Getting things ready."
      />
    )
  }

  if (state.phase === 'checking') {
    return (
      <Body
        icon={
          <IconBadge spin>
            <Loader2 />
          </IconBadge>
        }
        title="Checking for updates"
        subtitle="Making sure you have the latest Jarvis."
      />
    )
  }

  if (state.phase === 'available') {
    return (
      <Body
        icon={
          <IconBadge>
            <Download />
          </IconBadge>
        }
        title={`A new version is on the way${state.version ? ` — ${state.version}` : ''}`}
        subtitle="Downloading it in the background. This usually takes a minute or two."
      />
    )
  }

  if (state.phase === 'downloading') {
    const percent = Math.max(0, Math.min(100, state.percent))
    return (
      <Body
        icon={
          <IconBadge spin>
            <Loader2 />
          </IconBadge>
        }
        title={`Updating Jarvis — ${percent}%`}
        subtitle={`${state.transferredMB} / ${state.totalMB} MB downloaded.`}
      >
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </Body>
    )
  }

  if (state.phase === 'downloaded') {
    return (
      <Body
        icon={
          <IconBadge>
            <Download />
          </IconBadge>
        }
        title="Update ready"
        subtitle={'Restart Jarvis to apply the update. Nothing you’ve done will be lost.'}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDismissDownloaded}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {'Not now — I’ll restart later'}
          </button>
          <Button onClick={onInstall}>
            <RefreshCw /> Restart now
          </Button>
        </div>
      </Body>
    )
  }

  if (state.phase === 'error') {
    return (
      <Body
        icon={
          <IconBadge>
            <Settings />
          </IconBadge>
        }
        title={'Couldn’t finish the update'}
        subtitle={'We’ll try again in a moment. You can keep working in the meantime.'}
      >
        <DetailsDisclosure stack={state.message} />
      </Body>
    )
  }

  return (
    <Body
      icon={
        <IconBadge>
          <Settings />
        </IconBadge>
      }
      title="Maintenance"
      subtitle="Nothing to worry about."
    />
  )
}

function Body({
  icon,
  title,
  subtitle,
  children
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <>
      <CardHeader className="gap-3">
        <div className="flex items-start gap-3">
          {icon}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <CardTitle className="text-base">{title}</CardTitle>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </CardHeader>
      {children && <CardContent className="flex flex-col gap-3">{children}</CardContent>}
    </>
  )
}

function ErrorBody({
  errorInfo,
  onReload,
  onResetAndReload
}: {
  errorInfo: ErrorInfo | null
  onReload: () => void
  onResetAndReload: () => void
}): React.JSX.Element {
  return (
    <Body
      icon={
        <IconBadge>
          <Settings />
        </IconBadge>
      }
      title="Something hiccupped"
      subtitle={'Nothing’s lost — reloading usually sorts it.'}
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={onResetAndReload}>
          <RotateCcw /> Reset and reload
        </Button>
        <Button onClick={onReload}>
          <RefreshCw /> Reload
        </Button>
      </div>
      {errorInfo && (
        <DetailsDisclosure
          stack={
            errorInfo.stack
              ? `${errorInfo.message}\n\n${errorInfo.stack}`
              : errorInfo.message
          }
        />
      )}
    </Body>
  )
}

function ManualBody({
  copy,
  onDismiss
}: {
  copy: ManualCopy | undefined
  onDismiss: () => void
}): React.JSX.Element {
  const title = copy?.title ?? 'We’re on it'
  const subtitleBase =
    copy?.subtitle ??
    'Something needs a moment to sort itself out — we’re working on it.'
  const eta = formatEta(copy?.etaSeconds)
  const subtitle = eta ? `${subtitleBase} ETA ${eta}.` : subtitleBase
  return (
    <Body
      icon={
        <IconBadge spin>
          <Loader2 />
        </IconBadge>
      }
      title={title}
      subtitle={subtitle}
    >
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </Body>
  )
}

export function MaintenanceOverlay(props: {
  override?: OverlayOverride
}): React.JSX.Element | null {
  const override = props.override
  if (override) {
    return <OverlayContent override={override} />
  }
  return <ContextOverlay />
}

function ContextOverlay(): React.JSX.Element | null {
  const ctx = useMaintenance()
  if (!ctx.overlayVisible) return null
  return (
    <OverlayContent
      override={{
        kind: ctx.kind,
        updateState: ctx.updateState,
        errorInfo: ctx.errorInfo,
        manual: ctx.manual.active ? ctx.manual : undefined,
        onInstall: ctx.installUpdate,
        onDismissDownloaded: ctx.dismissDownloaded,
        onDismissManual: ctx.dismissManual
      }}
    />
  )
}

function OverlayContent({ override }: { override: OverlayOverride }): React.JSX.Element | null {
  const {
    kind,
    updateState = null,
    errorInfo = null,
    manual,
    onInstall,
    onDismissDownloaded,
    onDismissManual,
    onReload,
    onResetAndReload
  } = override

  if (kind === 'idle') return null

  const reload = onReload ?? ((): void => window.location.reload())
  const resetReload =
    onResetAndReload ??
    ((): void => {
      try {
        window.localStorage.clear()
      } catch {
        /* empty */
      }
      window.location.reload()
    })
  const install = onInstall ?? ((): void => window.api?.update?.install?.())
  const dismissDownloaded = onDismissDownloaded ?? ((): void => undefined)
  const dismissManual = onDismissManual ?? ((): void => undefined)

  return (
    <Shell>
      {kind === 'update' && (
        <UpdateBody
          state={updateState}
          onInstall={install}
          onDismissDownloaded={dismissDownloaded}
        />
      )}
      {kind === 'error' && (
        <ErrorBody
          errorInfo={errorInfo}
          onReload={reload}
          onResetAndReload={resetReload}
        />
      )}
      {kind === 'manual' && <ManualBody copy={manual} onDismiss={dismissManual} />}
    </Shell>
  )
}
