import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '../../stores/terminalStore'
import { useProjectStore } from '../../stores/projectStore'
import { Button } from '../ui/button'
import { X, Terminal as TerminalIcon } from 'lucide-react'

interface AgentChatPanelProps {
  taskId: string
}

const statusLabels: Record<string, { text: string; dot: string }> = {
  idle: { text: 'No session', dot: 'bg-muted-foreground' },
  running: { text: 'running', dot: 'bg-blue-500 animate-pulse' },
  completed: { text: 'session completed', dot: 'bg-green-500' },
  error: { text: 'session error', dot: 'bg-red-500' },
}

export function AgentChatPanel({ taskId }: AgentChatPanelProps): React.ReactElement {
  const { closePanel, panelHeight, setPanelHeight } = useTerminalStore()
  const { tasks } = useProjectStore()
  const status = useTerminalStore((s) => s.status[taskId]) ?? 'idle'

  const task = tasks.find((t) => t.id === taskId)
  const statusInfo = statusLabels[status] ?? statusLabels.idle

  const [isResizing, setIsResizing] = useState(false)
  const lastYRef = useRef<number>(0)
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

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

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      theme: {
        background: 'transparent',
        foreground: '#e6ebe7',
        cursor: '#8fc29b',
        black: '#111613',
        red: '#e06c75',
        green: '#8fc29b',
        yellow: '#e5c07b',
        blue: '#61afef',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#abb2bf',
      },
    })
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(terminalRef.current)
    
    term.write('\x1b[38;2;143;194;155m[AgentChatPanel] Initializing terminal...\x1b[0m\r\n')

    // Initial fit and auto-start
    setTimeout(() => {
      try {
        fitAddon.fit()
      } catch (e) {
        // Ignore fit errors if container is not ready
      }
      
      const currentStatus = useTerminalStore.getState().status[taskId]
      const currentTask = useProjectStore.getState().tasks.find((t) => t.id === taskId)
      
      if (currentStatus !== 'running') {
        if (currentTask) {
          term.write('\x1b[38;2;143;194;155m[AgentChatPanel] Requesting OMP agent spawn...\x1b[0m\r\n')
          window.electronAPI.spawnAgentPty(taskId, currentTask.projectPath, term.cols || 80, term.rows || 30)
        } else {
          term.write('\x1b[31m[AgentChatPanel] Error: Task not found in project store.\x1b[0m\r\n')
        }
      } else {
        term.write('\x1b[38;2;143;194;155m[AgentChatPanel] Agent is already running, waiting for output...\x1b[0m\r\n')
        window.electronAPI.spawnAgentPty(taskId, currentTask?.projectPath || '', term.cols || 80, term.rows || 30)
      }
    }, 100)

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Handle data from terminal to pty
    const onDataDisposable = term.onData((data) => {
      const currentStatus = useTerminalStore.getState().status[taskId]
      if (currentStatus === 'running') {
        window.electronAPI.sendAgentPtyData(taskId, data)
      }
    })

    // Listen for data from pty to terminal
    window.electronAPI.onAgentPtyOutput((payload) => {
      if (payload.taskId === taskId) {
        term.write(payload.data)
      }
    })

    return () => {
      onDataDisposable.dispose()
      term.dispose()
      window.electronAPI.removeAgentPtyOutputListener()
    }
  }, [taskId])

  // Resize observer to refit terminal when panel resizes
  useEffect(() => {
    if (!terminalRef.current || !fitAddonRef.current || !xtermRef.current) return

    const observer = new ResizeObserver(() => {
      try {
        fitAddonRef.current?.fit()
        if (xtermRef.current) {
          window.electronAPI.resizeAgentPty(taskId, xtermRef.current.cols, xtermRef.current.rows)
        }
      } catch {
        // ignore
      }
    })

    observer.observe(terminalRef.current)
    return () => observer.disconnect()
  }, [taskId])

  return (
    <div 
      className={`relative shrink-0 flex flex-col border-t border-border/30 bg-[#111613] text-[#e6ebe7] transition-[height] duration-0 ${isResizing ? 'select-none' : ''}`}
      style={{ height: panelHeight }}
    >
      <div 
        className="absolute top-0 left-0 right-0 h-1 -translate-y-1/2 cursor-ns-resize z-50 bg-transparent hover:bg-primary/50 transition-colors"
        onMouseDown={handleMouseDown}
      />
      <div className="flex shrink-0 items-center justify-between border-b border-border/25 px-4 py-2 shadow-xs bg-card">
        <div className="flex min-w-0 items-center gap-2">
          <TerminalIcon className="h-4 w-4 shrink-0 text-primary animate-pulse" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-card-foreground">Agent Terminal</span>
          {task && <span className="truncate text-xs text-muted-foreground font-semibold">· {task.title}</span>}
          <span className="ml-3 flex items-center gap-1.5 rounded-full border border-border/40 bg-background/50 px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase shadow-2xs">
            <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
            {statusInfo.text}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-all" 
            onClick={closePanel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-3 font-mono">
        <div ref={terminalRef} className="h-full w-full" />
      </div>
    </div>
  )
}
