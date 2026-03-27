/**
 * TEAM MONITORING DASHBOARD - Main Component
 * Smart AI Engineering Platform - SPKBG
 * 
 * Dashboard profesional untuk monitoring kinerja tim teknis
 * dengan KPI, charts, dan tabel anggota
 */

import { useEffect, useState } from 'react'
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  Calendar,
  RefreshCw
} from 'lucide-react'
import { 
  teamDashboardService, 
  type TeamDashboardData
} from '@/services/team/teamDashboardService'
import { KPISection } from './KPISection'
import { TaskChart } from './TaskChart'
import { MemberTable } from './MemberTable'

// ============================================================================
// TYPES
// ============================================================================

interface TeamMonitoringDashboardProps {
  teamId: string
  teamName?: string
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TeamMonitoringDashboard({ 
  teamId, 
  teamName 
}: TeamMonitoringDashboardProps): JSX.Element {
  const [data, setData] = useState<TeamDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Load dashboard data
  const loadData = async () => {
    setLoading(true)
    try {
      const dashboardData = await teamDashboardService.getDashboardData(teamId)
      setData(dashboardData)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Load dashboard error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadData()

    // Subscribe to real-time updates
    const unsubscribe = teamDashboardService.subscribeToUpdates(teamId, () => {
      loadData()
    })

    return () => unsubscribe()
  }, [teamId])

  // Calculate trend (mock - would compare with previous period in real implementation)
  const _getTrend = (current: number, previous: number = 0) => {
    if (previous === 0) return { value: 100, isPositive: true }
    const change = ((current - previous) / previous) * 100
    return {
      value: Math.abs(Math.round(change)),
      isPositive: change >= 0
    }
  }
  void _getTrend

  if (loading && !data) {
    return (
      <div className="p-6 space-y-6">
        {/* Header Skeleton */}
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
        
        {/* KPI Skeleton */}
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse"></div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-2 gap-6">
          <div className="h-80 bg-gray-200 rounded-xl animate-pulse"></div>
          <div className="h-80 bg-gray-200 rounded-xl animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">Gagal memuat dashboard</h3>
          <p className="text-gray-500 mt-2">Terjadi kesalahan saat mengambil data tim</p>
          <button 
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  const { kpi, taskDistribution, memberPerformance, weeklyActivity } = data

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {teamName || 'Dashboard Tim'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitoring kinerja tim teknis
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Last updated */}
          <span className="text-sm text-gray-400">
            Diperbarui: {lastUpdated.toLocaleTimeString('id-ID')}
          </span>
          
          {/* Refresh button */}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-sm">Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Section */}
      <KPISection kpi={kpi} />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskChart 
          distribution={taskDistribution}
          weeklyActivity={weeklyActivity}
        />
        
        {/* Quick Stats Panel */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Status Overview</h3>
          
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Progress Keseluruhan</span>
              <span className="font-semibold">{kpi.completionRate}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all"
                style={{ width: `${kpi.completionRate}%` }}
              />
            </div>
          </div>

          {/* Status Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-700">{kpi.pendingTasks}</p>
                <p className="text-sm text-yellow-600">Pending</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{kpi.inProgressTasks}</p>
                <p className="text-sm text-blue-600">In Progress</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{kpi.completedTasks}</p>
                <p className="text-sm text-green-600">Selesai</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700">{kpi.blockedTasks}</p>
                <p className="text-sm text-red-600">Blocked</p>
              </div>
            </div>
          </div>

          {/* Alerts */}
          {(kpi.overdueTasks > 0 || kpi.dueTodayTasks > 0) && (
            <div className="mt-4 space-y-2">
              {kpi.overdueTasks > 0 && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="text-sm text-red-700">
                    {kpi.overdueTasks} tugas overdue
                  </span>
                </div>
              )}
              {kpi.dueTodayTasks > 0 && (
                <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <Calendar className="w-5 h-5 text-orange-500" />
                  <span className="text-sm text-orange-700">
                    {kpi.dueTodayTasks} tugas deadline hari ini
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Member Performance Table */}
      <MemberTable members={memberPerformance} />

      {/* Footer */}
      <div className="text-center text-sm text-gray-400 pt-4">
        <p>Dashboard diperbarui otomatis • Data real-time dari Supabase</p>
      </div>
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default TeamMonitoringDashboard
