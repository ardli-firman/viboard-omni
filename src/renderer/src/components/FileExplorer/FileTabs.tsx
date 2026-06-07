import { type ReactElement } from 'react'
import { X, FileText, FolderTree, GitCompare } from 'lucide-react'
import { useFileExplorerStore } from '../../stores/fileExplorerStore'

export function FileTabs(): ReactElement {
  const openFiles = useFileExplorerStore((s) => s.openFiles)
  const activeFilePath = useFileExplorerStore((s) => s.activeFilePath)
  const setActiveFile = useFileExplorerStore((s) => s.setActiveFile)
  const closeFile = useFileExplorerStore((s) => s.closeFile)
  const gitStatus = useFileExplorerStore((s) => s.gitStatus)
  const toggleDiffMode = useFileExplorerStore((s) => s.toggleDiffMode)

  const showExplorer = activeFilePath === null
  const showFileTabs = openFiles.length > 0

  return (
    <div className="flex h-10 items-stretch gap-0 overflow-x-auto border-b border-border/25 bg-background/25">
      <TabButton
        active={showExplorer}
        onClick={() => setActiveFile(null)}
        title="File Explorer"
      >
        <FolderTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground/75" />
        <span>Explorer</span>
      </TabButton>

      {showFileTabs &&
        openFiles.map((file) => {
          const isActive = activeFilePath === file.path
          const isModified = !!gitStatus[file.relativePath] || file.diffMode
          return (
            <div
              key={file.path}
              className={`group flex shrink-0 items-center border-r border-border/20 transition-all cursor-pointer text-xs font-bold ${
                isActive
                  ? 'bg-card border-b-2 border-b-primary text-primary shadow-2xs'
                  : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground border-b border-b-transparent'
              }`}
              onClick={() => setActiveFile(file.path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setActiveFile(file.path)
                }
                if (e.key === 'Delete' || e.key === 'Backspace') {
                  e.preventDefault()
                  closeFile(file.path)
                }
              }}
              title={file.relativePath}
            >
              <span className="ml-3.5 flex items-center gap-1.5 leading-[40px]">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                <span className="truncate max-w-[120px]">{file.name}</span>
                {file.dirty && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </span>

              <div className="flex items-center pr-2.5 pl-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                {isModified && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      void toggleDiffMode(file.path)
                    }}
                    className={`mx-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      file.diffMode
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'text-muted-foreground/50 hover:bg-accent hover:text-foreground'
                    }`}
                    title="Toggle Diff View"
                  >
                    <GitCompare className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeFile(file.path)
                  }}
                  className="mx-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
                  title="Close"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )
        })}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: ReactElement[]
}): ReactElement {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 border-r border-border/20 px-3.5 text-xs font-bold transition-all ${
        active
          ? 'bg-card border-b-2 border-b-primary text-primary'
          : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground border-b border-b-transparent'
      }`}
      title={title}
    >
      {children}
    </button>
  )
}
