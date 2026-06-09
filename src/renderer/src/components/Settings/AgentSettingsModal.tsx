import { useState, useEffect } from 'react'
import type { AgentType, AgentCliConfig, SessionMode } from '@shared/types'
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
import { useSettingsStore } from '../../stores/settingsStore'
import { Bot, ChevronDown, ChevronRight, Info, Plus, Trash2, RotateCcw } from 'lucide-react'
import { AgentIcon } from '../AgentIcon'

// ── Agent metadata ────────────────────────────────────────────────────────────

interface AgentMeta {
  type: AgentType
  label: string
  description: string
  icon: string
  defaultBinary: string
  supportsSession: boolean
}

const AGENT_META: AgentMeta[] = [
  {
    type: 'oh-my-pi',
    label: 'Oh My Pi (omp)',
    description: 'oh-my-pi agent CLI — github.com/can1357/oh-my-pi',
    icon: '🤖',
    defaultBinary: 'omp',
    supportsSession: true,
  },
  {
    type: 'gemini-cli',
    label: 'Gemini CLI',
    description: 'Google Gemini CLI agent',
    icon: '✨',
    defaultBinary: 'gemini',
    supportsSession: false,
  },
  {
    type: 'pi-agent',
    label: 'Pi Agent CLI',
    description: 'Pi Agent CLI',
    icon: '🥧',
    defaultBinary: 'pi-agent',
    supportsSession: false,
  },
  {
    type: 'hermes',
    label: 'Hermes Agent',
    description: 'Hermes Agent CLI',
    icon: '🪄',
    defaultBinary: 'hermes',
    supportsSession: false,
  },
  {
    type: 'opencode',
    label: 'OpenCode',
    description: 'OpenCode AI agent — opencode.ai',
    icon: '🖥️',
    defaultBinary: 'opencode',
    supportsSession: false,
  },
  {
    type: 'claude',
    label: 'Claude Code',
    description: 'Anthropic Claude Code CLI — @anthropic-ai/claude-code',
    icon: '🧠',
    defaultBinary: 'claude',
    supportsSession: true,
  },
  {
    type: 'custom',
    label: 'Custom Command',
    description: 'Fully custom agent CLI — define your own binary and args',
    icon: '⚙️',
    defaultBinary: '',
    supportsSession: false,
  },
]

// ── KV Editor (extra env vars) ───────────────────────────────────────────────

interface KvEditorProps {
  value: Record<string, string>
  onChange: (v: Record<string, string>) => void
}

function KvEditor({ value, onChange }: KvEditorProps): React.ReactElement {
  const entries = Object.entries(value)

  const update = (idx: number, k: string, v: string): void => {
    const next = [...entries]
    next[idx] = [k, v]
    onChange(Object.fromEntries(next))
  }

  const remove = (idx: number): void => {
    const next = entries.filter((_, i) => i !== idx)
    onChange(Object.fromEntries(next))
  }

  const add = (): void => {
    onChange({ ...value, '': '' })
  }

  return (
    <div className="space-y-1.5">
      {entries.map(([k, v], idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            value={k}
            onChange={(e) => update(idx, e.target.value, v)}
            placeholder="KEY"
            className="h-7 flex-1 font-mono text-xs"
          />
          <span className="text-muted-foreground text-xs">=</span>
          <Input
            value={v}
            onChange={(e) => update(idx, k, e.target.value)}
            placeholder="VALUE"
            className="h-7 flex-1 font-mono text-xs"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => remove(idx)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={add}>
        <Plus className="h-3.5 w-3.5" />
        Add Variable
      </Button>
    </div>
  )
}

// ── Per-Agent Config Panel ────────────────────────────────────────────────────

interface AgentConfigPanelProps {
  meta: AgentMeta
  config: Partial<AgentCliConfig>
  onChange: (c: Partial<AgentCliConfig>) => void
  onReset: () => void
}

function AgentConfigPanel({ meta, config, onChange, onReset }: AgentConfigPanelProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false)

  const extraArgsStr = (config.extraArgs ?? []).join(' ')

  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <AgentIcon type={meta.type} className="w-6 h-6 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{meta.label}</p>
          <p className="text-[11px] text-muted-foreground truncate">{meta.description}</p>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/30 px-4 py-4 space-y-4 bg-muted/20">
          {/* Binary Path */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Binary Path
            </label>
            <Input
              value={config.binaryPath ?? ''}
              onChange={(e) => onChange({ ...config, binaryPath: e.target.value || null })}
              placeholder={`Auto-resolve (default: ${meta.defaultBinary || 'configured in settings'})`}
              className="h-8 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Leave blank to use the auto-resolved binary. Useful if the CLI is not in PATH.
            </p>
          </div>

          {/* Extra Args */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Extra Arguments
            </label>
            <Input
              value={extraArgsStr}
              onChange={(e) =>
                onChange({
                  ...config,
                  extraArgs: e.target.value.trim() ? e.target.value.trim().split(/\s+/) : [],
                })
              }
              placeholder="e.g. --no-color --debug"
              className="h-8 font-mono text-xs"
            />
          </div>

          {/* Session Mode (for agents that support it) */}
          {(meta.supportsSession || config.sessionMode === 'resume-file' || config.sessionMode === 'env-var') && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Session Persistence
              </label>
              <div className="flex gap-2 flex-wrap">
                {(['none', 'resume-file', 'env-var'] as SessionMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onChange({ ...config, sessionMode: mode })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      (config.sessionMode ?? 'none') === mode
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/40 bg-background text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    {mode === 'none' ? 'None' : mode === 'resume-file' ? '—resume <file>' : 'Env Var'}
                  </button>
                ))}
              </div>

              {config.sessionMode === 'resume-file' && (
                <Input
                  value={config.sessionArg ?? '--resume'}
                  onChange={(e) => onChange({ ...config, sessionArg: e.target.value })}
                  placeholder="--resume"
                  className="h-8 font-mono text-xs"
                />
              )}

              {config.sessionMode === 'env-var' && (
                <Input
                  value={config.sessionEnvVar ?? ''}
                  onChange={(e) => onChange({ ...config, sessionEnvVar: e.target.value })}
                  placeholder="SESSION_ID"
                  className="h-8 font-mono text-xs"
                />
              )}
            </div>
          )}

          {/* Extra Env Vars */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Extra Environment Variables
            </label>
            <KvEditor
              value={config.extraEnv ?? {}}
              onChange={(extraEnv) => onChange({ ...config, extraEnv })}
            />
          </div>

          {/* Reset button */}
          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={onReset}
            >
              <RotateCcw className="h-3 w-3" />
              Reset to Defaults
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

interface AgentSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AgentSettingsModal({ open, onOpenChange }: AgentSettingsModalProps): React.ReactElement {
  const { settings, saveSettings } = useSettingsStore()

  // Local draft state — only committed on Save
  const [defaultType, setDefaultType] = useState<AgentType>(settings.defaultAgentType)
  const [draftConfigs, setDraftConfigs] = useState<Record<string, Partial<AgentCliConfig>>>(
    () => ({ ...settings.agentConfigs }) as Record<string, Partial<AgentCliConfig>>,
  )
  const [saving, setSaving] = useState(false)

  // Sync draft when modal opens
  useEffect(() => {
    if (open) {
      setDefaultType(settings.defaultAgentType)
      setDraftConfigs({ ...settings.agentConfigs } as Record<string, Partial<AgentCliConfig>>)
    }
  }, [open, settings])

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await saveSettings({
        defaultAgentType: defaultType,
        agentConfigs: draftConfigs,
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const resetConfig = (type: AgentType): void => {
    setDraftConfigs((prev) => {
      const next = { ...prev }
      delete next[type]
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Agent CLI Settings</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Configure which agent CLI to use globally and per-driver parameters.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Default Agent Type */}
          <div className="space-y-2.5">
            <label className="text-sm font-semibold text-foreground">Default Agent</label>
            <p className="text-xs text-muted-foreground">
              New tasks will use this agent CLI unless overridden at the task level.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AGENT_META.map((meta) => (
                <button
                  key={meta.type}
                  type="button"
                  id={`agent-default-${meta.type}`}
                  onClick={() => setDefaultType(meta.type)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                    defaultType === meta.type
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/30 shadow-xs'
                      : 'border-border/40 bg-background hover:bg-muted/40 hover:border-border'
                  }`}
                >
                  <AgentIcon type={meta.type} className="w-5 h-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{meta.label}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Info banner */}
          <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Per-driver configuration</span> — expand each agent
              below to set its binary path, extra arguments, environment variables, and session mode.
              Leave fields blank to use driver defaults.
            </p>
          </div>

          {/* Per-Agent Configs */}
          <div className="space-y-2.5">
            <label className="text-sm font-semibold text-foreground">Driver Configuration</label>
            <div className="space-y-2">
              {AGENT_META.map((meta) => (
                <AgentConfigPanel
                  key={meta.type}
                  meta={meta}
                  config={draftConfigs[meta.type] ?? {}}
                  onChange={(c) =>
                    setDraftConfigs((prev) => ({ ...prev, [meta.type]: c }))
                  }
                  onReset={() => resetConfig(meta.type)}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
