/**
 * NOTIFICATION SYSTEM
 * Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
 * 
 * Real-time notifications menggunakan Supabase Realtime
 */

import { supabase } from '@/services/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType = 'info' | 'success' | 'warning' | 'error'
export type NotificationChannel = 'workflow' | 'approval' | 'system' | 'export'

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  channel: NotificationChannel
  entity_type?: string
  entity_id?: string
  link?: string
  is_read: boolean
  read_at?: string
  created_at: string
  metadata?: Record<string, any>
}

export interface NotificationPayload {
  user_id: string
  title: string
  message: string
  type: NotificationType
  channel: NotificationChannel
  entity_type?: string
  entity_id?: string
  link?: string
  metadata?: Record<string, any>
}

export interface NotificationPreferences {
  user_id: string
  email_enabled: boolean
  push_enabled: boolean
  in_app_enabled: boolean
  channels: NotificationChannel[]
}

export type NotificationCallback = (notification: Notification) => void

// ============================================================================
// NOTIFICATION SERVICE
// ============================================================================

export class NotificationService {
  private channel: RealtimeChannel | null = null
  private userId: string | null = null
  private callbacks: Map<string, NotificationCallback[]> = new Map()
  private isSubscribed: boolean = false

  async initialize(userId: string): Promise<void> {
    this.userId = userId
    await this.subscribeToNotifications()
  }

  private async subscribeToNotifications(): Promise<void> {
    if (!this.userId || this.isSubscribed) return

    this.channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => {
          const notification = payload.new as Notification
          this.handleNewNotification(notification)
        }
      )
      .subscribe()

    this.isSubscribed = true
  }

  private handleNewNotification(notification: Notification): void {
    const channelCallbacks = this.callbacks.get(notification.channel) || []
    const allCallbacks = this.callbacks.get('all') || []
    
    ;[...channelCallbacks, ...allCallbacks].forEach((callback) => {
      try {
        callback(notification)
      } catch (error) {
        console.error('Notification callback error:', error)
      }
    })
  }

  onNotification(channel: NotificationChannel | 'all', callback: NotificationCallback): () => void {
    if (!this.callbacks.has(channel)) {
      this.callbacks.set(channel, [])
    }
    
    this.callbacks.get(channel)!.push(callback)

    return () => {
      const callbacks = this.callbacks.get(channel)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
      }
    }
  }

  async sendNotification(payload: NotificationPayload): Promise<Notification | null> {
    if (!this.userId) return null

    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: this.userId,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          channel: payload.channel,
          entity_type: payload.entity_type,
          entity_id: payload.entity_id,
          link: payload.link,
          metadata: payload.metadata,
          is_read: false,
        })
        .select()
        .single()

      if (error) throw error
      
      return data
    } catch (error) {
      console.error('Failed to send notification:', error)
      return null
    }
  }

  async getUnreadNotifications(): Promise<Notification[]> {
    if (!this.userId) return []

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', this.userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      return data || []
    } catch (error) {
      console.error('Failed to get notifications:', error)
      return []
    }
  }

  async getAllNotifications(limit: number = 50): Promise<Notification[]> {
    if (!this.userId) return []

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      
      return data || []
    } catch (error) {
      console.error('Failed to get notifications:', error)
      return []
    }
  }

  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId)

      return !error
    } catch {
      return false
    }
  }

  async markAllAsRead(): Promise<boolean> {
    if (!this.userId) return false

    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', this.userId)
        .eq('is_read', false)

      return !error
    } catch {
      return false
    }
  }

  async getUnreadCount(): Promise<number> {
    if (!this.userId) return 0

    try {
      const { count, error: _error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('is_read', false)

      return count || 0
    } catch {
      return 0
    }
  }

  async deleteOldNotifications(days: number = 30): Promise<boolean> {
    if (!this.userId) return false

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', this.userId)
        .lt('created_at', cutoffDate.toISOString())

      return !error
    } catch {
      return false
    }
  }

  cleanup(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel)
      this.channel = null
    }
    this.callbacks.clear()
    this.isSubscribed = false
    this.userId = null
  }
}

let notificationServiceInstance: NotificationService | null = null

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService()
  }
  return notificationServiceInstance
}

export async function notifyWorkflowChange(
  userId: string,
  surveyCode: string,
  oldStatus: string,
  newStatus: string,
  surveyId: string
): Promise<void> {
  const service = getNotificationService()
  
  await service.sendNotification({
    user_id: userId,
    title: 'Status Survey Berubah',
    message: `Survey ${surveyCode} berubah dari "${oldStatus}" ke "${newStatus}"`,
    type: 'info',
    channel: 'workflow',
    entity_type: 'survey',
    entity_id: surveyId,
    link: `/surveys/${surveyId}`,
  })
}

export async function notifyApprovalRequired(
  userId: string,
  surveyCode: string,
  surveyId: string
): Promise<void> {
  const service = getNotificationService()
  
  await service.sendNotification({
    user_id: userId,
    title: 'Approval Diperlukan',
    message: `Survey ${surveyCode} menunggu approval Anda`,
    type: 'warning',
    channel: 'approval',
    entity_type: 'survey',
    entity_id: surveyId,
    link: `/approval/${surveyId}`,
  })
}

export async function notifyExportComplete(
  userId: string,
  fileName: string,
  downloadUrl: string
): Promise<void> {
  const service = getNotificationService()
  
  await service.sendNotification({
    user_id: userId,
    title: 'Export Berhasil',
    message: `File ${fileName} telah siap diunduh`,
    type: 'success',
    channel: 'export',
    link: downloadUrl,
  })
}

export async function notifyRevisionRequired(
  userId: string,
  surveyCode: string,
  note: string,
  surveyId: string
): Promise<void> {
  const service = getNotificationService()
  
  await service.sendNotification({
    user_id: userId,
    title: 'Revisi Diperlukan',
    message: `Survey ${surveyCode} perlu direvisi. Catatan: ${note}`,
    type: 'warning',
    channel: 'workflow',
    entity_type: 'survey',
    entity_id: surveyId,
    link: `/surveys/${surveyId}/edit`,
  })
}

export async function notifySurveySubmitted(
  userId: string,
  surveyCode: string,
  surveyId: string
): Promise<void> {
  const service = getNotificationService()
  
  await service.sendNotification({
    user_id: userId,
    title: 'Survey Dikirim',
    message: `Survey ${surveyCode} telah dikirim dan menunggu verifikasi`,
    type: 'success',
    channel: 'workflow',
    entity_type: 'survey',
    entity_id: surveyId,
    link: `/surveys/${surveyId}`,
  })
}

export { NotificationService as default }
