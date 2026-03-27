/**
 * LEADERBOARD SERVICE
 * Smart AI Engineering Platform - SPKBG
 * 
 * Service untuk menghitung dan mengelola leaderboard anggota tim
 * dengan sistem scoring berbasis produktivitas dan kecepatan kerja
 */

import { supabase } from '@/services/supabase/client'

// ============================================================================
// TYPES
// ============================================================================

export interface LeaderboardEntry {
  rank: number
  userId: string
  userName: string
  userEmail: string
  avatarUrl?: string
  role: string
  teamId: string
  teamName: string
  score: number
  completedTasks: number
  totalTasks: number
  onTimeCompletions: number
  earlyCompletions: number
  averageCompletionTime: number | null // in hours
  streakDays: number
  lastActivityAt: string
  badges: string[]
}

export interface LeaderboardFilters {
  teamId?: string
  period?: 'week' | 'month' | 'all'
  limit?: number
}

export interface ScoreBreakdown {
  baseScore: number
  onTimeBonus: number
  earlyBonus: number
  streakBonus: number
  totalScore: number
}

// ============================================================================
// SCORING CONSTANTS
// ============================================================================

const SCORE_CONFIG = {
  BASE_POINTS_PER_TASK: 10,
  ON_TIME_BONUS: 3,
  EARLY_BONUS: 5, // Completed before due date
  STREAK_MULTIPLIER: 1.5, // Multiplier for consecutive daily completions
  MAX_STREAK_DAYS: 7,
}

// ============================================================================
// SCORE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate score for a set of tasks
 * Formula: +10 per completed task + bonus for early completion
 */
export function calculateScore(tasks: Array<{
  status: string
  completed_at?: string
  due_date?: string
  created_at: string
}>): ScoreBreakdown {
  let baseScore = 0
  let onTimeBonus = 0
  let earlyBonus = 0

  tasks.forEach(task => {
    if (task.status === 'done') {
      baseScore += SCORE_CONFIG.BASE_POINTS_PER_TASK

      // Check if completed before or on due date
      if (task.completed_at && task.due_date) {
        const completedDate = new Date(task.completed_at)
        const dueDate = new Date(task.due_date)

        if (completedDate <= dueDate) {
          onTimeBonus += SCORE_CONFIG.ON_TIME_BONUS

          // Early bonus if completed at least 1 day before
          const daysDiff = Math.floor(
            (dueDate.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24)
          )
          if (daysDiff >= 1) {
            earlyBonus += SCORE_CONFIG.EARLY_BONUS
          }
        }
      }
    }
  })

  return {
    baseScore,
    onTimeBonus,
    earlyBonus,
    streakBonus: 0, // Calculated separately
    totalScore: baseScore + onTimeBonus + earlyBonus,
  }
}

/**
 * Calculate average completion time in hours
 */
export function calculateAverageCompletionTime(tasks: Array<{
  status: string
  created_at: string
  completed_at?: string
}>): number | null {
  const completedTasks = tasks.filter(
    t => t.status === 'done' && t.completed_at
  )

  if (completedTasks.length === 0) return null

  const totalHours = completedTasks.reduce((sum, task) => {
    const created = new Date(task.created_at).getTime()
    const completed = new Date(task.completed_at!).getTime()
    const hours = (completed - created) / (1000 * 60 * 60)
    return sum + hours
  }, 0)

  return Math.round(totalHours / completedTasks.length)
}

/**
 * Calculate streak (consecutive days with task completion)
 */
export function calculateStreak(tasks: Array<{
  status: string
  completed_at?: string
}>): number {
  const completionDates = tasks
    .filter(t => t.status === 'done' && t.completed_at)
    .map(t => new Date(t.completed_at!).toISOString().split('T')[0])
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  if (completionDates.length === 0) return 0

  let streak = 1
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // Check if streak is still active (completed today or yesterday)
  if (completionDates[0] !== today && completionDates[0] !== yesterday) {
    return 0 // Streak broken
  }

  for (let i = 1; i < completionDates.length; i++) {
    const current = new Date(completionDates[i - 1])
    const prev = new Date(completionDates[i])
    const diffDays = Math.floor(
      (current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (diffDays === 1) {
      streak++
    } else {
      break
    }
  }

  return Math.min(streak, SCORE_CONFIG.MAX_STREAK_DAYS)
}

/**
 * Get badges based on performance
 */
export function getBadges(entry: LeaderboardEntry): string[] {
  const badges: string[] = []

  // Rank badges
  if (entry.rank === 1) badges.push('🏆 Champion')
  if (entry.rank === 2) badges.push('🥈 Runner Up')
  if (entry.rank === 3) badges.push('🥉 Bronze')

  // Performance badges
  if (entry.completedTasks >= 20) badges.push('💎 Elite')
  if (entry.completedTasks >= 10) badges.push('⚡ Powerhouse')
  if (entry.onTimeCompletions >= 5) badges.push('⏰ On Time Pro')
  if (entry.earlyCompletions >= 3) badges.push('🚀 Speedster')
  if (entry.streakDays >= 5) badges.push('🔥 Streak Master')
  if (entry.averageCompletionTime && entry.averageCompletionTime <= 24) {
    badges.push('⚡ Fast Finisher')
  }

  return badges
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class LeaderboardService {
  /**
   * Get leaderboard for a specific team
   */
  async getTeamLeaderboard(
    teamId: string,
    limit: number = 20
  ): Promise<LeaderboardEntry[]> {
    try {
      // Get team members with details
      const { data: members, error: memberError } = await supabase
        .from('team_member_detail')
        .select('*')
        .eq('team_id', teamId)
        .eq('is_active', true)

      if (memberError || !members) throw memberError

      // Get all tasks for this team
      const { data: tasks, error: taskError } = await supabase
        .from('team_tasks')
        .select('assigned_to, status, created_at, completed_at, due_date')
        .eq('team_id', teamId)

      if (taskError) throw taskError

      // Get team name
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .single()

      if (teamError) throw teamError

      // Calculate scores for each member
      const entries: LeaderboardEntry[] = members.map((member, _index) => {
        const memberTasks =
          tasks?.filter(t => t.assigned_to === member.user_id) || []
        const completedTasks = memberTasks.filter(t => t.status === 'done')

        const scoreBreakdown = calculateScore(memberTasks)
        const avgTime = calculateAverageCompletionTime(memberTasks)
        const streak = calculateStreak(memberTasks)

        // Calculate early/on-time completions
        let onTimeCompletions = 0
        let earlyCompletions = 0

        completedTasks.forEach(task => {
          if (task.completed_at && task.due_date) {
            const completedDate = new Date(task.completed_at)
            const dueDate = new Date(task.due_date)

            if (completedDate <= dueDate) {
              onTimeCompletions++
              const daysDiff = Math.floor(
                (dueDate.getTime() - completedDate.getTime()) /
                  (1000 * 60 * 60 * 24)
              )
              if (daysDiff >= 1) earlyCompletions++
            }
          }
        })

        // Streak bonus
        const streakBonus = streak >= 3 ? streak * 2 : 0

        return {
          rank: 0, // Will be set after sorting
          userId: member.user_id,
          userName: member.user_name,
          userEmail: member.user_email,
          role: member.role,
          teamId: teamId,
          teamName: team.name,
          score: scoreBreakdown.totalScore + streakBonus,
          completedTasks: completedTasks.length,
          totalTasks: memberTasks.length,
          onTimeCompletions,
          earlyCompletions,
          averageCompletionTime: avgTime,
          streakDays: streak,
          lastActivityAt:
            completedTasks.length > 0
              ? completedTasks[completedTasks.length - 1].completed_at!
              : member.joined_at,
          badges: [], // Will be set after ranking
        }
      })

      // Sort by score descending
      entries.sort((a, b) => b.score - a.score)

      // Assign ranks and badges
      entries.forEach((entry, index) => {
        entry.rank = index + 1
        entry.badges = getBadges(entry)
      })

      return entries.slice(0, limit)
    } catch (error) {
      console.error('Get team leaderboard error:', error)
      return []
    }
  }

  /**
   * Get global leaderboard across all teams
   */
  async getGlobalLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
    try {
      // Get user's teams
      const { data: memberships, error: memberError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('is_active', true)

      if (memberError) throw memberError

      const teamIds = memberships?.map(m => m.team_id) || []
      if (teamIds.length === 0) return []

      // Aggregate leaderboards from all teams
      const allEntries: LeaderboardEntry[] = []

      for (const teamId of teamIds) {
        const teamLeaderboard = await this.getTeamLeaderboard(teamId, 100)
        allEntries.push(...teamLeaderboard)
      }

      // Aggregate by user (sum scores across teams)
      const userMap = new Map<string, LeaderboardEntry>()

      allEntries.forEach(entry => {
        if (userMap.has(entry.userId)) {
          const existing = userMap.get(entry.userId)!
          existing.score += entry.score
          existing.completedTasks += entry.completedTasks
          existing.totalTasks += entry.totalTasks
          existing.onTimeCompletions += entry.onTimeCompletions
          existing.earlyCompletions += entry.earlyCompletions
        } else {
          userMap.set(entry.userId, { ...entry })
        }
      })

      // Convert back to array and re-rank
      const aggregated = Array.from(userMap.values())
      aggregated.sort((a, b) => b.score - a.score)

      aggregated.forEach((entry, index) => {
        entry.rank = index + 1
        entry.badges = getBadges(entry)
      })

      return aggregated.slice(0, limit)
    } catch (error) {
      console.error('Get global leaderboard error:', error)
      return []
    }
  }

  /**
   * Get current user's rank
   */
  async getUserRank(
    userId: string,
    teamId?: string
  ): Promise<LeaderboardEntry | null> {
    try {
      const leaderboard = teamId
        ? await this.getTeamLeaderboard(teamId, 1000)
        : await this.getGlobalLeaderboard(1000)

      return leaderboard.find(e => e.userId === userId) || null
    } catch (error) {
      console.error('Get user rank error:', error)
      return null
    }
  }

  /**
   * Subscribe to leaderboard updates
   */
  subscribeToUpdates(
    teamId: string,
    callback: (leaderboard: LeaderboardEntry[]) => void
  ): () => void {
    const subscription = supabase
      .channel(`leaderboard:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_tasks',
          filter: `team_id=eq.${teamId}`,
        },
        async () => {
          // Recalculate leaderboard on any task change
          const leaderboard = await this.getTeamLeaderboard(teamId)
          callback(leaderboard)
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

export const leaderboardService = new LeaderboardService()

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  LeaderboardService,
  leaderboardService,
  calculateScore,
  calculateAverageCompletionTime,
  calculateStreak,
  getBadges,
  SCORE_CONFIG,
}
