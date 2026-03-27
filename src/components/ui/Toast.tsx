/**
 * TOAST NOTIFICATION COMPONENT
 * Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
 * 
 * UI Toast notification dengan Zustand state management
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ============================================================================
// TYPES
// ============================================================================

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: string
  title?: string
  message: string
  type: ToastType
  duration?: number
  persistent?: boolean
  action?: {
    label: string
    onClick: () => void
  }
}

export interface ToastStore {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearAll: () => void
}

// ============================================================================
// TOAST STORE
// ============================================================================

export const useToastStore = create<ToastStore>()(
  persist(
    (set, get) => ({
      toasts: [],
      
      addToast: (toast) => {
        const id = Math.random().toString(36).substring(2, 9)
        const newToast: Toast = {
          ...toast,
          id,
          duration: toast.duration ?? 5000,
        }
        
        set({ toasts: [...get().toasts, newToast] })
        
        // Auto remove non-persistent toasts
        if (!newToast.persistent && newToast.duration) {
          setTimeout(() => {
            get().removeToast(id)
          }, newToast.duration)
        }
      },
      
      removeToast: (id) => {
        set({ toasts: get().toasts.filter((t) => t.id !== id) })
      },
      
      clearAll: () => {
        set({ toasts: [] })
      },
    }),
    {
      name: 'toast-store',
      partialize: () => ({ toasts: [] }),
    }
  )
)

// ============================================================================
// TOAST HELPERS
// ============================================================================

export function showToast(message: string, type: ToastType = 'info', duration?: number): void {
  useToastStore.getState().addToast({
    message,
    type,
    duration,
  })
}

export function showSuccess(message: string, duration?: number): void {
  showToast(message, 'success', duration)
}

export function showError(message: string, duration: number = 8000): void {
  showToast(message, 'error', duration)
}

export function showWarning(message: string, duration?: number): void {
  showToast(message, 'warning', duration)
}

export function showInfo(message: string, duration?: number): void {
  showToast(message, 'info', duration)
}

// ============================================================================
// REACT COMPONENT
// ============================================================================

import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <AlertCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
}

const toastStyles: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
}

export function ToastContainer(): JSX.Element | null {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null as unknown as JSX.Element

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-start gap-3 p-4 rounded-lg border shadow-lg
            animate-in slide-in-from-right duration-200
            ${toastStyles[toast.type]}
          `}
          role="alert"
        >
          <div className="flex-shrink-0 mt-0.5">
            {toastIcons[toast.type]}
          </div>
          
          <div className="flex-1 min-w-0">
            {toast.title && (
              <h4 className="font-semibold text-sm mb-1">{toast.title}</h4>
            )}
            <p className="text-sm">{toast.message}</p>
            
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.onClick()
                  removeToast(toast.id)
                }}
                className="mt-2 text-sm font-medium underline hover:no-underline"
              >
                {toast.action.label}
              </button>
            )}
          </div>
          
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// LOADING OVERLAY
// ============================================================================

import { Loader2 } from 'lucide-react'

export function LoadingOverlay({ 
  isLoading, 
  message = 'Memuat...' 
}: { 
  isLoading: boolean
  message?: string 
}): JSX.Element | null {
  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-government-green" />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}

// ============================================================================
// SAVING INDICATOR
// ============================================================================

export function SavingIndicator({ 
  isSaving, 
  lastSaved 
}: { 
  isSaving: boolean
  lastSaved?: Date 
}): JSX.Element {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      {isSaving ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Menyimpan...</span>
        </>
      ) : lastSaved ? (
        <>
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span>Tersimpan {lastSaved.toLocaleTimeString('id-ID')}</span>
        </>
      ) : (
        <>
          <Info className="w-4 h-4" />
          <span>Belum disimpan</span>
        </>
      )}
    </div>
  )
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by boundary:', error, errorInfo)
    
    // Log to error tracking service
    logError(error, errorInfo)
    
    // Show toast
    showError('Terjadi kesalahan. Halaman akan dimuat ulang.', 10000)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 max-w-md">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Terjadi Kesalahan
            </h2>
            <p className="text-gray-600 mb-4">
              Mohon maaf, terjadi kesalahan saat memuat halaman.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

interface ErrorLog {
  timestamp: string
  message: string
  stack?: string
  componentStack?: string
  userAgent: string
  url: string
}

export function logError(error: Error, errorInfo?: ErrorInfo): void {
  const log: ErrorLog = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo?.componentStack ?? undefined,
    userAgent: navigator.userAgent,
    url: window.location.href,
  }

  // Log to console
  console.error('Error logged:', log)

  // Save to local storage for debugging
  const logs: ErrorLog[] = JSON.parse(localStorage.getItem('error_logs') || '[]')
  logs.push(log)
  
  // Keep only last 50 errors
  if (logs.length > 50) {
    logs.shift()
  }
  
  localStorage.setItem('error_logs', JSON.stringify(logs))

  // Send to analytics (if available)
  if ((window as any).gtag) {
    (window as any).gtag('event', 'exception', {
      description: error.message,
      fatal: true,
    })
  }
}

/**
 * Get error logs from local storage
 */
export function getErrorLogs(): ErrorLog[] {
  return JSON.parse(localStorage.getItem('error_logs') || '[]')
}

/**
 * Clear error logs
 */
export function clearErrorLogs(): void {
  localStorage.removeItem('error_logs')
}

// ============================================================================
// ASYNC ERROR HANDLER
// ============================================================================

export async function handleAsyncError<T>(
  promise: Promise<T>,
  errorMessage: string = 'Terjadi kesalahan'
): Promise<T | null> {
  try {
    return await promise
  } catch (error: any) {
    const message = error?.message || errorMessage
    showError(message)
    logError(error instanceof Error ? error : new Error(message))
    return null
  }
}
