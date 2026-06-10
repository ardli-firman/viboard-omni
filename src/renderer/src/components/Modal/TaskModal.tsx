import { useState, useEffect } from 'react'
import type { Task, AgentType, AgentCliConfig, SessionMode } from '@shared/types'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { useProjectStore } from '../../stores/projectStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { ChevronDown, ChevronRight, Settings2, Check } from 'lucide-react'
import { TagManagerModal } from './TagManagerModal'
import { AgentIcon } from '../AgentIcon'

// ── Agent type options ────────────────────────────────────────────────────────

const AGENT_OPTIONS: { type: AgentType; label: string; icon: string; description: string }[] = [
  { type: 'oh-my-pi',   label: 'Oh My Pi',    icon: '🤖', description: 'omp binary (oh-my-pi)' },
  { type: 'gemini-cli', label: 'Gemini CLI',  icon: '✨', description: 'Google Gemini CLI' },
  { type: 'pi-agent',   label: 'Pi Agent',    icon: '🥧', description: 'Pi Agent CLI' },
  { type: 'hermes',     label: 'Hermes',      icon: '🪄', description: 'Hermes Agent CLI' },
  { type: 'opencode',   label: 'OpenCode',    icon: '🖥️', description: 'OpenCode AI agent' },
  { type: 'claude',     label: 'Claude',      icon: '🧠', description: 'Claude Code CLI' },
  { type: 'custom',     label: 'Custom',      icon: '⚙️', description: 'Custom command' },
]

interface TaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  onSave: (data: {
    title: string
    description: string
    tags: string[]
    agentType: AgentType
    agentConfig?: Partial<AgentCliConfig>
  }) => Promise<void>
}

export function TaskModal({ open, onOpenChange, task, onSave }: TaskModalProps): React.ReactElement {
  const { currentProject, tags: projectTags } = useProjectStore()
  const { settings } = useSettingsStore()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagManagerOpen, setTagManagerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Agent type — always saved per-task (independent of advanced config toggle)
  const [agentType, setAgentType] = useState<AgentType>(settings.defaultAgentType)

  // Advanced config override (binary path, extra args, session mode)
  // This is separate from agentType — you can set a custom agentType without overriding paths
  const [useAdvancedConfig, setUseAdvancedConfig] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [binaryPath, setBinaryPath] = useState('')
  const [extraArgsStr, setExtraArgsStr] = useState('')
  const [sessionMode, setSessionMode] = useState<SessionMode>('none')
  const [sessionArg, setSessionArg] = useState('--resume')
  const [sessionEnvVar, setSessionEnvVar] = useState('')

  // Git Worktree State
  const [gitBranches, setGitBranches] = useState<string[]>([])
  const [worktreeBranch, setWorktreeBranch] = useState('')
  const [worktreeStatus, setWorktreeStatus] = useState<Task['worktreeStatus']>('none')
  const [worktreePath, setWorktreePath] = useState('')
  const [worktreeError, setWorktreeError] = useState('')
  const [creatingWorktree, setCreatingWorktree] = useState(false)
  const [removingWorktree, setRemovingWorktree] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? '')
      setDescription(task?.description ?? '')
      setSelectedTags(task?.tags ?? [])
      setShowAdvanced(false)

      // ── Agent type: use task's saved type, fallback to global default ──
      // For new tasks: default to global setting
      // For existing tasks: always restore what was saved, regardless of global default
      setAgentType(task?.agentType ?? settings.defaultAgentType)

      // ── Advanced config: restore if task had overrides ──
      if (task?.agentConfig && Object.keys(task.agentConfig).length > 0) {
        setUseAdvancedConfig(true)
        setBinaryPath(task.agentConfig.binaryPath ?? '')
        setExtraArgsStr((task.agentConfig.extraArgs ?? []).join(' '))
        setSessionMode(task.agentConfig.sessionMode ?? 'none')
        setSessionArg(task.agentConfig.sessionArg ?? '--resume')
        setSessionEnvVar(task.agentConfig.sessionEnvVar ?? '')
      } else {
        setUseAdvancedConfig(false)
        setBinaryPath('')
        setExtraArgsStr('')
        setSessionMode('none')
        setSessionArg('--resume')
        setSessionEnvVar('')
      }

      // Sync Git Worktree State
      setWorktreeBranch(task?.worktreeBranch ?? '')
      setWorktreeStatus(task?.worktreeStatus ?? 'none')
      setWorktreePath(task?.worktreePath ?? '')
      setWorktreeError(task?.worktreeError ?? '')
    }
  }, [open, task, settings.defaultAgentType])

  // Sync Git Worktree State reactively if task updates in the store
  useEffect(() => {
    if (task && open) {
      setWorktreeBranch((prev) => (creatingWorktree ? prev : task.worktreeBranch ?? ''))
      setWorktreeStatus(task.worktreeStatus ?? 'none')
      setWorktreePath(task.worktreePath ?? '')
      setWorktreeError(task.worktreeError ?? '')
    }
  }, [task, open])

  // Fetch Git Branches
  useEffect(() => {
    if (open && currentProject) {
      window.electronAPI.gitGetBranches(currentProject).then((branches) => {
        setGitBranches(branches)
      }).catch((err) => {
        console.error('Failed to get git branches:', err)
      })
    }
  }, [open, currentProject])

  async function handleCreateWorktree() {
    if (!currentProject || !task || !worktreeBranch.trim()) return
    setCreatingWorktree(true)
    try {
      const res = await window.electronAPI.gitCreateWorktree(
        currentProject,
        task.id,
        worktreeBranch.trim()
      )
      if (!res.success) {
        toast.error('Failed to create worktree: ' + res.error)
      } else {
        toast.success('Git worktree creation initiated!')
        setWorktreeStatus('installing')
      }
    } catch (err: any) {
      toast.error('Error: ' + (err.message || String(err)))
    } finally {
      setCreatingWorktree(false)
    }
  }

  async function handleRemoveWorktree() {
    if (!currentProject || !task) return
    if (!confirm('Are you sure you want to remove the Git Worktree for this task? This will force delete any changes inside the worktree folder.')) return
    setRemovingWorktree(true)
    try {
      const res = await window.electronAPI.gitRemoveWorktree(currentProject, task.id)
      if (!res.success) {
        toast.error('Failed to remove worktree: ' + res.error)
      } else {
        toast.success('Git worktree removed successfully.')
        setWorktreeStatus('none')
        setWorktreePath('')
        setWorktreeBranch('')
      }
    } catch (err: any) {
      toast.error('Error: ' + (err.message || String(err)))
    } finally {
      setRemovingWorktree(false)
    }
  }

  const isValid = title.trim().length > 0

  async function handleSave(): Promise<void> {
    if (!isValid || saving) return
    setSaving(true)
    try {
      // agentConfig is only non-undefined when user has set advanced overrides
      const agentConfig: Partial<AgentCliConfig> | undefined = useAdvancedConfig
        ? {
            agentType,
            binaryPath: binaryPath.trim() || null,
            extraArgs: extraArgsStr.trim() ? extraArgsStr.trim().split(/\s+/) : [],
            sessionMode,
            sessionArg: sessionMode === 'resume-file' ? sessionArg : null,
            sessionEnvVar: sessionMode === 'env-var' ? sessionEnvVar : null,
            extraEnv: {},
          }
        : undefined

      await onSave({
        title: title.trim(),
        description: description.trim(),
        tags: selectedTags,
        agentType,      // always sent — agentType is always per-task
        agentConfig,    // only set when advanced overrides are enabled
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const isDefaultAgent = agentType === settings.defaultAgentType

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/30 shrink-0">
          <DialogTitle>{task ? 'Edit Task' : 'New Task'}</DialogTitle>
          <DialogDescription>
            {task ? 'Update the task details.' : 'Create a new task for the board.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          {/* Tags Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground">Tags</label>
              <button
                type="button"
                onClick={() => setTagManagerOpen(true)}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                Manage Tags
              </button>
            </div>
            
            {projectTags.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic bg-muted/20 p-2.5 rounded-xl border border-dashed text-center">
                No tags created yet. Click "Manage Tags" to customize.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 border border-border/30 rounded-xl bg-background/50">
                {projectTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        setSelectedTags((prev) =>
                          prev.includes(tag.id)
                            ? prev.filter((id) => id !== tag.id)
                            : [...prev, tag.id]
                        )
                      }}
                      style={{
                        backgroundColor: isSelected ? `${tag.color}20` : 'transparent',
                        color: isSelected ? tag.color : 'hsl(var(--muted-foreground))',
                        borderColor: isSelected ? tag.color : 'rgba(var(--border), 0.3)',
                      }}
                      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold transition-all hover:scale-102 cursor-pointer ${
                        isSelected ? 'ring-1 ring-offset-0 font-extrabold' : 'text-muted-foreground'
                      }`}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full mr-1.5"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Project badge */}
          {currentProject && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Project: <span className="font-medium text-foreground">{currentProject}</span>
            </div>
          )}

          {/* Git Worktree Section */}
          {currentProject && task && (
            <div className="space-y-2.5 rounded-xl border border-border/30 p-3 bg-muted/10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Git Worktree</span>
                {worktreeStatus && worktreeStatus !== 'none' && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    worktreeStatus === 'created' 
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : worktreeStatus === 'failed'
                        ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse'
                  }`}>
                    {worktreeStatus}
                  </span>
                )}
              </div>

              {worktreeStatus === 'none' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-muted-foreground">
                    Create a dedicated Git Worktree to run the AI agent for this task on a separate branch.
                  </p>
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Branch Name
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          list="modal-git-branches"
                          value={worktreeBranch}
                          onChange={(e) => setWorktreeBranch(e.target.value)}
                          placeholder="e.g. feat/login-ui"
                          className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-2xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <datalist id="modal-git-branches">
                          {gitBranches.map((b) => (
                            <option key={b} value={b} />
                          ))}
                        </datalist>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!worktreeBranch.trim() || creatingWorktree}
                        onClick={handleCreateWorktree}
                        className="h-8 text-xs px-3"
                      >
                        {creatingWorktree ? 'Setting up...' : 'Setup Worktree'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {(worktreeStatus === 'creating' || worktreeStatus === 'installing') && (
                <div className="flex items-center gap-3 py-2 text-xs text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <div>
                    {worktreeStatus === 'creating' 
                      ? 'Creating git worktree...' 
                      : 'Installing project dependencies in the background...'}
                  </div>
                </div>
              )}

              {worktreeStatus === 'created' && (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center bg-background p-2 rounded-lg border">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">Branch: <span className="font-mono text-primary font-bold">{worktreeBranch}</span></div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">Path: <span className="font-mono">{worktreePath}</span></div>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleRemoveWorktree}
                      disabled={removingWorktree}
                      className="h-7 text-[10px] font-extrabold uppercase tracking-wide ml-2 shrink-0 cursor-pointer"
                    >
                      {removingWorktree ? 'Removing...' : 'Remove'}
                    </Button>
                  </div>
                </div>
              )}

              {worktreeStatus === 'failed' && (
                <div className="space-y-3">
                  <div className="bg-red-500/10 border border-red-500/25 p-2.5 rounded-lg text-[11px] text-red-500">
                    <div className="font-semibold uppercase tracking-wider text-[10px] mb-1">Setup Failed</div>
                    <div className="font-mono break-all">{worktreeError}</div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveWorktree}
                      disabled={removingWorktree}
                      className="h-7 text-[10px] font-semibold cursor-pointer"
                    >
                      Reset Worktree Settings
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Agent CLI Section ─────────────────────────────────────────── */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Agent CLI</span>
              {isDefaultAgent && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wide">
                  global default
                </span>
              )}
            </div>

            {/* Agent type picker — always visible, always saved */}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {AGENT_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  id={`task-agent-${opt.type}`}
                  onClick={() => setAgentType(opt.type)}
                  className={`group relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                    agentType === opt.type
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/30 shadow-xs'
                      : 'border-border/40 bg-background hover:bg-muted/40 hover:border-border'
                  }`}
                >
                  <AgentIcon type={opt.type} className="w-5 h-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${agentType === opt.type ? 'text-primary' : 'text-foreground'}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{opt.description}</p>
                  </div>
                  {agentType === opt.type && (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Advanced config override */}
            <div className="rounded-xl border border-border/30 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 bg-muted/20">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  {showAdvanced
                    ? <ChevronDown className="h-3.5 w-3.5" />
                    : <ChevronRight className="h-3.5 w-3.5" />}
                  <span className="font-semibold">Advanced Config Override</span>
                  {useAdvancedConfig && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                      active
                    </span>
                  )}
                </button>
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => setUseAdvancedConfig((v) => !v)}
                  className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${
                    useAdvancedConfig ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                  title={useAdvancedConfig ? 'Disable binary/args override' : 'Enable binary/args override'}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      useAdvancedConfig ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {showAdvanced && (
                <div className="border-t border-border/20 px-3 py-3 space-y-3 bg-card">
                  {!useAdvancedConfig && (
                    <p className="text-[11px] text-muted-foreground">
                      Enable the toggle above to override binary path, arguments, and session mode for this specific task.
                      Global driver settings from <span className="font-semibold">Agent CLI Settings</span> will apply otherwise.
                    </p>
                  )}

                  {useAdvancedConfig && (
                    <>
                      {/* Binary Path */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Binary Path (optional)
                        </label>
                        <Input
                          value={binaryPath}
                          onChange={(e) => setBinaryPath(e.target.value)}
                          placeholder="Leave blank for auto-resolve"
                          className="h-7 font-mono text-xs"
                        />
                      </div>

                      {/* Extra Args */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Extra Arguments
                        </label>
                        <Input
                          value={extraArgsStr}
                          onChange={(e) => setExtraArgsStr(e.target.value)}
                          placeholder="e.g. --no-color --verbose"
                          className="h-7 font-mono text-xs"
                        />
                      </div>

                      {/* Session Mode */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Session Mode
                        </label>
                        <div className="flex gap-1.5 flex-wrap">
                          {(['none', 'resume-file', 'env-var'] as SessionMode[]).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setSessionMode(mode)}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                                sessionMode === mode
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border/40 bg-background text-muted-foreground hover:bg-muted/40'
                              }`}
                            >
                              {mode === 'none' ? 'None' : mode === 'resume-file' ? '—resume <file>' : 'Env Var'}
                            </button>
                          ))}
                        </div>
                        {sessionMode === 'resume-file' && (
                          <Input
                            value={sessionArg}
                            onChange={(e) => setSessionArg(e.target.value)}
                            placeholder="--resume"
                            className="h-7 font-mono text-xs mt-1"
                          />
                        )}
                        {sessionMode === 'env-var' && (
                          <Input
                            value={sessionEnvVar}
                            onChange={(e) => setSessionEnvVar(e.target.value)}
                            placeholder="SESSION_ID"
                            className="h-7 font-mono text-xs mt-1"
                          />
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving ? 'Saving...' : task ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
      <TagManagerModal open={tagManagerOpen} onOpenChange={setTagManagerOpen} />
    </Dialog>
  )
}
