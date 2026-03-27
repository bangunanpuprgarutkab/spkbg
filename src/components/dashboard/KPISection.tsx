/**
 * KPI SECTION COMPONENT
 * Smart AI Engineering Platform - SPKBG
 * 
 * KPI Cards untuk menampilkan key metrics tim
 */

import { CheckCircle, Clock, AlertCircle, TrendingUp, TrendingDown, Users } from 'lucide-react'
import type { TeamKPI } from '@/services/team/teamDashboardService'

// ============================================================================
// TYPES
// ============================================================================

interface KPISectionProps {
  kpi: TeamKPI
}

interface KPICardProps {
  title: string
  value: number
  subtitle?: string
  icon: React.ReactNode
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
  trend?: {
    value: number
    isPositive: boolean
  }
}

// ============================================================================
// KPI CARD COMPONENT
// ============================================================================

function KPICard({ title, value, subtitle, icon, color, trend }: KPICardProps): JSX.Element {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  }

  const iconBgClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
  }

  return (
    <div className={`rounded-xl border p-5 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-3xl font-bold mt-1">{value.toLocaleString('id-ID')}</p>
          {subtitle && (
            <p className="text-sm mt-1 opacity-70">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{trend.value}% {trend.isPositive ? 'naik' : 'turun'}</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBgClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function KPISection({ kpi }: KPISectionProps): JSX.Element {
  // Calculate rates
  const completionRate = kpi.completionRate
  void completionRate

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Members */}
      <KPICard
        title="Total Anggota"
        value={kpi.totalMembers}
        subtitle="Anggota aktif tim"
        icon={<Users className="w-6 h-6" />}
        color="blue"
      />

      {/* Total Tasks */}
      <KPICard
        title="Total Tugas"
        value={kpi.totalTasks}
        subtitle={`${kpi.inProgressTasks} dalam proses`}
        icon={<Clock className="w-6 h-6" />}
        color="purple"
      />

      {/* Completed Tasks */}
      <KPICard
        title="Tugas Selesai"
        value={kpi.completedTasks}
        subtitle={`${completionRate}% completion rate`}
        icon={<CheckCircle className="w-6 h-6" />}
        color="green"
        trend={{ value: completionRate, isPositive: completionRate > 50 }}
      />

      {/* Pending/Blocked Tasks */}
      <KPICard
        title="Perlu Perhatian"
        value={kpi.pendingTasks + kpi.blockedTasks}
        subtitle={`${kpi.overdueTasks} overdue, ${kpi.dueTodayTasks} hari ini`}
        icon={<AlertCircle className="w-6 h-6" />}
        color={kpi.overdueTasks > 0 ? 'red' : 'yellow'}
      />
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default KPISection
