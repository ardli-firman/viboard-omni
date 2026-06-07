import { useState } from 'react'
import { Plus, Folder, Trash2, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { ScrollArea } from '../ui/scroll-area'
import { useProjectStore } from '../../stores/projectStore'

function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? p
}

export function Sidebar(): React.ReactElement {
  const {
    projects,
    currentProject,
    openProject,
    addProject,
    removeProject,
    closeProject,
    loading,
  } = useProjectStore()
  const [collapsed, setCollapsed] = useState(false)

  // Modern icon button styles (SaaS rounded)
  const iconBtn =
    'inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'

  return (
    <aside
      className={`z-30 flex shrink-0 flex-col border-r border-border/30 bg-background/30 backdrop-blur-xl transition-[width] duration-300 ease-in-out ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header: Label + Collapse toggle */}
      <div
        className={`flex h-12 items-center border-b border-border/20 ${
          collapsed ? 'justify-center' : 'pl-4 pr-2 justify-between'
        }`}
      >
        {!collapsed && (
          <span className="select-none text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">
            Workspaces
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={iconBtn}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4.5 w-4.5" />
          ) : (
            <PanelLeftClose className="h-4.5 w-4.5" />
          )}
        </button>
      </div>

      {/* Project list */}
      <ScrollArea className="flex-1 px-2 py-3">
        <div
          className={`flex flex-col ${
            collapsed ? 'items-center gap-2' : 'gap-1'
          }`}
        >
          {projects.length === 0 && !collapsed && (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
              <Folder className="mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-[11px] leading-normal text-muted-foreground/85">
                No active workspaces.
                <br />
                Click below to add.
              </p>
            </div>
          )}
          {projects.length === 0 && collapsed && (
            <Folder className="h-5 w-5 text-muted-foreground/30" />
          )}
          {projects.map((p) => {
            const isCurrent = p.path === currentProject
            if (collapsed) {
              return (
                <button
                  key={p.path}
                  onClick={() => openProject(p.path)}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
                    isCurrent
                      ? 'bg-primary/15 text-primary border border-primary/20 shadow-xs scale-105'
                      : 'text-muted-foreground hover:bg-primary/10 hover:text-primary hover:scale-105'
                  }`}
                  title={p.name}
                >
                  <Folder className="h-4.5 w-4.5" />
                  {isCurrent && (
                    <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary" />
                  )}
                </button>
              )
            }
            return (
              <div
                key={p.path}
                className={`group relative flex items-center rounded-xl border border-transparent p-0.5 transition-all duration-200 ${
                  isCurrent
                    ? 'bg-primary/10 border-primary/20 text-primary shadow-xs'
                    : 'hover:bg-primary/5 hover:text-primary/90 text-muted-foreground/80'
                }`}
              >
                <button
                  onClick={() => openProject(p.path)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left"
                  title={p.path}
                >
                  <Folder className={`h-4 w-4 shrink-0 transition-colors ${
                    isCurrent ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-primary/80'
                  }`} />
                  <span className="truncate text-xs font-bold leading-none tracking-tight">
                    {basename(p.path)}
                  </span>
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeProject(p.path)
                  }}
                  className="mr-1 shrink-0 rounded-lg p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  title="Remove project"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div
        className={`flex items-center gap-2 border-t border-border/20 p-3 bg-background/20 ${
          collapsed ? 'flex-col justify-center' : ''
        }`}
      >
        <button
          onClick={addProject}
          disabled={loading}
          className={
            collapsed
              ? iconBtn
              : 'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3 text-xs font-bold text-primary transition-all hover:bg-primary/20 hover:scale-[1.02] active:scale-98 disabled:pointer-events-none disabled:opacity-50'
          }
          title="Add Project"
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span>Add Project</span>}
        </button>
        {currentProject && (
          <button
            onClick={closeProject}
            className={
              collapsed
                ? iconBtn
                : 'inline-flex h-9 items-center justify-center rounded-xl border border-border/30 bg-background/40 px-3 text-xs font-bold text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95'
            }
            title="Close Project"
          >
            <X className="h-4 w-4" />
            {!collapsed && <span>Close</span>}
          </button>
        )}
      </div>
    </aside>
  )
}
