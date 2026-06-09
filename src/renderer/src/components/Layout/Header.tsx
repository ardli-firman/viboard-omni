import { useState } from 'react'
import { Moon, Sun, FolderKanban, Settings } from 'lucide-react'
import { Button } from '../ui/button'
import { useThemeStore } from '../../stores/themeStore'
import { useProjectStore } from '../../stores/projectStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { AgentSettingsModal } from '../Settings/AgentSettingsModal'
import { AgentIcon } from '../AgentIcon'

function basename(p: string): string {
  const parts = p.split(/[\\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? p
}

export function Header(): React.ReactElement {
  const { theme, toggle } = useThemeStore()
  const { currentProject } = useProjectStore()
  const { settings } = useSettingsStore()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <header className="z-40 flex h-15 items-center justify-between border-b border-border/30 bg-background/50 px-6 shadow-xs backdrop-blur-xl transition-all duration-300">
        <div className="flex items-center gap-4">
          {/* Brand logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs border border-primary/20">
              <FolderKanban className="h-4.5 w-4.5" />
            </div>
            <h1 className="text-base font-extrabold tracking-tight select-none">
              <span className="text-primary">
                Viboard
              </span>
              <span className="text-muted-foreground/90 font-medium">.omni</span>
            </h1>
          </div>

          {/* Project indicator badge */}
          {currentProject && (
            <div className="hidden items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-0.5.5 text-xs font-semibold text-primary sm:flex">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary"></span>
              </span>
              <span>Project:</span>
              <span className="font-bold text-foreground/80" title={currentProject}>
                {basename(currentProject)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Agent indicator badge */}
          <div
            className="hidden items-center gap-1.5 rounded-full border border-border/30 bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground sm:flex cursor-pointer hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-colors"
            onClick={() => setSettingsOpen(true)}
            title="Agent CLI Settings"
          >
            <AgentIcon type={settings.defaultAgentType} className="w-4 h-4 shrink-0" />
            <span>{settings.defaultAgentType}</span>
          </div>

          {/* Agent Settings button */}
          <Button
            variant="ghost"
            size="icon"
            id="btn-agent-settings"
            className="h-8.5 w-8.5 rounded-xl border border-border/20 bg-background/40 hover:bg-accent hover:text-accent-foreground hover:scale-105 active:scale-95 transition-all"
            onClick={() => setSettingsOpen(true)}
            title="Agent CLI Settings"
          >
            <Settings className="h-4.5 w-4.5" />
          </Button>

          {/* Theme Toggler */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8.5 w-8.5 rounded-xl border border-border/20 bg-background/40 hover:bg-accent hover:text-accent-foreground hover:scale-105 active:scale-95 transition-all"
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="h-4.5 w-4.5 text-amber-400" /> : <Moon className="h-4.5 w-4.5 text-indigo-600" />}
          </Button>
        </div>
      </header>

      <AgentSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}
