import { useState, useEffect } from 'react'
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
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { KanbanCard } from './Card'
import { Button } from '../ui/button'
import { ScrollArea, ScrollBar } from '../ui/scroll-area'
import { Plus } from 'lucide-react'

export function Board(): React.ReactElement {
  const { columns, tasks, loadData, addColumn, addTask, updateTask, deleteTask, moveTask } = useProjectStore()
  const { openPanel } = useTerminalStore()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [columnModalOpen, setColumnModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskColumnId, setTaskColumnId] = useState<string>('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => { loadData() }, [loadData])

  function getTasksByColumn(columnId: string): Task[] {
    return tasks.filter((t) => t.columnId === columnId).sort((a, b) => a.order - b.order)
  }

  function handleDragStart(event: DragStartEvent): void {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeTask = tasks.find((t) => t.id === active.id)
    if (!activeTask) return
    let targetColId = over.id as string
    const overTask = tasks.find((t) => t.id === over.id)
    if (overTask) {
      targetColId = overTask.columnId
    }
    const targetTasks = tasks.filter((t) => t.columnId === targetColId && t.id !== active.id)
    const overIndex = overTask ? targetTasks.findIndex((t) => t.id === over.id) : targetTasks.length
    targetTasks.splice(overIndex < 0 ? targetTasks.length : overIndex, 0, activeTask)
    for (const [i, t] of targetTasks.entries()) {
      moveTask(t.id, targetColId, i)
    }
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

  async function handleSaveTask(data: { title: string; description: string; projectPath: string; tags: string[] }): Promise<void> {
    if (editingTask) {
      await updateTask(editingTask.id, data)
    } else {
      await addTask({
        title: data.title,
        description: data.description,
        columnId: taskColumnId,
        projectPath: data.projectPath,
        agentType: 'pi-agent',
        tags: data.tags,
      })
    }
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <h2 className="text-lg font-semibold">Board</h2>
        <Button variant="outline" size="sm" onClick={() => setColumnModalOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />Add Column
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
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={getTasksByColumn(col.id)}
                onAddTask={() => handleAddTask(col.id)}
                onEditTask={handleEditTask}
                onDeleteTask={deleteTask}
                onOpenTerminal={(task) => openPanel(task.id)}
              />
            ))}
            <DragOverlay>
              {activeTask ? <KanbanCard task={activeTask} onEdit={() => {}} onDelete={() => {}} onOpenTerminal={() => {}} /> : null}
            </DragOverlay>
          </DndContext>
          {columns.length === 0 && (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground">No columns yet</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setColumnModalOpen(true)}>
                  Create your first column
                </Button>
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
