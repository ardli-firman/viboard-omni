import { useState } from 'react'
import type { Column, Task } from '@shared/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { KanbanCard } from './Card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'

interface ColumnProps {
  column: Column
  tasks: Task[]
  taskCount: number
  onAddTask: () => void
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  onOpenTerminal: (task: Task) => void
  onDeleteColumn: (columnId: string) => void
}

export function KanbanColumn({
  column,
  tasks,
  taskCount,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onOpenTerminal,
  onDeleteColumn,
}: ColumnProps): React.ReactElement {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const {
    setNodeRef,
    isOver,
    attributes,
    listeners,
    transform,
    transition,
  } = useSortable({ id: column.id, data: { type: 'column' as const } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="group/column flex w-80 shrink-0 flex-col gap-3 rounded-2xl border border-border/40 bg-background/30 p-2 shadow-sm backdrop-blur-md transition-colors hover:bg-background/40">
      {/* Header: drag handle + title + count + delete */}
      <CardHeader className="flex flex-row items-center justify-between gap-1 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <button
            className="cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground"
            {...attributes}
            {...listeners}
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <CardTitle className="truncate text-sm font-medium">{column.title}</CardTitle>
          <span className="shrink-0 text-xs text-muted-foreground">{taskCount}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover/column:opacity-100"
          onClick={() => setConfirmOpen(true)}
          title="Delete column"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>

      {/* Tasks area */}
      <div
        className={`flex flex-col gap-2 rounded-xl bg-transparent transition-colors ${
          isOver ? 'bg-primary/5 ring-2 ring-primary/20' : ''
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onEdit={() => onEditTask(task)}
              onDelete={() => onDeleteTask(task.id)}
              onOpenTerminal={() => onOpenTerminal(task)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex min-h-[5rem] items-center justify-center rounded-xl border border-dashed border-border/60 text-sm font-medium text-muted-foreground/60 transition-colors hover:border-primary/30 hover:text-primary/60">
            Drop tasks here
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-1 justify-start gap-2 rounded-xl text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary"
        onClick={onAddTask}
      >
        <Plus className="h-4 w-4" />
        <span className="font-medium">Add task</span>
      </Button>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{column.title}&rdquo;?</DialogTitle>
            <DialogDescription>
              This column contains <strong>{taskCount} task{taskCount !== 1 ? 's' : ''}</strong>.
              Deleting it will also permanently remove all tasks inside it.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false)
                onDeleteColumn(column.id)
              }}
            >
              Delete Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
