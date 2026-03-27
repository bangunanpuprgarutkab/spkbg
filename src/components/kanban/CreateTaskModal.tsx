/**
 * CREATE TASK MODAL
 * Smart AI Engineering Platform - SPKBG
 * 
 * Modal untuk membuat tugas baru di Kanban Board
 */

import { useState, useEffect } from 'react'
import { X, Plus, Calendar, User, AlertCircle, Loader2 } from 'lucide-react'
import { useKanbanStore } from '@/stores/kanbanStore'
import { teamService, type CreateTaskInput } from '@/services/team/teamService'
import { supabase } from '@/services/supabase/client'

// ============================================================================
// TYPES
// ============================================================================

interface CreateTaskModalProps {
  teamId: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CreateTaskModal({ teamId }: CreateTaskModalProps): JSX.Element {
  const { 
    isCreateModalOpen, 
    closeCreateModal, 
    members, 
    addTask,
    editingTask,
    closeEditModal,
    updateTask,
  } = useKanbanStore()

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [taskType, setTaskType] = useState<CreateTaskInput['taskType']>('survey')
  const [assignedTo, setAssignedTo] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [dueDate, setDueDate] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isCreateModalOpen) {
      if (editingTask) {
        // Populate form with editing task data
        setTitle(editingTask.title)
        setDescription(editingTask.description || '')
        setTaskType(editingTask.taskType || 'survey')
        setAssignedTo(editingTask.assignedTo || '')
        setPriority(editingTask.priority)
        setDueDate(editingTask.dueDate || '')
        setEstimatedHours(editingTask.estimatedHours?.toString() || '')
      } else {
        // Reset form for new task
        resetForm()
      }
    }
  }, [isCreateModalOpen, editingTask])

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setTaskType('survey')
    setAssignedTo('')
    setPriority('medium')
    setDueDate('')
    setEstimatedHours('')
    setError(null)
  }

  const handleClose = () => {
    if (editingTask) {
      closeEditModal()
    } else {
      closeCreateModal()
    }
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      setError('Judul tugas wajib diisi')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('User tidak terautentikasi')
        return
      }

      if (editingTask) {
        // Update existing task
        const { error: updateError } = await supabase
          .from('team_tasks')
          .update({
            title,
            description,
            task_type: taskType,
            assigned_to: assignedTo || null,
            priority,
            due_date: dueDate || null,
            estimated_hours: estimatedHours ? parseInt(estimatedHours) : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTask.id)

        if (updateError) throw updateError

        // Update local state
        updateTask(editingTask.id, {
          title,
          description,
          taskType,
          assignedTo: assignedTo || undefined,
          priority,
          dueDate: dueDate || undefined,
          estimatedHours: estimatedHours ? parseInt(estimatedHours) : undefined,
        })

        closeEditModal()
      } else {
        // Create new task
        const newTask = await teamService.createTask({
          teamId,
          title,
          description,
          taskType,
          assignedTo: assignedTo || undefined,
          priority,
          dueDate: dueDate || undefined,
          estimatedHours: estimatedHours ? parseInt(estimatedHours) : undefined,
        }, user.id)

        if (newTask) {
          addTask(newTask)
          closeCreateModal()
          resetForm()
        } else {
          setError('Gagal membuat tugas')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Task type options
  const taskTypeOptions = [
    { value: 'survey', label: '🔍 Survey', color: 'bg-blue-100 text-blue-800' },
    { value: 'analisis', label: '📊 Analisis', color: 'bg-purple-100 text-purple-800' },
    { value: 'verifikasi', label: '✓ Verifikasi', color: 'bg-green-100 text-green-800' },
    { value: 'dokumentasi', label: '📄 Dokumentasi', color: 'bg-gray-100 text-gray-800' },
    { value: 'rapat', label: '👥 Rapat', color: 'bg-orange-100 text-orange-800' },
    { value: 'lainnya', label: '📋 Lainnya', color: 'bg-yellow-100 text-yellow-800' },
  ]

  // Priority options
  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-700' },
    { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' },
  ]

  if (!isCreateModalOpen && !editingTask) return null as unknown as JSX.Element

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {editingTask ? 'Edit Tugas' : 'Tugas Baru'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Judul Tugas <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Survey Pondasi Gedung A"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deskripsi
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan detail tugas..."
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jenis Tugas
            </label>
            <div className="flex flex-wrap gap-2">
              {taskTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTaskType(option.value as CreateTaskInput['taskType'])}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${taskType === option.value 
                      ? option.color + ' ring-2 ring-offset-1' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assign To & Priority */}
          <div className="grid grid-cols-2 gap-4">
            {/* Assign To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Ditugaskan Ke
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- Pilih Anggota --</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.userName} ({member.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prioritas
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date & Estimated Hours */}
          <div className="grid grid-cols-2 gap-4">
            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Deadline
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Estimated Hours */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimasi Waktu (jam)
              </label>
              <input
                type="number"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="Contoh: 4"
                min="0"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="
                flex items-center gap-2 px-4 py-2 
                bg-green-600 text-white rounded-lg 
                hover:bg-green-700 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingTask ? 'Simpan Perubahan' : 'Buat Tugas'}
              {!isSubmitting && <Plus className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default CreateTaskModal
