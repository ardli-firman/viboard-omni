export type ThemeMode = 'dark' | 'light'

export type AgentType = 'pi-agent'

export type AgentStatus = 'idle' | 'running' | 'completed' | 'error'

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
