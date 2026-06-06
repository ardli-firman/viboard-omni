import { Moon, Sun } from 'lucide-react'
import { Button } from '../ui/button'
import { useThemeStore } from '../../stores/themeStore'

export function Header(): React.ReactElement {
  const { theme, toggle } = useThemeStore()

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/40 bg-background/40 px-6 backdrop-blur-md">
      <h1 className="text-lg font-bold tracking-tight text-primary">Viboard Omni</h1>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggle}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  )
}
