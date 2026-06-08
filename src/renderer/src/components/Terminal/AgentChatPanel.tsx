import { useEffect, useRef, useState, useCallback } from 'react'
import type { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { TerminalManager } from './TerminalManager'
import { useTerminalStore } from '../../stores/terminalStore'
import { useProjectStore } from '../../stores/projectStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { Button } from '../ui/button'
import { X, Terminal as TerminalIcon } from 'lucide-react'

interface AgentChatPanelProps {
  taskId: string
}

const statusLabels: Record<string, { text: string; dot: string }> = {
  idle: { text: 'No session', dot: 'bg-muted-foreground' },
  completed: { text: 'completed', dot: 'bg-green-500' },
  error: { text: 'error', dot: 'bg-red-500' },
}

export function AgentChatPanel({ taskId }: AgentChatPanelProps): React.ReactElement {
  const { closePanel, panelHeight, setPanelHeight } = useTerminalStore()
  const { tasks } = useProjectStore()
  const { settings } = useSettingsStore()
  const status = useTerminalStore((s) => s.status[taskId]) ?? 'idle'
  const activity = useTerminalStore((s) => s.activity[taskId]) ?? 'waiting'

  const task = tasks.find((t) => t.id === taskId)
  
  // Dynamic status details based on process state and granular agent activity
  const getStatusInfo = (): { text: string; dot: string } => {
    if (status !== 'running') {
      return statusLabels[status] ?? statusLabels.idle
    }
    switch (activity) {
      case 'thinking':
        return { text: 'thinking...', dot: 'bg-indigo-500 animate-pulse' }
      case 'tool_use':
        return { text: 'running tool...', dot: 'bg-purple-500 animate-pulse' }
      case 'responding':
        return { text: 'responding...', dot: 'bg-emerald-500 animate-pulse' }
      case 'waiting':
      default:
        return { text: 'waiting for input', dot: 'bg-amber-500' }
    }
  }

  const statusInfo = getStatusInfo()

  const [isResizing, setIsResizing] = useState(false)
  const lastYRef = useRef<number>(0)
  const terminalContainerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)

  // ── Resize Drag ──────────────────────────────────────────────────

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

  // ── Terminal Attach / Detach ──────────────────────────────────────
  // Instead of creating/destroying xterm on every mount, we use the
  // TerminalManager singleton to attach (show) / detach (hide) a
  // persistent session. The xterm and its scrollback survive task switches.

  useEffect(() => {
    if (!terminalContainerRef.current) return

    const manager = TerminalManager.getInstance()

    // Determine if this is a fresh session (never created before)
    const isNewSession = !manager.has(taskId)

    // Attach the terminal's DOM into our visible container.
    // If the session already exists, this re-attaches it with buffered output.
    const onData = (data: string): void => {
      const currentStatus = useTerminalStore.getState().status[taskId]
      if (currentStatus === 'running') {
        window.electronAPI.sendAgentPtyData(taskId, data)
      }
    }

    const term = manager.attach(taskId, terminalContainerRef.current, onData)
    xtermRef.current = term

    // Only spawn a new PTY if this is a fresh session (no running process)
    if (isNewSession) {
      // Show init message
      term.write('\x1b[38;2;143;194;155m[Terminal] Initializing session...\x1b[0m\r\n')

      // Delay slightly so xterm has time to fit and measure cols/rows
      setTimeout(() => {
        const fitAddon = manager.getFitAddon(taskId)
        try {
          fitAddon?.fit()
        } catch {
          // ignore fit errors if container isn't ready
        }

        const currentStatus = useTerminalStore.getState().status[taskId]
        const currentTask = useProjectStore.getState().tasks.find((t) => t.id === taskId)

        if (currentStatus !== 'running') {
          if (currentTask) {
            const agentType = currentTask.agentType ?? settings.defaultAgentType ?? 'oh-my-pi'
            const globalAgentConfig = settings.agentConfigs[agentType]
            const taskAgentConfig = currentTask.agentConfig

            term.write('\x1b[38;2;143;194;155m[Terminal] Spawning agent...\x1b[0m\r\n')
            window.electronAPI.spawnAgentPty(
              taskId,
              currentTask.projectPath,
              term.cols || 80,
              term.rows || 30,
              agentType,
              globalAgentConfig,
              taskAgentConfig,
            )
          } else {
            term.write('\x1b[31m[Terminal] Error: Task not found.\x1b[0m\r\n')
          }
        }
      }, 100)
    } else {
      // Existing session — just re-fit
      setTimeout(() => {
        const fitAddon = manager.getFitAddon(taskId)
        try {
          fitAddon?.fit()
        } catch {
          // ignore
        }
      }, 50)
    }

    // Cleanup: detach (don't dispose!) so the session stays alive
    return () => {
      manager.detach(taskId)
    }
  }, [taskId])

  // ── IPC Output Listener ──────────────────────────────────────────
  // A single scoped listener routes PTY output to the TerminalManager.
  // The manager handles writing to attached terminals and buffering
  // for detached ones.

  useEffect(() => {
    const manager = TerminalManager.getInstance()

    const handler = window.electronAPI.onAgentPtyOutput((payload: { taskId: string; data: string }) => {
      manager.writeToTerminal(payload.taskId, payload.data)
    })

    return () => {
      window.electronAPI.removeAgentPtyOutputListener(handler)
    }
  }, []) // Mount once — routes ALL taskIds through TerminalManager

  // ── Resize Observer ──────────────────────────────────────────────
  // Re-fits xterm when the panel container resizes.

  const handleResize = useCallback(() => {
    const manager = TerminalManager.getInstance()
    const fitAddon = manager.getFitAddon(taskId)
    const term = manager.getTerminal(taskId)
    try {
      fitAddon?.fit()
      if (term) {
        window.electronAPI.resizeAgentPty(taskId, term.cols, term.rows)
      }
    } catch {
      // ignore
    }
  }, [taskId])

  useEffect(() => {
    if (!terminalContainerRef.current) return

    const observer = new ResizeObserver(handleResize)
    observer.observe(terminalContainerRef.current)
    return () => observer.disconnect()
  }, [taskId, handleResize])

  // ── Render ────────────────────────────────────────────────────────

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
        <div ref={terminalContainerRef} className="h-full w-full" />
      </div>
    </div>
  )
}
