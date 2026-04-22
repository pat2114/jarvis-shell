import { useEffect, useMemo } from 'react'
import { Loader2, PartyPopper, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getStep, PIPELINE_STEPS } from '@shared/pipeline'
import type { StepDef } from '@shared/pipeline'
import type { StepRecord } from '@shared/types'
import { usePipeline } from '@/pipeline/usePipeline'
import { Checkpoint1Panel } from './checkpoints/Checkpoint1Panel'
import { Checkpoint2Panel } from './checkpoints/Checkpoint2Panel'
import { Checkpoint3Panel } from './checkpoints/Checkpoint3Panel'
import { Checkpoint4Panel } from './checkpoints/Checkpoint4Panel'
import { Checkpoint5Panel } from './checkpoints/Checkpoint5Panel'
import { Checkpoint5aPanel } from './checkpoints/Checkpoint5aPanel'
import { Checkpoint6Panel } from './checkpoints/Checkpoint6Panel'
import { Checkpoint7Panel } from './checkpoints/Checkpoint7Panel'
import type { CheckpointPanelProps } from './checkpoints/types'

const CHECKPOINT_COMPONENTS: Record<string, React.ComponentType<CheckpointPanelProps>> = {
  'check-1': Checkpoint1Panel,
  'check-2': Checkpoint2Panel,
  'check-3': Checkpoint3Panel,
  'check-4': Checkpoint4Panel,
  'check-5': Checkpoint5Panel,
  'check-5a': Checkpoint5aPanel,
  'check-6': Checkpoint6Panel,
  'check-7': Checkpoint7Panel
}

const AGENT_RUNNING_COPY: Record<string, { title: string; description: string }> = {
  'agent-1': {
    title: 'Researching the company…',
    description: 'Reading the website and socials to understand who they are.'
  },
  'agent-2': {
    title: 'Drafting a campaign direction…',
    description: 'Distilling the research into a clear message and audience.'
  },
  'agent-3': {
    title: 'Writing the script…',
    description: 'Shaping a 30-second story with narration, core line, and call to action.'
  },
  'agent-4': {
    title: 'Building the storyboard…',
    description: 'Breaking the script into scenes with visuals and timing.'
  },
  'agent-5': {
    title: 'Assembling visuals…',
    description: 'Picking existing footage and generating what&apos;s missing.'
  },
  'agent-6': {
    title: 'Recording the voice-over…',
    description: 'Turning the script into spoken narration.'
  },
  'agent-6a': {
    title: 'Scoring the music…',
    description: 'Finding the right sound to match the ad.'
  },
  'agent-7': {
    title: 'Animating the scenes…',
    description: 'Producing motion footage from the storyboard.'
  },
  'agent-8': {
    title: 'Cutting the final edit…',
    description: 'Stitching video, voice, music, and on-screen text together.'
  },
  'agent-9': {
    title: 'Drafting outreach…',
    description: 'Writing a personalised email to send to the company.'
  },
  'agent-10': {
    title: 'Handling correspondence…',
    description: 'Managing replies and follow-ups.'
  },
  'agent-11': {
    title: 'Checking for payment…',
    description: 'Waiting until payment confirmation arrives.'
  },
  'agent-12': {
    title: 'Delivering the final video…',
    description: 'Sending the finished cut to the company.'
  }
}

function useReportAgentError(
  projectId: string | null | undefined,
  stepId: string | null | undefined,
  status: string | undefined,
  errorMessage: string | null | undefined
): void {
  useEffect(() => {
    if (status !== 'error') return
    if (!errorMessage) return
    try {
      void window.api?.telemetry?.report({
        source: 'agent-error',
        message: errorMessage,
        stepId: stepId ?? undefined,
        projectId: projectId ?? undefined
      })
    } catch {
      /* empty */
    }
  }, [status, errorMessage, stepId, projectId])
}

export function CheckpointRouter(): React.JSX.Element {
  const { state, loading, approve, revise, resetProject } = usePipeline()

  const currentStep = state?.project.currentStepId ?? null
  const stepDef: StepDef | undefined = useMemo(
    () => (currentStep ? getStep(currentStep) : undefined),
    [currentStep]
  )

  const record: StepRecord | undefined = state?.steps.find(
    (s) => s.stepId === state?.project.currentStepId
  )

  useReportAgentError(
    state?.project.id,
    record?.stepId,
    record?.status,
    record?.errorMessage
  )

  if (loading || !state) {
    return <CenterShim label="Loading project…" />
  }

  if (!stepDef || !record) {
    return <CenterShim label="Starting up…" />
  }

  if (record.status === 'error') {
    const failing =
      stepDef.kind === 'checkpoint' && stepDef.reviewsOutputOf
        ? getStep(stepDef.reviewsOutputOf)
        : stepDef
    return (
      <ErrorPanel
        label={failing?.label ?? stepDef.label}
        message={record.errorMessage}
        onReset={resetProject}
      />
    )
  }

  if (stepDef.kind === 'agent') {
    const copy = AGENT_RUNNING_COPY[stepDef.id] ?? {
      title: `${stepDef.label}…`,
      description: stepDef.description ?? ''
    }
    return <AgentRunningPanel title={copy.title} description={copy.description} />
  }

  if (record.status === 'awaiting-review') {
    const Component = CHECKPOINT_COMPONENTS[stepDef.id]
    if (!Component) {
      return <CenterShim label="Preparing review…" />
    }
    return (
      <Component
        checkpointId={stepDef.id}
        projectState={state}
        onApprove={() => approve(stepDef.id)}
        onRevise={(feedback) => revise(stepDef.id, feedback)}
      />
    )
  }

  // Checkpoint is approved — if it's the very last step, we're done.
  const isLast = PIPELINE_STEPS[PIPELINE_STEPS.length - 1]?.id === stepDef.id
  if (record.status === 'approved' && isLast) {
    return <PipelineCompletePanel onReset={resetProject} />
  }

  return <CenterShim label="Moving to the next step…" />
}

function AgentRunningPanel({
  title,
  description
}: {
  title: string
  description: string
}): React.JSX.Element {
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center gap-4 p-6 text-center">
      <Loader2 className="size-8 animate-spin text-primary" />
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  )
}

function CenterShim({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function ErrorPanel({
  label,
  message,
  onReset
}: {
  label: string
  message: string | null
  onReset: () => void
}): React.JSX.Element {
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-destructive" />
            {label} didn&apos;t finish
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Something went wrong — try starting the project again.
          </p>
          {message && (
            <pre className="max-h-40 overflow-auto rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              {message}
            </pre>
          )}
          <div className="flex justify-end">
            <Button onClick={onReset}>Start over</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PipelineCompletePanel({ onReset }: { onReset: () => void }): React.JSX.Element {
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-4 p-6 text-center">
      <PartyPopper className="size-10 text-primary" />
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">All done.</h2>
        <p className="text-sm text-muted-foreground">
          Every step was approved. You can start a new project whenever you&apos;re ready.
        </p>
      </div>
      <Button onClick={onReset}>Start a new project</Button>
    </div>
  )
}
