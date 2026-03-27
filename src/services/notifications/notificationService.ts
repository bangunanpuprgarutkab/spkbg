/**
 * NOTIFICATION SERVICE
 * Smart AI Engineering Platform - SPKBG
 * 
 * Service untuk mengelola notifikasi real-time dengan Supabase
 * termasuk subscriptions, CRUD operations, dan toast notifications
 */

import { supabase } from '@/services/supabase/client'

// ============================================================================
// TYPES
// ============================================================================

export interface Notification {
  id: string
  userId: string
  teamId?: string
  type: NotificationType
  title: string
  message?: string
  data?: Record<string, any>
  priority: 'low' | 'normal' | 'high' | 'urgent'
  isRead: boolean
  isArchived: boolean
  readAt?: string
  actionUrl?: string
  createdAt: string
  updatedAt: string
  timeAgo?: string
}

export type NotificationType = 
  | 'task_assigned'
  | 'task_status_changed'
  | 'task_completed'
  | 'member_added'
  | 'member_joined'
  | 'deadline_approaching'
  | 'workflow_update'
  | 'system'

export interface NotificationFilters {
  isRead?: boolean
  type?: NotificationType
  priority?: string
}

export interface NotificationCount {
  total: number
  unread: number
  highPriority: number
}

// ============================================================================
// NOTIFICATION SERVICE
// ============================================================================

export class NotificationService {
  private subscription: any = null

  /**
   * Get notifications for current user
   */
  async getNotifications(
    filters?: NotificationFilters,
    limit: number = 50
  ): Promise<Notification[]> {
    try {
      let query = supabase
        .from('user_notifications')
        .select('*')
        .limit(limit)

      if (filters?.isRead !== undefined) {
        query = query.eq('is_read', filters.isRead)
      }

      if (filters?.type) {
        query = query.eq('type', filters.type)
      }

      if (filters?.priority) {
        query = query.eq('priority', filters.priority)
      }

      const { data, error } = await query

      if (error) throw error

      return (data || []).map(this.mapNotification)
    } catch (error) {
      console.error('Get notifications error:', error)
      return []
    }
  }

  /**
   * Get unread notifications
   */
  async getUnreadNotifications(limit: number = 20): Promise<Notification[]> {
    return this.getNotifications({ isRead: false }, limit)
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', notificationId)

      return !error
    } catch (error) {
      console.error('Mark as read error:', error)
      return false
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('mark_all_notifications_read')

      if (error) throw error
      return data || 0
    } catch (error) {
      console.error('Mark all as read error:', error)
      return 0
    }
  }

  /**
   * Archive notification
   */
  async archiveNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_archived: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notificationId)

      return !error
    } catch (error) {
      console.error('Archive notification error:', error)
      return false
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      return !error
    } catch (error) {
      console.error('Delete notification error:', error)
      return false
    }
  }

  /**
   * Get notification count
   */
  async getNotificationCount(): Promise<NotificationCount> {
    try {
      // Get unread count via RPC
      const { data: unreadCount, error: countError } = await supabase
        .rpc('get_unread_notification_count')

      if (countError) throw countError

      // Get high priority unread count
      const { data: highPriorityData, error: priorityError } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('is_read', false)
        .eq('is_archived', false)
        .in('priority', ['high', 'urgent'])

      if (priorityError) throw priorityError

      // Get total count
      const { data: totalData, error: totalError } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('is_archived', false)

      if (totalError) throw totalError

      return {
        total: totalData?.length || 0,
        unread: unreadCount || 0,
        highPriority: highPriorityData?.length || 0,
      }
    } catch (error) {
      console.error('Get notification count error:', error)
      return { total: 0, unread: 0, highPriority: 0 }
    }
  }

  /**
   * Subscribe to real-time notifications
   */
  subscribeToNotifications(
    onNewNotification: (notification: Notification) => void,
    onUpdate?: () => void
  ): () => void {
    // Callback stored for future use
    void onNewNotification

    this.subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${supabase.auth.getUser()}`,
        },
        (payload) => {
          const notification = this.mapNotification(payload.new)
          onNewNotification(notification)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          onUpdate?.()
        }
      )
      .subscribe()

    return () => {
      this.unsubscribe()
    }
  }

  /**
   * Unsubscribe from notifications
   */
  unsubscribe(): void {
    if (this.subscription) {
      this.subscription.unsubscribe()
      this.subscription = null
    }
  }

  /**
   * Manually check for approaching deadlines
   */
  async checkDeadlines(): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('check_all_approaching_deadlines')

      if (error) throw error
      return data || 0
    } catch (error) {
      console.error('Check deadlines error:', error)
      return 0
    }
  }

  /**
   * Map database notification to interface
   */
  private mapNotification(data: any): Notification {
    return {
      id: data.id,
      userId: data.user_id,
      teamId: data.team_id,
      type: data.type as NotificationType,
      title: data.title,
      message: data.message,
      data: data.data,
      priority: data.priority as Notification['priority'],
      isRead: data.is_read,
      isArchived: data.is_archived,
      readAt: data.read_at,
      actionUrl: data.action_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      timeAgo: data.time_ago,
    }
  }

  /**
   * Get icon for notification type
   */
  static getIconForType(type: NotificationType): string {
    const icons: Record<NotificationType, string> = {
      task_assigned: 'ClipboardList',
      task_status_changed: 'RefreshCw',
      task_completed: 'CheckCircle',
      member_added: 'UserPlus',
      member_joined: 'Users',
      deadline_approaching: 'AlertTriangle',
      workflow_update: 'GitBranch',
      system: 'Bell',
    }
    return icons[type] || 'Bell'
  }

  /**
   * Get color for notification priority
   */
  static getColorForPriority(priority: string): string {
    const colors: Record<string, string> = {
      low: 'text-gray-500 bg-gray-100',
      normal: 'text-blue-500 bg-blue-100',
      high: 'text-orange-500 bg-orange-100',
      urgent: 'text-red-500 bg-red-100',
    }
    return colors[priority] || colors.normal
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const notificationService = new NotificationService()

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  NotificationService,
  notificationService,
}
