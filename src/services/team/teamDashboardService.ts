/**
 * TEAM DASHBOARD SERVICE
 * Smart AI Engineering Platform - SPKBG
 * 
 * Service untuk mengambil data dashboard tim dari Supabase
 * dengan aggregations dan real-time subscriptions
 */

import { supabase } from '@/services/supabase/client'

// ============================================================================
// TYPES
// ============================================================================

export interface TeamKPI {
  totalMembers: number
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  inProgressTasks: number
  blockedTasks: number
  completionRate: number
  overdueTasks: number
  dueTodayTasks: number
}

export interface TaskStatusDistribution {
  status: string
  count: number
  percentage: number
  color: string
}

export interface MemberPerformance {
  userId: string
  userName: string
  userEmail: string
  role: string
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  pendingTasks: number
  completionRate: number
  isActive: boolean
  joinedAt: string
}

export interface WeeklyActivity {
  day: string
  tasksCreated: number
  tasksCompleted: number
}

export interface TeamDashboardData {
  kpi: TeamKPI
  taskDistribution: TaskStatusDistribution[]
  memberPerformance: MemberPerformance[]
  weeklyActivity: WeeklyActivity[]
}

// ============================================================================
// SERVICE
// ============================================================================

export class TeamDashboardService {
  /**
   * Get KPI data for a team
   */
  async getTeamKPI(teamId: string): Promise<TeamKPI> {
    try {
      // Get member count
      const { data: members, error: memberError } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('is_active', true)

      if (memberError) throw memberError

      // Get task stats
      const { data: tasks, error: taskError } = await supabase
        .from('team_tasks')
        .select('status, due_date')
        .eq('team_id', teamId)

      if (taskError) throw taskError

      const totalTasks = tasks?.length || 0
      const completedTasks = tasks?.filter(t => t.status === 'done').length || 0
      const pendingTasks = tasks?.filter(t => t.status === 'pending').length || 0
      const inProgressTasks = tasks?.filter(t => t.status === 'in_progress').length || 0
      const blockedTasks = tasks?.filter(t => t.status === 'blocked').length || 0

      // Calculate overdue and due today
      const today = new Date().toISOString().split('T')[0]
      const overdueTasks = tasks?.filter(t => {
        if (!t.due_date || t.status === 'done' || t.status === 'cancelled') return false
        return t.due_date < today
      }).length || 0

      const dueTodayTasks = tasks?.filter(t => {
        if (!t.due_date || t.status === 'done' || t.status === 'cancelled') return false
        return t.due_date === today
      }).length || 0

      return {
        totalMembers: members?.length || 0,
        totalTasks,
        completedTasks,
        pendingTasks,
        inProgressTasks,
        blockedTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        overdueTasks,
        dueTodayTasks,
      }
    } catch (error) {
      console.error('Get team KPI error:', error)
      return {
        totalMembers: 0,
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        blockedTasks: 0,
        completionRate: 0,
        overdueTasks: 0,
        dueTodayTasks: 0,
      }
    }
  }

  /**
   * Get task status distribution for charts
   */
  async getTaskDistribution(teamId: string): Promise<TaskStatusDistribution[]> {
    try {
      const { data: tasks, error } = await supabase
        .from('team_tasks')
        .select('status')
        .eq('team_id', teamId)

      if (error) throw error

      const total = tasks?.length || 0

      const statusColors: Record<string, string> = {
        pending: '#F59E0B',      // Yellow
        in_progress: '#3B82F6',  // Blue
        review: '#8B5CF6',       // Purple
        done: '#10B981',         // Green
        blocked: '#EF4444',      // Red
        cancelled: '#6B7280',    // Gray
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

      // Convert to array with percentages
      return Object.entries(counts).map(([status, count]) => ({
        status: statusLabels[status] || status,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        color: statusColors[status] || '#9CA3AF',
      })).sort((a, b) => b.count - a.count)
    } catch (error) {
      console.error('Get task distribution error:', error)
      return []
    }
  }

  /**
   * Get member performance metrics
   */
  async getMemberPerformance(teamId: string): Promise<MemberPerformance[]> {
    try {
      // Get members with user info
      const { data: members, error: memberError } = await supabase
        .from('team_member_detail')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('joined_at')

      if (memberError) throw memberError

      // Get all tasks for this team
      const { data: tasks, error: taskError } = await supabase
        .from('team_tasks')
        .select('assigned_to, status')
        .eq('team_id', teamId)

      if (taskError) throw taskError

      // Calculate per-member stats
      return (members || []).map(member => {
        const memberTasks = tasks?.filter(t => t.assigned_to === member.user_id) || []
        const totalTasks = memberTasks.length
        const completedTasks = memberTasks.filter(t => t.status === 'done').length
        const inProgressTasks = memberTasks.filter(t => t.status === 'in_progress').length
        const pendingTasks = memberTasks.filter(t => t.status === 'pending').length

        return {
          userId: member.user_id,
          userName: member.user_name,
          userEmail: member.user_email,
          role: member.role,
          totalTasks,
          completedTasks,
          inProgressTasks,
          pendingTasks,
          completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          isActive: member.is_active,
          joinedAt: member.joined_at,
        }
      })
    } catch (error) {
      console.error('Get member performance error:', error)
      return []
    }
  }

  /**
   * Get weekly activity data
   */
  async getWeeklyActivity(teamId: string): Promise<WeeklyActivity[]> {
    try {
      // Get last 7 days of activity
      const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
      const today = new Date()
      
      // Generate last 7 days
      const weekData: WeeklyActivity[] = []
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        
        // Count tasks created on this date
        const { data: created, error: _createdError } = await supabase
          .from('team_tasks')
          .select('id', { count: 'exact' })
          .eq('team_id', teamId)
          .gte('created_at', `${dateStr}T00:00:00`)
          .lt('created_at', `${dateStr}T23:59:59`)

        // Count tasks completed on this date
        const { data: completed, error: _completedError } = await supabase
          .from('team_tasks')
          .select('id', { count: 'exact' })
          .eq('team_id', teamId)
          .eq('status', 'done')
          .gte('completed_at', `${dateStr}T00:00:00`)
          .lt('completed_at', `${dateStr}T23:59:59`)

        weekData.push({
          day: days[date.getDay()],
          tasksCreated: created?.length || 0,
          tasksCompleted: completed?.length || 0,
        })
      }

      return weekData
    } catch (error) {
      console.error('Get weekly activity error:', error)
      return []
    }
  }

  /**
   * Get full dashboard data
   */
  async getDashboardData(teamId: string): Promise<TeamDashboardData> {
    const [kpi, taskDistribution, memberPerformance, weeklyActivity] = await Promise.all([
      this.getTeamKPI(teamId),
      this.getTaskDistribution(teamId),
      this.getMemberPerformance(teamId),
      this.getWeeklyActivity(teamId),
    ])

    return {
      kpi,
      taskDistribution,
      memberPerformance,
      weeklyActivity,
    }
  }

  /**
   * Subscribe to real-time dashboard updates
   */
  subscribeToUpdates(teamId: string, callback: () => void) {
    const subscription = supabase
      .channel(`team_dashboard:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_tasks',
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          callback()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          callback()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const teamDashboardService = new TeamDashboardService()

export default {
  TeamDashboardService,
  teamDashboardService,
}
