import { useState, useEffect } from 'react'
import type { Task } from '@shared/types'
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

interface TaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task | null
  onSave: (data: { title: string; description: string; tags: string[] }) => Promise<void>
}

export function TaskModal({ open, onOpenChange, task, onSave }: TaskModalProps): React.ReactElement {
  const { currentProject } = useProjectStore()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? '')
      setDescription(task?.description ?? '')
    }
  }, [open, task])

  const isValid = title.trim().length > 0

  async function handleSave(): Promise<void> {
    if (!isValid || saving) return
    setSaving(true)
    try {
      await onSave({ title: title.trim(), description: description.trim(), tags: [] })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'New Task'}</DialogTitle>
          <DialogDescription>
            {task ? 'Update the task details.' : 'Create a new task for the board.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>
          {currentProject && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Project: <span className="font-medium text-foreground">{currentProject}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving ? 'Saving...' : task ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
