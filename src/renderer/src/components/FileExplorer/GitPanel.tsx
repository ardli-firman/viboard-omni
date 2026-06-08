import { type ReactElement, useState, useEffect } from 'react'
import {
  GitBranch,
  RefreshCw,
  ArrowDown,
  ArrowUp,
  Plus,
  Minus,
  RotateCcw,
  GitCompare,
  AlertTriangle,
  Loader2,
  Check,
} from 'lucide-react'
import { useFileExplorerStore } from '../../stores/fileExplorerStore'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Badge } from '../ui/badge'
import { toast } from 'sonner'

export function GitPanel(): ReactElement {
  const rootPath = useFileExplorerStore((s) => s.rootPath)
  const gitBranch = useFileExplorerStore((s) => s.gitBranch)
  const gitStatus = useFileExplorerStore((s) => s.gitStatus)
  const refreshGitStatus = useFileExplorerStore((s) => s.refreshGitStatus)
  const openFile = useFileExplorerStore((s) => s.openFile)
  const toggleDiffMode = useFileExplorerStore((s) => s.toggleDiffMode)

  const [commitMessage, setCommitMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeOp, setActiveOp] = useState<string | null>(null)
  const [discardConfirmFile, setDiscardConfirmFile] = useState<string | null>(null)
  const [discardAllConfirm, setDiscardAllConfirm] = useState(false)

  // Auto-refresh Git status on mount and when root path changes
  useEffect(() => {
    if (rootPath) {
      void refreshGitStatus()
    }
  }, [rootPath, refreshGitStatus])

  // Parse status records
  const stagedFiles: { path: string; relPath: string; name: string; code: string }[] = []
  const unstagedFiles: { path: string; relPath: string; name: string; code: string }[] = []

  if (rootPath && gitStatus) {
    for (const [relPath, code] of Object.entries(gitStatus)) {
      const fullPath = `${rootPath}/${relPath}`.replace(/\\/g, '/')
      const name = relPath.split('/').pop() || relPath

      const isStaged = code[0] !== ' ' && code[0] !== '?'
      const isUnstaged = code[1] !== ' ' || code === '??'

      if (isStaged) {
        stagedFiles.push({ path: fullPath, relPath, name, code })
      }
      if (isUnstaged) {
        unstagedFiles.push({ path: fullPath, relPath, name, code })
      }
    }
  }

  const runOperation = async (
    name: string,
    op: () => Promise<{ success: boolean; error?: string; output?: string }>,
  ): Promise<boolean> => {
    if (!rootPath) return false
    setLoading(true)
    setActiveOp(name)
    try {
      const res = await op()
      if (res.success) {
        toast.success(`${name} completed successfully`)
        await refreshGitStatus()
        return true
      } else {
        toast.error(`Failed ${name.toLowerCase()}: ${res.error || 'Unknown error'}`)
        return false
      }
    } catch (err: any) {
      toast.error(`Error during ${name.toLowerCase()}: ${err.message || err}`)
      return false
    } finally {
      setLoading(false)
      setActiveOp(null)
    }
  }

  const handleInit = async () => {
    await runOperation('Git Init', () => window.electronAPI.gitInit(rootPath!))
  }

  const handleStage = async (relPath: string) => {
    await runOperation('Stage File', () => window.electronAPI.gitAdd(rootPath!, relPath))
  }

  const handleStageAll = async () => {
    await runOperation('Stage All', () => window.electronAPI.gitAdd(rootPath!, '.'))
  }

  const handleUnstage = async (relPath: string) => {
    await runOperation('Unstage File', () => window.electronAPI.gitUnstage(rootPath!, relPath))
  }

  const handleUnstageAll = async () => {
    await runOperation('Unstage All', () => window.electronAPI.gitUnstage(rootPath!, '.'))
  }

  const handleDiscard = async (relPath: string) => {
    const success = await runOperation('Discard Changes', () =>
      window.electronAPI.gitDiscard(rootPath!, relPath),
    )
    if (success) {
      setDiscardConfirmFile(null)
    }
  }

  const handleDiscardAll = async () => {
    const success = await runOperation('Discard All Changes', () =>
      window.electronAPI.gitDiscard(rootPath!, '.'),
    )
    if (success) {
      setDiscardAllConfirm(false)
    }
  }

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      toast.error('Please enter a commit message')
      return
    }
    const success = await runOperation('Commit', () =>
      window.electronAPI.gitCommit(rootPath!, commitMessage.trim()),
    )
    if (success) {
      setCommitMessage('')
    }
  }

  const handleFetch = async () => {
    await runOperation('Git Fetch', () => window.electronAPI.gitFetch(rootPath!))
  }

  const handlePull = async () => {
    await runOperation('Git Pull', () => window.electronAPI.gitPull(rootPath!))
  }

  const handlePush = async () => {
    await runOperation('Git Push', () => window.electronAPI.gitPush(rootPath!))
  }

  const handleDiff = async (file: { path: string; name: string; relPath: string }) => {
    await openFile(file.path, file.name, file.relPath)
    // Delay slightly to make sure file is open in store, then force diffMode
    setTimeout(() => {
      const state = useFileExplorerStore.getState()
      const openF = state.openFiles.find((f) => f.path === file.path)
      if (openF && !openF.diffMode) {
        void toggleDiffMode(file.path)
      }
    }, 100)
  }

  const getStatusBadge = (code: string, isStagedList: boolean) => {
    const char = isStagedList ? code[0] : code[1] === ' ' ? code[0] : code[1]

    if (code === '??') {
      return (
        <Badge variant="outline" className="border-emerald-500/35 bg-emerald-500/10 text-emerald-500">
          U
        </Badge>
      )
    }
    if (char === 'M') {
      return (
        <Badge variant="outline" className="border-amber-500/35 bg-amber-500/10 text-amber-500">
          M
        </Badge>
      )
    }
    if (char === 'A') {
      return (
        <Badge variant="outline" className="border-emerald-500/35 bg-emerald-500/10 text-emerald-500">
          A
        </Badge>
      )
    }
    if (char === 'D') {
      return (
        <Badge variant="outline" className="border-destructive/35 bg-destructive/10 text-destructive">
          D
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="border-muted-foreground/35 bg-muted-foreground/10 text-muted-foreground">
        {char}
      </Badge>
    )
  }

  if (!rootPath) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
        <div>
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500/60" />
          <p className="text-xs">No active project workspace directory.</p>
        </div>
      </div>
    )
  }

  // Not a Git repository
  if (gitBranch === '') {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <GitBranch className="mb-4 h-12 w-12 text-muted-foreground/30 animate-pulse" />
        <h3 className="mb-2 text-sm font-bold text-foreground">Initialize Git Repository</h3>
        <p className="mb-6 text-xs text-muted-foreground leading-relaxed max-w-[240px]">
          This project directory is not initialized as a Git repository yet.
        </p>
        <Button
          onClick={handleInit}
          disabled={loading}
          className="w-full max-w-[200px]"
        >
          {loading && activeOp === 'Git Init' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Initialize Repository
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden text-xs">
      {/* Remote Branch and Sync Toolbar */}
      <div className="flex items-center justify-between border-b border-border/10 bg-background/10 px-4 py-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <GitBranch className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate font-bold text-foreground select-none" title={gitBranch || 'HEAD'}>
            {gitBranch}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleFetch}
            disabled={loading}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/60 transition-all hover:bg-primary/10 hover:text-primary active:scale-95 disabled:opacity-40"
            title="Fetch changes from remote"
          >
            {loading && activeOp === 'Git Fetch' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={handlePull}
            disabled={loading}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/60 transition-all hover:bg-primary/10 hover:text-primary active:scale-95 disabled:opacity-40"
            title="Pull changes from remote"
          >
            {loading && activeOp === 'Git Pull' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={handlePush}
            disabled={loading}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/60 transition-all hover:bg-primary/10 hover:text-primary active:scale-95 disabled:opacity-40"
            title="Push committed changes to remote"
          >
            {loading && activeOp === 'Git Push' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Scrollable Git Panels */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Commit message inputs */}
        <div className="space-y-2">
          <Textarea
            placeholder="Commit message..."
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            disabled={loading}
            className="min-h-[60px] max-h-[120px] resize-y text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void handleCommit()
              }
            }}
          />
          <Button
            onClick={handleCommit}
            disabled={loading || stagedFiles.length === 0}
            className="w-full text-xs h-8"
          >
            {loading && activeOp === 'Commit' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Commit Staged ({stagedFiles.length})
          </Button>
        </div>

        {/* Staged Changes Group */}
        {stagedFiles.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between border-b border-border/10 pb-1">
              <span className="font-bold tracking-wide text-muted-foreground select-none uppercase text-[10px]">
                Staged Changes ({stagedFiles.length})
              </span>
              <button
                onClick={handleUnstageAll}
                disabled={loading}
                className="rounded-md p-0.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40"
                title="Unstage all staged files"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {stagedFiles.map((file) => (
                <div
                  key={`staged-${file.relPath}`}
                  className="group flex h-8 items-center justify-between rounded-lg px-2 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground"
                >
                  <span
                    onClick={() => handleDiff(file)}
                    className="truncate mr-2 font-medium cursor-pointer"
                    title={file.relPath}
                  >
                    {file.name}{' '}
                    <span className="text-[10px] text-muted-foreground/50 font-normal">
                      {file.relPath.substring(0, file.relPath.lastIndexOf('/'))}
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(file.code, true)}
                    <button
                      onClick={() => handleUnstage(file.relPath)}
                      disabled={loading}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all disabled:opacity-40"
                      title="Unstage file"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Changes Group (Modified, Untracked) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between border-b border-border/10 pb-1">
            <span className="font-bold tracking-wide text-muted-foreground select-none uppercase text-[10px]">
              Changes ({unstagedFiles.length})
            </span>
            {unstagedFiles.length > 0 && (
              <div className="flex items-center gap-1">
                {discardAllConfirm ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-destructive animate-pulse">
                      Sure?
                    </span>
                    <button
                      onClick={handleDiscardAll}
                      disabled={loading}
                      className="rounded-md bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive hover:bg-destructive/25 transition-all"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setDiscardAllConfirm(false)}
                      className="rounded-md bg-accent/30 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground hover:bg-accent/50"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDiscardAllConfirm(true)}
                    disabled={loading}
                    className="rounded-md p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40"
                    title="Discard all unstaged changes"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={handleStageAll}
                  disabled={loading}
                  className="rounded-md p-0.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40"
                  title="Stage all unstaged files"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {unstagedFiles.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground/60 text-[11px] select-none italic">
              No changes in working tree
            </p>
          ) : (
            <div className="space-y-0.5">
              {unstagedFiles.map((file) => {
                const isUnconfirmed = discardConfirmFile === file.relPath
                return (
                  <div
                    key={`unstaged-${file.relPath}`}
                    className="group flex h-8 items-center justify-between rounded-lg px-2 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground"
                  >
                    <span
                      onClick={() => handleDiff(file)}
                      className="truncate mr-2 font-medium cursor-pointer"
                      title={file.relPath}
                    >
                      {file.name}{' '}
                      <span className="text-[10px] text-muted-foreground/50 font-normal">
                        {file.relPath.substring(0, file.relPath.lastIndexOf('/'))}
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isUnconfirmed ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDiscard(file.relPath)}
                            disabled={loading}
                            className="rounded bg-destructive/15 px-1 py-0.5 text-[9px] font-bold text-destructive hover:bg-destructive/25 transition-all"
                            title="Confirm discard"
                          >
                            Discard
                          </button>
                          <button
                            onClick={() => setDiscardConfirmFile(null)}
                            className="rounded bg-accent/30 px-1 py-0.5 text-[9px] font-bold text-muted-foreground hover:bg-accent/50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          {getStatusBadge(file.code, false)}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                            {file.code !== '??' && (
                              <button
                                onClick={() => handleDiff(file)}
                                className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/45 hover:bg-primary/10 hover:text-primary transition-all"
                                title="Open diff view"
                              >
                                <GitCompare className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              onClick={() => setDiscardConfirmFile(file.relPath)}
                              disabled={loading}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-all disabled:opacity-40"
                              title="Discard changes"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleStage(file.relPath)}
                              disabled={loading}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/40 hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-40"
                              title="Stage changes"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
