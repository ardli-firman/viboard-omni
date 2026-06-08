import { useState } from 'react'
import type { Task, AgentStatus, AgentActivity, AgentType } from '@shared/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Pencil, Trash2, Calendar, Clock, CheckSquare, ChevronDown, ChevronUp, MoreVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu'
import { useTerminalStore } from '../../stores/terminalStore'
import { useProjectStore } from '../../stores/projectStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

const AGENT_DISPLAY: Record<AgentType, { label: string; icon: string }> = {
  'oh-my-pi': { label: 'Oh My Pi', icon: '🤖' },
  'gemini-cli': { label: 'Gemini', icon: '✨' },
  'pi-agent': { label: 'Pi Agent', icon: '🥧' },
  'hermes': { label: 'Hermes', icon: '🪄' },
  'opencode': { label: 'OpenCode', icon: '🖥️' },
  'custom': { label: 'Custom', icon: '⚙️' },
}

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

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(months / 12)
  return `${years}y ago`
}

export function KanbanCard({ task, onEdit, onDelete, onOpenChat }: KanbanCardProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task' as const },
  })

  const realStatus = useTerminalStore((s) => s.status[task.id]) ?? task.agentStatus
  const realActivity = useTerminalStore((s) => s.activity[task.id]) ?? 'waiting'
  const display = getCardStatusDisplay(realStatus, realActivity)

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`viboard_task_collapsed_${task.id}`)
      return saved ? JSON.parse(saved) : true
    } catch {
      return true
    }
  })

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(`viboard_task_collapsed_${task.id}`, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Generate deterministic dummy data based on task id
  const charCodeSum = Array.from(task.id).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const { tags: projectTags } = useProjectStore()

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
      className={`group/card relative cursor-grab rounded-2xl border border-border/40 bg-card p-0 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_8px_30px_rgb(60,110,71,0.08)] active:cursor-grabbing ${
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
      <CardContent className="space-y-3.5 p-4">
        {/* Row 1: Title & Actions */}
        <div className="flex items-start justify-between gap-3 min-h-6">
          <div className="flex-1 flex items-start gap-2 min-w-0">
            {/* Status indicator vertical stripe */}
            {display.lineClass && (
              <div 
                className={`w-1 h-5 shrink-0 rounded-full ${display.lineClass} mt-0.5`} 
                title={`Agent status: ${display.label}`}
              />
            )}
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <h4 className="text-sm font-bold leading-snug tracking-tight text-foreground transition-colors group-hover/card:text-primary">
                {task.title}
              </h4>
              {/* Compact running agent status display when collapsed */}
              {isCollapsed && realStatus !== 'idle' && (
                <div className="flex items-center">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border/30 bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground/80 shadow-xs select-none">
                    <span className="text-[10px] leading-none">{AGENT_DISPLAY[task.agentType]?.icon ?? '🤖'}</span>
                    <span>{AGENT_DISPLAY[task.agentType]?.label ?? task.agentType}</span>
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      {realStatus === 'running' && (
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          realActivity === 'thinking' ? 'bg-indigo-400' :
                          realActivity === 'tool_use' ? 'bg-purple-400' :
                          realActivity === 'responding' ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}></span>
                      )}
                      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                        realStatus === 'completed' ? 'bg-emerald-500' :
                        realStatus === 'error' ? 'bg-destructive' :
                        realActivity === 'thinking' ? 'bg-indigo-500' :
                        realActivity === 'tool_use' ? 'bg-purple-500' :
                        realActivity === 'responding' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}></span>
                    </span>
                    {realStatus === 'running' && (
                      <span className="text-[8px] text-muted-foreground/60 lowercase font-medium">
                        ({realActivity === 'tool_use' ? 'tool' : realActivity})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-1 items-center">
            {/* Collapse toggle button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-md text-muted-foreground/60 hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={toggleCollapse}
              title={isCollapsed ? "Expand Task" : "Collapse Task"}
            >
              {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </Button>

            {/* Actions Dropdown Button (3-dots vertical) */}
            <div className="opacity-0 transition-opacity duration-200 group-hover/card:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-md text-muted-foreground/60 hover:bg-accent hover:text-accent-foreground"
                    onClick={(e) => e.stopPropagation()}
                    title="Task Actions"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border border-border shadow-md rounded-xl p-1">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit()
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-foreground cursor-pointer rounded-lg hover:bg-muted"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Edit Task</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete()
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 cursor-pointer rounded-lg"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete Task</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {!isCollapsed && (
          <>

        {/* Row 2: Description */}
        {task.description && (
          <p className="line-clamp-2 text-[12px] font-medium leading-relaxed text-muted-foreground/85">
            {task.description}
          </p>
        )}

        {/* Row 3: Tags Display (rendered conditionally only when tags exist) */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {task.tags.map((tagId) => {
              const tag = projectTags.find((t) => t.id === tagId)
              if (!tag) return null
              return (
                <span
                  key={tag.id}
                  style={{
                    backgroundColor: `${tag.color}15`,
                    color: tag.color,
                    borderColor: `${tag.color}35`,
                  }}
                  className="inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase transition-colors duration-200 shadow-xs"
                >
                  <span
                    className="h-1 w-1 rounded-full mr-1.5"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </span>
              )
            })}
          </div>
        )}

        {/* Timestamps: created & updated */}
        <div className="flex items-center gap-3 text-[10px] font-medium text-muted-foreground/70">
          <span className="flex items-center gap-1" title={`Created: ${new Date(task.createdAt).toLocaleString()}`}>
            <Clock className="h-3 w-3" />
            <span>Created {formatRelativeTime(task.createdAt)}</span>
          </span>
          <span className="flex items-center gap-1" title={`Updated: ${new Date(task.updatedAt).toLocaleString()}`}>
            <Clock className="h-3 w-3" />
            <span>Updated {formatRelativeTime(task.updatedAt)}</span>
          </span>
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

          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {task.agentType && (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <span 
                    className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase text-muted-foreground/80 shadow-xs cursor-help select-none"
                  >
                    <span className="mr-1 text-[11px] leading-none">{AGENT_DISPLAY[task.agentType]?.icon ?? '🤖'}</span>
                    <span className={realStatus !== 'idle' ? 'mr-1.5' : ''}>{AGENT_DISPLAY[task.agentType]?.label ?? task.agentType}</span>
                    
                    {/* Status Dot inside Agent badge */}
                    {realStatus !== 'idle' && (
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        {realStatus === 'running' && (
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            realActivity === 'thinking' ? 'bg-indigo-400' :
                            realActivity === 'tool_use' ? 'bg-purple-400' :
                            realActivity === 'responding' ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}></span>
                        )}
                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                          realStatus === 'completed' ? 'bg-emerald-500' :
                          realStatus === 'error' ? 'bg-destructive' :
                          realActivity === 'thinking' ? 'bg-indigo-500' :
                          realActivity === 'tool_use' ? 'bg-purple-500' :
                          realActivity === 'responding' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}></span>
                      </span>
                    )}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-popover text-popover-foreground border border-border shadow-md px-3 py-2 rounded-xl backdrop-blur-md">
                  <div className="flex flex-col gap-1 text-[11px] font-medium leading-none">
                    <div className="font-bold flex items-center gap-1.5">
                      <span className="text-xs">{AGENT_DISPLAY[task.agentType]?.icon ?? '🤖'}</span>
                      <span>{AGENT_DISPLAY[task.agentType]?.label ?? task.agentType} Agent</span>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1.5 mt-0.5 capitalize">
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        realStatus === 'completed' ? 'bg-emerald-500' :
                        realStatus === 'error' ? 'bg-destructive' :
                        realStatus === 'idle' ? 'bg-slate-400' :
                        realActivity === 'thinking' ? 'bg-indigo-500' :
                        realActivity === 'tool_use' ? 'bg-purple-500' :
                        realActivity === 'responding' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`} />
                      <span>Status: {realStatus === 'running' ? `${realStatus} (${realActivity === 'tool_use' ? 'running tool' : realActivity})` : realStatus}</span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        </>
        )}
      </CardContent>
    </Card>
  )
}
