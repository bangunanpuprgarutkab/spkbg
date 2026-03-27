/**
 * TASK CARD COMPONENT
 * Smart AI Engineering Platform - SPKBG
 * 
 * Kartu tugas untuk Kanban Board dengan drag & drop support
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, User, AlertCircle, Clock, MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import type { TeamTask } from '@/services/team/teamService'

// ============================================================================
// TYPES
// ============================================================================

interface TaskCardProps {
  task: TeamTask
  isOverlay?: boolean
  isDragging?: boolean
}

interface SortableTaskCardProps {
  task: TeamTask
}

// ============================================================================
// PRIORITY & STATUS HELPERS
// ============================================================================

const getPriorityConfig = (priority: string) => {
  const configs: Record<string, { color: string; bg: string; label: string }> = {
    low: { 
      color: 'text-gray-600', 
      bg: 'bg-gray-100',
      label: 'Low'
    },
    medium: { 
      color: 'text-blue-600', 
      bg: 'bg-blue-100',
      label: 'Medium'
    },
    high: { 
      color: 'text-orange-600', 
      bg: 'bg-orange-100',
      label: 'High'
    },
    urgent: { 
      color: 'text-red-600', 
      bg: 'bg-red-100',
      label: 'Urgent'
    },
  }
  return configs[priority] || configs.medium
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-500" />
    case 'in_progress':
      return <Clock className="w-4 h-4 text-blue-500" />
    case 'done':
      return <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    case 'blocked':
      return <AlertCircle className="w-4 h-4 text-red-500" />
    default:
      return <Clock className="w-4 h-4 text-gray-400" />
  }
}

// ============================================================================
// TASK CARD (Static)
// ============================================================================

export function TaskCard({ task, isOverlay, isDragging }: TaskCardProps): JSX.Element {
  const priorityConfig = getPriorityConfig(task.priority)
  
  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No deadline'
    const date = new Date(dateString)
    return date.toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }

  // Check if overdue
  const isOverdue = task.isOverdue || (
    task.dueDate && 
    new Date(task.dueDate) < new Date() && 
    task.status !== 'done' && 
    task.status !== 'cancelled'
  )

  // Get status label
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pending',
      in_progress: 'In Progress',
      done: 'Done',
      blocked: 'Blocked',
      cancelled: 'Cancelled',
    }
    return labels[status] || status
  }

  return (
    <div
      className={`
        bg-white rounded-lg p-4 shadow-sm border border-gray-200
        hover:shadow-md transition-shadow
        ${isOverlay ? 'shadow-xl ring-2 ring-blue-400 rotate-2 cursor-grabbing' : ''}
        ${isDragging ? 'opacity-50' : ''}
        ${isOverdue ? 'border-l-4 border-l-red-500' : ''}
        cursor-grab active:cursor-grabbing
      `}
    >
      {/* Header: Priority & Status */}
      <div className="flex justify-between items-start mb-2">
        <span className={`
          px-2 py-0.5 rounded text-xs font-medium
          ${priorityConfig.bg} ${priorityConfig.color}
        `}>
          {priorityConfig.label}
        </span>
        <div className="flex items-center gap-1">
          {getStatusIcon(task.status)}
          <span className="text-xs text-gray-500">{getStatusLabel(task.status)}</span>
        </div>
      </div>

      {/* Title */}
      <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2">
        {task.title}
      </h4>

      {/* Description (if any) */}
      {task.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Progress bar (if in progress) */}
      {task.status === 'in_progress' && task.progressPercentage > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{task.progressPercentage}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${task.progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer: Assigned & Due Date */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <User className="w-3.5 h-3.5" />
          <span className="truncate max-w-[100px]">
            {task.assignedToName || 'Unassigned'}
          </span>
        </div>
        
        <div className={`
          flex items-center gap-1
          ${isOverdue ? 'text-red-600 font-medium' : ''}
          ${task.isDueToday ? 'text-orange-600' : ''}
        `}>
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDate(task.dueDate)}</span>
          {isOverdue && <span className="text-red-600">(Overdue)</span>}
        </div>
      </div>

      {/* Task Type Badge */}
      {task.taskType && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            {task.taskType === 'survey' && '🔍 Survey'}
            {task.taskType === 'analisis' && '📊 Analisis'}
            {task.taskType === 'verifikasi' && '✓ Verifikasi'}
            {task.taskType === 'dokumentasi' && '📄 Dokumentasi'}
            {task.taskType === 'rapat' && '👥 Rapat'}
            {task.taskType === 'lainnya' && '📋 Lainnya'}
          </span>
        </div>
      )}

      {/* Actions (visible on hover) */}
      {!isOverlay && (
        <div className="
          mt-3 pt-2 border-t border-gray-100
          flex items-center justify-between
          opacity-0 group-hover:opacity-100 transition-opacity
        ">
          <div className="flex gap-1">
            <button className="p-1 hover:bg-gray-100 rounded">
              <Edit className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <button className="p-1 hover:bg-gray-100 rounded">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
          <button className="p-1 hover:bg-gray-100 rounded">
            <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SORTABLE TASK CARD (with DnD)
// ============================================================================

export function SortableTaskCard({ task }: SortableTaskCardProps): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group"
    >
      <TaskCard 
        task={task} 
        isDragging={isDragging}
      />
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default TaskCard
