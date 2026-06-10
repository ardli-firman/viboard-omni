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
import { useProjectStore } from '../../stores/projectStore'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react'

interface TagManagerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PRESET_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#22c55e', // Green
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#64748b', // Slate
]

export function TagManagerModal({ open, onOpenChange }: TagManagerModalProps): React.ReactElement {
  const { tags, addProjectTag, updateProjectTag, deleteProjectTag } = useProjectStore()
  
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[7]) // Default Blue
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingColor, setEditingColor] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAddTag(): Promise<void> {
    if (!newTagName.trim()) {
      toast.error('Tag name cannot be empty')
      return
    }
    setSaving(true)
    try {
      await addProjectTag(newTagName.trim(), newTagColor)
      setNewTagName('')
      toast.success('Tag created successfully')
    } catch (err) {
      toast.error('Failed to create tag')
    } finally {
      setSaving(false)
    }
  }

  function startEditing(id: string, name: string, color: string): void {
    setEditingId(id)
    setEditingName(name)
    setEditingColor(color)
  }

  async function handleSaveEdit(id: string): Promise<void> {
    if (!editingName.trim()) {
      toast.error('Tag name cannot be empty')
      return
    }
    setSaving(true)
    try {
      await updateProjectTag(id, { name: editingName.trim(), color: editingColor })
      setEditingId(null)
      toast.success('Tag updated')
    } catch (err) {
      toast.error('Failed to update tag')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTag(id: string): Promise<void> {
    if (confirm('Are you sure you want to delete this tag? It will be removed from all tasks.')) {
      setSaving(true)
      try {
        await deleteProjectTag(id)
        toast.success('Tag deleted')
      } catch (err) {
        toast.error('Failed to delete tag')
      } finally {
        setSaving(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/30 shrink-0">
          <DialogTitle>Manage Project Tags</DialogTitle>
          <DialogDescription>
            Create, edit, or delete tags for this project.
          </DialogDescription>
        </DialogHeader>

        {/* Existing Tags List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Current Tags ({tags.length})
            </h4>
            
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-xl border border-dashed">
                No tags created yet.
              </p>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => {
                  const isEditing = editingId === tag.id
                  return (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between gap-3 p-2 rounded-xl border border-border/30 bg-card hover:bg-muted/10 transition-all duration-200"
                    >
                      {isEditing ? (
                        <div className="flex flex-col gap-2 w-full">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={editingColor}
                              onChange={(e) => setEditingColor(e.target.value)}
                              className="h-7 w-7 rounded-md border-0 cursor-pointer overflow-hidden bg-transparent shrink-0"
                            />
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-8 flex-1"
                              placeholder="Tag name"
                              autoFocus
                            />
                            <Button
                              size="icon"
                              variant="default"
                              className="h-8 w-8 rounded-lg shrink-0"
                              onClick={() => handleSaveEdit(tag.id)}
                              disabled={saving}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 rounded-lg shrink-0"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {/* Color palette selector for editing */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {PRESET_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`h-5 w-5 rounded-full border transition-all duration-200 hover:scale-110 ${
                                  editingColor === color ? 'ring-2 ring-primary ring-offset-1 scale-105' : 'border-border/30'
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => setEditingColor(color)}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5">
                            <span
                              style={{
                                backgroundColor: `${tag.color}20`,
                                color: tag.color,
                                borderColor: `${tag.color}40`,
                              }}
                              className="inline-flex items-center rounded-lg border px-3 py-1 text-xs font-bold tracking-wide transition-all shadow-xs"
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full mr-2"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                              onClick={() => startEditing(tag.id, tag.name, tag.color)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteTag(tag.id)}
                              disabled={saving}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="h-[1px] bg-border/20 my-4" />

          {/* Create Tag Section */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-muted/30 border border-border/40">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Create New Tag
            </h4>
            <div className="flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name (e.g. Documentation)"
                className="h-9 flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              />
              
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="h-9 w-9 rounded-lg border border-border/45 cursor-pointer overflow-hidden p-0 bg-transparent shrink-0"
                title="Custom color selector"
              />

              <Button
                onClick={handleAddTag}
                disabled={saving || !newTagName.trim()}
                className="h-9 gap-1.5 px-3 rounded-lg"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>

            {/* Quick preset color picker */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Preset Palette
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-6 w-6 rounded-full border transition-all duration-200 hover:scale-110 ${
                      newTagColor === color ? 'ring-2 ring-primary ring-offset-2 scale-105' : 'border-border/30'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTagColor(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/30 shrink-0">
          <Button variant="default" onClick={() => onOpenChange(false)} className="rounded-lg font-bold">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
