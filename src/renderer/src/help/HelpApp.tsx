import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { cn } from '@/lib/utils'
import { Send, Loader2, MessageCircleQuestion } from 'lucide-react'

type HelpResponse =
  | { ok: true; data: string; rawText: string }
  | { ok: false; error: string; rawText?: string }

type Message = {
  id: number
  role: 'user' | 'assistant'
  text: string
  pending?: boolean
}

const WELCOME_TEXT =
  "Hi — I can explain what each step does, help you write revision feedback, or suggest prompt tweaks. What's on your mind?"

let idCounter = 0

function readProjectId(): string | null {
  try {
    return window.localStorage.getItem('atelier.projectId')
  } catch {
    return null
  }
}

function HelpWindow(): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([
    { id: idCounter++, role: 'assistant', text: WELCOME_TEXT }
  ])
  const [input, setInput] = useState('')
  const [isPending, setIsPending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const submit = async (): Promise<void> => {
    if (isPending) return
    const text = input.trim()
    if (!text) return

    const history = messages
      .filter((m, i) => !(i === 0 && m.role === 'assistant'))
      .filter((m) => !m.pending)
      .map((m) => ({ role: m.role, text: m.text }))

    const userMsg: Message = { id: idCounter++, role: 'user', text }
    const pendingId = idCounter++
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: pendingId, role: 'assistant', text: 'thinking…', pending: true }
    ])
    setInput('')
    setIsPending(true)

    try {
      const response = (await window.api.help.sendMessage({
        projectId: readProjectId(),
        messages: history,
        userMessage: text
      })) as HelpResponse

      if (response.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId ? { ...m, text: response.data || '…', pending: false } : m
          )
        )
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, text: `Co-pilot error: ${response.error}`, pending: false }
              : m
          )
        )
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? { ...m, text: `Co-pilot error: ${(err as Error).message}`, pending: false }
            : m
        )
      )
    } finally {
      setIsPending(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <MessageCircleQuestion className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Co-pilot</div>
          <div className="truncate text-xs text-muted-foreground">
            Ask me anything about using Jarvis.
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              'flex max-w-[85%] items-start gap-2 rounded-md px-3 py-2 text-sm',
              m.role === 'user'
                ? 'ml-auto bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {m.pending && <Loader2 className="mt-0.5 size-3.5 animate-spin" />}
            <span className="whitespace-pre-wrap">{m.text}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t border-border p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={isPending}
          placeholder={isPending ? 'thinking…' : 'ask the co-pilot…'}
          className="flex-1"
        />
        <Button
          onClick={() => void submit()}
          size="icon"
          aria-label="Send"
          disabled={isPending || !input.trim()}
        >
          {isPending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>
    </div>
  )
}

export function HelpApp(): React.JSX.Element {
  return (
    <ThemeProvider>
      <div className="h-screen w-screen">
        <HelpWindow />
      </div>
    </ThemeProvider>
  )
}
