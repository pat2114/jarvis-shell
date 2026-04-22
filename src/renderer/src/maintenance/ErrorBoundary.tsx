import { Component, type ErrorInfo as ReactErrorInfo, type ReactNode } from 'react'
import { MaintenanceOverlay } from './MaintenanceOverlay'
import { reportErrorGlobal } from './MaintenanceProvider'
import type { ErrorInfo } from './types'

type Props = { children: ReactNode }

type State = {
  error: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error: { message: error.message, stack: error.stack } }
  }

  componentDidCatch(error: Error, info: ReactErrorInfo): void {
    const stack = error.stack
      ? `${error.stack}\n\nComponent stack:${info.componentStack ?? ''}`
      : info.componentStack ?? undefined
    reportErrorGlobal({
      source: 'error-boundary',
      message: error.message,
      stack
    })
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private handleResetAndReload = (): void => {
    try {
      window.localStorage.clear()
    } catch {
      /* empty */
    }
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <MaintenanceOverlay
          override={{
            kind: 'error',
            errorInfo: this.state.error,
            onReload: this.handleReload,
            onResetAndReload: this.handleResetAndReload
          }}
        />
      )
    }
    return this.props.children
  }
}
