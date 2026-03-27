/**
 * TEAM MANAGEMENT SERVICE
 * Smart AI Engineering Platform - SPKBG
 * 
 * CRUD operations untuk tim teknis, anggota, dan tugas
 * Integrasi dengan notification system
 */

import { supabase } from '@/services/supabase/client'
import { getNotificationService } from '@/services/notifications'

// ============================================================================
// TYPES
// ============================================================================

export type TeamRole = 'ketua_tim' | 'surveyor' | 'analis' | 'verifikator' | 'dokumentator'

export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'done' | 'blocked' | 'cancelled'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Team {
  id: string
  projectId: string
  name: string
  description?: string
  ketuaId: string
  status: 'active' | 'inactive' | 'completed'
  createdBy: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: TeamRole
  isActive: boolean
  joinedAt: string
  leftAt?: string
  assignedBy?: string
  notes?: string
  // Join fields
  userName?: string
  userEmail?: string
}

export interface TeamTask {
  id: string
  teamId: string
  title: string
  description?: string
  taskType?: 'survey' | 'analisis' | 'verifikasi' | 'dokumentasi' | 'rapat' | 'lainnya'
  assignedTo?: string
  createdBy: string
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string
  startedAt?: string
  completedAt?: string
  progressPercentage: number
  estimatedHours?: number
  actualHours?: number
  surveyId?: string
  componentId?: string
  createdAt: string
  updatedAt: string
  // Join fields
  assignedToName?: string
  teamName?: string
  projectName?: string
  isOverdue?: boolean
  isDueToday?: boolean
  isDueSoon?: boolean
}

export interface TeamActivity {
  id: string
  teamId: string
  userId: string
  activityType: string
  description: string
  metadata?: any
  targetUserId?: string
  targetTaskId?: string
  createdAt: string
  // Join fields
  userName?: string
  targetUserName?: string
  targetTaskTitle?: string
}

export interface TeamSummary {
  id: string
  name: string
  description?: string
  teamStatus: string
  projectId: string
  projectName: string
  ketuaName: string
  memberCount: number
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  pendingTasks: number
  overdueTasks: number
  progressPercentage: number
  createdAt: string
  updatedAt: string
}

export interface MemberDetail {
  id: string
  teamId: string
  userId: string
  userName: string
  userEmail: string
  role: TeamRole
  isActive: boolean
  joinedAt: string
  leftAt?: string
  activeTasks: number
  completedTasks: number
}

export interface CreateTeamInput {
  projectId: string
  name: string
  description?: string
  ketuaId: string
}

export interface AddMemberInput {
  teamId: string
  userId: string
  role: TeamRole
  notes?: string
}

export interface CreateTaskInput {
  teamId: string
  title: string
  description?: string
  taskType?: 'survey' | 'analisis' | 'verifikasi' | 'dokumentasi' | 'rapat' | 'lainnya'
  assignedTo?: string
  priority?: TaskPriority
  dueDate?: string
  estimatedHours?: number
  surveyId?: string
  componentId?: string
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  taskType?: 'survey' | 'analisis' | 'verifikasi' | 'dokumentasi' | 'rapat' | 'lainnya'
  assignedTo?: string
  status?: TaskStatus
  priority?: TaskPriority
  dueDate?: string
  progressPercentage?: number
  estimatedHours?: number
  actualHours?: number
}

// ============================================================================
// TEAM SERVICE
// ============================================================================

export class TeamService {
  /**
   * Create new team
   */
  async createTeam(input: CreateTeamInput, createdBy: string): Promise<Team | null> {
    try {
      const { data, error } = await supabase
        .from('teams')
        .insert({
          project_id: input.projectId,
          name: input.name,
          description: input.description,
          ketua_id: input.ketuaId,
          created_by: createdBy,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      // Auto-add ketua_tim as member
      await this.addMember({
        teamId: data.id,
        userId: input.ketuaId,
        role: 'ketua_tim',
        notes: 'Ketua Tim (otomatis)',
      }, createdBy)

      // Send notification to ketua
      await getNotificationService().sendNotification({
        user_id: input.ketuaId,
        title: 'Anda Ditunjuk sebagai Ketua Tim',
        message: `Anda ditunjuk sebagai Ketua Tim untuk "${input.name}"`,
        type: 'info',
        channel: 'workflow',
        link: `/teams/${data.id}`,
      })

      return {
        id: data.id,
        projectId: data.project_id,
        name: data.name,
        description: data.description,
        ketuaId: data.ketua_id,
        status: data.status,
        createdBy: data.created_by,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        completedAt: data.completed_at,
      }
    } catch (error) {
      console.error('Create team error:', error)
      return null
    }
  }

  /**
   * Get team by ID
   */
  async getTeam(id: string): Promise<Team | null> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return null

    return {
      id: data.id,
      projectId: data.project_id,
      name: data.name,
      description: data.description,
      ketuaId: data.ketua_id,
      status: data.status,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      completedAt: data.completed_at,
    }
  }

  /**
   * Get team by project
   */
  async getTeamByProject(projectId: string): Promise<Team | null> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('project_id', projectId)
      .single()

    if (error || !data) return null

    return {
      id: data.id,
      projectId: data.project_id,
      name: data.name,
      description: data.description,
      ketuaId: data.ketua_id,
      status: data.status,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      completedAt: data.completed_at,
    }
  }

  /**
   * Get all teams (admin only) or teams for user
   */
  async getTeams(userId?: string): Promise<TeamSummary[]> {
    try {
      let query = supabase.from('team_summary').select('*')
      
      if (userId) {
        // Filter teams where user is member
        const { data: memberTeams } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', userId)
          .eq('is_active', true)
        
        const teamIds = memberTeams?.map(m => m.team_id) || []
        if (teamIds.length > 0) {
          query = query.in('id', teamIds)
        } else {
          return []
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      return (data || []).map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        teamStatus: t.team_status,
        projectId: t.project_id,
        projectName: t.nama_bangunan,
        ketuaName: t.ketua_name,
        memberCount: t.member_count,
        totalTasks: t.total_tasks,
        completedTasks: t.completed_tasks,
        inProgressTasks: t.in_progress_tasks,
        pendingTasks: t.pending_tasks,
        overdueTasks: t.overdue_tasks,
        progressPercentage: t.progress_percentage,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }))
    } catch (error) {
      console.error('Get teams error:', error)
      return []
    }
  }

  /**
   * Update team
   */
  async updateTeam(id: string, updates: Partial<Team>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          name: updates.name,
          description: updates.description,
          ketua_id: updates.ketuaId,
          status: updates.status,
          updated_at: new Date().toISOString(),
          completed_at: updates.status === 'completed' ? new Date().toISOString() : undefined,
        })
        .eq('id', id)

      return !error
    } catch {
      return false
    }
  }

  /**
   * Add member to team
   */
  async addMember(input: AddMemberInput, assignedBy: string): Promise<TeamMember | null> {
    try {
      // Check if user already in team
      const { data: existing } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', input.teamId)
        .eq('user_id', input.userId)
        .maybeSingle()

      if (existing) {
        // Reactivate if exists
        const { error } = await supabase
          .from('team_members')
          .update({
            is_active: true,
            role: input.role,
            notes: input.notes,
            left_at: null,
          })
          .eq('id', existing.id)

        if (error) throw error
        return { ...existing, isActive: true, role: input.role }
      }

      const { data, error } = await supabase
        .from('team_members')
        .insert({
          team_id: input.teamId,
          user_id: input.userId,
          role: input.role,
          assigned_by: assignedBy,
          notes: input.notes,
          is_active: true,
          joined_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      // Get user info
      const { data: userData } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', input.userId)
        .single()

      // Send notification
      const { data: teamData } = await supabase
        .from('teams')
        .select('name')
        .eq('id', input.teamId)
        .single()

      await getNotificationService().sendNotification({
        user_id: input.userId,
        title: 'Anda Ditambahkan ke Tim',
        message: `Anda ditambahkan ke tim "${teamData?.name}" sebagai ${input.role}`,
        type: 'info',
        channel: 'workflow',
        link: `/teams/${input.teamId}`,
      })

      return {
        id: data.id,
        teamId: data.team_id,
        userId: data.user_id,
        role: data.role,
        isActive: data.is_active,
        joinedAt: data.joined_at,
        leftAt: data.left_at,
        assignedBy: data.assigned_by,
        notes: data.notes,
        userName: userData?.name,
        userEmail: userData?.email,
      }
    } catch (error) {
      console.error('Add member error:', error)
      return null
    }
  }

  /**
   * Remove member from team
   */
  async removeMember(memberId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({
          is_active: false,
          left_at: new Date().toISOString(),
        })
        .eq('id', memberId)

      return !error
    } catch {
      return false
    }
  }

  /**
   * Get team members
   */
  async getMembers(teamId: string, activeOnly = true): Promise<MemberDetail[]> {
    const { data, error } = await supabase
      .from('team_member_detail')
      .select('*')
      .eq('team_id', teamId)
      .eq(activeOnly ? 'is_active' : '', activeOnly ? true : '')
      .order('joined_at')

    if (error) return []

    return (data || []).map(m => ({
      id: m.id,
      teamId: m.team_id,
      userId: m.user_id,
      userName: m.user_name,
      userEmail: m.user_email,
      role: m.role,
      isActive: m.is_active,
      joinedAt: m.joined_at,
      leftAt: m.left_at,
      activeTasks: m.active_tasks,
      completedTasks: m.completed_tasks,
    }))
  }

  /**
   * Create task
   */
  async createTask(input: CreateTaskInput, createdBy: string): Promise<TeamTask | null> {
    try {
      const { data, error } = await supabase
        .from('team_tasks')
        .insert({
          team_id: input.teamId,
          title: input.title,
          description: input.description,
          task_type: input.taskType,
          assigned_to: input.assignedTo,
          created_by: createdBy,
          status: 'pending',
          priority: input.priority || 'medium',
          due_date: input.dueDate,
          estimated_hours: input.estimatedHours,
          survey_id: input.surveyId,
          component_id: input.componentId,
          progress_percentage: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      // Send notification to assigned user
      if (input.assignedTo) {
        await getNotificationService().sendNotification({
          user_id: input.assignedTo,
          title: 'Tugas Baru',
          message: `Anda diberi tugas: "${input.title}"`,
          type: 'info',
          channel: 'workflow',
          link: `/teams/${input.teamId}/tasks`,
        })
      }

      return {
        id: data.id,
        teamId: data.team_id,
        title: data.title,
        description: data.description,
        taskType: data.task_type,
        assignedTo: data.assigned_to,
        createdBy: data.created_by,
        status: data.status,
        priority: data.priority,
        dueDate: data.due_date,
        estimatedHours: data.estimated_hours,
        progressPercentage: data.progress_percentage,
        surveyId: data.survey_id,
        componentId: data.component_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    } catch (error) {
      console.error('Create task error:', error)
      return null
    }
  }

  /**
   * Get tasks for team
   */
  async getTasks(teamId: string, filters?: {
    status?: TaskStatus
    assignedTo?: string
    priority?: TaskPriority
  }): Promise<TeamTask[]> {
    let query = supabase
      .from('task_board')
      .select('*')
      .eq('team_id', teamId)

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo)
    }
    if (filters?.priority) {
      query = query.eq('priority', filters.priority)
    }

    const { data, error } = await query.order('due_date')

    if (error) return []

    return (data || []).map(t => ({
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
  }

  /**
   * Update task
   */
  async updateTask(taskId: string, updates: UpdateTaskInput): Promise<boolean> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      }

      if (updates.title !== undefined) updateData.title = updates.title
      if (updates.description !== undefined) updateData.description = updates.description
      if (updates.taskType !== undefined) updateData.task_type = updates.taskType
      if (updates.assignedTo !== undefined) updateData.assigned_to = updates.assignedTo
      if (updates.status !== undefined) {
        updateData.status = updates.status
        if (updates.status === 'in_progress' && !updateData.started_at) {
          updateData.started_at = new Date().toISOString()
        }
        if (updates.status === 'done') {
          updateData.completed_at = new Date().toISOString()
        }
      }
      if (updates.priority !== undefined) updateData.priority = updates.priority
      if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate
      if (updates.progressPercentage !== undefined) updateData.progress_percentage = updates.progressPercentage
      if (updates.estimatedHours !== undefined) updateData.estimated_hours = updates.estimatedHours
      if (updates.actualHours !== undefined) updateData.actual_hours = updates.actualHours

      const { error } = await supabase
        .from('team_tasks')
        .update(updateData)
        .eq('id', taskId)

      return !error
    } catch {
      return false
    }
  }

  /**
   * Get team activities
   */
  async getActivities(teamId: string, limit = 50): Promise<TeamActivity[]> {
    const { data, error } = await supabase
      .from('team_activities')
      .select(`
        *,
        user:user_id(name),
        target_user:target_user_id(name)
      `)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return []

    return (data || []).map(a => ({
      id: a.id,
      teamId: a.team_id,
      userId: a.user_id,
      activityType: a.activity_type,
      description: a.description,
      metadata: a.metadata,
      targetUserId: a.target_user_id,
      targetTaskId: a.target_task_id,
      createdAt: a.created_at,
      userName: (a as any).user?.name,
      targetUserName: (a as any).target_user?.name,
    }))
  }

  /**
   * Get user's tasks across all teams
   */
  async getMyTasks(userId: string, status?: TaskStatus): Promise<TeamTask[]> {
    let query = supabase
      .from('task_board')
      .select('*')
      .eq('assigned_to', userId)

    if (status) {
      query = query.eq('status', status)
    } else {
      query = query.not('status', 'in', '("done","cancelled")')
    }

    const { data, error } = await query.order('due_date')

    if (error) return []

    return (data || []).map(t => ({
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
  }

  /**
   * Check if user is team member
   */
  async isTeamMember(teamId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    return !error && !!data
  }

  /**
   * Get user's role in team
   */
  async getUserRole(teamId: string, userId: string): Promise<TeamRole | null> {
    const { data, error } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (error || !data) return null
    return data.role as TeamRole
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const teamService = new TeamService()

export default {
  TeamService,
  teamService,
}
