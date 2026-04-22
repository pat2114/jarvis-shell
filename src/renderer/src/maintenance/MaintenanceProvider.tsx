import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { ErrorInfo, ManualCopy, MaintenanceKind, UpdateState } from './types'

type ManualState = ManualCopy & { active: boolean }

type MaintenanceContextValue = {
  kind: MaintenanceKind
  updateState: UpdateState | null
  errorInfo: ErrorInfo | null
  manual: ManualState
  overlayVisible: boolean
  showManual: (copy?: ManualCopy) => void
  dismissManual: () => void
  reportError: (input: {
    source: 'error-boundary' | 'agent-error' | 'main-process' | 'repair-escalation'
    message: string
    stack?: string
    stepId?: string
    projectId?: string
    context?: Record<string, unknown>
  }) => void
  installUpdate: () => void
  dismissDownloaded: () => void
}

const MaintenanceContext = createContext<MaintenanceContextValue | null>(null)

export function reportErrorGlobal(input: {
  source: 'error-boundary' | 'agent-error' | 'main-process' | 'repair-escalation'
  message: string
  stack?: string
  stepId?: string
  projectId?: string
  context?: Record<string, unknown>
}): void {
  try {
    void window.api?.telemetry?.report(input)
  } catch {
    /* empty */
  }
}

export function MaintenanceProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)
  const [manual, setManual] = useState<ManualState>({ active: false })
  const [downloadedDismissed, setDownloadedDismissed] = useState<boolean>(false)
  const availableSinceRef = useRef<number | null>(null)
  const [, forceTick] = useState(0)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = window.api?.update?.onState?.((state) => {
        setUpdateState(state as UpdateState)
      })
    } catch {
      /* empty */
    }
    try {
      void (window.api?.update?.getState?.() as Promise<UpdateState> | undefined)?.then(
        (initial) => {
          if (initial) setUpdateState(initial)
        }
      )
    } catch {
      /* empty */
    }
    return () => {
      try {
        unsubscribe?.()
      } catch {
        /* empty */
      }
    }
  }, [])

  useEffect(() => {
    if (!updateState) return
    if (updateState.phase === 'available') {
      if (availableSinceRef.current === null) {
        availableSinceRef.current = Date.now()
        const t = setTimeout(() => forceTick((n) => n + 1), 3500)
        return () => clearTimeout(t)
      }
    } else {
      availableSinceRef.current = null
    }
    if (updateState.phase !== 'downloaded') {
      setDownloadedDismissed(false)
    }
    return
  }, [updateState])

  const isUpdateOverlayActive = useMemo<boolean>(() => {
    if (!updateState) return false
    switch (updateState.phase) {
      case 'checking':
      case 'downloading':
        return true
      case 'downloaded':
        return !downloadedDismissed
      case 'available': {
        const since = availableSinceRef.current
        if (since === null) return true
        return Date.now() - since < 3500
      }
      case 'error':
        return true
      default:
        return false
    }
  }, [updateState, downloadedDismissed])

  const kind: MaintenanceKind = useMemo(() => {
    if (errorInfo) return 'error'
    if (manual.active) return 'manual'
    if (isUpdateOverlayActive) return 'update'
    return 'idle'
  }, [errorInfo, manual.active, isUpdateOverlayActive])

  const overlayVisible = kind !== 'idle'

  const showManual = useCallback((copy?: ManualCopy) => {
    setManual({ active: true, ...copy })
  }, [])

  const dismissManual = useCallback(() => {
    setManual({ active: false })
  }, [])

  const reportError = useCallback<MaintenanceContextValue['reportError']>((input) => {
    reportErrorGlobal(input)
    if (input.source === 'error-boundary' || input.source === 'main-process') {
      setErrorInfo({ message: input.message, stack: input.stack })
    }
  }, [])

  const installUpdate = useCallback(() => {
    try {
      window.api?.update?.install?.()
    } catch {
      /* empty */
    }
  }, [])

  const dismissDownloaded = useCallback(() => {
    setDownloadedDismissed(true)
  }, [])

  const value = useMemo<MaintenanceContextValue>(
    () => ({
      kind,
      updateState,
      errorInfo,
      manual,
      overlayVisible,
      showManual,
      dismissManual,
      reportError,
      installUpdate,
      dismissDownloaded
    }),
    [
      kind,
      updateState,
      errorInfo,
      manual,
      overlayVisible,
      showManual,
      dismissManual,
      reportError,
      installUpdate,
      dismissDownloaded
    ]
  )

  return <MaintenanceContext.Provider value={value}>{children}</MaintenanceContext.Provider>
}

export function useMaintenance(): MaintenanceContextValue {
  const ctx = useContext(MaintenanceContext)
  if (!ctx) throw new Error('useMaintenance must be used inside <MaintenanceProvider>')
  return ctx
}
