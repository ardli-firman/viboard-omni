import { FolderOpen } from 'lucide-react'
import { Button } from '../ui/button'
import { useProjectStore } from '../../stores/projectStore'

export function ProjectPicker(): React.ReactElement {
  const { selectProject, loading } = useProjectStore()

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="rounded-full bg-muted p-4">
          <FolderOpen className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">No Project Open</h2>
          <p className="text-sm text-muted-foreground">
            Open a folder to start managing your board and tasks.
          </p>
        </div>
        <Button size="lg" onClick={selectProject} disabled={loading}>
          <FolderOpen className="mr-2 h-5 w-5" />
          {loading ? 'Opening...' : 'Open Project'}
        </Button>
      </div>
    </div>
  )
}
