import { useEffect, useMemo, useState } from 'react'
import { LayoutRenderer } from '@/layout/LayoutRenderer'
import { templates, type TemplateId } from '@/layout/templates'
import type { PanelRegistry } from '@/layout/types'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { PipelineProvider, usePipeline } from '@/pipeline/usePipeline'
import { SetupProvider, useSetup } from '@/setup/useSetup'
import { MaintenanceProvider } from '@/maintenance/MaintenanceProvider'
import { MaintenanceOverlay } from '@/maintenance/MaintenanceOverlay'
import { ErrorBoundary } from '@/maintenance/ErrorBoundary'
import { PipelinePanel } from '@/panels/PipelinePanel'
import { ProjectStartPanel } from '@/panels/ProjectStartPanel'
import { CheckpointRouter } from '@/panels/CheckpointRouter'
import { OnboardingPanel } from '@/panels/OnboardingPanel'
import { SettingsPanel } from '@/panels/SettingsPanel'
import { ChatBox } from '@/components/ChatBox'
import { HelpApp } from '@/help/HelpApp'
import { Button } from '@/components/ui/button'
import { Check, Loader2, X } from 'lucide-react'

function MainSlot(): React.JSX.Element {
  const { projectId } = usePipeline()
  const { status, isChecking, isReady, isSettingsOpen } = useSetup()

  if (isChecking && !status) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Checking setup…
        </div>
      </div>
    )
  }

  if (!isReady) return <OnboardingPanel />
  if (isSettingsOpen) return <SettingsPanel />
  if (projectId === null) return <ProjectStartPanel />
  return <CheckpointRouter />
}

const mainPanels: PanelRegistry = {
  pipeline: PipelinePanel,
  main: MainSlot,
  chat: ChatBox
}

const previewPanels: PanelRegistry = {
  pipeline: PipelinePanel,
  main: MainSlot,
  chat: PreviewHintPanel
}

function readPreviewId(): TemplateId | null {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('preview')
  if (raw && raw in templates) return raw as TemplateId
  return null
}

function App(): React.JSX.Element {
  const isHelp = useMemo(
    () => new URLSearchParams(window.location.search).get('help') === '1',
    []
  )
  if (isHelp) return <HelpApp />

  const previewId = useMemo(readPreviewId, [])
  const isPreview = previewId !== null

  const [templateId, setTemplateId] = useState<TemplateId>(
    isPreview ? previewId : 'split'
  )

  useEffect(() => {
    if (isPreview) return
    const unsubscribe = window.api?.preview.onApplied?.((id: string) => {
      if (id in templates) setTemplateId(id as TemplateId)
    })
    return unsubscribe
  }, [isPreview])

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <MaintenanceProvider>
          <SetupProvider>
            <PipelineProvider>
              <div className="relative h-full w-full">
                <LayoutRenderer
                  template={templates[templateId]}
                  panels={isPreview ? previewPanels : mainPanels}
                />
                {isPreview && <PreviewActionBar templateId={previewId} />}
              </div>
            </PipelineProvider>
          </SetupProvider>
          {!isPreview && <MaintenanceOverlay />}
        </MaintenanceProvider>
      </ErrorBoundary>
    </ThemeProvider>
  )
}

function PreviewActionBar({ templateId }: { templateId: TemplateId }): React.JSX.Element {
  const template = templates[templateId]
  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-background/95 px-4 py-2 shadow-lg backdrop-blur">
      <div className="text-xs">
        <span className="text-muted-foreground">Previewing layout: </span>
        <span className="font-medium">{template.name}</span>
      </div>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => window.api?.preview.discard()}
        >
          <X /> Discard
        </Button>
        <Button size="sm" onClick={() => window.api?.preview.apply(templateId)}>
          <Check /> Apply
        </Button>
      </div>
    </div>
  )
}

function PreviewHintPanel(): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-3 text-xs text-muted-foreground">
      Preview window — chat is disabled here.
    </div>
  )
}

export default App
