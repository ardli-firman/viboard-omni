import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { Board } from './components/Board/Board'
import { TerminalPanel } from './components/Terminal/TerminalPanel'
import { Header } from './components/Layout/Header'
import { useThemeStore } from './stores/themeStore'
import { useTerminalStore } from './stores/terminalStore'

function App(): React.ReactElement {
  const { init } = useThemeStore()
  const { panelOpen, activeTaskId } = useTerminalStore()

  useEffect(() => {
    init()
  }, [init])

  return (
    <>
      <div className="flex h-screen flex-col bg-background">
        <Header />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <Board />
          </div>
          {panelOpen && activeTaskId && <TerminalPanel taskId={activeTaskId} />}
        </div>
      </div>
      <Toaster />
    </>
  )
}

export default App
