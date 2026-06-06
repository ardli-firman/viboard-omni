import { useEffect, useRef, useState, useCallback } from 'react'
import {
  useTerminalStore,
  type AgentMessage,
  type AgentBlock,
  nextMessageId,
} from '../../stores/terminalStore'
import { useProjectStore } from '../../stores/projectStore'
import { Button } from '../ui/button'
import { X, Send, Square, RotateCcw, User, Bot, ChevronDown, ChevronRight, Wrench, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AgentChatPanelProps {
  taskId: string
}

const statusLabels: Record<string, { text: string; dot: string }> = {
  idle: { text: 'No session', dot: 'bg-muted-foreground' },
  running: { text: 'omp running', dot: 'bg-blue-500 animate-pulse' },
  completed: { text: 'session ready', dot: 'bg-green-500' },
  error: { text: 'session error', dot: 'bg-red-500' },
}

function ThinkingBlock({ text }: { text: string }): React.ReactElement {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border border-border/40 bg-muted/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>Thinking{text ? ` (${text.length} chars)` : ''}</span>
      </button>
      {open && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap border-t border-border/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {text || '(empty)'}
        </pre>
      )}
    </div>
  )
}

function ToolBlock({ block }: { block: Extract<AgentBlock, { kind: 'tool' }> }): React.ReactElement {
  const [open, setOpen] = useState(false)
  const statusLabel: Record<typeof block.status, string> = {
    pending: 'queued',
    running: 'running',
    done: 'done',
    error: 'error',
  }
  const statusClass: Record<typeof block.status, string> = {
    pending: 'text-muted-foreground',
    running: 'text-blue-500',
    done: 'text-green-500',
    error: 'text-red-500',
  }
  return (
    <div className="rounded-md border border-border/40 bg-background/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-muted/40"
      >
        <Wrench className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono text-[12px]">{block.name || 'tool'}</span>
        <span className={`ml-auto text-[11px] font-medium ${statusClass[block.status]}`}>
          {statusLabel[block.status]}
        </span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (
        <div className="space-y-2 border-t border-border/30 px-3 py-2 text-[11px] font-mono text-muted-foreground">
          {block.input && (
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap">{block.input}</pre>
          )}
          {block.output && (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap border-t border-border/20 pt-2">
              {block.output}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: AgentMessage }): React.ReactElement {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div className={`flex max-w-[80%] flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        {isUser ? (
          <div className="rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground whitespace-pre-wrap">
            {message.prompt ?? ''}
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2 rounded-2xl rounded-bl-sm bg-muted/50 px-4 py-2.5 text-sm">
            {message.blocks.length === 0 && !message.done && (
              <span className="text-muted-foreground">omp is starting…</span>
            )}
            {message.blocks.length === 0 && message.done && !message.errorText && (
              <span className="text-muted-foreground italic text-[12px]">(empty response)</span>
            )}
            {message.blocks.map((block, i) => {
              if (block.kind === 'text') {
                return (
                  <div key={i} className="relative prose prose-sm prose-slate dark:prose-invert max-w-none break-words prose-p:leading-relaxed prose-pre:bg-background/50 prose-pre:border prose-pre:border-border/30 prose-a:text-primary hover:prose-a:text-primary/80">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {block.text}
                    </ReactMarkdown>
                    {!message.done && i === message.blocks.length - 1 && (
                      <span className="mt-1 inline-block h-3.5 w-2 animate-pulse bg-foreground/80" />
                    )}
                  </div>
                )
              }
              if (block.kind === 'thinking') {
                const hasText = message.blocks.some((b) => b.kind === 'text' && (b.text || '').trim().length > 0)
                if (message.done && !hasText) {
                  return (
                    <div key={i} className="rounded-2xl bg-muted/30 px-4 py-3 text-sm whitespace-pre-wrap">
                      {block.text || '(empty response)'}
                    </div>
                  )
                }
                return <ThinkingBlock key={i} text={block.text} />
              }
              if (block.kind === 'tool') {
                return <ToolBlock key={i} block={block} />
              }
              return null
            })}
            {message.errorText && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-500">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="font-mono">{message.errorText}</span>
              </div>
            )}
          </div>
        )}
        <span className="text-[10px] text-muted-foreground/70">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  )
}

export function AgentChatPanel({ taskId }: AgentChatPanelProps): React.ReactElement {
  const { closePanel } = useTerminalStore()
  const { tasks } = useProjectStore()
  const threads = useTerminalStore((s) => s.threads[taskId]) ?? []
  const status = useTerminalStore((s) => s.status[taskId]) ?? 'idle'
  const sessionId = useTerminalStore((s) => s.sessionId[taskId]) ?? null
  const appendUserMessage = useTerminalStore((s) => s.appendUserMessage)
  const setStatus = useTerminalStore((s) => s.setStatus)
  const clearThread = useTerminalStore((s) => s.clearThread)
  const panelHeight = useTerminalStore((s) => s.panelHeight)
  const setPanelHeight = useTerminalStore((s) => s.setPanelHeight)

  const task = tasks.find((t) => t.id === taskId)
  const statusInfo = statusLabels[status] ?? statusLabels.idle

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastYRef = useRef<number>(0)

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent): void => {
      const deltaY = lastYRef.current - e.clientY
      lastYRef.current = e.clientY
      setPanelHeight((prev) => prev + deltaY)
    }

    const handleMouseUp = (): void => {
      setIsResizing(false)
    }

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ns-resize'

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, setPanelHeight])

  const handleMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    lastYRef.current = e.clientY
    setIsResizing(true)
  }

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [threads])

  const handleSend = useCallback(async (): Promise<void> => {
    const prompt = draft.trim()
    if (!prompt || sending || !task) return
    setDraft('')
    setSending(true)

    // Locally show the user message immediately.
    const userMessage: AgentMessage = {
      id: nextMessageId(),
      role: 'user',
      blocks: [],
      prompt,
      createdAt: Date.now(),
      done: true,
    }
    appendUserMessage(taskId, userMessage)

    try {
      const { promptId } = await window.electronAPI.sendAgentPrompt(
        taskId,
        task.projectPath,
        prompt,
      )
      // Mark status as running locally; main will re-broadcast but this is responsive.
      setStatus(taskId, 'running')
      // Make sure the agent message placeholder exists so the bubble appears quickly.
      useTerminalStore.getState().applyEvent(taskId, promptId, { type: 'message_start' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      appendUserMessage(taskId, {
        id: nextMessageId(),
        role: 'agent',
        blocks: [],
        createdAt: Date.now(),
        done: true,
        errorText: `[Failed to send prompt] ${message}`,
      })
      setStatus(taskId, 'error')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }, [draft, sending, task, taskId, appendUserMessage, setStatus])

  const handleStop = useCallback((): void => {
    window.electronAPI.killAgent(taskId)
  }, [taskId])

  const handleReset = useCallback((): void => {
    void window.electronAPI.resetAgentSession(taskId)
    clearThread(taskId)
    setStatus(taskId, 'idle')
  }, [taskId, clearThread, setStatus])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const sessionLabelRaw = sessionId
    ? sessionId.length > 10
      ? `${sessionId.slice(0, 8)}…`
      : sessionId
    : '—'
  const sessionLabel = typeof sessionLabelRaw === 'string' ? sessionLabelRaw : '—'

  return (
    <div 
      className={`relative flex flex-col border-t border-border/40 bg-background transition-[height] duration-0 ${isResizing ? 'select-none' : ''}`}
      style={{ height: panelHeight }}
    >
      <div 
        className="absolute top-0 left-0 right-0 h-1.5 -translate-y-1/2 cursor-ns-resize z-50 bg-transparent hover:bg-primary/50 transition-colors"
        onMouseDown={handleMouseDown}
      />
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Bot className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold">OMP Agent Chat</span>
          {task && <span className="truncate text-xs text-muted-foreground">· {task.title}</span>}
          <span className="ml-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
            {statusInfo.text}
          </span>
          <span className="hidden text-[11px] text-muted-foreground/70 md:inline">· session {sessionLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Reset session"
            onClick={handleReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closePanel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {threads.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Bot className="h-8 w-8 opacity-40" />
            <p className="font-medium">Start a conversation with the OMP agent</p>
            <p className="text-xs text-muted-foreground/70">
              Each task has its own persistent session. Type a prompt below.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {threads.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t bg-background/60 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message to omp… (Enter to send, Shift+Enter for new line)"
            rows={2}
            disabled={sending}
            className="flex-1 resize-none rounded-md border border-border/40 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none disabled:opacity-50"
          />
          {status === 'running' ? (
            <Button
              variant="destructive"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleStop}
              title="Stop agent"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => void handleSend()}
              disabled={!draft.trim() || sending || !task}
              title="Send (Enter)"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground/70">
          <span>
            {task?.projectPath ? `cwd: ${task.projectPath}` : 'no project selected'}
          </span>
          <span>session id persisted per task</span>
        </div>
      </div>
    </div>
  )
}
