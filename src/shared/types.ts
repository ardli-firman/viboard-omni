export type ThemeMode = 'dark' | 'light'

/**
 * Supported agent CLI types.
 * 'oh-my-pi'   — oh-my-pi (omp binary)
 * 'gemini-cli' — Google Gemini CLI (slot, binary path user-defined)
 * 'pi-agent'   — Pi Agent CLI (slot, binary path user-defined)
 * 'hermes'     — Hermes Agent (slot, binary path user-defined)
 * 'opencode'   — OpenCode AI agent (opencode.ai)
 * 'claude'     — Anthropic Claude Code CLI
 * 'custom'     — Fully custom command, user provides binary + args
 */
export type AgentType = 'oh-my-pi' | 'gemini-cli' | 'pi-agent' | 'hermes' | 'opencode' | 'claude' | 'custom'

export type AgentStatus = 'idle' | 'running' | 'completed' | 'error'

/** Granular real-time activity of the agent within a running session. */
export type AgentActivity = 'waiting' | 'thinking' | 'tool_use' | 'responding'

/**
 * How the agent driver injects session/resume information.
 * 'resume-file' — passes a --resume <path> style argument
 * 'env-var'     — injects via environment variable
 * 'none'        — no session persistence
 */
export type SessionMode = 'resume-file' | 'env-var' | 'none'

/**
 * Per-agent CLI configuration.
 * Stored globally in app settings (as defaults) and optionally per-task (as overrides).
 */
export interface AgentCliConfig {
  agentType: AgentType
  /** Explicit path to binary. null = driver auto-resolves */
  binaryPath: string | null
  /** Extra CLI arguments inserted before the session arg */
  extraArgs: string[]
  /** Extra environment variables injected at spawn */
  extraEnv: Record<string, string>
  /** How session continuity is handled */
  sessionMode: SessionMode
  /** Flag/arg used for session resume, e.g. '--resume'. null if sessionMode !== 'resume-file' */
  sessionArg: string | null
  /** Env var name used when sessionMode === 'env-var' */
  sessionEnvVar: string | null
}

/**
 * Global application settings, persisted to userData/settings.json
 */
export interface AppSettings {
  defaultAgentType: AgentType
  /** Per-type config overrides. Merged on top of driver defaults at spawn time. */
  agentConfigs: Partial<Record<AgentType, Partial<AgentCliConfig>>>
}

export interface Column {
  id: string
  title: string
  order: number
  color?: string
  createdAt: number
  updatedAt: number
}

export interface Task {
  id: string
  title: string
  description: string
  columnId: string
  order: number
  projectPath: string
  agentType: AgentType
  agentStatus: AgentStatus
  agentSessionId?: string
  /** Per-task agent config override. Merged on top of global settings at spawn time. */
  agentConfig?: Partial<AgentCliConfig>
  customAgentCommand?: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface RegisteredProject {
  path: string
  name: string
  addedAt: number
  lastOpenedAt: number
}

export interface ProjectTag {
  id: string
  projectPath: string
  name: string
  color: string
}

// OMP agent JSON-mode events as forwarded to renderer
export interface AgentOutputEvent {
  taskId: string
  promptId: number
  raw?: Record<string, unknown>
  type?: string
  prompt?: string
  message?: string
  exitCode?: number | null
  signal?: string | null
}

export interface AgentPromptInput {
  taskId: string
  projectPath: string
  prompt: string
}
