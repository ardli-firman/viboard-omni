import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { Board } from './components/Board/Board'
import { AgentChatPanel } from './components/Terminal/AgentChatPanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Header } from './components/Layout/Header'
import { Sidebar } from './components/Layout/Sidebar'
import { ExplorerPanel } from './components/FileExplorer/ExplorerPanel'
import { ProjectPicker } from './components/ProjectPicker/ProjectPicker'
import { useThemeStore } from './stores/themeStore'
import { useTerminalStore } from './stores/terminalStore'
import { useProjectStore } from './stores/projectStore'

function App(): React.ReactElement {
  const { init } = useThemeStore()
  const { panelOpen, activeTaskId, applyEvent, finalizeMessage, setStatus } = useTerminalStore()
  const { currentProject, loadProjects, setAgentStatus } = useProjectStore()

  useEffect(() => {
    init()
    loadProjects()
  }, [init, loadProjects])

  // Bridge OMP agent session status from main process into the renderer stores.
  useEffect(() => {
    const handler = (data: { taskId: string; status: 'idle' | 'running' | 'completed' | 'error' }): void => {
      setStatus(data.taskId, data.status)
      setAgentStatus(data.taskId, data.status)
    }
    window.electronAPI.onAgentStatus(handler)
    return () => {
      window.electronAPI.removeAgentStatusListener()
    }
  }, [setStatus, setAgentStatus])

  // Bridge OMP JSON-mode output events into the terminal store's message thread.
  useEffect(() => {
    const handler = (data: { taskId: string; promptId: number; raw?: Record<string, unknown>; type?: string; prompt?: string; message?: string; exitCode?: number | null; signal?: string | null }): void => {
      if (data.raw) {
        applyEvent(data.taskId, data.promptId, data.raw)
      } else if (data.type === 'prompt' && data.prompt) {
        // The prompt event is a meta-event; user message is appended locally.
      } else if (data.type === 'closed') {
        finalizeMessage(data.taskId, data.promptId)
      } else if (data.type === 'error' && data.message) {
        finalizeMessage(data.taskId, data.promptId, data.message)
      }
    }
    window.electronAPI.onAgentOutput(handler)
    return () => {
      window.electronAPI.removeAgentOutputListener()
    }
  }, [applyEvent, finalizeMessage])

  return (
    <>
      <div className="flex h-screen flex-col bg-background">
        <Header />
        <div className="flex flex-1 flex-col overflow-hidden">
          {currentProject ? (
            <div className="flex flex-1 overflow-hidden">
              <Sidebar />
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <Board />
                </div>
                {panelOpen && activeTaskId && (
                  <ErrorBoundary>
                    <AgentChatPanel taskId={activeTaskId} />
                  </ErrorBoundary>
                )}
              </div>
              <ExplorerPanel />
            </div>
          ) : (
            <ProjectPicker />
          )}
        </div>
      </div>
      <Toaster />
    </>
  )
}

export default App
