import { useState } from 'react'
import { Plus, Folder, Trash2, X, PanelLeftClose, PanelLeftOpen, GripVertical, Loader2 } from 'lucide-react'
import { ScrollArea } from '../ui/scroll-area'
import { useProjectStore } from '../../stores/projectStore'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'
import type { RegisteredProject } from '@shared/types'

function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? p
}

function SortableProjectItem({
  p,
  isCurrent,
  isLoading,
  isAnyLoading,
  onOpen,
  onRemove,
}: {
  p: RegisteredProject
  isCurrent: boolean
  isLoading: boolean
  isAnyLoading: boolean
  onOpen: () => void
  onRemove: () => void
}): React.ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: p.path })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center rounded-xl border border-transparent p-0.5 transition-all duration-200 ${
        isCurrent
          ? 'bg-primary/10 border-primary/20 text-primary shadow-xs'
          : 'hover:bg-primary/5 hover:text-primary/90 text-muted-foreground/80'
      } ${isDragging ? 'opacity-50 border-dashed border-primary/40 bg-primary/5 shadow-md scale-[1.01]' : ''}`}
    >
      {/* Drag Grip Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing shrink-0 px-1.5 py-2 text-muted-foreground/45 hover:text-primary transition-colors rounded-lg"
        title="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <button
        onClick={isAnyLoading ? undefined : onOpen}
        disabled={isAnyLoading}
        className={`flex min-w-0 flex-1 items-center gap-2 px-1 py-2 text-left ${
          isAnyLoading && !isCurrent ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        title={p.path}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        ) : (
          <Folder
            className={`h-4 w-4 shrink-0 transition-colors ${
              isCurrent ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-primary/80'
            }`}
          />
        )}
        <span className="truncate text-xs font-bold leading-none tracking-tight">
          {basename(p.path)}
        </span>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        disabled={isAnyLoading}
        className="mr-1 shrink-0 rounded-lg p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 disabled:pointer-events-none"
        title="Remove project"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function Sidebar(): React.ReactElement {
  const {
    projects,
    currentProject,
    openProject,
    addProject,
    removeProject,
    closeProject,
    reorderProjects,
    loading,
  } = useProjectStore()
  const [collapsed, setCollapsed] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<RegisteredProject | null>(null)
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)

  const handleOpenProject = async (path: string): Promise<void> => {
    setSwitchingTo(path)
    // Yield to the event loop so React can render and paint the spinner instantly
    await new Promise((resolve) => setTimeout(resolve, 80))
    try {
      await openProject(path)
    } finally {
      setSwitchingTo(null)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = projects.findIndex((p) => p.path === active.id)
    const newIndex = projects.findIndex((p) => p.path === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = [...projects]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved)
      reorderProjects(reordered.map((p) => p.path))
    }
  }

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

          {collapsed ? (
            // Collapsed mode: simple list without DND support
            projects.map((p) => {
              const isCurrent = p.path === currentProject
              const isLoading = p.path === switchingTo || (isCurrent && loading)
              const isAnyLoading = loading || !!switchingTo
              return (
                <button
                  key={p.path}
                  disabled={isAnyLoading && !isCurrent}
                  onClick={() => handleOpenProject(p.path)}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
                    isCurrent
                      ? 'bg-primary/15 text-primary border border-primary/20 shadow-xs scale-105'
                      : 'text-muted-foreground hover:bg-primary/10 hover:text-primary hover:scale-105'
                  } ${isAnyLoading && !isCurrent ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={p.name}
                >
                  {isLoading ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin text-primary" />
                  ) : (
                    <Folder className="h-4.5 w-4.5" />
                  )}
                  {isCurrent && !isLoading && (
                    <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary" />
                  )}
                </button>
              )
            })
          ) : (
            // Expanded mode: vertical DND list
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={projects.map((p) => p.path)}
                strategy={verticalListSortingStrategy}
              >
                {projects.map((p) => {
                  const isCurrent = p.path === currentProject
                  const isLoading = p.path === switchingTo || (isCurrent && loading)
                  const isAnyLoading = loading || !!switchingTo
                  return (
                    <SortableProjectItem
                      key={p.path}
                      p={p}
                      isCurrent={isCurrent}
                      isLoading={isLoading}
                      isAnyLoading={isAnyLoading}
                      onOpen={() => handleOpenProject(p.path)}
                      onRemove={() => setProjectToDelete(p)}
                    />
                  )
                })}
              </SortableContext>
            </DndContext>
          )}
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
            disabled={loading}
            className={
              collapsed
                ? iconBtn
                : 'inline-flex h-9 items-center justify-center rounded-xl border border-border/30 bg-background/40 px-3 text-xs font-bold text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95 disabled:pointer-events-none disabled:opacity-50'
            }
            title="Close Project"
          >
            <X className="h-4 w-4" />
            {!collapsed && <span>Close</span>}
          </button>
        )}
      </div>

      {/* Confirmation Dialog for Project Deletion */}
      <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Remove Workspace</DialogTitle>
            <DialogDescription className="pt-2 text-xs leading-normal">
              Are you sure you want to remove <span className="font-bold text-foreground">"{projectToDelete?.name}"</span> from your workspaces?
              <br />
              This will not delete the project files on your disk, it will only remove it from Viboard's workspace list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setProjectToDelete(null)}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (projectToDelete) {
                  await removeProject(projectToDelete.path)
                  setProjectToDelete(null)
                }
              }}
              className="rounded-xl text-xs font-bold"
            >
              Remove Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
