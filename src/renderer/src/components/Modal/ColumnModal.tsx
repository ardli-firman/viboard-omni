import { useState } from 'react'
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

interface ColumnModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (title: string, color?: string) => Promise<void>
}

const noopLog = { info: (..._args: unknown[]): void => {}, error: (..._args: unknown[]): void => {}, warn: (..._args: unknown[]): void => {} }

export function ColumnModal({ open, onOpenChange, onSave }: ColumnModalProps): React.ReactElement {
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const isValid = title.trim().length > 0

  async function handleSave(): Promise<void> {
    if (!isValid || saving) return
    setSaving(true)
    const log = window.electronAPI?.log ?? noopLog
    try {
      log.info('[ColumnModal] Calling onSave')
      await onSave(title.trim())
      log.info('[ColumnModal] onSave succeeded')
      setTitle('')
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error('[ColumnModal] onSave failed:', msg)
      toast.error('Failed to add column: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Column</DialogTitle>
          <DialogDescription>Add a new column to the board.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Column Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Backlog, In Progress"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving ? 'Saving...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
