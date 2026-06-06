import { create } from 'zustand'
import type { AgentStatus } from '@shared/types'

export type AgentBlock =
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool'; name: string; input: string; output: string; status: 'pending' | 'running' | 'done' | 'error' }

export interface AgentMessage {
  id: string
  role: 'user' | 'agent'
  blocks: AgentBlock[]
  prompt?: string
  createdAt: number
  done: boolean
  errorText?: string
}

interface AgentChatState {
  activeTaskId: string | null
  panelOpen: boolean
  threads: Record<string, AgentMessage[]>
  status: Record<string, AgentStatus>
  sessionId: Record<string, string | null>
  panelHeight: number

  openPanel: (taskId: string) => void
  closePanel: () => void
  appendUserMessage: (taskId: string, message: AgentMessage) => void
  applyEvent: (taskId: string, promptId: number, raw: Record<string, unknown>) => void
  finalizeMessage: (taskId: string, promptId: number, error?: string) => void
  setStatus: (taskId: string, status: AgentStatus) => void
  setSessionId: (taskId: string, sessionId: string) => void
  clearThread: (taskId: string) => void
  setPanelHeight: (updater: number | ((prev: number) => number)) => void
}

let messageCounter = 0
export const nextMessageId = (): string => `msg_${Date.now()}_${++messageCounter}`

function ensureBlock<K extends AgentBlock['kind']>(
  message: AgentMessage,
  kind: K,
): Extract<AgentBlock, { kind: K }> {
  const last = message.blocks[message.blocks.length - 1]
  if (last && last.kind === kind) return last as Extract<AgentBlock, { kind: K }>
  const created: AgentBlock =
    kind === 'text'
      ? { kind: 'text', text: '' }
      : kind === 'thinking'
        ? { kind: 'thinking', text: '' }
        : { kind: 'tool', name: '', input: '', output: '', status: 'pending' }
  message.blocks.push(created)
  return created as Extract<AgentBlock, { kind: K }>
}

export const useTerminalStore = create<AgentChatState>((set) => ({
  activeTaskId: null,
  panelOpen: false,
  threads: {},
  status: {},
  sessionId: {},
  panelHeight: 420,

  openPanel: (taskId) => set({ activeTaskId: taskId, panelOpen: true }),

  closePanel: () => set({ panelOpen: false }),

  appendUserMessage: (taskId, message) =>
    set((s) => ({
      threads: { ...s.threads, [taskId]: [...(s.threads[taskId] ?? []), message] },
    })),

  applyEvent: (taskId, promptId, raw) =>
    set((s) => {
      // Only process specific NDJSON event types from the agent output stream.
      const type = raw.type as string | undefined
      if (type !== 'session' && type !== 'message_start' && type !== 'message_update' && type !== 'message_end' && type !== 'turn_end' && type !== 'agent_end') {
        return s
      }

      const list = [...(s.threads[taskId] ?? [])]

      // Find or create the agent message for this prompt.
      let message = list.find((m) => m.id === `prompt_${promptId}`)
      if (!message) {
        message = {
          id: `prompt_${promptId}`,
          role: 'agent',
          blocks: [],
          createdAt: Date.now(),
          done: false,
        }
        list.push(message)
      }

      if (type === 'session') {
        const sid = raw.id as string | undefined
        if (sid) {
          // Schedule async setSessionId to avoid dispatching inside zustand updater.
          setTimeout(() => useTerminalStore.getState().setSessionId(taskId, sid), 0)
        }
        return { threads: { ...s.threads, [taskId]: list } }
      }

      if (type === 'message_start') {
        message.blocks = []
        return { threads: { ...s.threads, [taskId]: list } }
      }

      if (type === 'message_update') {
        const evt = raw.assistantMessageEvent as
          | { type?: string; contentIndex?: number; delta?: string; content?: string; partial?: { content?: { type?: string; name?: string; input?: unknown }[] } }
          | undefined
        if (!evt) return { threads: { ...s.threads, [taskId]: list } }

        if (evt.type === 'thinking_start') {
          ensureBlock(message, 'thinking')
        } else if (evt.type === 'thinking_delta' && typeof evt.delta === 'string') {
          const block = ensureBlock(message, 'thinking')
          block.text += evt.delta
        } else if (evt.type === 'thinking_end') {
          if (typeof evt.content === 'string') {
            const block = ensureBlock(message, 'thinking')
            block.text = evt.content
          }
        } else if (evt.type === 'text_start') {
          ensureBlock(message, 'text')
        } else if (evt.type === 'text_delta' && typeof evt.delta === 'string') {
          const block = ensureBlock(message, 'text')
          block.text += evt.delta
        } else if (evt.type === 'text_end') {
          if (typeof evt.content === 'string') {
            const block = ensureBlock(message, 'text')
            block.text = evt.content
          }
        } else if (evt.type === 'tool_use_start' || evt.type === 'tool_use_delta' || evt.type === 'tool_use_end') {
          const block = ensureBlock(message, 'tool')
          const partial = evt.partial?.content?.[evt.contentIndex ?? 0]
          if (partial?.type === 'tool_use' && partial.name && !block.name) {
            block.name = String(partial.name)
          }
          if (typeof evt.delta === 'string' && evt.type === 'tool_use_delta') {
            block.input += evt.delta
          }
          if (evt.type === 'tool_use_end') {
            block.status = 'running'
          }
        }
        return { threads: { ...s.threads, [taskId]: list } }
      }

      if (type === 'message_end' || type === 'turn_end' || type === 'agent_end') {
        message.done = true
        return { threads: { ...s.threads, [taskId]: list } }
      }

      return { threads: { ...s.threads, [taskId]: list } }
    }),

  finalizeMessage: (taskId, promptId, error) =>
    set((s) => {
      const list = [...(s.threads[taskId] ?? [])]
      const message = list.find((m) => m.id === `prompt_${promptId}`)
      if (!message) return s
      message.done = true
      if (error) message.errorText = error
      return { threads: { ...s.threads, [taskId]: list } }
    }),

  setStatus: (taskId, status) => set((s) => ({ status: { ...s.status, [taskId]: status } })),

  setSessionId: (taskId, sessionId) =>
    set((s) => ({ sessionId: { ...s.sessionId, [taskId]: sessionId } })),

  clearThread: (taskId) =>
    set((s) => {
      const { [taskId]: _, ...rest } = s.threads
      const { [taskId]: _s, ...restStatus } = s.status
      const { [taskId]: _ss, ...restSession } = s.sessionId
      return { threads: rest, status: restStatus, sessionId: restSession }
    }),

  setPanelHeight: (updater) =>
    set((s) => {
      const newHeight = typeof updater === 'function' ? updater(s.panelHeight) : updater
      // Limit height between 200px and 1200px
      return { panelHeight: Math.max(200, Math.min(newHeight, 1200)) }
    }),
}))
