import type { Column, Task } from '@shared/types'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Plus } from 'lucide-react'
import { KanbanCard } from './Card'

interface ColumnProps {
  column: Column
  tasks: Task[]
  onAddTask: () => void
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  onOpenTerminal: (task: Task) => void
}

export function KanbanColumn({ column, tasks, onAddTask, onEditTask, onDeleteTask, onOpenTerminal }: ColumnProps): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3">
      <CardHeader className="flex flex-row items-center justify-between px-4 py-3">
        <CardTitle className="text-sm font-medium">{column.title}</CardTitle>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </CardHeader>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 rounded-lg bg-muted/30 p-2 transition-colors ${isOver ? 'bg-accent/30' : ''}`}
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
          <div className="flex min-h-[4rem] items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
            Drop tasks here
          </div>
        )}
      </div>
      <Button variant="ghost" size="sm" className="justify-start gap-1 text-muted-foreground" onClick={onAddTask}>
        <Plus className="h-3.5 w-3.5" />
        Add task
      </Button>
    </div>
  )
}
