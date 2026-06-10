import { useState, useEffect, useRef } from 'react'
import type { Task, AgentStatus, AgentActivity, AgentType, Subtask } from '@shared/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Pencil, Trash2, Calendar, Clock, CheckSquare, ChevronDown, ChevronUp, MoreVertical, Plus, Check, GitBranch } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu'
import { useTerminalStore } from '../../stores/terminalStore'
import { useProjectStore } from '../../stores/projectStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { AgentIcon } from '../AgentIcon'

const AGENT_DISPLAY: Record<AgentType, { label: string; icon: string }> = {
  'oh-my-pi': { label: 'Oh My Pi', icon: '🤖' },
  'gemini-cli': { label: 'Gemini', icon: '✨' },
  'pi-agent': { label: 'Pi Agent', icon: '🥧' },
  'hermes': { label: 'Hermes', icon: '🪄' },
  'opencode': { label: 'OpenCode', icon: '🖥️' },
  'claude': { label: 'Claude', icon: '🧠' },
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

interface SubtaskItemProps {
  subtask: Subtask
  onToggle: () => void
  onUpdate: (title: string) => void
  onDelete: () => void
}

function SubtaskItem({ subtask, onToggle, onUpdate, onDelete }: SubtaskItemProps): React.ReactElement {
  const [title, setTitle] = useState(subtask.title)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync state with prop updates
  useEffect(() => {
    setTitle(subtask.title)
  }, [subtask.title])

  // Auto-adjust height based on content
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [title])

  const handleBlur = () => {
    setIsFocused(false)
    if (title.trim() && title.trim() !== subtask.title) {
      onUpdate(title.trim())
    } else {
      setTitle(subtask.title) // revert
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation()
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setTitle(subtask.title)
      e.currentTarget.blur()
    }
  }

  return (
    <div 
      className="flex items-start gap-2 group/subtask py-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Custom Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border transition-all duration-200 cursor-pointer mt-1 ${
          subtask.completed
            ? 'border-primary bg-primary text-primary-foreground shadow-xs'
            : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40 bg-background/50'
        }`}
      >
        {subtask.completed && <Check className="h-3 w-3 stroke-[3]" />}
      </button>

      {/* Inline Editable Textarea */}
      <textarea
        ref={textareaRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        rows={1}
        className={`flex-1 bg-transparent px-2 py-0.5 text-xs text-foreground transition-all duration-200 rounded-lg border-0 focus:ring-0 outline-none resize-none overflow-hidden h-auto leading-relaxed ${
          isFocused 
            ? 'bg-muted/30' 
            : 'hover:bg-muted/20'
        } ${
          subtask.completed ? 'text-muted-foreground/50 line-through font-normal' : 'font-semibold text-foreground/90'
        }`}
        placeholder="Subtask title..."
      />

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="h-7 w-7 shrink-0 rounded-lg text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover/subtask:opacity-100 transition-all duration-200 cursor-pointer mt-0.5"
        title="Delete subtask"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}


interface AddSubtaskInputProps {
  onAdd: (title: string) => void
}

function AddSubtaskInput({ onAdd }: AddSubtaskInputProps): React.ReactElement {
  const [title, setTitle] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    if (title.trim()) {
      onAdd(title.trim())
      setTitle('')
      setTimeout(() => {
        textareaRef.current?.focus()
        textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 100)
    }
  }

  // Auto-adjust height based on content
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [title])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation()
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleFocus = () => {
    setIsFocused(true)
    setTimeout(() => {
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
  }

  return (
    <div 
      className="flex items-start gap-2 mt-2"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleSubmit()
        }}
        disabled={!title.trim()}
        className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border transition-all duration-200 cursor-pointer mt-1 ${
          title.trim()
            ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary'
            : 'border-dashed border-muted-foreground/30 text-muted-foreground/40 hover:border-primary/50 hover:text-primary/60 hover:bg-muted/30'
        }`}
        title="Add subtask"
      >
        <Plus className="h-3 w-3" />
      </button>
      <textarea
        ref={textareaRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={handleFocus}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder="Add a subtask..."
        rows={1}
        className={`flex-1 bg-transparent px-2 py-0.5 text-xs transition-all duration-200 rounded-lg border-0 focus:ring-0 outline-none resize-none overflow-hidden h-auto leading-relaxed ${
          isFocused 
            ? 'bg-muted/30 text-foreground' 
            : 'text-muted-foreground/60 hover:bg-muted/20'
        }`}
      />
      {title.trim() && (
        <Button
          onClick={(e) => {
            e.stopPropagation()
            handleSubmit()
          }}
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-lg text-primary hover:bg-primary/10 cursor-pointer mt-0.5"
          title="Save subtask"
        >
          <Check className="h-4 w-4 stroke-[2.5]" />
        </Button>
      )}
    </div>
  )
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
  const { tags: projectTags, updateTask } = useProjectStore()

  const subtasks = task.subtasks || []
  const totalSubtasks = subtasks.length
  const doneSubtasks = subtasks.filter((s) => s.completed).length
  const progressPercent = totalSubtasks > 0 ? Math.round((doneSubtasks / totalSubtasks) * 100) : 0

  const handleToggleSubtask = (subtaskId: string) => {
    const updatedSubtasks = subtasks.map((sub) =>
      sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub
    )
    updateTask(task.id, { subtasks: updatedSubtasks })
  }

  const handleUpdateSubtask = (subtaskId: string, title: string) => {
    const updatedSubtasks = subtasks.map((sub) =>
      sub.id === subtaskId ? { ...sub, title } : sub
    )
    updateTask(task.id, { subtasks: updatedSubtasks })
  }

  const handleDeleteSubtask = (subtaskId: string) => {
    const updatedSubtasks = subtasks.filter((sub) => sub.id !== subtaskId)
    updateTask(task.id, { subtasks: updatedSubtasks })
  }

  const handleAddSubtask = (title: string) => {
    const newSubtask: Subtask = {
      id: crypto.randomUUID(),
      title,
      completed: false
    }
    const updatedSubtasks = [...subtasks, newSubtask]
    updateTask(task.id, { subtasks: updatedSubtasks })
  }

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
        isDragging ? 'ring-2 ring-primary/50 shadow-lg' : ''
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
              {/* Collapsed: rich preview */}
              {isCollapsed && (
                <div className="space-y-1.5 pt-1">
                  {/* Row 1: Agent badge + Tags + Subtask count */}
                  <div className="flex flex-wrap items-center gap-1">
                    {task.worktreeBranch && task.worktreeStatus && task.worktreeStatus !== 'none' && (
                      <span 
                        className={`inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[10px] font-semibold select-none ${
                          task.worktreeStatus === 'created'
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : task.worktreeStatus === 'failed'
                              ? 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400'
                              : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 animate-pulse'
                        }`}
                        title={`Git Worktree: ${task.worktreeBranch} (${task.worktreeStatus})`}
                      >
                        <GitBranch className={`w-3 h-3 shrink-0 ${task.worktreeStatus === 'installing' || task.worktreeStatus === 'creating' ? 'animate-bounce' : ''}`} />
                        <span className="truncate max-w-[100px]">{task.worktreeBranch}</span>
                      </span>
                    )}
                    {realStatus !== 'idle' && (
                      <span className="inline-flex h-5 items-center gap-1 rounded-md border border-border/30 bg-muted/40 px-1.5 text-[10px] font-semibold text-muted-foreground/80 select-none">
                        <AgentIcon type={task.agentType} className="w-3.5 h-3.5 shrink-0" />
                        <span>{AGENT_DISPLAY[task.agentType]?.label ?? task.agentType}</span>
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          {realStatus === 'running' && (
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                              realActivity === 'thinking' ? 'bg-indigo-400' :
                              realActivity === 'tool_use' ? 'bg-purple-400' :
                              realActivity === 'responding' ? 'bg-emerald-400' : 'bg-amber-400'
                            }`} />
                          )}
                          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                            realStatus === 'completed' ? 'bg-emerald-500' :
                            realStatus === 'error' ? 'bg-destructive' :
                            realActivity === 'thinking' ? 'bg-indigo-500' :
                            realActivity === 'tool_use' ? 'bg-purple-500' :
                            realActivity === 'responding' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`} />
                        </span>
                        {realStatus === 'running' && (
                          <span className="text-[9px] text-muted-foreground/60 lowercase">
                            {realActivity === 'tool_use' ? 'tool' : realActivity}
                          </span>
                        )}
                      </span>
                    )}
                    {task.tags && task.tags.length > 0 && task.tags.map((tagId) => {
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
                          className="inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-bold tracking-wider uppercase"
                        >
                          <span className="h-1 w-1 rounded-full mr-1" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </span>
                      )
                    })}
                    {totalSubtasks > 0 && (
                      <span
                        className="inline-flex h-5 items-center gap-1 rounded-md border border-border/30 bg-muted/40 px-1.5 text-[10px] font-semibold text-muted-foreground/80 select-none"
                        title={`${doneSubtasks} of ${totalSubtasks} subtasks`}
                      >
                        <CheckSquare className="w-3 h-3 text-muted-foreground/70" />
                        {doneSubtasks}/{totalSubtasks}
                      </span>
                    )}
                  </div>

                  {/* Row 2: Mini progress bar + fraction */}
                  {totalSubtasks > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-bold tabular-nums text-muted-foreground/60">
                        {progressPercent}%
                      </span>
                    </div>
                  )}

                  {/* Row 3: Assignee · Due · Created — clean metadata bar */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold shadow-xs ${assignee.color}`}
                      title={assignee.name}
                    >
                      {assignee.initials}
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground/70">
                      <Calendar className="h-3 w-3 text-muted-foreground/50" />
                      {dueDate}
                    </span>
                    <span className="text-[10px] text-muted-foreground/20">·</span>
                    <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground/60">
                      <Clock className="h-3 w-3 text-muted-foreground/45" />
                      {formatRelativeTime(task.createdAt)}
                    </span>
                  </div>
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

        {/* Subtasks Section */}
        <div className="space-y-2.5 pt-0.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <CheckSquare className="h-3.5 w-3.5 text-muted-foreground/70" />
              Subtasks
            </span>
            {totalSubtasks > 0 && (
              <span className="font-semibold tabular-nums text-foreground/80">
                {doneSubtasks}/{totalSubtasks} ({progressPercent}%)
              </span>
            )}
          </div>

          {totalSubtasks > 0 && (
            <div className="h-1.5 w-full rounded-full bg-secondary/40 overflow-hidden">
              <div 
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          {/* Subtasks List */}
          {totalSubtasks > 0 && (
            <div className="space-y-1 mt-1">
              {subtasks.map((sub) => (
                <SubtaskItem
                  key={sub.id}
                  subtask={sub}
                  onToggle={() => handleToggleSubtask(sub.id)}
                  onUpdate={(title) => handleUpdateSubtask(sub.id, title)}
                  onDelete={() => handleDeleteSubtask(sub.id)}
                />
              ))}
            </div>
          )}

          {/* Add Subtask Form */}
          <AddSubtaskInput onAdd={handleAddSubtask} />
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
            {task.worktreeBranch && task.worktreeStatus && task.worktreeStatus !== 'none' && (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <span 
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase shadow-xs cursor-help select-none ${
                      task.worktreeStatus === 'created'
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : task.worktreeStatus === 'failed'
                          ? 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400'
                          : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    <GitBranch className={`w-3.5 h-3.5 mr-1 shrink-0 ${task.worktreeStatus === 'installing' || task.worktreeStatus === 'creating' ? 'animate-pulse' : ''}`} />
                    <span>{task.worktreeBranch}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-popover text-popover-foreground border border-border shadow-md px-3 py-2 rounded-xl backdrop-blur-md">
                  <div className="flex flex-col gap-1 text-[11px] font-medium leading-none">
                    <div className="font-bold flex items-center gap-1.5">
                      <GitBranch className="w-4 h-4 shrink-0" />
                      <span>Git Worktree Branch</span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      Status: <span className="font-semibold uppercase text-primary">{task.worktreeStatus}</span>
                    </div>
                    {task.worktreePath && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 font-mono max-w-xs break-all">
                        {task.worktreePath}
                      </div>
                    )}
                    {task.worktreeError && (
                      <div className="text-[10px] text-red-500 mt-1 font-mono max-w-xs break-all border-t border-border/20 pt-1">
                        Error: {task.worktreeError}
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            {task.agentType && (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <span 
                    className="inline-flex items-center rounded-md border border-border/30 bg-muted/40 px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase text-muted-foreground/80 shadow-xs cursor-help select-none"
                  >
                    <AgentIcon type={task.agentType} className="w-3.5 h-3.5 mr-1 shrink-0" />
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
                      <AgentIcon type={task.agentType} className="w-4 h-4 shrink-0" />
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
