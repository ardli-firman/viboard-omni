import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '../../stores/terminalStore'
import { Button } from '../ui/button'
import { X } from 'lucide-react'

interface TerminalPanelProps {
  taskId: string
}

export function TerminalPanel({ taskId }: TerminalPanelProps): React.ReactElement {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const { sessions, closePanel } = useTerminalStore()

  const session = sessions[taskId]

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

    term.writeln('\x1b[36mViboard Omni Terminal\x1b[0m')
    term.writeln('Type commands. Press Enter to send.\r\n')

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

  const handleResize = useCallback(() => {
    fitAddonRef.current?.fit()
  }, [])

  useEffect(() => {
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [handleResize])

  async function handleSpawn(): Promise<void> {
    const tasks = await window.electronAPI.getTasks()
    const task = tasks.find((t) => t.id === taskId)
    if (task) {
      const result = await window.electronAPI.spawnTerminal(taskId, task.projectPath)
      useTerminalStore.getState().registerSession(taskId, result.pid)
    }
  }

  function handleKill(): void {
    window.electronAPI.killTerminal(taskId)
    useTerminalStore.getState().removeSession(taskId)
  }

  return (
    <div className="flex flex-col border-t bg-background">
      <div className="flex items-center justify-between border-b px-4 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Terminal</span>
          <span className="text-xs text-muted-foreground">
            {session?.isActive ? '● Connected' : '○ Idle'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!session?.isActive && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSpawn}>
              Start Agent
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
