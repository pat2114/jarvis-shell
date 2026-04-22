import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { StepId } from '@shared/pipeline'
import type { Project, StepRecord } from '@shared/types'

export type ProjectState = {
  project: Project
  steps: StepRecord[]
}

type PipelineContextValue = {
  projectId: string | null
  state: ProjectState | null
  loading: boolean
  createProject: (companyName: string, websiteUrl: string) => Promise<void>
  approve: (checkpointId: StepId) => Promise<void>
  revise: (checkpointId: StepId, feedback: string) => Promise<void>
  resetProject: () => void
}

const STORAGE_KEY = 'atelier.projectId'

function readStoredProjectId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredProjectId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore storage errors
  }
}

const PipelineContext = createContext<PipelineContextValue | null>(null)

export function PipelineProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [projectId, setProjectId] = useState<string | null>(() => readStoredProjectId())
  const [state, setState] = useState<ProjectState | null>(null)
  const [loading, setLoading] = useState<boolean>(() => readStoredProjectId() !== null)
  const projectIdRef = useRef<string | null>(projectId)

  useEffect(() => {
    projectIdRef.current = projectId
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    if (!projectId) {
      setState(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void (async () => {
      try {
        const result = (await window.api.pipeline.getState(projectId)) as ProjectState | null
        if (cancelled) return
        if (!result) {
          writeStoredProjectId(null)
          setProjectId(null)
          setState(null)
        } else {
          setState(result)
        }
      } catch {
        if (!cancelled) setState(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  useEffect(() => {
    const unsubscribe = window.api?.pipeline?.onUpdated?.((incoming) => {
      const next = incoming as ProjectState | null
      if (!next) return
      if (next.project?.id && next.project.id === projectIdRef.current) {
        setState(next)
      }
    })
    return unsubscribe
  }, [])

  const createProject = useCallback(async (companyName: string, websiteUrl: string) => {
    const result = (await window.api.pipeline.createProject({
      companyName,
      websiteUrl
    })) as ProjectState
    writeStoredProjectId(result.project.id)
    setProjectId(result.project.id)
    setState(result)
  }, [])

  const approve = useCallback(
    async (checkpointId: StepId) => {
      const id = projectIdRef.current
      if (!id) return
      const result = (await window.api.pipeline.approve(id, checkpointId)) as ProjectState | null
      if (result) setState(result)
    },
    []
  )

  const revise = useCallback(
    async (checkpointId: StepId, feedback: string) => {
      const id = projectIdRef.current
      if (!id) return
      const result = (await window.api.pipeline.revise(
        id,
        checkpointId,
        feedback
      )) as ProjectState | null
      if (result) setState(result)
    },
    []
  )

  const resetProject = useCallback(() => {
    writeStoredProjectId(null)
    setProjectId(null)
    setState(null)
  }, [])

  const value = useMemo<PipelineContextValue>(
    () => ({
      projectId,
      state,
      loading,
      createProject,
      approve,
      revise,
      resetProject
    }),
    [projectId, state, loading, createProject, approve, revise, resetProject]
  )

  return createElement(PipelineContext.Provider, { value }, children)
}

export function usePipeline(): PipelineContextValue {
  const ctx = useContext(PipelineContext)
  if (!ctx) throw new Error('usePipeline must be used inside <PipelineProvider>')
  return ctx
}
