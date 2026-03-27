/**
 * LEADERBOARD COMPONENT
 * Smart AI Engineering Platform - SPKBG
 * 
 * Leaderboard anggota tim dengan ranking, score, dan badges
 * dengan highlight khusus untuk top 3
 */

import { useEffect, useState } from 'react'
import { 
  Trophy, 
  Medal, 
  Award, 
  Star,
  RefreshCw
} from 'lucide-react'
import { 
  leaderboardService, 
  type LeaderboardEntry 
} from '@/services/team/leaderboardService'
import { MemberCard } from './MemberCard'

// ============================================================================
// TYPES
// ============================================================================

interface LeaderboardProps {
  teamId: string
  className?: string
}

// ============================================================================
// TOP 3 PODIUM COMPONENT
// ============================================================================

const TopThreePodium = ({ entries }: { entries: LeaderboardEntry[] }) => {
  if (entries.length === 0) return null

  const [first, second, third] = [
    entries[0],
    entries[1] || null,
    entries[2] || null,
  ]

  return (
    <div className="flex justify-center items-end gap-4 mb-8 px-4">
      {/* 2nd Place */}
      {second && (
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-lg">
              {second.userName.charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-gray-200 rounded-full p-1">
              <Medal className="w-5 h-5 text-gray-500" />
            </div>
          </div>
          <div className="mt-3 text-center">
            <p className="font-semibold text-gray-800 text-sm truncate max-w-[100px]">
              {second.userName}
            </p>
            <p className="text-xs text-gray-500">{second.score} pts</p>
          </div>
          <div className="mt-2 w-24 h-24 bg-gray-200 rounded-t-lg flex items-start justify-center pt-2">
            <span className="text-2xl font-bold text-gray-600">2</span>
          </div>
        </div>
      )}

      {/* 1st Place */}
      <div className="flex flex-col items-center -mt-4">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-yellow-200 shadow-xl">
            {first.userName.charAt(0).toUpperCase()}
          </div>
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
            <Trophy className="w-8 h-8 text-yellow-500" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-yellow-100 rounded-full p-1.5">
            <Star className="w-5 h-5 text-yellow-600" />
          </div>
        </div>
        <div className="mt-4 text-center">
          <p className="font-bold text-gray-900 text-base truncate max-w-[120px]">
            {first.userName}
          </p>
          <p className="text-sm text-yellow-600 font-semibold">{first.score} pts</p>
          <div className="flex flex-wrap justify-center gap-1 mt-1">
            {first.badges.slice(0, 2).map((badge, idx) => (
              <span key={idx} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                {badge}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-2 w-28 h-28 bg-gradient-to-b from-yellow-300 to-yellow-500 rounded-t-lg flex items-start justify-center pt-2 shadow-lg">
          <span className="text-3xl font-bold text-white">1</span>
        </div>
      </div>

      {/* 3rd Place */}
      {third && (
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-18 h-18 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white text-xl font-bold border-4 border-white shadow-lg">
              {third.userName.charAt(0).toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-amber-100 rounded-full p-1">
              <Award className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="mt-3 text-center">
            <p className="font-semibold text-gray-800 text-sm truncate max-w-[100px]">
              {third.userName}
            </p>
            <p className="text-xs text-gray-500">{third.score} pts</p>
          </div>
          <div className="mt-2 w-20 h-20 bg-amber-200 rounded-t-lg flex items-start justify-center pt-2">
            <span className="text-xl font-bold text-amber-700">3</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function Leaderboard({ teamId, className }: LeaderboardProps): JSX.Element {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentUserRank, setCurrentUserRank] = useState<LeaderboardEntry | null>(null)

  // Load leaderboard
  const loadLeaderboard = async () => {
    try {
      const data = await leaderboardService.getTeamLeaderboard(teamId, 20)
      setEntries(data)

      // Get current user rank
      const userRank = await leaderboardService.getUserRank(teamId)
      setCurrentUserRank(userRank)
    } catch (error) {
      console.error('Load leaderboard error:', error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadLeaderboard()

    // Subscribe to real-time updates
    const unsubscribe = leaderboardService.subscribeToUpdates(teamId, (updated) => {
      setEntries(updated)
    })

    return () => unsubscribe()
  }, [teamId])

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadLeaderboard()
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-xl border p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto"></div>
          <div className="flex justify-center gap-4">
            <div className="w-20 h-32 bg-gray-200 rounded"></div>
            <div className="w-24 h-40 bg-gray-200 rounded"></div>
            <div className="w-20 h-28 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className={`bg-white rounded-xl border p-8 ${className}`}>
        <div className="text-center">
          <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">Belum Ada Data</h3>
          <p className="text-gray-500 mt-2">
            Leaderboard akan muncul setelah anggota mulai menyelesaikan tugas
          </p>
        </div>
      </div>
    )
  }

  const topThree = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b bg-gradient-to-r from-yellow-50 to-orange-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-600" />
            <h2 className="text-xl font-bold text-gray-900">Leaderboard</h2>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Peringkat berdasarkan produktivitas dan kecepatan kerja
        </p>
      </div>

      {/* Top 3 Podium */}
      <div className="pt-6">
        <TopThreePodium entries={topThree} />
      </div>

      {/* Current User Highlight (if not in top 3) */}
      {currentUserRank && currentUserRank.rank > 3 && (
        <div className="mx-6 mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
              #{currentUserRank.rank}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Anda</p>
              <p className="text-sm text-gray-600">
                {currentUserRank.score} pts • {currentUserRank.completedTasks} tugas selesai
              </p>
            </div>
            <div className="flex gap-1">
              {currentUserRank.badges.slice(0, 2).map((badge, idx) => (
                <span key={idx} className="text-lg" title={badge}>
                  {badge.split(' ')[0]}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rest of Rankings */}
      <div className="px-6 pb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Peringkat Lainnya
        </h3>
        <div className="space-y-3">
          {rest.map((entry) => (
            <MemberCard key={entry.userId} entry={entry} />
          ))}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="px-6 py-4 border-t bg-gray-50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {entries.reduce((sum, e) => sum + e.completedTasks, 0)}
            </p>
            <p className="text-xs text-gray-500">Total Tugas Selesai</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {Math.max(...entries.map(e => e.score))}
            </p>
            <p className="text-xs text-gray-500">Score Tertinggi</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {entries.filter(e => e.streakDays > 0).length}
            </p>
            <p className="text-xs text-gray-500">Anggota Aktif</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Leaderboard
