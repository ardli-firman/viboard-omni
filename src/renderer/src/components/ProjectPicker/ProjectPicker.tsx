import { Plus, FolderOpen, Trash2, Folder, Terminal, Sliders, Cpu } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import type { RegisteredProject } from '@shared/types'

function formatDate(ts: number): string {
  const ago = Date.now() - ts
  const mins = Math.floor(ago / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function ProjectRow({
  project,
  onOpen,
  onRemove,
}: {
  project: RegisteredProject
  onOpen: () => void
  onRemove: () => void
}): React.ReactElement {
  return (
    <div
      onClick={onOpen}
      className="group flex w-full items-center gap-4.5 rounded-2xl border border-border/25 bg-card/30 px-5 py-4 text-left cursor-pointer transition-all duration-300 hover:bg-card/60 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 transition-transform group-hover:scale-105">
        <Folder className="h-5 w-5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-bold text-foreground group-hover:text-primary transition-colors">{project.name}</span>
        <span className="truncate text-xs text-muted-foreground/85 font-medium" title={project.path}>
          {project.path}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[11px] font-bold text-muted-foreground/70 bg-background/50 border border-border/10 rounded-full px-2.5 py-0.5">
          {formatDate(project.lastOpenedAt)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="rounded-lg p-1.5 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          title="Remove project"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function ProjectPicker(): React.ReactElement {
  const { projects, addProject, removeProject, openProject, loading } = useProjectStore()

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-12 bg-transparent overflow-y-auto">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        
        {/* Welcome Section */}
        <div className="text-center space-y-3">
          <div className="relative mx-auto mb-2 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-xs">
            <FolderOpen className="h-8 w-8" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight">
            <span className="text-primary">
              Welcome to Viboard
            </span>
          </h2>
          <p className="mx-auto max-w-md text-sm font-medium text-muted-foreground/90 leading-relaxed">
            Your agent-integrated development Kanban board. Select a registered workspace below or import a new project folder to start editing.
          </p>
        </div>

        {/* Dummy Metrics / Features Section */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1 items-center p-3 rounded-2xl border border-border/15 bg-card/25 text-center">
            <Terminal className="h-4.5 w-4.5 text-primary mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/75">Agent CLI</span>
            <span className="text-xs font-bold text-foreground/90">Integrated</span>
          </div>
          <div className="flex flex-col gap-1 items-center p-3 rounded-2xl border border-border/15 bg-card/25 text-center">
            <Cpu className="h-4.5 w-4.5 text-primary mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/75">Monaco Editor</span>
            <span className="text-xs font-bold text-foreground/90">Matcha theme</span>
          </div>
          <div className="flex flex-col gap-1 items-center p-3 rounded-2xl border border-border/15 bg-card/25 text-center">
            <Sliders className="h-4.5 w-4.5 text-primary mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/75">Total Projects</span>
            <span className="text-xs font-bold text-foreground/90">{projects.length} connected</span>
          </div>
        </div>

        {/* Workspace Card Container */}
        <div className="space-y-4 rounded-3xl border border-border/25 bg-card/30 p-6 shadow-sm backdrop-blur-xl">
          
          {/* Section: Recent Workspaces */}
          {projects.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground/80">
                Recent Workspaces
              </h3>
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {projects.map((p) => (
                  <ProjectRow
                    key={p.path}
                    project={p}
                    onOpen={() => openProject(p.path)}
                    onRemove={() => removeProject(p.path)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-border/40 rounded-2xl bg-background/10">
              <Folder className="h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-semibold text-muted-foreground">No projects configured yet</p>
              <p className="text-xs text-muted-foreground/70 max-w-[280px] mt-1 leading-normal">
                Click the button below to register a local directory on your device.
              </p>
            </div>
          )}

          {/* Action: Add Project Area */}
          <div className="pt-2">
            <button 
              onClick={addProject} 
              disabled={loading} 
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-primary/20 bg-primary/10 hover:bg-primary/15 px-6 py-5 text-sm font-bold text-primary transition-all hover:scale-[1.01] hover:shadow-xs active:scale-99 disabled:pointer-events-none disabled:opacity-50"
            >
              <Plus className="h-5 w-5" />
              <span>{loading ? 'Opening System Picker...' : 'Register New Project Folder'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
