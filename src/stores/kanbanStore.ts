/**
 * KANBAN STORE - Zustand State Management
 * Smart AI Engineering Platform - SPKBG
 * 
 * State management untuk Kanban Board dengan real-time sync ke Supabase
 */

import { create } from 'zustand'
import { supabase } from '@/services/supabase/client'
import type { TeamTask, TaskStatus, TeamMember } from '@/services/team/teamService'

// ============================================================================
// TYPES
// ============================================================================

interface KanbanState {
  // Data
  tasks: TeamTask[]
  members: TeamMember[]
  teamId: string | null
  
  // Loading states
  isLoading: boolean
  isUpdating: boolean
  
  // Modals
  isCreateModalOpen: boolean
  editingTask: TeamTask | null
  
  // Actions
  setTeamId: (teamId: string) => void
  loadTasks: (teamId: string) => Promise<void>
  loadMembers: (teamId: string) => Promise<void>
  
  // Task operations
  addTask: (task: TeamTask) => void
  updateTask: (taskId: string, updates: Partial<TeamTask>) => void
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<boolean>
  deleteTask: (taskId: string) => void
  
  // Modal operations
  openCreateModal: () => void
  closeCreateModal: () => void
  openEditModal: (task: TeamTask) => void
  closeEditModal: () => void
  
  // Real-time
  subscribeToChanges: () => () => void
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useKanbanStore = create<KanbanState>((set, get) => ({
  // Initial state
  tasks: [],
  members: [],
  teamId: null,
  isLoading: false,
  isUpdating: false,
  isCreateModalOpen: false,
  editingTask: null,

  // Set team ID
  setTeamId: (teamId: string) => {
    set({ teamId })
  },

  // Load tasks from Supabase
  loadTasks: async (teamId: string) => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('task_board')
        .select('*')
        .eq('team_id', teamId)
        .order('due_date', { ascending: true })

      if (error) throw error

      const tasks: TeamTask[] = (data || []).map(t => ({
        id: t.id,
        teamId: t.team_id,
        title: t.title,
        description: t.description,
        taskType: t.task_type,
        assignedTo: t.assigned_to,
        createdBy: t.created_by,
        status: t.status,
        priority: t.priority,
        dueDate: t.due_date,
        startedAt: t.started_at,
        completedAt: t.completed_at,
        progressPercentage: t.progress_percentage,
        estimatedHours: t.estimated_hours,
        actualHours: t.actual_hours,
        surveyId: t.survey_id,
        componentId: t.component_id,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        assignedToName: t.assigned_to_name,
        teamName: t.team_name,
        projectName: t.project_name,
        isOverdue: t.is_overdue,
        isDueToday: t.is_due_today,
        isDueSoon: t.is_due_soon,
      }))

      set({ tasks, teamId, isLoading: false })
    } catch (error) {
      console.error('Load tasks error:', error)
      set({ isLoading: false })
    }
  },

  // Load members from Supabase
  loadMembers: async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('team_member_detail')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('joined_at')

      if (error) throw error

      const members: TeamMember[] = (data || []).map(m => ({
        id: m.id,
        teamId: m.team_id,
        userId: m.user_id,
        role: m.role,
        isActive: m.is_active,
        joinedAt: m.joined_at,
        leftAt: m.left_at,
        assignedBy: m.assigned_by,
        notes: m.notes,
        userName: m.user_name,
        userEmail: m.user_email,
      }))

      set({ members })
    } catch (error) {
      console.error('Load members error:', error)
    }
  },

  // Add task to state
  addTask: (task: TeamTask) => {
    set(state => ({
      tasks: [...state.tasks, task]
    }))
  },

  // Update task in state
  updateTask: (taskId: string, updates: Partial<TeamTask>) => {
    set(state => ({
      tasks: state.tasks.map(t =>
        t.id === taskId ? { ...t, ...updates } : t
      )
    }))
  },

  // Update task status with Supabase sync
  updateTaskStatus: async (taskId: string, status: TaskStatus): Promise<boolean> => {
    set({ isUpdating: true })
    try {
      // Optimistic update
      get().updateTask(taskId, { status })

      // Update in Supabase
      const updateData: any = { 
        status,
        updated_at: new Date().toISOString()
      }

      // Auto-set timestamps based on status
      if (status === 'in_progress') {
        updateData.started_at = new Date().toISOString()
      }
      if (status === 'done') {
        updateData.completed_at = new Date().toISOString()
        updateData.progress_percentage = 100
      }

      const { error } = await supabase
        .from('team_tasks')
        .update(updateData)
        .eq('id', taskId)

      if (error) {
        // Revert on error
        console.error('Update status error:', error)
        await get().loadTasks(get().teamId!)
        return false
      }

      set({ isUpdating: false })
      return true
    } catch (error) {
      console.error('Update status error:', error)
      set({ isUpdating: false })
      return false
    }
  },

  // Delete task from state
  deleteTask: (taskId: string) => {
    set(state => ({
      tasks: state.tasks.filter(t => t.id !== taskId)
    }))
  },

  // Modal operations
  openCreateModal: () => set({ isCreateModalOpen: true }),
  closeCreateModal: () => set({ isCreateModalOpen: false }),
  openEditModal: (task: TeamTask) => set({ editingTask: task }),
  closeEditModal: () => set({ editingTask: null }),

  // Subscribe to real-time changes
  subscribeToChanges: () => {
    const teamId = get().teamId
    if (!teamId) return () => {}

    const subscription = supabase
      .channel(`team_tasks:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_tasks',
          filter: `team_id=eq.${teamId}`
        },
        () => {
          // Reload tasks on any change
          get().loadTasks(teamId)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }
}))

// ============================================================================
// SELECTOR HOOKS
// ============================================================================

export const useTasksByStatus = (status: TaskStatus) => {
  return useKanbanStore(state => 
    state.tasks.filter(t => t.status === status)
  )
}

export const useTaskCounts = () => {
  return useKanbanStore(state => ({
    pending: state.tasks.filter(t => t.status === 'pending').length,
    in_progress: state.tasks.filter(t => t.status === 'in_progress').length,
    done: state.tasks.filter(t => t.status === 'done').length,
    blocked: state.tasks.filter(t => t.status === 'blocked').length,
    total: state.tasks.length,
  }))
}

export default useKanbanStore
