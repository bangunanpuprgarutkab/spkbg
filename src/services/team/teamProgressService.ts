/**
 * TEAM PROGRESS UTILITIES
 * Smart AI Engineering Platform - SPKBG
 * 
 * Utilities untuk menghitung dan mengelola progress tim
 * berdasarkan status task completion
 */

import { supabase } from '@/services/supabase/client'

// ============================================================================
// TYPES
// ============================================================================

export interface TeamProgress {
  teamId: string
  teamName: string
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  pendingTasks: number
  blockedTasks: number
  progressPercentage: number
  completionRate: number
  remainingTasks: number
  estimatedDaysLeft: number | null
  lastUpdated: string
}

export interface ProgressBreakdown {
  status: string
  count: number
  percentage: number
  color: string
}

// ============================================================================
// PROGRESS CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate progress percentage from tasks
 * Formula: (completed / total) × 100
 */
export function calculateProgress(tasks: { status: string }[]): number {
  if (!tasks || tasks.length === 0) return 0

  const total = tasks.length
  const done = tasks.filter(t => t.status === 'done').length

  return Math.round((done / total) * 100)
}

/**
 * Calculate detailed progress metrics
 */
export function calculateDetailedProgress(tasks: { status: string }[]): {
  total: number
  completed: number
  inProgress: number
  pending: number
  blocked: number
  percentage: number
} {
  if (!tasks || tasks.length === 0) {
    return { total: 0, completed: 0, inProgress: 0, pending: 0, blocked: 0, percentage: 0 }
  }

  const total = tasks.length
  const completed = tasks.filter(t => t.status === 'done').length
  const inProgress = tasks.filter(t => t.status === 'in_progress').length
  const pending = tasks.filter(t => t.status === 'pending').length
  const blocked = tasks.filter(t => t.status === 'blocked').length

  return {
    total,
    completed,
    inProgress,
    pending,
    blocked,
    percentage: Math.round((completed / total) * 100),
  }
}

/**
 * Get color based on progress percentage
 */
export function getProgressColor(percentage: number): string {
  if (percentage >= 80) return 'bg-green-500'
  if (percentage >= 60) return 'bg-blue-500'
  if (percentage >= 40) return 'bg-yellow-500'
  if (percentage >= 20) return 'bg-orange-500'
  return 'bg-red-500'
}

/**
 * Get status text based on progress
 */
export function getProgressStatus(percentage: number): string {
  if (percentage === 100) return 'Selesai'
  if (percentage >= 80) return 'Hampir Selesai'
  if (percentage >= 60) return 'Progress Baik'
  if (percentage >= 40) return 'Sedang Berjalan'
  if (percentage >= 20) return 'Progress Lambat'
  return 'Baru Mulai'
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class TeamProgressService {
  /**
   * Get progress for a specific team
   */
  async getTeamProgress(teamId: string): Promise<TeamProgress | null> {
    try {
      // Get team info
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('id', teamId)
        .single()

      if (teamError || !team) return null

      // Get all tasks for team
      const { data: tasks, error: taskError } = await supabase
        .from('team_tasks')
        .select('status, created_at, completed_at, estimated_hours')
        .eq('team_id', teamId)

      if (taskError) throw taskError

      const metrics = calculateDetailedProgress(tasks || [])

      // Calculate estimated days left (rough estimation)
      let estimatedDaysLeft: number | null = null
      if (metrics.inProgress > 0) {
        const avgTasksPerDay = metrics.completed / 7 // Assume 1 week baseline
        estimatedDaysLeft = avgTasksPerDay > 0 
          ? Math.ceil((metrics.pending + metrics.inProgress) / avgTasksPerDay)
          : null
      }

      return {
        teamId: team.id,
        teamName: team.name,
        totalTasks: metrics.total,
        completedTasks: metrics.completed,
        inProgressTasks: metrics.inProgress,
        pendingTasks: metrics.pending,
        blockedTasks: metrics.blocked,
        progressPercentage: metrics.percentage,
        completionRate: metrics.percentage,
        remainingTasks: metrics.total - metrics.completed,
        estimatedDaysLeft,
        lastUpdated: new Date().toISOString(),
      }
    } catch (error) {
      console.error('Get team progress error:', error)
      return null
    }
  }

  /**
   * Get progress for all teams user has access to
   */
  async getAllTeamsProgress(): Promise<TeamProgress[]> {
    try {
      // Get user's teams
      const { data: memberships, error: memberError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('is_active', true)

      if (memberError) throw memberError

      const teamIds = memberships?.map(m => m.team_id) || []
      if (teamIds.length === 0) return []

      // Get progress for each team
      const progressPromises = teamIds.map(id => this.getTeamProgress(id))
      const results = await Promise.all(progressPromises)

      return results.filter((p): p is TeamProgress => p !== null)
        .sort((a, b) => b.progressPercentage - a.progressPercentage)
    } catch (error) {
      console.error('Get all teams progress error:', error)
      return []
    }
  }

  /**
   * Get progress breakdown by status
   */
  async getProgressBreakdown(teamId: string): Promise<ProgressBreakdown[]> {
    try {
      const { data: tasks, error } = await supabase
        .from('team_tasks')
        .select('status')
        .eq('team_id', teamId)

      if (error) throw error

      const total = tasks?.length || 0
      if (total === 0) return []

      const statusColors: Record<string, string> = {
        pending: '#F59E0B',
        in_progress: '#3B82F6',
        review: '#8B5CF6',
        done: '#10B981',
        blocked: '#EF4444',
        cancelled: '#6B7280',
      }

      const statusLabels: Record<string, string> = {
        pending: 'Pending',
        in_progress: 'In Progress',
        review: 'Review',
        done: 'Done',
        blocked: 'Blocked',
        cancelled: 'Cancelled',
      }

      // Count each status
      const counts: Record<string, number> = {}
      tasks?.forEach(task => {
        counts[task.status] = (counts[task.status] || 0) + 1
      })

      return Object.entries(counts).map(([status, count]) => ({
        status: statusLabels[status] || status,
        count,
        percentage: Math.round((count / total) * 100),
        color: statusColors[status] || '#9CA3AF',
      }))
    } catch (error) {
      console.error('Get progress breakdown error:', error)
      return []
    }
  }

  /**
   * Subscribe to progress updates
   */
  subscribeToProgressUpdates(
    teamId: string,
    callback: (progress: TeamProgress) => void
  ): () => void {
    const subscription = supabase
      .channel(`team_progress:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_tasks',
          filter: `team_id=eq.${teamId}`,
        },
        async () => {
          // Recalculate progress on any task change
          const progress = await this.getTeamProgress(teamId)
          if (progress) callback(progress)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const teamProgressService = new TeamProgressService()

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  TeamProgressService,
  teamProgressService,
  calculateProgress,
  calculateDetailedProgress,
  getProgressColor,
  getProgressStatus,
}
