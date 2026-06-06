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

  const isExpanded = expandedPaths.has(item.path)
  const isActive = activeFilePath === item.path
  const isOpen = openFiles.some((f) => f.path === item.path)
  const Icon = getFileIcon(item.name, item.extension, item.isDirectory, isExpanded)
  const iconColor = item.isDirectory ? 'text-sky-400' : getFileIconColor(item.extension)

  // Indent: each level = 14px (icon column at fixed offset, name follows)
  const baseIndent = 8
  const indentPerLevel = 14
  const nameLeft = baseIndent + depth * indentPerLevel
  const chevronLeft = depth === 0 ? 0 : nameLeft - 14

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
        className={`group relative flex h-[22px] w-full items-center pr-2 text-left text-[13px] leading-[22px] transition-colors ${
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-foreground hover:bg-accent/50'
        }`}
        style={{ paddingLeft: nameLeft }}
        title={item.relativePath}
      >
        {/* Chevron for directories */}
        {item.isDirectory && (
          <span
            className="absolute inline-flex h-[22px] w-[14px] items-center justify-center text-muted-foreground/70"
            style={{ left: chevronLeft }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        )}
        <Icon className={`h-[15px] w-[15px] shrink-0 ${iconColor}`} />
        <span className="ml-1.5 truncate">{item.name}</span>
        {isOpen && !item.isDirectory && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary/70" />
        )}
      </button>
      {item.isDirectory && isExpanded && item.children && (
        <div>
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
    // Collapse all by clearing expanded paths then re-adding root
    const state = useFileExplorerStore.getState()
    useFileExplorerStore.setState({ expandedPaths: new Set() })
    // Re-trigger a no-op to ensure subscribers update
    void state
  }

  const iconH =
    'inline-flex h-[20px] w-[20px] items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground opacity-0 group-hover:opacity-100'

  if (!rootPath) return <></>

  return (
    <div className="group flex h-[26px] items-center justify-between px-1">
      <span className="select-none truncate px-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/80">
        {basename(rootPath)}
      </span>
      <div className="flex items-center gap-0">
        <button onClick={collapseAll} className={iconH} title="Collapse Folders">
          <span className="text-[14px] leading-none">⋯</span>
        </button>
        <button onClick={() => void loadTree(rootPath)} className={iconH} title="Refresh">
          <RotateCw className="h-[13px] w-[13px]" />
        </button>
        <button className={iconH} title="New File">
          <FilePlus className="h-[13px] w-[13px]" />
        </button>
        <button className={iconH} title="New Folder">
          <FolderPlus className="h-[13px] w-[13px]" />
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
