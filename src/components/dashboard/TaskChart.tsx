/**
 * TASK CHART COMPONENT
 * Smart AI Engineering Platform - SPKBG
 * 
 * Charts untuk visualisasi distribusi task dan aktivitas mingguan
 * menggunakan Recharts (BarChart dan PieChart)
 */

import { useState } from 'react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import { BarChart3, PieChart as PieChartIcon, Calendar } from 'lucide-react'
import type { 
  TaskStatusDistribution, 
  WeeklyActivity 
} from '@/services/team/teamDashboardService'

// ============================================================================
// TYPES
// ============================================================================

interface TaskChartProps {
  distribution: TaskStatusDistribution[]
  weeklyActivity: WeeklyActivity[]
}

type ChartType = 'status' | 'activity'

// ============================================================================
// COMPONENT
// ============================================================================

export function TaskChart({ distribution, weeklyActivity }: TaskChartProps): JSX.Element {
  const [activeChart, setActiveChart] = useState<ChartType>('status')

  // Custom tooltip untuk PieChart
  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border">
          <p className="font-semibold">{data.status}</p>
          <p className="text-sm text-gray-600">
            {data.count} tugas ({data.percentage}%)
          </p>
        </div>
      )
    }
    return null
  }

  // Custom tooltip untuk BarChart
  const BarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border">
          <p className="font-semibold mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value} tugas
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Render status distribution chart
  const renderStatusChart = () => {
    if (distribution.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <PieChartIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Belum ada data tugas</p>
          </div>
        </div>
      )
    }

    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={distribution}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="count"
            nameKey="status"
          >
            {distribution.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<PieTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value: string, entry: any) => (
              <span style={{ color: entry.color }}>
                {value} ({entry.payload.count})
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  // Render weekly activity chart
  const renderActivityChart = () => {
    if (weeklyActivity.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Belum ada aktivitas mingguan</p>
          </div>
        </div>
      )
    }

    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={weeklyActivity} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="day" 
            stroke="#6B7280"
            fontSize={12}
            tickLine={false}
          />
          <YAxis 
            stroke="#6B7280"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<BarTooltip />} />
          <Bar 
            dataKey="tasksCreated" 
            name="Dibuat" 
            fill="#3B82F6" 
            radius={[4, 4, 0, 0]}
          />
          <Bar 
            dataKey="tasksCompleted" 
            name="Selesai" 
            fill="#10B981" 
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      {/* Header dengan Tabs */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Analisis Tugas</h3>
        
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveChart('status')}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
              ${activeChart === 'status' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            <PieChartIcon className="w-4 h-4" />
            Status
          </button>
          <button
            onClick={() => setActiveChart('activity')}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
              ${activeChart === 'activity' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            <Calendar className="w-4 h-4" />
            Mingguan
          </button>
        </div>
      </div>

      {/* Chart Content */}
      <div className="mt-4">
        {activeChart === 'status' ? (
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-4 text-center">
              Distribusi Status Tugas
            </h4>
            {renderStatusChart()}
          </div>
        ) : (
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-4 text-center">
              Aktivitas 7 Hari Terakhir
            </h4>
            {renderActivityChart()}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {activeChart === 'status' && distribution.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {distribution.reduce((sum, d) => sum + d.count, 0)}
              </p>
              <p className="text-xs text-gray-500">Total Tugas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {distribution.find(d => d.status === 'Done')?.count || 0}
              </p>
              <p className="text-xs text-gray-500">Selesai</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {Math.round(
                  ((distribution.find(d => d.status === 'Done')?.count || 0) / 
                   distribution.reduce((sum, d) => sum + d.count, 0)) * 100
                )}%
              </p>
              <p className="text-xs text-gray-500">Rate</p>
            </div>
          </div>
        </div>
      )}

      {activeChart === 'activity' && weeklyActivity.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {weeklyActivity.reduce((sum, d) => sum + d.tasksCreated, 0)}
              </p>
              <p className="text-xs text-gray-500">Dibuat Minggu Ini</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {weeklyActivity.reduce((sum, d) => sum + d.tasksCompleted, 0)}
              </p>
              <p className="text-xs text-gray-500">Selesai Minggu Ini</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default TaskChart
