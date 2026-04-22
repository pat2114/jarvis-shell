import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSetup } from '@/setup/useSetup'
import { ChecksList, KeysList, SectionWrap } from '@/setup/SetupSections'

export function SettingsPanel(): React.JSX.Element {
  const { status, closeSettings } = useSetup()
  const required = status?.required ?? []
  const optional = status?.optional ?? []

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Settings
          </div>
          <h1 className="text-xl font-semibold">Dependencies & keys</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={closeSettings}>
          <X /> Close
        </Button>
      </header>

      <SectionWrap>
        <ChecksList
          heading="Required"
          description="Core dependencies Atelier needs to run."
          tone="required"
          checks={required}
          showRecheck
        />

        <ChecksList
          heading="Optional"
          description="Nice to have. Missing these only affects certain steps."
          tone="optional"
          checks={optional}
        />

        <KeysList
          heading="API keys"
          description="Stored encrypted on your machine using your OS keychain."
        />
      </SectionWrap>
    </div>
  )
}
