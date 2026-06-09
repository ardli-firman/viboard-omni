import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Task, AgentType, AgentCliConfig } from '@shared/types'
import { KanbanColumn } from './Column'
import { TaskModal } from '../Modal/TaskModal'
import { ColumnModal } from '../Modal/ColumnModal'
import { TagManagerModal } from '../Modal/TagManagerModal'
import { useProjectStore } from '../../stores/projectStore'
import { useTerminalStore } from '../../stores/terminalStore'
import { TerminalManager } from '../Terminal/TerminalManager'
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
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
  arrayMove,
} from '@dnd-kit/sortable'
import { KanbanCard } from './Card'
import { Button } from '../ui/button'
import { Minus, Plus, Maximize2, RotateCcw, Tag } from 'lucide-react'

export function Board(): React.ReactElement {
  const {
    columns,
    tasks,
    currentProject,
    addColumn,
    addTask,
    updateTask,
    deleteTask,
    deleteColumn,
    reorderColumns,
    updateColumn,
  } = useProjectStore()
  const { openPanel } = useTerminalStore()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'task' | 'column' | null>(null)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [columnModalOpen, setColumnModalOpen] = useState(false)
  const [tagManagerOpen, setTagManagerOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskColumnId, setTaskColumnId] = useState<string>('')

  // Local order state — the source of truth for visual column order.
  // Synced from the store (and external mutations like addColumn/deleteColumn),
  // updated synchronously on drop for realtime UI.
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [syncedSignature, setSyncedSignature] = useState<string>('')
  const [scale, setScale] = useState(1)
  const [isPanning, setIsPanning] = useState(false)

  const [collapsedColumns, setCollapsedColumns] = useState<string[]>([])

  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartColumnRef = useRef<string | null>(null)
  const [boardDimensions, setBoardDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (boardRef.current) {
      setBoardDimensions({
        width: boardRef.current.offsetWidth,
        height: boardRef.current.offsetHeight,
      })
    }
  }, [columns, tasks, columnOrder, collapsedColumns])

  useEffect(() => {
    if (currentProject) {
      try {
        const saved = localStorage.getItem(`viboard_collapsed_cols_${currentProject}`)
        setCollapsedColumns(saved ? JSON.parse(saved) : [])
      } catch {
        setCollapsedColumns([])
      }
    } else {
      setCollapsedColumns([])
    }
  }, [currentProject])

  const toggleColumnCollapse = (colId: string) => {
    setCollapsedColumns((prev) => {
      const next = prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
      if (currentProject) {
        localStorage.setItem(`viboard_collapsed_cols_${currentProject}`, JSON.stringify(next))
      }
      return next
    })
  }

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

    const type = event.active.data.current?.type as 'task' | 'column' | undefined
    if (type === 'task') {
      const storeTasks = useProjectStore.getState().tasks
      const task = storeTasks.find((t) => t.id === event.active.id)
      if (task) {
        dragStartColumnRef.current = task.columnId
      }
    } else {
      dragStartColumnRef.current = null
    }

    window.electronAPI.log.info('[Board] handleDragStart:', {
      activeId: event.active.id,
      activeType: type,
      dragStartColumn: dragStartColumnRef.current
    })
  }

  function handleDragOver(event: DragOverEvent): void {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeType = active.data.current?.type as 'task' | 'column' | undefined
    if (activeType !== 'task') return

    window.electronAPI.log.info('[Board] handleDragOver start:', {
      activeId: active.id,
      overId: over.id
    })

    const storeTasks = useProjectStore.getState().tasks
    const activeTask = storeTasks.find((t) => t.id === active.id)
    if (!activeTask) return

    // Determine the target column
    let overColId: string
    const overTask = storeTasks.find((t) => t.id === over.id)
    if (overTask) {
      overColId = overTask.columnId
    } else if (sortedColumnsFromStore.some((c) => c.id === over.id)) {
      overColId = over.id as string
    } else {
      return
    }

    const fromColId = activeTask.columnId

    if (fromColId === overColId) {
      const colTasks = storeTasks
        .filter((t) => t.columnId === fromColId)
        .sort((a, b) => a.order - b.order)
      const activeIndex = colTasks.findIndex((t) => t.id === active.id)
      const overIndex = colTasks.findIndex((t) => t.id === over.id)

      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        const reordered = arrayMove(colTasks, activeIndex, overIndex)
        const orderMap: Record<string, { columnId: string; order: number }> = {}
        for (const [i, t] of reordered.entries()) {
          orderMap[t.id] = { columnId: fromColId, order: i }
        }
        useProjectStore.setState((s) => ({
          tasks: s.tasks.map((t) => {
            const update = orderMap[t.id]
            return update ? { ...t, columnId: update.columnId, order: update.order } : t
          }),
        }))
      }
    } else {
      // Reordering cross-column
      const targetTasks = storeTasks
        .filter((t) => t.columnId === overColId && t.id !== active.id)
        .sort((a, b) => a.order - b.order)

      const overIndex = overTask
        ? targetTasks.findIndex((t) => t.id === over.id)
        : targetTasks.length

      targetTasks.splice(overIndex < 0 ? targetTasks.length : overIndex, 0, activeTask)

      // Build update map
      const orderMap: Record<string, { columnId: string; order: number }> = {}
      for (const [i, t] of targetTasks.entries()) {
        orderMap[t.id] = { columnId: overColId, order: i }
      }

      // Reorder the source column to close the gap
      const sourceTasks = storeTasks
        .filter((t) => t.columnId === fromColId && t.id !== active.id)
        .sort((a, b) => a.order - b.order)
      for (const [i, t] of sourceTasks.entries()) {
        orderMap[t.id] = { columnId: fromColId, order: i }
      }

      useProjectStore.setState((s) => ({
        tasks: s.tasks.map((t) => {
          const update = orderMap[t.id]
          return update ? { ...t, columnId: update.columnId, order: update.order } : t
        }),
      }))
    }
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event

    window.electronAPI.log.info('[Board] handleDragEnd called:', {
      activeId: active.id,
      overId: over?.id,
      activeType: active.data.current?.type,
      dragStartColumn: dragStartColumnRef.current
    })

    if (!over) {
      setActiveId(null)
      setActiveType(null)
      return
    }

    const type = active.data.current?.type as 'task' | 'column' | undefined

    if (type === 'column') {
      if (active.id === over.id) {
        setActiveId(null)
        setActiveType(null)
        return
      }
      const storeColumns = useProjectStore.getState().columns
      const storeTasks = useProjectStore.getState().tasks
      // Resolve target column id: over.id may be a column or a task inside a column
      let overColId = over.id as string
      if (!storeColumns.some((c) => c.id === overColId)) {
        const overTask = storeTasks.find((t) => t.id === over.id)
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

    // Task reorder
    const storeTasks = useProjectStore.getState().tasks
    const activeTask = storeTasks.find((t) => t.id === active.id)

    window.electronAPI.log.info('[Board] handleDragEnd Task reorder state:', {
      activeTaskFound: !!activeTask,
      activeTaskColumn: activeTask?.columnId,
      activeTaskOrder: activeTask?.order
    })

    if (!activeTask) {
      setActiveId(null)
      setActiveType(null)
      return
    }

    // Persist all tasks in the affected column(s) to the database.
    const affectedColIds = new Set<string>()
    // Add current/new column ID
    affectedColIds.add(activeTask.columnId)
    // Add original column ID
    if (dragStartColumnRef.current) {
      affectedColIds.add(dragStartColumnRef.current)
    }

    const tasksToUpdate: { id: string; columnId: string; order: number }[] = []
    for (const colId of affectedColIds) {
      const colTasks = storeTasks.filter((t) => t.columnId === colId).sort((a, b) => a.order - b.order)
      colTasks.forEach((t, i) => {
        tasksToUpdate.push({ id: t.id, columnId: colId, order: i })
      })
    }

    window.electronAPI.log.info('[Board] handleDragEnd tasksToUpdate:', tasksToUpdate)

    if (tasksToUpdate.length > 0) {
      window.electronAPI.reorderTasks(tasksToUpdate).catch((err) => {
        console.error('Failed to persist task reorder:', err)
      })
    }

    dragStartColumnRef.current = null
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

  async function handleSaveTask(data: {
    title: string
    description: string
    tags: string[]
    agentType: AgentType
    agentConfig?: Partial<AgentCliConfig>
  }): Promise<void> {
    if (editingTask) {
      const configChanged =
        editingTask.agentType !== data.agentType ||
        JSON.stringify(editingTask.agentConfig) !== JSON.stringify(data.agentConfig)

      if (configChanged) {
        await window.electronAPI.killAgentPty(editingTask.id)
        TerminalManager.getInstance().dispose(editingTask.id)
      }

      await updateTask(editingTask.id, {
        title: data.title,
        description: data.description,
        tags: data.tags,
        agentType: data.agentType,
        agentConfig: data.agentConfig,
      })
    } else {
      await addTask({
        title: data.title,
        description: data.description,
        columnId: taskColumnId,
        tags: data.tags,
        agentType: data.agentType,
        agentConfig: data.agentConfig,
      })
    }
  }

  function handleWheel(e: React.WheelEvent): void {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY > 0 ? -0.05 : 0.05
      setScale(prev => Math.max(0.1, Math.min(2, prev + delta)))
    }
  }

  function zoomIn(): void {
    setScale(prev => Math.min(2, prev + 0.1))
  }

  function zoomOut(): void {
    setScale(prev => Math.max(0.1, prev - 0.1))
  }

  function resetZoom(): void {
    setScale(1)
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0
      containerRef.current.scrollTop = 0
    }
  }

  function autoFit(): void {
    if (!boardRef.current || !containerRef.current) return
    const boardWidth = boardRef.current.offsetWidth
    const boardHeight = boardRef.current.offsetHeight
    const containerWidth = containerRef.current.clientWidth
    const containerHeight = containerRef.current.clientHeight

    if (boardWidth > 0 && containerWidth > 0 && boardHeight > 0 && containerHeight > 0) {
      const padding = 48
      const scaleX = (containerWidth - padding) / boardWidth
      const scaleY = (containerHeight - padding) / boardHeight
      const fitScale = Math.max(0.1, Math.min(1, Math.min(scaleX, scaleY)))

      setScale(fitScale)
      if (containerRef.current) {
        containerRef.current.scrollLeft = 0
        containerRef.current.scrollTop = 0
      }
    }
  }

  function handleMouseDown(e: React.MouseEvent): void {
    if (e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: containerRef.current?.scrollLeft ?? 0,
        ty: containerRef.current?.scrollTop ?? 0,
      }
    }
  }

  function handleMouseMove(e: React.MouseEvent): void {
    if (!panStartRef.current || !containerRef.current) return
    const dx = e.clientX - panStartRef.current.x
    const dy = e.clientY - panStartRef.current.y
    containerRef.current.scrollLeft = panStartRef.current.tx - dx
    containerRef.current.scrollTop = panStartRef.current.ty - dy
  }

  function handleMouseUp(): void {
    setIsPanning(false)
    panStartRef.current = null
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '=':
          case '+':
            e.preventDefault()
            zoomIn()
            break
          case '-':
            e.preventDefault()
            zoomOut()
            break
          case '0':
            e.preventDefault()
            resetZoom()
            break
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function preventWheel(e: WheelEvent): void {
      if (e.ctrlKey || e.metaKey) e.preventDefault()
    }
    el.addEventListener('wheel', preventWheel, { passive: false })
    return () => el.removeEventListener('wheel', preventWheel)
  }, [])

  const activeTask = activeId && activeType === 'task' ? tasks.find((t) => t.id === activeId) : null
  const activeColumn = activeId && activeType === 'column' ? sortedColumnsFromStore.find((c) => c.id === activeId) : null

  return (
    <div className="relative flex h-full flex-col bg-transparent">
      <div className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-border/25 bg-background/40 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">Kanban Board</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl font-bold shadow-xs transition-all hover:bg-muted"
            onClick={() => setTagManagerOpen(true)}
          >
            <Tag className="mr-1.5 h-4 w-4" />Tags
          </Button>
          <Button
            variant="default"
            size="sm"
            className="rounded-xl font-bold shadow-sm transition-all hover:scale-[1.02] hover:shadow-md active:scale-98"
            onClick={() => setColumnModalOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />Add Column
          </Button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative flex-1 select-none overflow-auto"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? 'grabbing' : undefined }}
      >

        <div
          style={{
            width: `${boardDimensions.width * scale}px`,
            height: `${boardDimensions.height * scale}px`,
            position: 'relative',
          }}
        >
          <div
            ref={boardRef}
            className="flex gap-5 p-6 absolute top-0 left-0"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
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
                  onUpdateColumn={updateColumn}
                  isCollapsed={collapsedColumns.includes(col.id)}
                  onToggleCollapse={() => toggleColumnCollapse(col.id)}
                />
              ))}
            </SortableContext>
            {createPortal(
              <DragOverlay>
                {activeTask ? (
                  <div style={{ width: '292px', transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                    <KanbanCard
                      task={activeTask}
                      onEdit={() => {}}
                      onDelete={() => {}}
                      onOpenChat={() => {}}
                    />
                  </div>
                ) : activeColumn ? (
                  <div style={{ width: collapsedColumns.includes(activeColumn.id) ? '64px' : '288px', transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                    <div className="flex w-full shrink-0 scale-105 flex-col gap-3 rounded-2xl border border-primary/20 bg-background/60 p-4 opacity-95 shadow-xl backdrop-blur-xl transition-transform">
                      <div className="text-base font-bold text-primary truncate">{activeColumn.title}</div>
                      {!collapsedColumns.includes(activeColumn.id) && (
                        <div className="text-sm font-medium text-muted-foreground">
                          {tasks.filter((t) => t.columnId === activeColumn.id).length} tasks
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </DragOverlay>,
              document.body
            )}
          </DndContext>
          {sortedColumns.length === 0 && (
            <div className="flex min-w-100 items-center justify-center">
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
        </div>
      </div>
      {/* Floating Compact Zoom Controls */}
      <div
        className="absolute bottom-6 right-6 z-20 flex items-center gap-1 rounded-xl border border-border/40 bg-background/60 p-1 shadow-lg backdrop-blur-md transition-all hover:bg-background/80 hover:shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={zoomOut}
          disabled={scale <= 0.1}
          title="Zoom out (Ctrl+-)"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <button
          onClick={resetZoom}
          className="min-w-12 px-1 text-center text-xs font-semibold tabular-nums text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Reset zoom to 100% (Ctrl+0)"
        >
          {Math.round(scale * 100)}%
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={zoomIn}
          disabled={scale >= 2}
          title="Zoom in (Ctrl++)"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <div className="h-4 w-px bg-border/40 mx-0.5" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={autoFit}
          title="Fit board to viewport"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={resetZoom}
          disabled={scale === 1}
          title="Reset position and zoom (Ctrl+0)"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
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
      <TagManagerModal
        open={tagManagerOpen}
        onOpenChange={setTagManagerOpen}
      />
    </div>
  )
}
