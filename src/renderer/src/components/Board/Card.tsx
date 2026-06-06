import type { Task, AgentStatus } from '@shared/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Pencil, Trash2 } from 'lucide-react'

interface KanbanCardProps {
  task: Task
  onEdit: () => void
  onDelete: () => void
  onOpenChat: () => void
}

const statusColors: Record<AgentStatus, string> = {
  idle: 'bg-muted text-muted-foreground',
  running: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  completed: 'bg-green-500/10 text-green-500 border-green-500/20',
  error: 'bg-red-500/10 text-red-500 border-red-500/20',
}



export function KanbanCard({ task, onEdit, onDelete, onOpenChat }: KanbanCardProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task' as const },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`group/card cursor-grab rounded-xl border border-border/40 bg-background/80 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md active:cursor-grabbing ${isDragging ? 'opacity-50 ring-2 ring-primary/50' : ''}`}
      {...attributes}
      {...listeners}
      onClick={() => {
        // Prevent opening chat if they drag the card but accidentally trigger a click.
        // dnd-kit usually prevents default click, but just to be safe.
        if (!isDragging) {
          onOpenChat()
        }
      }}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-sm font-semibold leading-tight text-foreground">{task.title}</h4>
          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onEdit() }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onDelete() }}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
        {task.description && (
          <p className="line-clamp-2 text-xs font-medium text-muted-foreground/80">{task.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Badge variant="secondary" className="rounded-full bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground hover:bg-secondary/70">pi-agent</Badge>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${statusColors[task.agentStatus] ?? statusColors.idle}`}>
            {task.agentStatus}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
