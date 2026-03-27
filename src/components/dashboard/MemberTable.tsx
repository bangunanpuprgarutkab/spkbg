/**
 * MEMBER TABLE COMPONENT
 * Smart AI Engineering Platform - SPKBG
 * 
 * Tabel anggota tim dengan statistik tugas dan progress
 */

import { User, CheckCircle, Clock, AlertCircle, TrendingUp, MoreHorizontal, Mail } from 'lucide-react'
import type { MemberPerformance } from '@/services/team/teamDashboardService'

// ============================================================================
// TYPES
// ============================================================================

interface MemberTableProps {
  members: MemberPerformance[]
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getRoleBadgeColor = (role: string): string => {
  const colors: Record<string, string> = {
    ketua_tim: 'bg-purple-100 text-purple-800 border-purple-200',
    surveyor: 'bg-green-100 text-green-800 border-green-200',
    analis: 'bg-blue-100 text-blue-800 border-blue-200',
    verifikator: 'bg-orange-100 text-orange-800 border-orange-200',
    dokumentator: 'bg-gray-100 text-gray-800 border-gray-200',
  }
  return colors[role] || 'bg-gray-100 text-gray-800'
}

const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    ketua_tim: 'Ketua Tim',
    surveyor: 'Surveyor',
    analis: 'Analis',
    verifikator: 'Verifikator',
    dokumentator: 'Dokumentator',
  }
  return labels[role] || role
}

const getProgressColor = (rate: number): string => {
  if (rate >= 80) return 'bg-green-500'
  if (rate >= 50) return 'bg-blue-500'
  if (rate >= 30) return 'bg-yellow-500'
  return 'bg-red-500'
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MemberTable({ members }: MemberTableProps): JSX.Element {
  if (members.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-8">
        <div className="text-center">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">Belum ada anggota</h3>
          <p className="text-gray-500 mt-1">Tim ini belum memiliki anggota aktif</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Kinerja Anggota</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {members.length} anggota aktif
            </p>
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <MoreHorizontal className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/50 border-b">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Anggota
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Peran
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Tugas
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((member) => (
              <tr 
                key={member.userId}
                className="hover:bg-gray-50/80 transition-colors"
              >
                {/* Member Info */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {member.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.userName}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Mail className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">{member.userEmail}</span>
                      </div>
                    </div>
                  </div>
                </td>

                {/* Role */}
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(member.role)}`}>
                    {getRoleLabel(member.role)}
                  </span>
                </td>

                {/* Total Tasks */}
                <td className="px-6 py-4 text-center">
                  <span className="text-lg font-semibold text-gray-900">
                    {member.totalTasks}
                  </span>
                </td>

                {/* Task Status Breakdown */}
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-3">
                    {member.completedTasks > 0 && (
                      <div className="flex items-center gap-1 text-xs text-green-600" title="Selesai">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span className="font-medium">{member.completedTasks}</span>
                      </div>
                    )}
                    {member.inProgressTasks > 0 && (
                      <div className="flex items-center gap-1 text-xs text-blue-600" title="Dalam Proses">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-medium">{member.inProgressTasks}</span>
                      </div>
                    )}
                    {member.pendingTasks > 0 && (
                      <div className="flex items-center gap-1 text-xs text-yellow-600" title="Pending">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span className="font-medium">{member.pendingTasks}</span>
                      </div>
                    )}
                    {member.totalTasks === 0 && (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>
                </td>

                {/* Progress */}
                <td className="px-6 py-4">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${getProgressColor(member.completionRate)}`}
                          style={{ width: `${member.completionRate}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 min-w-[32px]">
                        {member.completionRate}%
                      </span>
                    </div>
                  </div>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 text-right">
                  <button className="text-gray-400 hover:text-gray-600 transition-colors">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Summary */}
      <div className="px-6 py-4 border-t bg-gray-50/50">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-gray-600">
                Total selesai: <strong className="text-gray-900">
                  {members.reduce((sum, m) => sum + m.completedTasks, 0)}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-gray-600">
                Dalam proses: <strong className="text-gray-900">
                  {members.reduce((sum, m) => sum + m.inProgressTasks, 0)}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-gray-600">
                Rata-rata completion: <strong className="text-gray-900">
                  {Math.round(
                    members.reduce((sum, m) => sum + m.completionRate, 0) / members.length
                  )}%
                </strong>
              </span>
            </div>
          </div>
          <div className="text-gray-400">
            Diurutkan berdasarkan kinerja
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default MemberTable
