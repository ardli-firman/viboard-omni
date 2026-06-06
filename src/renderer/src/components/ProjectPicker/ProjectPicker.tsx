import { Plus, FolderOpen, Trash2, Folder } from 'lucide-react'
import { Button } from '../ui/button'
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
    <button
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
    >
      <Folder className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{project.name}</span>
        <span className="truncate text-xs text-muted-foreground" title={project.path}>
          {project.path}
        </span>
      </div>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {formatDate(project.lastOpenedAt)}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        title="Remove project"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </button>
  )
}

export function ProjectPicker(): React.ReactElement {
  const { projects, addProject, removeProject, openProject, loading } = useProjectStore()

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex rounded-full bg-muted p-3">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Viboard Omni</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a project or add a new one to get started.
          </p>
        </div>

        {projects.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Recent Projects
            </p>
            <div className="space-y-1.5">
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
        )}

        <Button size="lg" onClick={addProject} disabled={loading} className="w-full">
          <Plus className="mr-2 h-5 w-5" />
          {loading ? 'Adding...' : 'Add Project'}
        </Button>
      </div>
    </div>
  )
}
