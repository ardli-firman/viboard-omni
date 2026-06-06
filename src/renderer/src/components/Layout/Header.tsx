import { Moon, Sun, FolderOpen, X } from 'lucide-react'
import { Button } from '../ui/button'
import { useThemeStore } from '../../stores/themeStore'
import { useProjectStore } from '../../stores/projectStore'

function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? p
}

export function Header(): React.ReactElement {
  const { theme, toggle } = useThemeStore()
  const { currentProject, selectProject, closeProject } = useProjectStore()

  return (
    <header className="flex h-12 items-center justify-between border-b px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold tracking-tight">Viboard Omni</h1>
        {currentProject && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs">
            <span className="font-medium" title={currentProject}>
              {basename(currentProject)}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="truncate max-w-[280px] text-muted-foreground" title={currentProject}>
              {currentProject}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 -mr-1"
              onClick={selectProject}
              title="Switch Project"
            >
              <FolderOpen className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={closeProject}
              title="Close Project"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggle}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  )
}
