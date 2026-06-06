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

  // Icon button styles (reused)
  const iconBtn =
    'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'

  return (
    <aside
      className={`flex shrink-0 flex-col border-r bg-muted/20 transition-[width] duration-200 ease-out ${
        collapsed ? 'w-12' : 'w-56'
      }`}
    >
      {/* Header: just label + collapse control */}
      <div
        className={`flex h-10 items-center border-b ${
          collapsed ? 'justify-center' : 'pl-3 pr-1.5 justify-between'
        }`}
      >
        {!collapsed && (
          <span className="select-none text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Projects
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={iconBtn}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Project list */}
      <ScrollArea className="flex-1">
        <div
          className={`flex flex-col p-1.5 ${
            collapsed ? 'items-center gap-1' : 'gap-0.5'
          }`}
        >
          {projects.length === 0 && !collapsed && (
            <p className="px-2 py-6 text-center text-[12px] leading-snug text-muted-foreground">
              No projects yet.
              <br />
              Use + below to add one.
            </p>
          )}
          {projects.length === 0 && collapsed && (
            <Folder className="h-4 w-4 text-muted-foreground/40" />
          )}
          {projects.map((p) => {
            const isCurrent = p.path === currentProject
            if (collapsed) {
              return (
                <button
                  key={p.path}
                  onClick={() => openProject(p.path)}
                  className={`relative flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                    isCurrent
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                  }`}
                  title={p.name}
                >
                  <Folder className="h-4 w-4" />
                  {isCurrent && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary" />
                  )}
                </button>
              )
            }
            return (
              <div
                key={p.path}
                className={`group flex items-center gap-0.5 rounded-md pr-1 transition-colors ${
                  isCurrent
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                }`}
              >
                <button
                  onClick={() => openProject(p.path)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                  title={p.path}
                >
                  <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-[13px] leading-tight">
                    {basename(p.path)}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeProject(p.path)
                  }}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  title="Remove project"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      </ScrollArea>

      {/* Footer: add + close actions in a single clean row */}
      <div
        className={`flex items-center gap-1 border-t p-1.5 ${
          collapsed ? 'flex-col justify-center' : ''
        }`}
      >
        <button
          onClick={addProject}
          disabled={loading}
          className={
            collapsed
              ? iconBtn
              : 'inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50'
          }
          title="Add Project"
        >
          <Plus className="h-3.5 w-3.5" />
          {!collapsed && <span>Add</span>}
        </button>
        {currentProject && (
          <button
            onClick={closeProject}
            className={
              collapsed
                ? iconBtn
                : 'inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
            }
            title="Close Project"
          >
            <X className="h-3.5 w-3.5" />
            {!collapsed && <span>Close</span>}
          </button>
        )}
      </div>
    </aside>
  )
}
