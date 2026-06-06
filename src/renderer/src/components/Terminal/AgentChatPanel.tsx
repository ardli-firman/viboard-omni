import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '../../stores/terminalStore'
import { useProjectStore } from '../../stores/projectStore'
import { Button } from '../ui/button'
import { X, Square, RotateCcw, Bot, Play } from 'lucide-react'

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
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      theme: {
        background: 'transparent',
      },
    })
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(terminalRef.current)
    
    // Initial fit
    setTimeout(() => {
      fitAddon.fit()
    }, 10)

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

  const handleStart = useCallback(() => {
    if (!task) return
    if (xtermRef.current) {
      xtermRef.current.reset()
    }
    const cols = xtermRef.current?.cols || 80
    const rows = xtermRef.current?.rows || 30
    window.electronAPI.spawnAgentPty(taskId, task.projectPath, cols, rows)
  }, [taskId, task])

  const handleStop = useCallback((): void => {
    window.electronAPI.killAgentPty(taskId)
  }, [taskId])

  const handleRestart = useCallback((): void => {
    handleStop()
    setTimeout(() => handleStart(), 500)
  }, [handleStop, handleStart])

  return (
    <div 
      className={`relative flex flex-col border-t border-border/40 bg-[#1e1e1e] text-white transition-[height] duration-0 ${isResizing ? 'select-none' : ''}`}
      style={{ height: panelHeight }}
    >
      <div 
        className="absolute top-0 left-0 right-0 h-1.5 -translate-y-1/2 cursor-ns-resize z-50 bg-transparent hover:bg-primary/50 transition-colors"
        onMouseDown={handleMouseDown}
      />
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2.5 shadow-sm bg-background">
        <div className="flex min-w-0 items-center gap-2">
          <Bot className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold">Terminal</span>
          {task && <span className="truncate text-xs text-muted-foreground">· {task.title}</span>}
          <span className="ml-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
            {statusInfo.text}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {status === 'running' ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-400 hover:text-red-500"
              title="Stop session"
              onClick={handleStop}
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-green-400 hover:text-green-500"
              title="Start session"
              onClick={handleStart}
            >
              <Play className="h-4 w-4 fill-current" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Restart session" onClick={handleRestart}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closePanel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-2">
        <div ref={terminalRef} className="h-full w-full" />
      </div>
    </div>
  )
}
