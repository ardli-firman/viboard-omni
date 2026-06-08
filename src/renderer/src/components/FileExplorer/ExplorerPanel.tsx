import { type ReactElement, useEffect, useRef, useCallback } from 'react'
import { PanelRightClose, PanelRightOpen, RotateCw } from 'lucide-react'
import { useFileExplorerStore } from '../../stores/fileExplorerStore'
import { useProjectStore } from '../../stores/projectStore'
import { FileTabs } from './FileTabs'
import { FileTree } from './FileTree'
import { FileEditor } from './FileEditor'

const MIN_WIDTH = 200
const MAX_WIDTH = 640
const COLLAPSED_WIDTH = 48

export function ExplorerPanel(): ReactElement {
  const panelOpen = useFileExplorerStore((s) => s.panelOpen)
  const togglePanel = useFileExplorerStore((s) => s.togglePanel)
  const activeFilePath = useFileExplorerStore((s) => s.activeFilePath)
  const openFiles = useFileExplorerStore((s) => s.openFiles)
  const loadTree = useFileExplorerStore((s) => s.loadTree)
  const setRootPath = useFileExplorerStore((s) => s.setRootPath)
  const closeAllFiles = useFileExplorerStore((s) => s.closeAllFiles)
  const rootPath = useFileExplorerStore((s) => s.rootPath)
  const panelWidth = useFileExplorerStore((s) => s.panelWidth)
  const setPanelWidth = useFileExplorerStore((s) => s.setPanelWidth)
  const resetPanelWidth = useFileExplorerStore((s) => s.resetPanelWidth)

  const currentProject = useProjectStore((s) => s.currentProject)

  useEffect(() => {
    if (currentProject) {
      void loadTree(currentProject)
    } else {
      setRootPath(null)
      closeAllFiles()
    }
  }, [currentProject, loadTree, setRootPath, closeAllFiles])

  useEffect(() => {
    if (!rootPath) return

    const handler = (): void => {
      void loadTree(rootPath)
    }

    const token = window.electronAPI.onProjectFileChanged(handler)

    return () => {
      window.electronAPI.removeProjectFileChangedListener(token)
    }
  }, [rootPath, loadTree])

  const activeFile = openFiles.find((f) => f.path === activeFilePath)
  const showEditor = activeFilePath !== null && activeFile !== undefined
  const activeView = showEditor ? 'editor' : 'explorer'

  // Drag-to-resize logic
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      isDragging.current = true
      startX.current = e.clientX
      startWidth.current = panelWidth
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [panelWidth],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return
      // Panel grows to the left as user drags right
      const delta = startX.current - e.clientX
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth.current + delta))
      setPanelWidth(next)
    },
    [setPanelWidth],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      isDragging.current = false
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    },
    [],
  )

  const onDoubleClick = useCallback(() => {
    resetPanelWidth()
  }, [resetPanelWidth])

  const widthPx = panelOpen ? panelWidth : COLLAPSED_WIDTH

  return (
    <div
      className="relative flex shrink-0 overflow-hidden bg-card/20"
      style={{ width: `${widthPx}px` }}
    >
      {/* Drag handle - left edge of right panel */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        className={`group absolute left-0 top-0 z-10 h-full w-[4px] cursor-col-resize transition-colors ${
          isDragging.current ? 'bg-primary/40' : 'hover:bg-primary/20'
        }`}
        title="Drag to resize. Double-click to reset."
      />

      <aside className="flex w-full flex-col border-l border-border/20">
        {/* Header - SaaS style */}
        <div
          className={`flex h-12 items-center border-b border-border/20 bg-background/25 ${
            panelOpen ? 'justify-between pl-4 pr-1.5' : 'justify-center'
          } shrink-0`}
        >
          {panelOpen && (
            <span className="select-none text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">
              Explorer
            </span>
          )}
          <div className="flex items-center gap-0.5">
            {panelOpen && rootPath && (
              <button
                onClick={() => rootPath && void loadTree(rootPath)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground/60 transition-all hover:bg-primary/10 hover:text-primary active:scale-95"
                title="Refresh Explorer"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={togglePanel}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground/60 transition-all hover:bg-primary/10 hover:text-primary active:scale-95"
              title={panelOpen ? 'Collapse' : 'Expand'}
            >
              {panelOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {panelOpen && (
          <>
            <FileTabs />
            <div className="flex flex-1 flex-col overflow-hidden min-h-0 bg-background/5">
              {activeView === 'explorer' ? (
                <FileTree />
              ) : activeFile ? (
                <FileEditor file={activeFile} />
              ) : (
                <FileTree />
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
