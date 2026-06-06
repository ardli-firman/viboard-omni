import { useEffect, useMemo, useState } from 'react'
import type { Task } from '@shared/types'
import { KanbanColumn } from './Column'
import { TaskModal } from '../Modal/TaskModal'
import { ColumnModal } from '../Modal/ColumnModal'
import { useProjectStore } from '../../stores/projectStore'
import { useTerminalStore } from '../../stores/terminalStore'
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { KanbanCard } from './Card'
import { Button } from '../ui/button'
import { ScrollArea, ScrollBar } from '../ui/scroll-area'
import { Plus } from 'lucide-react'

export function Board(): React.ReactElement {
  const {
    columns,
    tasks,
    addColumn,
    addTask,
    updateTask,
    deleteTask,
    deleteColumn,
    reorderColumns,
  } = useProjectStore()
  const { openPanel } = useTerminalStore()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'task' | 'column' | null>(null)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [columnModalOpen, setColumnModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskColumnId, setTaskColumnId] = useState<string>('')

  // Local order state — the source of truth for visual column order.
  // Synced from the store (and external mutations like addColumn/deleteColumn),
  // updated synchronously on drop for realtime UI.
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [syncedSignature, setSyncedSignature] = useState<string>('')

  const sortedColumnsFromStore = useMemo(
    () => [...columns].sort((a, b) => a.order - b.order),
    [columns],
  )

  // Sync local order from store whenever the store's order changes externally
  // (e.g., loadData, addColumn, deleteColumn). We detect changes via a
  // signature so we only resync when the actual order changed, not on every
  // re-render or unrelated state update.
  useEffect(() => {
    const storeIds = sortedColumnsFromStore.map((c) => c.id)
    const signature = storeIds.join('|')
    if (signature !== syncedSignature) {
      setColumnOrder(storeIds)
      setSyncedSignature(signature)
    }
  }, [sortedColumnsFromStore, syncedSignature])

  const sortedColumns = useMemo(
    () =>
      columnOrder
        .map((id) => sortedColumnsFromStore.find((c) => c.id === id))
        .filter((c): c is (typeof sortedColumnsFromStore)[number] => Boolean(c)),
    [columnOrder, sortedColumnsFromStore],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function getTasksByColumn(columnId: string): Task[] {
    return tasks.filter((t) => t.columnId === columnId).sort((a, b) => a.order - b.order)
  }

  function handleDragStart(event: DragStartEvent): void {
    setActiveId(event.active.id as string)
    setActiveType((event.active.data.current?.type as 'task' | 'column' | undefined) ?? null)
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (!over || active.id === over.id) {
      setActiveId(null)
      setActiveType(null)
      return
    }

    const type = active.data.current?.type as 'task' | 'column' | undefined

    if (type === 'column') {
      // Resolve target column id: over.id may be a column or a task inside a column
      let overColId = over.id as string
      if (!sortedColumnsFromStore.some((c) => c.id === overColId)) {
        const overTask = tasks.find((t) => t.id === over.id)
        if (overTask) overColId = overTask.columnId
        else {
          setActiveId(null)
          setActiveType(null)
          return
        }
      }

      const oldIndex = columnOrder.indexOf(active.id as string)
      const newIndex = columnOrder.indexOf(overColId)
      if (oldIndex < 0 || newIndex < 0) {
        setActiveId(null)
        setActiveType(null)
        return
      }

      const newOrder = [...columnOrder]
      const [moved] = newOrder.splice(oldIndex, 1)
      newOrder.splice(newIndex, 0, moved)

      // Update local order synchronously so dnd-kit sees the new items in
      // the same render cycle, then persist to store/DB in the background.
      setColumnOrder(newOrder)
      setSyncedSignature(newOrder.join('|'))
      reorderColumns(newOrder.map((id, i) => ({ id, order: i })))

      setActiveId(null)
      setActiveType(null)
      return
    }

    // Task reorder — optimistic update: sync state first, persist in background.
    const activeTask = tasks.find((t) => t.id === active.id)
    if (!activeTask) return
    let targetColId = over.id as string
    const overTask = tasks.find((t) => t.id === over.id)
    if (overTask) {
      targetColId = overTask.columnId
    }
    const targetTasks = tasks.filter((t) => t.columnId === targetColId && t.id !== active.id).sort((a, b) => a.order - b.order)
    const overIndex = overTask ? targetTasks.findIndex((t) => t.id === over.id) : targetTasks.length
    targetTasks.splice(overIndex < 0 ? targetTasks.length : overIndex, 0, activeTask)

    // Build updated order map and apply synchronously so dnd-kit sees new order immediately.
    const orderMap: Record<string, { columnId: string; order: number }> = {}
    for (const [i, t] of targetTasks.entries()) {
      orderMap[t.id] = { columnId: targetColId, order: i }
    }
    useProjectStore.setState((s) => ({
      tasks: s.tasks.map((t) => {
        const update = orderMap[t.id]
        return update ? { ...t, columnId: update.columnId, order: update.order } : t
      }),
    }))

    // Persist in background.
    for (const [i, t] of targetTasks.entries()) {
      window.electronAPI.moveTask(t.id, targetColId, i).catch((err) => {
        console.error('Failed to persist task reorder:', err)
      })
    }

    setActiveId(null)
    setActiveType(null)
  }

  function handleAddTask(columnId: string): void {
    setEditingTask(null)
    setTaskColumnId(columnId)
    setTaskModalOpen(true)
  }

  function handleEditTask(task: Task): void {
    setEditingTask(task)
    setTaskColumnId(task.columnId)
    setTaskModalOpen(true)
  }

  async function handleSaveTask(data: { title: string; description: string; tags: string[] }): Promise<void> {
    if (editingTask) {
      await updateTask(editingTask.id, { title: data.title, description: data.description, tags: data.tags })
    } else {
      await addTask({
        title: data.title,
        description: data.description,
        columnId: taskColumnId,
        tags: data.tags,
      })
    }
  }

  const activeTask = activeId && activeType === 'task' ? tasks.find((t) => t.id === activeId) : null
  const activeColumn = activeId && activeType === 'column' ? sortedColumnsFromStore.find((c) => c.id === activeId) : null

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="flex items-center justify-between border-b border-border/40 bg-background/40 px-6 py-4 backdrop-blur-md">
        <h2 className="text-xl font-bold tracking-tight text-primary">Board</h2>
        <Button variant="default" size="sm" className="rounded-full font-medium shadow-sm transition-transform hover:scale-105" onClick={() => setColumnModalOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />Add Column
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex gap-4 p-6 min-h-full">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columnOrder}
              strategy={horizontalListSortingStrategy}
            >
              {sortedColumns.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  tasks={getTasksByColumn(col.id)}
                  taskCount={getTasksByColumn(col.id).length}
                  onAddTask={() => handleAddTask(col.id)}
                  onEditTask={handleEditTask}
                  onDeleteTask={deleteTask}
                  onOpenChat={(task) => openPanel(task.id)}
                  onDeleteColumn={deleteColumn}
                />
              ))}
            </SortableContext>
            <DragOverlay>
              {activeTask ? (
                <KanbanCard
                  task={activeTask}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onOpenChat={() => {}}
                />
              ) : activeColumn ? (
                <div className="flex w-72 shrink-0 scale-105 flex-col gap-3 rounded-2xl border border-primary/20 bg-background/60 p-4 opacity-95 shadow-xl backdrop-blur-xl transition-transform">
                  <div className="text-base font-bold text-primary">{activeColumn.title}</div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {tasks.filter((t) => t.columnId === activeColumn.id).length} tasks
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
          {sortedColumns.length === 0 && (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-background/20 px-10 py-8 text-center backdrop-blur-sm">
                <p className="text-sm font-medium text-muted-foreground">
                  No columns in this board
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Use the <span className="font-semibold text-foreground/80">Add Column</span> button above to create one.
                </p>
              </div>
            </div>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <TaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        task={editingTask}
        onSave={handleSaveTask}
      />
      <ColumnModal
        open={columnModalOpen}
        onOpenChange={setColumnModalOpen}
        onSave={async (title, color) => { await addColumn(title, color) }}
      />
    </div>
  )
}
