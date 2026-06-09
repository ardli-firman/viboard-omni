import { useEffect, useRef, useState, useCallback } from 'react'
import type { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { TerminalManager } from './TerminalManager'
import { useTerminalStore } from '../../stores/terminalStore'
import { useProjectStore } from '../../stores/projectStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useThemeStore } from '../../stores/themeStore'
import { Button } from '../ui/button'
import { X, Terminal as TerminalIcon, Minus, Maximize2, Minimize2, ChevronUp, Play, Square, RotateCw } from 'lucide-react'


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
  const { theme } = useThemeStore()
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

  const handleStartAgent = useCallback(() => {
    const manager = TerminalManager.getInstance()
    const term = manager.getTerminal(taskId)
    if (!term) return

    const currentTask = tasks.find((t) => t.id === taskId)
    if (!currentTask) {
      term.write('\x1b[31m[Terminal] Error: Task not found.\x1b[0m\r\n')
      return
    }

    const agentType = currentTask.agentType ?? settings.defaultAgentType ?? 'oh-my-pi'
    const globalAgentConfig = settings.agentConfigs[agentType]
    const taskAgentConfig = currentTask.agentConfig

    // Show spawning message
    term.write('\r\n\x1b[38;2;143;194;155m[Terminal] Spawning agent...\x1b[0m\r\n')

    window.electronAPI.spawnAgentPty(
      taskId,
      currentTask.projectPath,
      term.cols || 80,
      term.rows || 30,
      agentType,
      globalAgentConfig,
      taskAgentConfig,
    ).catch((err) => {
      term.write(`\x1b[31m[Terminal] Error spawning agent: ${err.message || err}\x1b[0m\r\n`)
    })
  }, [taskId, tasks, settings])

  const handleStopAgent = useCallback(async () => {
    try {
      await window.electronAPI.killAgentPty(taskId)
    } catch (err) {
      console.error('Failed to stop agent:', err)
    }
  }, [taskId])

  const [sizeMode, setSizeMode] = useState<'normal' | 'minimized' | 'maximized'>('normal')
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
    if (sizeMode !== 'normal') return // Disable dragging when minimized or maximized
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

    // Automatically spawn a new PTY if this is a fresh session AND the status is 'idle'
    const currentStatus = useTerminalStore.getState().status[taskId] ?? 'idle'
    if (isNewSession && currentStatus === 'idle') {
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

        const currentTask = useProjectStore.getState().tasks.find((t) => t.id === taskId)

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
          ).catch((err) => {
            term.write(`\x1b[31m[Terminal] Error spawning agent: ${err.message || err}\x1b[0m\r\n`)
          })
        } else {
          term.write('\x1b[31m[Terminal] Error: Task not found.\x1b[0m\r\n')
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
  }, [taskId, task?.agentType, JSON.stringify(task?.agentConfig)])

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

  // ── Dynamic Theme Synchronization ────────────────────────────────
  useEffect(() => {
    TerminalManager.getInstance().updateTheme(taskId, theme)
  }, [taskId, theme])

  // ── Resize Observer ──────────────────────────────────────────────
  // Re-fits xterm when the panel container resizes.

  const handleResize = useCallback(() => {
    const manager = TerminalManager.getInstance()
    const fitAddon = manager.getFitAddon(taskId)
    const term = manager.getTerminal(taskId)
    try {
      fitAddon?.fit()
      if (term) {
        window.electronAPI.resizeAgentPty(taskId, term.cols, term.rows).catch((err) => {
          console.warn(`[AgentChatPanel] Failed to resize PTY via IPC:`, err)
        })
      }
    } catch {
      // ignore
    }
  }, [taskId])

  // Throttled ResizeObserver: fires at most once per 100ms to prevent
  // expensive xterm fit() + IPC resize calls on every pixel during drag.
  useEffect(() => {
    if (!terminalContainerRef.current) return

    let throttleTimer: ReturnType<typeof setTimeout> | null = null
    const throttledResize = (): void => {
      if (throttleTimer) return
      throttleTimer = setTimeout(() => {
        throttleTimer = null
        handleResize()
      }, 100)
    }

    const observer = new ResizeObserver(throttledResize)
    observer.observe(terminalContainerRef.current)
    return () => {
      observer.disconnect()
      if (throttleTimer) clearTimeout(throttleTimer)
    }
  }, [taskId, handleResize])

  // Trigger terminal refit after transition animations complete
  useEffect(() => {
    const timer = setTimeout(() => {
      handleResize()
    }, 320)
    return () => clearTimeout(timer)
  }, [sizeMode, handleResize])

  const getPanelHeightStyle = (): string | number => {
    if (sizeMode === 'minimized') return '38px'
    if (sizeMode === 'maximized') return '80vh'
    return panelHeight
  }

  const handleHeaderDoubleClick = (): void => {
    if (sizeMode === 'minimized') {
      setSizeMode('normal')
    } else if (sizeMode === 'normal') {
      setSizeMode('minimized')
    } else {
      setSizeMode('normal')
    }
  }

  const handleHeaderClick = (): void => {
    if (sizeMode === 'minimized') {
      setSizeMode('normal')
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div 
      className={`relative shrink-0 flex flex-col border-t border-border/30 bg-background text-foreground transition-all duration-300 ${
        isResizing ? 'select-none transition-none' : ''
      }`}
      style={{ height: getPanelHeightStyle() }}
    >
      {/* Resizer handle bar (visible only in normal size mode) */}
      {sizeMode === 'normal' && (
        <div 
          className="absolute top-0 left-0 right-0 h-1.5 -translate-y-1/2 cursor-ns-resize z-50 bg-transparent hover:bg-primary/50 transition-all duration-150 group/resizer flex items-center justify-center"
          onMouseDown={handleMouseDown}
        >
          <div className="w-12 h-1 rounded-full bg-muted-foreground/30 group-hover/resizer:bg-primary/80 transition-colors duration-150" />
        </div>
      )}

      {/* Header bar */}
      <div 
        className={`flex shrink-0 items-center justify-between border-b border-border/25 px-4 py-2 shadow-xs bg-card select-none ${
          sizeMode === 'minimized' ? 'cursor-pointer hover:bg-primary/10' : 'cursor-default'
        }`}
        onDoubleClick={handleHeaderDoubleClick}
        onClick={handleHeaderClick}
      >
        <div className="flex min-w-0 items-center gap-2">
          <TerminalIcon className="h-4 w-4 shrink-0 text-primary animate-pulse" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-primary">Agent Terminal</span>
          {task && <span className="truncate text-xs text-muted-foreground font-semibold">· {task.title}</span>}
          <span className="ml-3 flex items-center gap-1.5 rounded-full border border-border/40 bg-background/50 px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase shadow-2xs">
            <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
            {statusInfo.text}
          </span>
          {sizeMode === 'minimized' && (
            <span className="text-[10px] text-muted-foreground/80 font-bold ml-4 animate-pulse">
              (Minimized • Click to restore)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {/* Action Button: Run / Restart / Stop */}
          {sizeMode !== 'minimized' && (
            status === 'running' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 border-red-500/30 hover:bg-red-500/10 text-red-500 text-[10px] font-extrabold uppercase tracking-wider px-2.5 rounded-lg active:scale-95 transition-all shadow-xs"
                onClick={handleStopAgent}
                title="Stop current agent session"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Stop Agent</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider px-2.5 rounded-lg active:scale-95 transition-all shadow-xs"
                onClick={handleStartAgent}
                title={status === 'idle' ? 'Run agent' : 'Restart agent session'}
              >
                {status === 'idle' ? (
                  <Play className="h-3 w-3 fill-current" />
                ) : (
                  <RotateCw className="h-3 w-3" />
                )}
                <span>{status === 'idle' ? 'Run Agent' : 'Restart'}</span>
              </Button>
            )
          )}

          {/* Minimize / Restore button */}
          {sizeMode === 'minimized' ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted active:scale-95 transition-all"
              onClick={() => setSizeMode('normal')}
              title="Restore panel"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted active:scale-95 transition-all"
              onClick={() => setSizeMode('minimized')}
              title="Minimize to status bar"
            >
              <Minus className="h-4 w-4" />
            </Button>
          )}

          {/* Maximize / Restore normal button */}
          {sizeMode === 'maximized' ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted active:scale-95 transition-all"
              onClick={() => setSizeMode('normal')}
              title="Restore normal size"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          ) : (
            sizeMode !== 'minimized' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted active:scale-95 transition-all"
                onClick={() => setSizeMode('maximized')}
                title="Maximize panel"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )
          )}

          {/* Close button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-all" 
            onClick={closePanel}
            title="Close session"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Terminal logs (hidden when minimized) */}
      <div className={`flex-1 overflow-hidden p-3 font-mono ${sizeMode === 'minimized' ? 'hidden' : ''}`}>
        <div ref={terminalContainerRef} className="h-full w-full" />
      </div>
    </div>
  )
}
