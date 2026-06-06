import { type ReactElement } from 'react'
import { X, FileText, FolderTree } from 'lucide-react'
import { useFileExplorerStore } from '../../stores/fileExplorerStore'

export function FileTabs(): ReactElement {
  const openFiles = useFileExplorerStore((s) => s.openFiles)
  const activeFilePath = useFileExplorerStore((s) => s.activeFilePath)
  const setActiveFile = useFileExplorerStore((s) => s.setActiveFile)
  const closeFile = useFileExplorerStore((s) => s.closeFile)

  const showExplorer = activeFilePath === null
  const showFileTabs = openFiles.length > 0

  return (
    <div className="flex h-[35px] items-stretch gap-0 overflow-x-auto border-b bg-muted/5">
      <TabButton
        active={showExplorer}
        onClick={() => setActiveFile(null)}
        title="File Explorer"
      >
        <FolderTree className="h-3.5 w-3.5 shrink-0" />
        <span>Explorer</span>
      </TabButton>

      {showFileTabs &&
        openFiles.map((file) => {
          const isActive = activeFilePath === file.path
          return (
            <div
              key={file.path}
              className={`group flex shrink-0 items-center border-r transition-colors cursor-pointer text-[13px] ${
                isActive
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
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
              <span className="ml-3 flex items-center gap-1.5 leading-[35px]">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                <span className="truncate max-w-[140px]">{file.name}</span>
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeFile(file.path)
                }}
                className="mx-1.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                title="Close"
              >
                <X className="h-3 w-3" />
              </button>
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
      className={`flex shrink-0 items-center gap-1.5 border-r px-3 text-[13px] transition-colors ${
        active
          ? 'bg-background text-foreground'
          : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
      }`}
      title={title}
    >
      {children}
    </button>
  )
}
