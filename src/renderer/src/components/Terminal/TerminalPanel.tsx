import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '../../stores/terminalStore'
import { useProjectStore } from '../../stores/projectStore'
import { Button } from '../ui/button'
import { X } from 'lucide-react'

interface TerminalPanelProps {
  taskId: string
}

const statusLabels: Record<string, { text: string; color: string }> = {
  idle: { text: '○ Idle', color: 'text-muted-foreground' },
  running: { text: '● omp session', color: 'text-blue-500' },
  completed: { text: '● completed', color: 'text-green-500' },
  error: { text: '● error', color: 'text-red-500' },
}

export function TerminalPanel({ taskId }: TerminalPanelProps): React.ReactElement {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const { sessions, closePanel, registerSession, setSessionStatus } = useTerminalStore()
  const { tasks } = useProjectStore()

  const session = sessions[taskId]
  const task = tasks.find((t) => t.id === taskId)
  const statusInfo = statusLabels[session?.status ?? 'idle'] ?? statusLabels.idle

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      rows: 15,
      cols: 80,
      theme: {
        background: '#1a1a2e',
        foreground: '#e0e0e0',
        cursor: '#e0e0e0',
        selectionBackground: '#4a4a6a',
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)
    fitAddon.fit()
    term.focus()

    term.onData((data) => {
      window.electronAPI.sendTerminalInput(taskId, data)
    })

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    term.writeln('\x1b[36mViboard Omni — OMP Agent CLI\x1b[0m')
    term.writeln('Each task has its own dedicated omp session. Start the agent below.\r\n')

    const handleOutput = (output: { taskId: string; data: string }): void => {
      if (output.taskId === taskId && xtermRef.current) {
        xtermRef.current.write(output.data)
      }
    }

    window.electronAPI.onTerminalOutput(handleOutput)

    return () => {
      window.electronAPI.removeTerminalOutputListener()
      term.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [taskId])

  // Push PTY resize events to the omp session whenever xterm dimensions change.
  useEffect(() => {
    const fit = (): boolean => {
      if (!fitAddonRef.current || !xtermRef.current) return false
      try {
        const dims = fitAddonRef.current.proposeDimensions()
        if (dims && dims.cols > 0 && dims.rows > 0) {
          xtermRef.current.resize(dims.cols, dims.rows)
          if (session?.status === 'running') {
            window.electronAPI.resizeTerminal(taskId, dims.cols, dims.rows)
          }
          return true
        }
      } catch {
        // ignore sizing failures
      }
      return false
    }
    fit()
    const onResize = (): void => {
      fit()
    }
    window.addEventListener('resize', onResize)

    let observer: ResizeObserver | null = null
    if (terminalRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        fit()
      })
      observer.observe(terminalRef.current)
    }

    return () => {
      window.removeEventListener('resize', onResize)
      observer?.disconnect()
    }
  }, [taskId, session?.status])

  async function handleSpawn(): Promise<void> {
    if (!task) {
      const all = await window.electronAPI.getTasks()
      const found = all.find((t) => t.id === taskId)
      if (!found) return
      const result = await window.electronAPI.spawnTerminal(taskId, found.projectPath)
      registerSession(taskId, result.pid, result.agentStatus)
      setSessionStatus(taskId, result.agentStatus)
      return
    }
    const result = await window.electronAPI.spawnTerminal(taskId, task.projectPath)
    registerSession(taskId, result.pid, result.agentStatus)
    setSessionStatus(taskId, result.agentStatus)
  }

  function handleKill(): void {
    window.electronAPI.killTerminal(taskId)
    setSessionStatus(taskId, 'idle')
  }

  return (
    <div className="flex flex-col border-t bg-background">
      <div className="flex items-center justify-between border-b px-4 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">OMP Agent</span>
          {task && <span className="text-xs text-muted-foreground">· {task.title}</span>}
          <span className={`text-xs ${statusInfo.color}`}>{statusInfo.text}</span>
        </div>
        <div className="flex items-center gap-1">
          {!session?.isActive && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleSpawn}
              disabled={!task}
            >
              Start omp session
            </Button>
          )}
          {session?.isActive && (
            <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={handleKill}>
              Stop
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closePanel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={terminalRef} className="min-h-[200px] w-full" />
    </div>
  )
}
