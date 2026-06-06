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

export interface TerminalOutput {
  taskId: string
  data: string
}

export interface TerminalSpawnInput {
  taskId: string
  projectPath: string
}

export interface TerminalInput {
  taskId: string
  input: string
}

export interface TerminalResizeInput {
  taskId: string
  cols: number
  rows: number
}

export interface TerminalKillInput {
  taskId: string
}
