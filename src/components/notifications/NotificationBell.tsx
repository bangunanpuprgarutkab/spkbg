/**
 * NOTIFICATION BELL COMPONENT
 * Smart AI Engineering Platform - SPKBG
 * 
 * Bell icon dengan dropdown notifikasi real-time
 * menampilkan unread count badge dan notification list
 */

import { useEffect, useState, useRef } from 'react'
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Archive,
  X,
  Clock,
  CheckCircle,
  UserPlus,
  Users,
  ClipboardList,
  RefreshCw,
  GitBranch,
  AlertTriangle
} from 'lucide-react'
import { 
  notificationService, 
  type Notification, 
  type NotificationType 
} from '@/services/notifications/notificationService'

// ============================================================================
// TYPES
// ============================================================================

interface NotificationBellProps {
  className?: string
}

// ============================================================================
// ICON MAPPING
// ============================================================================

const iconMap: Record<NotificationType, React.ReactNode> = {
  task_assigned: <ClipboardList className="w-5 h-5" />,
  task_status_changed: <RefreshCw className="w-5 h-5" />,
  task_completed: <CheckCircle className="w-5 h-5" />,
  member_added: <UserPlus className="w-5 h-5" />,
  member_joined: <Users className="w-5 h-5" />,
  deadline_approaching: <AlertTriangle className="w-5 h-5" />,
  workflow_update: <GitBranch className="w-5 h-5" />,
  system: <Bell className="w-5 h-5" />,
}

const priorityColors: Record<string, string> = {
  low: 'border-l-gray-400',
  normal: 'border-l-blue-500',
  high: 'border-l-orange-500',
  urgent: 'border-l-red-500',
}

const priorityBg: Record<string, string> = {
  low: 'bg-gray-50',
  normal: 'bg-blue-50',
  high: 'bg-orange-50',
  urgent: 'bg-red-50',
}

// ============================================================================
// COMPONENT
// ============================================================================

export function NotificationBell({ className }: NotificationBellProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load notifications
  const loadNotifications = async () => {
    setLoading(true)
    try {
      const [notifs, count] = await Promise.all([
        notificationService.getNotifications({ isRead: false }, 20),
        notificationService.getNotificationCount(),
      ])
      setNotifications(notifs)
      setUnreadCount(count.unread)
    } catch (error) {
      console.error('Load notifications error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadNotifications()

    // Subscribe to real-time notifications
    const unsubscribe = notificationService.subscribeToNotifications(
      (newNotif) => {
        // Add new notification to list
        setNotifications(prev => [newNotif, ...prev])
        setUnreadCount(prev => prev + 1)
        
        // Show toast
        showToast(newNotif)
      },
      () => {
        // Refresh on updates
        loadNotifications()
      }
    )

    return () => unsubscribe()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Show toast notification
  const showToast = (notification: Notification) => {
    // Create toast element
    const toast = document.createElement('div')
    toast.className = `
      fixed top-4 right-4 z-50 max-w-sm 
      bg-white rounded-lg shadow-lg border-l-4 
      ${priorityColors[notification.priority]}
      p-4 transform transition-all duration-300
      translate-x-full opacity-0
    `
    toast.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0">${getIconForType(notification.type)}</div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm text-gray-900">${notification.title}</p>
          ${notification.message ? `<p class="text-sm text-gray-600 mt-1">${notification.message}</p>` : ''}
        </div>
        <button class="text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `
    
    document.body.appendChild(toast)
    
    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-x-full', 'opacity-0')
    })
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      toast.classList.add('translate-x-full', 'opacity-0')
      setTimeout(() => toast.remove(), 300)
    }, 5000)
  }

  const getIconForType = (type: NotificationType): string => {
    const icons: Record<NotificationType, string> = {
      task_assigned: '📋',
      task_status_changed: '🔄',
      task_completed: '✅',
      member_added: '👤',
      member_joined: '👥',
      deadline_approaching: '⚠️',
      workflow_update: '📊',
      system: '🔔',
    }
    return icons[type] || '🔔'
  }

  // Mark as read
  const handleMarkAsRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const success = await notificationService.markAsRead(id)
    if (success) {
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    const count = await notificationService.markAllAsRead()
    if (count > 0) {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    }
  }

  // Archive notification
  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const success = await notificationService.archiveNotification(id)
    if (success) {
      setNotifications(prev => prev.filter(n => n.id !== id))
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      notificationService.markAsRead(notification.id)
    }
    
    // Navigate if action URL exists
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl
    }
    
    setIsOpen(false)
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) loadNotifications()
        }}
        className={`
          relative p-2 rounded-lg transition-colors
          ${isOpen ? 'bg-gray-100' : 'hover:bg-gray-100'}
        `}
      >
        <Bell className="w-6 h-6 text-gray-600" />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className={`
            absolute -top-1 -right-1 
            min-w-[20px] h-5 px-1.5
            flex items-center justify-center
            text-xs font-bold text-white
            bg-red-500 rounded-full
            ${unreadCount > 9 ? 'scale-90' : ''}
          `}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={`
          absolute right-0 top-full mt-2 w-96
          bg-white rounded-xl shadow-xl border
          z-50 overflow-hidden
        `}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/50">
            <div>
              <h3 className="font-semibold text-gray-900">Notifikasi</h3>
              <p className="text-xs text-gray-500">
                {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Tidak ada notifikasi baru'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Tandai semua sudah dibaca"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Tidak ada notifikasi</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`
                      flex items-start gap-3 p-4 cursor-pointer
                      transition-colors hover:bg-gray-50
                      ${!notification.isRead ? priorityBg[notification.priority] : ''}
                      ${!notification.isRead ? `border-l-4 ${priorityColors[notification.priority]}` : 'border-l-4 border-l-transparent'}
                    `}
                  >
                    {/* Icon */}
                    <div className={`
                      flex-shrink-0 w-10 h-10 rounded-full 
                      flex items-center justify-center
                      ${priorityBg[notification.priority]}
                    `}>
                      {iconMap[notification.type]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.isRead ? 'font-semibold' : ''} text-gray-900`}>
                        {notification.title}
                      </p>
                      {notification.message && (
                        <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>{notification.timeAgo || notification.createdAt}</span>
                        {notification.priority === 'urgent' && (
                          <span className="text-red-500 font-medium">• Urgent</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      {!notification.isRead && (
                        <button
                          onClick={(e) => handleMarkAsRead(e, notification.id)}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                          title="Tandai sudah dibaca"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleArchive(e, notification.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        title="Arsipkan"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-gray-50/50 text-center">
            <button className="text-sm text-green-600 hover:text-green-700 font-medium">
              Lihat Semua Notifikasi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default NotificationBell
