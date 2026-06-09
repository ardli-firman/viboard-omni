import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'

// ── Terminal Session ─────────────────────────────────────────────────

interface TerminalSession {
  terminal: Terminal
  fitAddon: FitAddon
  /** Offscreen container that holds the xterm canvas. Survives detach. */
  container: HTMLDivElement
  isAttached: boolean
  /** Buffered output received while this session was detached (background). */
  outputBuffer: string
  lastAccessedAt: number
  /** Disposable for the onData listener (user typing → PTY). */
  onDataDisposable: { dispose: () => void } | null
  /** Whether a requestAnimationFrame write is pending. */
  _rafPending: boolean
}

export const XTERM_DARK_THEME = {
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
}

export const XTERM_LIGHT_THEME = {
  background: 'transparent',
  foreground: '#141c18',
  cursor: '#141c18',
  black: '#abb2bf',
  red: '#e06c75',
  green: '#3b6e4c',
  yellow: '#b58900',
  blue: '#268bd2',
  magenta: '#d33682',
  cyan: '#2aa198',
  white: '#141c18',
}


// ── TerminalManager Singleton ────────────────────────────────────────
//
// Manages xterm Terminal instances OUTSIDE of React's lifecycle so they
// persist across component mount/unmount (task switching). Key features:
//
//  • getOrCreate(taskId)  – lazy-creates a session
//  • attach(taskId, el)   – moves the xterm DOM into a visible container
//  • detach(taskId)       – removes the DOM but keeps xterm alive
//  • writeToTerminal()    – writes data; buffers if detached (capped)
//  • LRU eviction         – max 3 sessions; oldest auto-disposed
//

export class TerminalManager {
  private static instance: TerminalManager | null = null
  private sessions = new Map<string, TerminalSession>()

  private readonly MAX_SESSIONS = 3
  /** Max buffered output for a detached (background) session. */
  private readonly MAX_DETACHED_BUFFER = 100 * 1024 // 100KB
  private readonly SCROLLBACK = 3000

  // ── Singleton ────────────────────────────────────────────────────

  static getInstance(): TerminalManager {
    if (!TerminalManager.instance) {
      TerminalManager.instance = new TerminalManager()
    }
    return TerminalManager.instance
  }

  // ── Core API ─────────────────────────────────────────────────────

  /**
   * Returns an existing session for `taskId`, or creates a new one.
   * The returned session's xterm is NOT yet attached to any visible DOM —
   * call `attach()` next.
   */
  getOrCreate(taskId: string): TerminalSession {
    const existing = this.sessions.get(taskId)
    if (existing) {
      existing.lastAccessedAt = Date.now()
      return existing
    }

    // Evict oldest if at capacity
    this.evictIfNeeded()

    // Create an offscreen container — xterm needs a DOM node to open into,
    // but it doesn't need to be in the visible document yet.
    const container = document.createElement('div')
    container.style.width = '100%'
    container.style.height = '100%'

    let currentTheme: 'light' | 'dark' = 'dark'
    try {
      const { useThemeStore } = require('../../stores/themeStore')
      currentTheme = useThemeStore.getState().theme
    } catch {
      // ignore
    }

    const term = new Terminal({
      cursorBlink: true,
      fontFamily:
        '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      scrollback: this.SCROLLBACK,
      fastScrollSensitivity: 5,
      smoothScrollDuration: 0,
      theme: currentTheme === 'dark' ? XTERM_DARK_THEME : XTERM_LIGHT_THEME,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)

    // Open xterm into the offscreen container
    term.open(container)

    // Enable keyboard copy & paste shortcuts
    term.attachCustomKeyEventHandler((e) => {
      // Copy: Ctrl+C (only if selection exists) or Ctrl+Shift+C
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (term.hasSelection()) {
          if (e.type === 'keydown') {
            const selection = term.getSelection()
            navigator.clipboard.writeText(selection).catch((err) => {
              console.error('Failed to copy selection to clipboard:', err)
            })
          }
          return false // stop propagation and prevent default (don't send to PTY)
        }
      }

      // Paste: Ctrl+V or Ctrl+Shift+V
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (e.type === 'keydown') {
          navigator.clipboard.readText().then((text) => {
            if (text) term.paste(text)
          }).catch((err) => {
            console.error('Failed to paste from clipboard:', err)
          })
        }
        return false // stop propagation and prevent default (don't send to PTY)
      }

      return true
    })

    // Enable Right-Click copy & paste (QuickEdit behavior)
    container.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      if (term.hasSelection()) {
        const selection = term.getSelection()
        navigator.clipboard.writeText(selection).then(() => {
          term.clearSelection()
        }).catch((err) => {
          console.error('Failed to copy selection to clipboard:', err)
        })
      } else {
        navigator.clipboard.readText().then((text) => {
          if (text) term.paste(text)
        }).catch((err) => {
          console.error('Failed to paste from clipboard:', err)
        })
      }
    })

    const session: TerminalSession = {
      terminal: term,
      fitAddon,
      container,
      isAttached: false,
      outputBuffer: '',
      lastAccessedAt: Date.now(),
      onDataDisposable: null,
      _rafPending: false,
    }

    this.sessions.set(taskId, session)
    return session
  }

  /**
   * Attach a session's xterm DOM into `parentEl` (the visible panel).
   * If the session was previously detached, any buffered output is flushed.
   *
   * @returns The xterm Terminal instance for convenience.
   */
  attach(
    taskId: string,
    parentEl: HTMLElement,
    onData?: (data: string) => void,
  ): Terminal {
    const session = this.getOrCreate(taskId)

    // Move the offscreen container into the visible parent
    if (session.container.parentElement !== parentEl) {
      parentEl.appendChild(session.container)
    }
    session.isAttached = true
    session.lastAccessedAt = Date.now()

    // Fit to the new container size
    try {
      session.fitAddon.fit()
    } catch {
      // Container might not be ready yet; caller can retry via ResizeObserver
    }

    // Flush any output that arrived while detached
    if (session.outputBuffer.length > 0) {
      session.terminal.write(session.outputBuffer)
      session.outputBuffer = ''
    }

    // Wire up the onData handler (user keystrokes → PTY)
    if (session.onDataDisposable) {
      session.onDataDisposable.dispose()
    }
    if (onData) {
      session.onDataDisposable = session.terminal.onData(onData)
    }

    return session.terminal
  }

  /**
   * Detach a session — removes its DOM from the visible tree but keeps
   * the xterm instance alive. Future output will be buffered.
   */
  detach(taskId: string): void {
    const session = this.sessions.get(taskId)
    if (!session) return

    // Remove from visible DOM (but keep the container element alive)
    if (session.container.parentElement) {
      session.container.parentElement.removeChild(session.container)
    }
    session.isAttached = false

    // Dispose the onData handler to avoid sending keystrokes to a background PTY
    if (session.onDataDisposable) {
      session.onDataDisposable.dispose()
      session.onDataDisposable = null
    }
  }

  /**
   * Write data to a terminal. If the session is detached, the data is
   * buffered in memory (capped at MAX_DETACHED_BUFFER).
   *
   * For attached sessions, writes are coalesced via requestAnimationFrame
   * so xterm only renders once per browser frame regardless of how many
   * IPC messages arrive within that frame.
   */
  writeToTerminal(taskId: string, data: string): void {
    const session = this.sessions.get(taskId)
    if (!session) return

    if (session.isAttached) {
      // Accumulate into the pending buffer and schedule a single RAF write
      session.outputBuffer += data
      if (!session._rafPending) {
        session._rafPending = true
        requestAnimationFrame(() => {
          const s = this.sessions.get(taskId)
          if (s && s.isAttached && s.outputBuffer.length > 0) {
            s.terminal.write(s.outputBuffer)
            s.outputBuffer = ''
          }
          if (s) s._rafPending = false
        })
      }
    } else {
      // Buffer output for when the user switches back
      session.outputBuffer += data
      if (session.outputBuffer.length > this.MAX_DETACHED_BUFFER) {
        session.outputBuffer = session.outputBuffer.slice(-this.MAX_DETACHED_BUFFER)
      }
    }
  }

  /**
   * Check if a session exists for a given taskId.
   */
  has(taskId: string): boolean {
    return this.sessions.has(taskId)
  }

  /**
   * Get the terminal instance for a taskId (if it exists).
   */
  getTerminal(taskId: string): Terminal | null {
    return this.sessions.get(taskId)?.terminal ?? null
  }

  /**
   * Get the FitAddon for a taskId (if it exists).
   */
  getFitAddon(taskId: string): FitAddon | null {
    return this.sessions.get(taskId)?.fitAddon ?? null
  }

  /**
   * Dynamically update the terminal theme for a given session.
   */
  updateTheme(taskId: string, theme: 'light' | 'dark'): void {
    const session = this.sessions.get(taskId)
    if (!session) return
    session.terminal.options.theme = theme === 'dark' ? XTERM_DARK_THEME : XTERM_LIGHT_THEME
  }

  /**
   * Fully destroy a session — dispose xterm, remove DOM, free memory.
   */
  dispose(taskId: string): void {
    const session = this.sessions.get(taskId)
    if (!session) return

    if (session.onDataDisposable) {
      session.onDataDisposable.dispose()
    }
    session.terminal.dispose()
    if (session.container.parentElement) {
      session.container.parentElement.removeChild(session.container)
    }
    session.outputBuffer = ''
    this.sessions.delete(taskId)
  }

  /**
   * Destroy all sessions. Called on app shutdown.
   */
  disposeAll(): void {
    for (const taskId of Array.from(this.sessions.keys())) {
      this.dispose(taskId)
    }
  }

  // ── Internals ────────────────────────────────────────────────────

  /**
   * Evict the least-recently-accessed NON-RUNNING session if at capacity.
   * Sessions with a running agent are NEVER evicted — we protect active work.
   * If all sessions are running, the limit becomes a soft cap (no eviction).
   */
  private evictIfNeeded(): void {
    if (this.sessions.size < this.MAX_SESSIONS) return

    // We need to check which sessions have running agents.
    // Import lazily to avoid circular dependency issues.
    let runningStatuses: Record<string, string> = {}
    try {
      // Dynamic import of the store to check agent status
      const { useTerminalStore } = require('../../stores/terminalStore')
      runningStatuses = useTerminalStore.getState().status ?? {}
    } catch {
      // If store isn't available, fall back to evicting oldest
    }

    let candidateId: string | null = null
    let candidateTime = Infinity
    for (const [id, session] of this.sessions) {
      const agentStatus = runningStatuses[id]
      // Skip running sessions — never evict active agents
      if (agentStatus === 'running') continue
      if (session.lastAccessedAt < candidateTime) {
        candidateTime = session.lastAccessedAt
        candidateId = id
      }
    }

    if (candidateId) {
      this.dispose(candidateId)
    }
    // If candidateId is null, all sessions are running — soft cap, allow exceeding
  }
}

