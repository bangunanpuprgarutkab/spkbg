/**
 * SORTABLE TASK CARD COMPONENT
 * Smart AI Engineering Platform - SPKBG
 * 
 * Task Card yang dapat di-drag menggunakan dnd-kit
 */

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TeamTask } from '@/services/team/teamService'
import TaskCard from './TaskCard'

interface SortableTaskCardProps {
  task: TeamTask
}

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
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} />
    </div>
  )
}

export default SortableTaskCard
