import { useState } from 'react'
import type { Column, Task } from '@shared/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Plus, Trash2, GripVertical, Pencil } from 'lucide-react'
import { KanbanCard } from './Card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import { Input } from '../ui/input'

interface ColumnProps {
  column: Column
  tasks: Task[]
  taskCount: number
  onAddTask: () => void
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  onOpenChat: (task: Task) => void
  onDeleteColumn: (columnId: string) => void
  onUpdateColumn: (id: string, data: { title?: string; color?: string }) => void
}

export function KanbanColumn({
  column,
  tasks,
  taskCount,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onOpenChat,
  onDeleteColumn,
  onUpdateColumn,
}: ColumnProps): React.ReactElement {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(column.title)

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

  function handleSaveTitle() {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== column.title) {
      onUpdateColumn(column.id, { title: trimmed })
    }
    setIsEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSaveTitle()
    } else if (e.key === 'Escape') {
      setEditTitle(column.title)
      setIsEditing(false)
    }
  }

  return (
    <div ref={setNodeRef} style={style} className="group/column flex w-80 h-[640px] shrink-0 flex-col gap-3.5 rounded-2xl border border-border/30 bg-card/25 p-3.5 shadow-xs transition-all duration-300 hover:bg-card/35 hover:shadow-sm">
      {/* Header: drag handle + title + count + delete */}
      <CardHeader className="flex flex-row items-center justify-between gap-2 p-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            className="cursor-grab touch-none text-muted-foreground/45 hover:text-primary transition-colors"
            {...attributes}
            {...listeners}
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          {isEditing ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleKeyDown}
              className="h-8 w-full min-w-0 bg-background/50 border-border/30 rounded-lg text-xs font-bold px-2 focus:ring-1 focus:ring-primary/40"
              autoFocus
            />
          ) : (
            <>
              <CardTitle
                className="truncate text-xs font-bold uppercase tracking-wider text-foreground/85 cursor-pointer hover:text-primary transition-colors select-none"
                onDoubleClick={() => setIsEditing(true)}
                title="Double-click to edit"
              >
                {column.title}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0 opacity-0 transition-opacity hover:bg-muted group-hover/column:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsEditing(true)
                }}
                title="Edit column title"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </>
          )}
          <span className="shrink-0 rounded-full border border-border/25 bg-background/40 px-2 py-0.5 text-[10px] font-bold text-muted-foreground/80">{taskCount}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground/40 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover/column:opacity-100"
          onClick={() => setConfirmOpen(true)}
          title="Delete column"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>

      {/* Tasks area */}
      <div
        className={`flex-1 overflow-y-auto pr-1 flex flex-col gap-3 rounded-xl bg-transparent transition-all ${
          isOver ? 'bg-primary/5 ring-1 ring-primary/20 p-1' : ''
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onEdit={() => onEditTask(task)}
              onDelete={() => onDeleteTask(task.id)}
              onOpenChat={() => onOpenChat(task)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex min-h-[6rem] items-center justify-center rounded-xl border border-dashed border-border/40 bg-background/10 text-xs font-bold text-muted-foreground/45 transition-all duration-300 hover:border-primary/25 hover:text-primary/75 hover:bg-primary/5">
            Drop tasks here
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-1 justify-start gap-2 rounded-xl text-xs font-bold text-muted-foreground/85 transition-all hover:bg-primary/10 hover:text-primary active:scale-95"
        onClick={onAddTask}
      >
        <Plus className="h-4 w-4" />
        <span>Add task</span>
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
