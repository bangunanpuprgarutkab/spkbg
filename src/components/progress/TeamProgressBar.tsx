/**
 * TEAM PROGRESS BAR COMPONENT
 * Smart AI Engineering Platform - SPKBG
 * 
 * Progress bar untuk menampilkan progress pekerjaan tim
 * dengan visualisasi yang informatif dan real-time updates
 */

import { useEffect, useState } from 'react'
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  RefreshCw
} from 'lucide-react'
import { 
  teamProgressService, 
  getProgressColor,
  getProgressStatus,
  type TeamProgress 
} from '@/services/team/teamProgressService'

// ============================================================================
// TYPES
// ============================================================================

interface TeamProgressBarProps {
  teamId: string
  teamName?: string
  showDetails?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

interface ProgressBarProps {
  value: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  animated?: boolean
  className?: string
}

// ============================================================================
// BASE PROGRESS BAR COMPONENT
// ============================================================================

export function ProgressBar({ 
  value, 
  size = 'md', 
  showLabel = true,
  animated = true,
  className = ''
}: ProgressBarProps): JSX.Element {
  const colorClass = getProgressColor(value)
  
  const heightClass = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  }[size]

  const labelSize = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size]

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1.5">
          <span className={`font-medium text-gray-700 ${labelSize}`}>
            Progress
          </span>
          <span className={`font-bold ${labelSize} ${colorClass.replace('bg-', 'text-')}`}>
            {value}%
          </span>
        </div>
      )}
      
      <div className={`w-full bg-gray-200 rounded-full ${heightClass} overflow-hidden`}>
        <div
          className={`${colorClass} ${heightClass} rounded-full transition-all duration-500 ease-out ${animated ? 'animate-pulse-once' : ''}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}

// ============================================================================
// TEAM PROGRESS BAR COMPONENT
// ============================================================================

export function TeamProgressBar({
  teamId,
  teamName,
  showDetails = true,
  className = ''
}: TeamProgressBarProps): JSX.Element {
  const [progress, setProgress] = useState<TeamProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Load progress data
  const loadProgress = async () => {
    try {
      const data = await teamProgressService.getTeamProgress(teamId)
      setProgress(data)
    } catch (error) {
      console.error('Load progress error:', error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadProgress()

    // Subscribe to real-time updates
    const unsubscribe = teamProgressService.subscribeToProgressUpdates(
      teamId,
      (updatedProgress) => {
        setProgress(updatedProgress)
      }
    )

    return () => unsubscribe()
  }, [teamId])

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadProgress()
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border p-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-3 bg-gray-200 rounded-full"></div>
          <div className="flex gap-4">
            <div className="h-8 bg-gray-200 rounded w-16"></div>
            <div className="h-8 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!progress || progress.totalTasks === 0) {
    return (
      <div className={`bg-white rounded-lg border p-4 ${className}`}>
        <div className="text-center py-6">
          <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Belum ada tugas</p>
          <p className="text-xs text-gray-400 mt-1">Buat tugas untuk melihat progress</p>
        </div>
      </div>
    )
  }

  const displayName = teamName || progress.teamName
  const statusText = getProgressStatus(progress.progressPercentage)
  const progressColor = getProgressColor(progress.progressPercentage)

  return (
    <div className={`bg-white rounded-xl border p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{displayName}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{statusText}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${progressColor.replace('bg-', 'bg-opacity-10 text-').replace('bg-opacity-10', 'bg-opacity-10')}`}>
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{progress.progressPercentage}%</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">
            {progress.completedTasks} dari {progress.totalTasks} tugas selesai
          </span>
          <span className="font-medium text-gray-900">
            {progress.remainingTasks} tersisa
          </span>
        </div>
        
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          {/* Segmented progress bar */}
          <div className="flex h-full">
            {/* Done */}
            <div 
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${(progress.completedTasks / progress.totalTasks) * 100}%` }}
              title={`Done: ${progress.completedTasks}`}
            />
            {/* In Progress */}
            <div 
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${(progress.inProgressTasks / progress.totalTasks) * 100}%` }}
              title={`In Progress: ${progress.inProgressTasks}`}
            />
            {/* Pending */}
            <div 
              className="h-full bg-yellow-500 transition-all duration-500"
              style={{ width: `${(progress.pendingTasks / progress.totalTasks) * 100}%` }}
              title={`Pending: ${progress.pendingTasks}`}
            />
            {/* Blocked */}
            {progress.blockedTasks > 0 && (
              <div 
                className="h-full bg-red-500 transition-all duration-500"
                style={{ width: `${(progress.blockedTasks / progress.totalTasks) * 100}%` }}
                title={`Blocked: ${progress.blockedTasks}`}
              />
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
            <span className="text-gray-600">Selesai ({progress.completedTasks})</span>
          </div>
          {progress.inProgressTasks > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
              <span className="text-gray-600">Proses ({progress.inProgressTasks})</span>
            </div>
          )}
          {progress.pendingTasks > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
              <span className="text-gray-600">Pending ({progress.pendingTasks})</span>
            </div>
          )}
          {progress.blockedTasks > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <span className="text-gray-600">Blocked ({progress.blockedTasks})</span>
            </div>
          )}
        </div>
      </div>

      {/* Details Grid */}
      {showDetails && (
        <div className="grid grid-cols-3 gap-3 pt-4 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-lg font-bold">{progress.completedTasks}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Selesai</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-blue-600">
              <Clock className="w-4 h-4" />
              <span className="text-lg font-bold">{progress.inProgressTasks}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Dikerjakan</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-lg font-bold">{progress.remainingTasks}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Tersisa</p>
          </div>
        </div>
      )}

      {/* ETA */}
      {progress.estimatedDaysLeft !== null && progress.progressPercentage < 100 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            Estimasi penyelesaian: <strong>{progress.estimatedDaysLeft} hari</strong>
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// COMPACT PROGRESS CARD (for lists)
// ============================================================================

export function CompactProgressCard({
  teamId,
  className = ''
}: { teamId: string; className?: string }): JSX.Element {
  const [progress, setProgress] = useState<TeamProgress | null>(null)

  useEffect(() => {
    const load = async () => {
      const data = await teamProgressService.getTeamProgress(teamId)
      setProgress(data)
    }
    load()
  }, [teamId])

  if (!progress) return null as unknown as JSX.Element

  const colorClass = getProgressColor(progress.progressPercentage)

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">{progress.teamName}</span>
          <span className="font-medium">{progress.progressPercentage}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`${colorClass} h-full rounded-full transition-all`}
            style={{ width: `${progress.progressPercentage}%` }}
          />
        </div>
      </div>
      <span className="text-xs text-gray-500">
        {progress.completedTasks}/{progress.totalTasks}
      </span>
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ProgressBar,
  TeamProgressBar,
  CompactProgressCard,
}
