/**
 * KANBAN BOARD - Main Component
 * Smart AI Engineering Platform - SPKBG
 * 
 * Kanban Board dengan drag & drop menggunakan dnd-kit
 * 4 Kolom: Pending | In Progress | Done | Blocked
 */

import { useEffect, useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Plus, Filter, RefreshCw, Calendar } from 'lucide-react'
import { useKanbanStore, useTaskCounts } from '@/stores/kanbanStore'
import type { TeamTask, TaskStatus } from '@/services/team/teamService'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from './TaskCard'
import { CreateTaskModal } from './CreateTaskModal'

// ============================================================================
// TYPES
// ============================================================================

interface KanbanBoardProps {
  teamId: string
}

interface ColumnDef {
  id: TaskStatus
  title: string
  color: string
  bgColor: string
}

// ============================================================================
// COLUMN DEFINITIONS
// ============================================================================

const COLUMNS: ColumnDef[] = [
  { 
    id: 'pending', 
    title: 'Pending', 
    color: 'border-yellow-400',
    bgColor: 'bg-yellow-50/50'
  },
  { 
    id: 'in_progress', 
    title: 'In Progress', 
    color: 'border-blue-400',
    bgColor: 'bg-blue-50/50'
  },
  { 
    id: 'done', 
    title: 'Done', 
    color: 'border-green-400',
    bgColor: 'bg-green-50/50'
  },
  { 
    id: 'blocked', 
    title: 'Blocked', 
    color: 'border-red-400',
    bgColor: 'bg-red-50/50'
  },
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function KanbanBoard({ teamId }: KanbanBoardProps): JSX.Element {
  const {
    tasks,
    loadTasks,
    loadMembers,
    isLoading,
    isUpdating,
    openCreateModal,
    updateTaskStatus,
    subscribeToChanges,
  } = useKanbanStore()

  const counts = useTaskCounts()
  const [, setActiveId] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<TeamTask | null>(null)

  // Load data on mount
  useEffect(() => {
    loadTasks(teamId)
    loadMembers(teamId)
    
    // Subscribe to real-time changes
    const unsubscribe = subscribeToChanges()
    return () => unsubscribe()
  }, [teamId])

  // Setup dnd sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Minimum 5px movement to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Group tasks by status
  const tasksByColumn = useMemo(() => {
    const result: Record<TaskStatus, TeamTask[]> = {
      pending: tasks.filter(t => t.status === 'pending'),
      in_progress: tasks.filter(t => t.status === 'in_progress'),
      review: tasks.filter(t => t.status === 'review'),
      done: tasks.filter(t => t.status === 'done'),
      blocked: tasks.filter(t => t.status === 'blocked'),
      cancelled: tasks.filter(t => t.status === 'cancelled'),
    }
    return result
  }, [tasks])

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id as string)
    
    const task = tasks.find(t => t.id === active.id)
    if (task) {
      setActiveTask(task)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    
    if (!over) return

    const activeTask = tasks.find(t => t.id === active.id)
    if (!activeTask) return

    const overId = over.id as string
    
    // Check if dragging over a column
    const isOverColumn = COLUMNS.some(col => col.id === overId)
    
    if (isOverColumn && activeTask.status !== overId) {
      // Update status optimistically
      useKanbanStore.getState().updateTask(activeTask.id, { status: overId as TaskStatus })
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    setActiveId(null)
    setActiveTask(null)

    if (!over) return

    const activeTask = tasks.find(t => t.id === active.id)
    if (!activeTask) return

    const overId = over.id as string
    
    // Check if dropped on a column
    const isOverColumn = COLUMNS.some(col => col.id === overId)
    
    if (isOverColumn && activeTask.status !== overId) {
      // Update status in database
      const success = await updateTaskStatus(activeTask.id, overId as TaskStatus)
      
      if (!success) {
        // Revert on error
        useKanbanStore.getState().updateTask(activeTask.id, { status: activeTask.status })
      }
    }
  }

  // Drop animation config
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  }

  // Refresh handler
  const handleRefresh = () => {
    loadTasks(teamId)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Task Board</h2>
          <p className="text-sm text-gray-500 mt-1">
            {counts.total} tugas total • {counts.pending} pending • {counts.in_progress} proses • {counts.done} selesai
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Filter button */}
          <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Filter className="w-4 h-4" />
            <span className="text-sm">Filter</span>
          </button>

          {/* Add task button */}
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tugas Baru</span>
          </button>
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {COLUMNS.map(column => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={tasksByColumn[column.id]}
              isUpdating={isUpdating}
            />
          ))}
        </div>

        {/* Drag Overlay - Shows while dragging */}
        <DragOverlay dropAnimation={dropAnimation}>
          {activeTask ? (
            <TaskCard 
              task={activeTask} 
              isOverlay 
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Create Task Modal */}
      <CreateTaskModal teamId={teamId} />

      {/* Loading overlay */}
      {isUpdating && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Updating...</span>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// BOARD STATS COMPONENT
// ============================================================================

export function KanbanStats(): JSX.Element {
  const counts = useTaskCounts()

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-yellow-700">{counts.pending}</p>
            <p className="text-sm text-yellow-600">Pending</p>
          </div>
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <Calendar className="w-5 h-5 text-yellow-600" />
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-blue-700">{counts.in_progress}</p>
            <p className="text-sm text-blue-600">In Progress</p>
          </div>
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-green-700">{counts.done}</p>
            <p className="text-sm text-green-600">Done</p>
          </div>
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <Plus className="w-5 h-5 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-red-700">{counts.blocked}</p>
            <p className="text-sm text-red-600">Blocked</p>
          </div>
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <Calendar className="w-5 h-5 text-red-600" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default KanbanBoard
