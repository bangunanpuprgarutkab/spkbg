/**
 * MEMBER CARD COMPONENT
 * Smart AI Engineering Platform - SPKBG
 * 
 * Card untuk menampilkan data anggota di leaderboard
 * dengan badges, score, dan statistik
 */

import { Trophy, Target, Flame, Star, Zap } from 'lucide-react'
import type { LeaderboardEntry } from '@/services/team/leaderboardService'

// ============================================================================
// TYPES
// ============================================================================

interface MemberCardProps {
  entry: LeaderboardEntry
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getRoleColor = (role: string): string => {
  const colors: Record<string, string> = {
    ketua_tim: 'bg-purple-100 text-purple-700',
    surveyor: 'bg-green-100 text-green-700',
    analis: 'bg-blue-100 text-blue-700',
    verifikator: 'bg-orange-100 text-orange-700',
    dokumentator: 'bg-gray-100 text-gray-700',
  }
  return colors[role] || 'bg-gray-100 text-gray-700'
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

const getBadgeIcon = (badge: string): React.ReactNode => {
  if (badge.includes('Champion')) return <Trophy className="w-3 h-3" />
  if (badge.includes('Elite')) return <Star className="w-3 h-3" />
  if (badge.includes('Powerhouse')) return <Zap className="w-3 h-3" />
  if (badge.includes('Streak')) return <Flame className="w-3 h-3" />
  if (badge.includes('On Time')) return <Target className="w-3 h-3" />
  return <Star className="w-3 h-3" />
}

const getBadgeColor = (badge: string): string => {
  if (badge.includes('Champion')) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  if (badge.includes('Elite')) return 'bg-purple-100 text-purple-700 border-purple-200'
  if (badge.includes('Powerhouse')) return 'bg-blue-100 text-blue-700 border-blue-200'
  if (badge.includes('Streak')) return 'bg-orange-100 text-orange-700 border-orange-200'
  if (badge.includes('Speedster')) return 'bg-green-100 text-green-700 border-green-200'
  if (badge.includes('Fast')) return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MemberCard({ entry }: MemberCardProps): JSX.Element {
  const completionRate = entry.totalTasks > 0
    ? Math.round((entry.completedTasks / entry.totalTasks) * 100)
    : 0

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      {/* Rank */}
      <div className="flex-shrink-0 w-10 text-center">
        <span className="text-lg font-bold text-gray-600">#{entry.rank}</span>
      </div>

      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-lg font-bold">
          {entry.userName.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-semibold text-gray-900 truncate">{entry.userName}</h4>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleColor(entry.role)}`}>
            {getRoleLabel(entry.role)}
          </span>
        </div>

        {/* Badges */}
        {entry.badges.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {entry.badges.slice(0, 3).map((badge, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${getBadgeColor(badge)}`}
                title={badge}
              >
                {getBadgeIcon(badge)}
                <span className="truncate max-w-[80px]">{badge.replace(/[^a-zA-Z\s]/g, '').trim()}</span>
              </span>
            ))}
            {entry.badges.length > 3 && (
              <span className="text-xs text-gray-500 px-1">+{entry.badges.length - 3}</span>
            )}
          </div>
        )}

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{entry.completedTasks} selesai</span>
          <span>{completionRate}% rate</span>
          {entry.averageCompletionTime && (
            <span>{Math.round(entry.averageCompletionTime)}h avg</span>
          )}
          {entry.streakDays > 0 && (
            <span className="text-orange-600 font-medium flex items-center gap-0.5">
              <Flame className="w-3 h-3" />
              {entry.streakDays} hari
            </span>
          )}
        </div>
      </div>

      {/* Score */}
      <div className="flex-shrink-0 text-right">
        <p className="text-xl font-bold text-gray-900">{entry.score}</p>
        <p className="text-xs text-gray-500">points</p>
      </div>
    </div>
  )
}

// ============================================================================
// COMPACT VARIANT
// ============================================================================

export function CompactMemberCard({ entry }: MemberCardProps): JSX.Element {
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
      <span className="w-6 text-center font-bold text-gray-400">{entry.rank}</span>
      
      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
        {entry.userName.charAt(0).toUpperCase()}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">{entry.userName}</p>
        <p className="text-xs text-gray-500">{entry.completedTasks} tugas</p>
      </div>
      
      <span className="font-semibold text-gray-900">{entry.score}</span>
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  MemberCard,
  CompactMemberCard,
}
