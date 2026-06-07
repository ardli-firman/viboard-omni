import type { Task, AgentStatus, AgentActivity } from '@shared/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Pencil, Trash2, Calendar, CheckSquare } from 'lucide-react'
import { useTerminalStore } from '../../stores/terminalStore'

interface KanbanCardProps {
  task: Task
  onEdit: () => void
  onDelete: () => void
  onOpenChat: () => void
}

interface StatusDisplay {
  label: string
  className: string
  lineClass: string | null
  ringClass: string | null
}

const getCardStatusDisplay = (status: AgentStatus, activity: AgentActivity): StatusDisplay => {
  if (status !== 'running') {
    switch (status) {
      case 'completed':
        return {
          label: 'completed',
          className: 'bg-primary/10 text-primary border-primary/30',
          lineClass: 'bg-primary',
          ringClass: 'ring-1 ring-primary/20',
        }
      case 'error':
        return {
          label: 'error',
          className: 'bg-destructive/10 text-destructive border-destructive/30',
          lineClass: 'bg-destructive',
          ringClass: 'ring-1 ring-destructive/20',
        }
      case 'idle':
      default:
        return {
          label: 'idle',
          className: 'bg-muted/60 text-muted-foreground border-muted-foreground/20',
          lineClass: null,
          ringClass: null,
        }
    }
  }

  // running status - map activity
  switch (activity) {
    case 'thinking':
      return {
        label: 'thinking',
        className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 animate-pulse',
        lineClass: 'bg-indigo-500 animate-pulse',
        ringClass: 'ring-1 ring-indigo-500/30',
      }
    case 'tool_use':
      return {
        label: 'running tool',
        className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 animate-pulse',
        lineClass: 'bg-purple-500 animate-pulse',
        ringClass: 'ring-1 ring-purple-500/30',
      }
    case 'responding':
      return {
        label: 'responding',
        className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 animate-pulse',
        lineClass: 'bg-emerald-500 animate-pulse',
        ringClass: 'ring-1 ring-emerald-500/30',
      }
    case 'waiting':
    default:
      return {
        label: 'waiting',
        className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
        lineClass: 'bg-amber-500',
        ringClass: 'ring-1 ring-amber-500/30',
      }
  }
}

export function KanbanCard({ task, onEdit, onDelete, onOpenChat }: KanbanCardProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task' as const },
  })

  const realStatus = useTerminalStore((s) => s.status[task.id]) ?? task.agentStatus
  const realActivity = useTerminalStore((s) => s.activity[task.id]) ?? 'waiting'
  const display = getCardStatusDisplay(realStatus, realActivity)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Generate deterministic dummy data based on task id
  const charCodeSum = Array.from(task.id).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  
  const priorities = [
    { label: 'Low', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/10' },
    { label: 'Medium', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/15' },
    { label: 'High', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' }
  ]
  const priority = priorities[charCodeSum % 3]

  const totalSubtasks = (charCodeSum % 5) + 2 // 2 to 6
  const doneSubtasks = charCodeSum % (totalSubtasks + 1)
  const progressPercent = Math.round((doneSubtasks / totalSubtasks) * 100)

  const assignees = [
    { name: 'Adit Pratama', initials: 'AP', color: 'bg-teal-600 text-teal-50' },
    { name: 'Budi Santoso', initials: 'BS', color: 'bg-emerald-600 text-emerald-50' },
    { name: 'Citra Lestari', initials: 'CL', color: 'bg-amber-600 text-amber-50' },
    { name: 'Diana Putri', initials: 'DP', color: 'bg-indigo-600 text-indigo-50' },
  ]
  const assignee = assignees[charCodeSum % 4]

  const dueDays = (charCodeSum % 7) + 2
  const dueDate = `June ${dueDays + 8}`

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`group/card relative cursor-grab overflow-hidden rounded-2xl border border-border/40 bg-card p-0 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_8px_30px_rgb(60,110,71,0.08)] active:cursor-grabbing ${
        isDragging ? 'ring-2 ring-primary/50 opacity-40 shadow-lg' : ''
      } ${display.ringClass ?? ''}`}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) {
          onOpenChat()
        }
      }}
    >
      {/* Decorative accent top line for running status */}
      {display.lineClass && (
        <div className={`absolute top-0 left-0 right-0 h-1 ${display.lineClass}`} />
      )}

      <CardContent className="space-y-4.5 p-4.5">
        {/* Row 1: Priority & Action Buttons */}
        <div className="flex items-center justify-between">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${priority.color}`}>
            {priority.label} Priority
          </span>
          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-md hover:bg-accent hover:text-accent-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              title="Edit Task"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-md hover:bg-destructive/10 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              title="Delete Task"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Row 2: Title & Description */}
        <div className="space-y-1.5">
          <h4 className="text-sm font-bold leading-snug tracking-tight text-foreground transition-colors group-hover/card:text-primary">
            {task.title}
          </h4>
          {task.description && (
            <p className="line-clamp-2 text-[12px] font-medium leading-relaxed text-muted-foreground/85">
              {task.description}
            </p>
          )}
        </div>

        {/* Row 3: Subtasks progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckSquare className="h-3.5 w-3.5 text-muted-foreground/80" />
              Tasks Progress
            </span>
            <span>{doneSubtasks}/{totalSubtasks} ({progressPercent}%)</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary/40 overflow-hidden">
            <div 
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-[1px] w-full bg-border/30" />

        {/* Row 4: Assignee, Due Date & Agent Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Assignee Avatar */}
            <div 
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-xs ${assignee.color}`}
              title={`Assigned to ${assignee.name}`}
            >
              {assignee.initials}
            </div>
            
            {/* Due Date */}
            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground" title="Due Date">
              <Calendar className="h-3 w-3 text-muted-foreground/75" />
              <span>{dueDate}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase shadow-xs ${display.className}`}>
              {display.label}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
