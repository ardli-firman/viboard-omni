import { type ReactElement } from 'react'
import { ChevronDown, ChevronRight, FilePlus, FolderPlus, RotateCw } from 'lucide-react'
import { useFileExplorerStore, type FileTreeItem } from '../../stores/fileExplorerStore'
import { getFileIcon, getFileIconColor } from '../../lib/fileIcons'
import { useProjectStore } from '../../stores/projectStore'
import { basename } from '../../lib/pathUtils'

function TreeNode({ item, depth }: { item: FileTreeItem; depth: number }): ReactElement {
  const expandedPaths = useFileExplorerStore((s) => s.expandedPaths)
  const activeFilePath = useFileExplorerStore((s) => s.activeFilePath)
  const openFiles = useFileExplorerStore((s) => s.openFiles)
  const toggleExpand = useFileExplorerStore((s) => s.toggleExpand)
  const openFile = useFileExplorerStore((s) => s.openFile)
  const gitStatus = useFileExplorerStore((s) => s.gitStatus)

  const isExpanded = expandedPaths.has(item.path)
  const isActive = activeFilePath === item.path
  const isOpen = openFiles.some((f) => f.path === item.path)
  
  const status = gitStatus[item.relativePath]
  const isModified = status?.includes('M')
  const isAdded = status?.includes('A') || status?.includes('?')

  const Icon = getFileIcon(item.name, item.extension, item.isDirectory, isExpanded)
  const iconColor = item.isDirectory ? 'text-sky-400' : getFileIconColor(item.extension)
  const textColor = isActive
    ? 'text-primary'
    : isModified
      ? 'text-amber-600 dark:text-amber-400'
      : isAdded
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-muted-foreground/80'

  // Indent: each level = 14px (icon column at fixed offset, name follows)
  const baseIndent = 18
  const indentPerLevel = 14
  const nameLeft = baseIndent + depth * indentPerLevel
  const chevronLeft = nameLeft - 14

  function handleClick(): void {
    if (item.isDirectory) {
      toggleExpand(item.path)
    } else {
      void openFile(item.path, item.name, item.relativePath)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={`group relative flex h-7.5 w-full items-center pr-3 text-left text-xs transition-all ${textColor} ${
          isActive
            ? 'bg-primary/10 border-r-2 border-primary font-bold'
            : 'hover:bg-primary/5 hover:text-foreground font-medium'
        }`}
        style={{ paddingLeft: nameLeft }}
        title={item.relativePath}
      >
        {/* Chevron for directories */}
        {item.isDirectory && (
          <span
            className="absolute inline-flex h-7.5 w-[14px] items-center justify-center text-muted-foreground/50 group-hover:text-primary transition-colors"
            style={{ left: chevronLeft }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        )}
        <Icon className={`h-4 w-4 shrink-0 ${iconColor} transition-transform group-hover:scale-110`} />
        <span className="ml-2 truncate">{item.name}</span>
        {status && !item.isDirectory && (
          <span className={`ml-auto text-[9px] font-extrabold px-1 rounded-sm ${isModified ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
            {isModified ? 'M' : isAdded ? 'A' : ''}
          </span>
        )}
        {isOpen && !item.isDirectory && !status && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary/60" />
        )}
      </button>
      {item.isDirectory && isExpanded && item.children && (
        <div className="mt-0.5">
          {item.children.map((child) => (
            <TreeNode key={child.path} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function TreeHeader(): ReactElement {
  const rootPath = useFileExplorerStore((s) => s.rootPath)
  const loadTree = useFileExplorerStore((s) => s.loadTree)
  const collapseAll = () => {
    const state = useFileExplorerStore.getState()
    useFileExplorerStore.setState({ expandedPaths: new Set() })
    void state
  }

  const iconH =
    'inline-flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground/60 transition-all hover:bg-primary/10 hover:text-primary active:scale-90 opacity-0 group-hover:opacity-100'

  if (!rootPath) return <></>

  return (
    <div className="group flex h-8 items-center justify-between border-b border-border/10 bg-background/10 px-3 py-1">
      <span className="select-none truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
        {basename(rootPath)}
      </span>
      <div className="flex items-center gap-0.5">
        <button onClick={collapseAll} className={iconH} title="Collapse Folders">
          <span className="text-xs leading-none font-bold">⋯</span>
        </button>
        <button onClick={() => void loadTree(rootPath)} className={iconH} title="Refresh">
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button className={iconH} title="New File">
          <FilePlus className="h-3.5 w-3.5" />
        </button>
        <button className={iconH} title="New Folder">
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function FileTree(): ReactElement {
  const tree = useFileExplorerStore((s) => s.tree)
  const treeLoading = useFileExplorerStore((s) => s.treeLoading)
  const treeError = useFileExplorerStore((s) => s.treeError)
  const rootPath = useFileExplorerStore((s) => s.rootPath)
  const currentProject = useProjectStore((s) => s.currentProject)

  return (
    <div className="flex h-full flex-col">
      <TreeHeader />
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {treeLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        {treeError && <p className="px-3 py-2 text-xs text-destructive">{treeError}</p>}
        {!treeLoading && !treeError && tree.length === 0 && (
          <p className="px-4 py-6 text-center text-[12px] leading-snug text-muted-foreground">
            {rootPath || currentProject
              ? 'No files found in project'
              : 'Open a project to browse files'}
          </p>
        )}
        {!treeLoading && tree.map((item) => <TreeNode key={item.path} item={item} depth={0} />)}
      </div>
    </div>
  )
}
