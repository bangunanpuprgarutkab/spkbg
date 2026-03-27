/**
 * KANBAN COLUMN COMPONENT
 * Smart AI Engineering Platform - SPKBG
 * 
 * Kolom Kanban yang dapat menerima drop dari task card
 */

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { MoreHorizontal, Plus } from 'lucide-react'
import type { TeamTask, TaskStatus } from '@/services/team/teamService'
import { SortableTaskCard } from './SortableTaskCard'

// ============================================================================
// TYPES
// ============================================================================

interface ColumnDef {
  id: TaskStatus
  title: string
  color: string
  bgColor: string
}

interface KanbanColumnProps {
  column: ColumnDef
  tasks: TeamTask[]
  isUpdating?: boolean
}

// ============================================================================
// COMPONENT
// ============================================================================

export function KanbanColumn({ column, tasks, isUpdating }: KanbanColumnProps): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
  })

  // Get border color based on column
  const getBorderColor = () => {
    switch (column.id) {
      case 'pending': return 'border-yellow-400'
      case 'in_progress': return 'border-blue-400'
      case 'done': return 'border-green-400'
      case 'blocked': return 'border-red-400'
      default: return 'border-gray-300'
    }
  }

  // Get background color based on column
  const getBgColor = () => {
    switch (column.id) {
      case 'pending': return 'bg-yellow-50/30'
      case 'in_progress': return 'bg-blue-50/30'
      case 'done': return 'bg-green-50/30'
      case 'blocked': return 'bg-red-50/30'
      default: return 'bg-gray-50'
    }
  }

  // Get header color
  const getHeaderColor = () => {
    switch (column.id) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'done': return 'bg-green-100 text-green-800'
      case 'blocked': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-shrink-0 w-72 flex flex-col max-h-full
        rounded-xl border-2 transition-colors
        ${getBgColor()}
        ${getBorderColor()}
        ${isOver ? 'ring-2 ring-offset-2 ring-blue-400' : ''}
        ${isUpdating ? 'opacity-70' : ''}
      `}
    >
      {/* Column Header */}
      <div className={`
        p-3 rounded-t-xl border-b
        flex items-center justify-between
        ${getHeaderColor()}
      `}>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{column.title}</h3>
          <span className="
            bg-white/80 px-2 py-0.5 rounded-full text-xs font-medium
            min-w-[1.5rem] text-center
          ">
            {tasks.length}
          </span>
        </div>
        <button className="p-1 hover:bg-white/50 rounded transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Tasks Container */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[200px]">
        <SortableContext
          items={tasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map(task => (
            <SortableTaskCard 
              key={task.id} 
              task={task}
            />
          ))}
        </SortableContext>

        {/* Empty State */}
        {tasks.length === 0 && (
          <div className="
            h-32 flex flex-col items-center justify-center
            border-2 border-dashed border-gray-300 rounded-lg
            text-gray-400 text-sm
          ">
            <Plus className="w-8 h-8 mb-2 opacity-50" />
            <p>Drag task ke sini</p>
            <p className="text-xs">atau buat tugas baru</p>
          </div>
        )}
      </div>

      {/* Add Task Button (Bottom) */}
      <div className="p-3 pt-0">
        <button className="
          w-full py-2 flex items-center justify-center gap-2
          text-gray-500 hover:text-gray-700
          hover:bg-white/50 rounded-lg
          transition-colors text-sm
        ">
          <Plus className="w-4 h-4" />
          Tambah Tugas
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default KanbanColumn
