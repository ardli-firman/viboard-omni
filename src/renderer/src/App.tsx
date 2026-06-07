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
import type { AgentActivity } from '@shared/types'

function App(): React.ReactElement {
  const { init } = useThemeStore()
  const { panelOpen, activeTaskId, setStatus, setActivity } = useTerminalStore()
  const { currentProject, loadProjects, setAgentStatus } = useProjectStore()

  useEffect(() => {
    init()
    loadProjects()
  }, [init, loadProjects])

  // Bridge OMP agent session status from main process into the renderer stores.
  // Uses scoped listener: stores the handler ref for targeted cleanup.
  useEffect(() => {
    const ipcHandler = window.electronAPI.onAgentStatus(
      (data: { taskId: string; status: 'idle' | 'running' | 'completed' | 'error' }): void => {
        setStatus(data.taskId, data.status)
        setAgentStatus(data.taskId, data.status)
      },
    )
    return () => {
      window.electronAPI.removeAgentStatusListener(ipcHandler)
    }
  }, [setStatus, setAgentStatus])

  // Bridge granular agent activity updates into the terminal store.
  useEffect(() => {
    const ipcHandler = window.electronAPI.onAgentActivity(
      (data: { taskId: string; activity: AgentActivity }): void => {
        setActivity(data.taskId, data.activity)
      },
    )
    return () => {
      window.electronAPI.removeAgentActivityListener(ipcHandler)
    }
  }, [setActivity])

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
