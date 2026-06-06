import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { Board } from './components/Board/Board'
import { TerminalPanel } from './components/Terminal/TerminalPanel'
import { Header } from './components/Layout/Header'
import { Sidebar } from './components/Layout/Sidebar'
import { ProjectPicker } from './components/ProjectPicker/ProjectPicker'
import { useThemeStore } from './stores/themeStore'
import { useTerminalStore } from './stores/terminalStore'
import { useProjectStore } from './stores/projectStore'

function App(): React.ReactElement {
  const { init } = useThemeStore()
  const { panelOpen, activeTaskId } = useTerminalStore()
  const { currentProject, loadProjects } = useProjectStore()

  useEffect(() => {
    init()
    loadProjects()
  }, [init, loadProjects])
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
                {panelOpen && activeTaskId && <TerminalPanel taskId={activeTaskId} />}
              </div>
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
