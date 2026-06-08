import { useState, useEffect } from 'react'
import type { Task, AgentType, AgentCliConfig, SessionMode } from '@shared/types'
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

// ── Agent type options ────────────────────────────────────────────────────────

const AGENT_OPTIONS: { type: AgentType; label: string; icon: string; description: string }[] = [
  { type: 'oh-my-pi',   label: 'Oh My Pi',    icon: '🤖', description: 'omp binary (oh-my-pi)' },
  { type: 'gemini-cli', label: 'Gemini CLI',  icon: '✨', description: 'Google Gemini CLI' },
  { type: 'pi-agent',   label: 'Pi Agent',    icon: '🥧', description: 'Pi Agent CLI' },
  { type: 'hermes',     label: 'Hermes',      icon: '🪄', description: 'Hermes Agent CLI' },
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
  const { currentProject } = useProjectStore()
  const { settings } = useSettingsStore()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
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

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? '')
      setDescription(task?.description ?? '')
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
    }
  }, [open, task, settings.defaultAgentType])

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
        tags: [],
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

          {/* Project badge */}
          {currentProject && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Project: <span className="font-medium text-foreground">{currentProject}</span>
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
                  <span className="text-base leading-none">{opt.icon}</span>
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
    </Dialog>
  )
}
