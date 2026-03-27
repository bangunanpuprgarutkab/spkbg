/**
 * TEAM DASHBOARD & TASK BOARD COMPONENTS
 * Smart AI Engineering Platform - SPKBG
 * 
 * UI Components untuk manajemen tim: Team List, Team Detail, Kanban Board
 */

import { useState, useEffect, useMemo } from 'react'
import { Users, Plus, MoreVertical, Clock, AlertCircle, Calendar, User, Trash2, Edit } from 'lucide-react'
import { teamService, type TeamSummary, type MemberDetail, type TeamTask, type TaskStatus, type TeamActivity } from '@/services/team/teamService'
import { showSuccess } from '@/components/ui/Toast'

// ============================================================================
// TYPES
// ============================================================================

interface TeamListProps {
  onSelectTeam: (teamId: string) => void
  onCreateTeam?: () => void
}

interface TeamDetailProps {
  teamId: string
  onBack?: () => void
}

interface TaskBoardProps {
  teamId: string
}

// ============================================================================
// TEAM LIST COMPONENT
// ============================================================================

export function TeamList({ onSelectTeam, onCreateTeam }: TeamListProps): JSX.Element {
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadTeams()
  }, [])

  const loadTeams = async () => {
    setLoading(true)
    try {
      const data = await teamService.getTeams()
      setTeams(data)
    } catch (error) {
      console.error('Load teams error:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTeams = useMemo(() => {
    if (filter === 'all') return teams
    if (filter === 'active') return teams.filter(t => t.teamStatus === 'active')
    if (filter === 'completed') return teams.filter(t => t.teamStatus === 'completed')
    return teams
  }, [teams, filter])

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      completed: 'bg-blue-100 text-blue-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tim Teknis</h2>
          <p className="text-sm text-gray-500">{teams.length} tim aktif</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="completed">Selesai</option>
          </select>
          {onCreateTeam && (
            <button
              onClick={onCreateTeam}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              Buat Tim
            </button>
          )}
        </div>
      </div>

      {/* Team Cards */}
      <div className="grid gap-4">
        {filteredTeams.map(team => (
          <div
            key={team.id}
            onClick={() => onSelectTeam(team.id)}
            className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{team.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(team.teamStatus)}`}>
                    {team.teamStatus}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{team.projectName}</p>
                <p className="text-sm text-gray-500">Ketua: {team.ketuaName}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{team.memberCount} anggota</span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Progress</span>
                <span className="font-medium">{team.progressPercentage}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 transition-all"
                  style={{ width: `${team.progressPercentage}%` }}
                />
              </div>
            </div>

            {/* Task Stats */}
            <div className="mt-4 flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                <span className="text-gray-600">{team.pendingTasks} pending</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-gray-600">{team.inProgressTasks} proses</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-gray-600">{team.completedTasks} selesai</span>
              </div>
              {team.overdueTasks > 0 && (
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-red-600">{team.overdueTasks} overdue</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredTeams.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Belum ada tim</p>
          {onCreateTeam && (
            <button
              onClick={onCreateTeam}
              className="mt-3 text-green-600 hover:underline"
            >
              Buat tim pertama
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// TEAM DETAIL COMPONENT
// ============================================================================

export function TeamDetail({ teamId, onBack }: TeamDetailProps): JSX.Element {
  const [team, setTeam] = useState<TeamSummary | null>(null)
  const [members, setMembers] = useState<MemberDetail[]>([])
  const [activities, setActivities] = useState<TeamActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'tasks' | 'activity'>('overview')

  useEffect(() => {
    loadTeamData()
  }, [teamId])

  const loadTeamData = async () => {
    setLoading(true)
    try {
      // Get teams list (contains summary)
      const teams = await teamService.getTeams()
      const currentTeam = teams.find(t => t.id === teamId)
      if (currentTeam) setTeam(currentTeam)

      // Get members
      const membersData = await teamService.getMembers(teamId)
      setMembers(membersData)

      // Get activities
      const activitiesData = await teamService.getActivities(teamId, 20)
      setActivities(activitiesData)
    } catch (error) {
      console.error('Load team data error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Yakin ingin menghapus anggota ini?')) return
    
    const success = await teamService.removeMember(memberId)
    if (success) {
      showSuccess('Anggota berhasil dihapus')
      loadTeamData()
    }
  }

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      ketua_tim: 'bg-purple-100 text-purple-800',
      surveyor: 'bg-green-100 text-green-800',
      analis: 'bg-blue-100 text-blue-800',
      verifikator: 'bg-orange-100 text-orange-800',
      dokumentator: 'bg-gray-100 text-gray-800',
    }
    const labels: Record<string, string> = {
      ketua_tim: 'Ketua Tim',
      surveyor: 'Surveyor',
      analis: 'Analis',
      verifikator: 'Verifikator',
      dokumentator: 'Dokumentator',
    }
    return { color: colors[role] || 'bg-gray-100', label: labels[role] || role }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!team) return <div>Team not found</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          {onBack && (
            <button
              onClick={onBack}
              className="text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              ← Kembali ke daftar tim
            </button>
          )}
          <h2 className="text-2xl font-bold">{team.name}</h2>
          <p className="text-gray-600">{team.projectName}</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Edit className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          {[
            { id: 'overview', label: 'Ringkasan' },
            { id: 'members', label: `Anggota (${members.length})` },
            { id: 'tasks', label: 'Tugas' },
            { id: 'activity', label: 'Aktivitas' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-blue-700">{members.length}</p>
              <p className="text-sm text-blue-600">Anggota</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-yellow-700">{team.pendingTasks}</p>
              <p className="text-sm text-yellow-600">Pending</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-purple-700">{team.inProgressTasks}</p>
              <p className="text-sm text-purple-600">Dalam Proses</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-700">{team.completedTasks}</p>
              <p className="text-sm text-green-600">Selesai</p>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Daftar Anggota</h3>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm">
                <Plus className="w-4 h-4" />
                Tambah Anggota
              </button>
            </div>
            
            {members.map(member => {
              const badge = getRoleBadge(member.role)
              return (
                <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium">{member.userName}</p>
                      <p className="text-sm text-gray-500">{member.userEmail}</p>
                      <div className="flex gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-xs ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {member.activeTasks} tugas aktif
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-2 hover:bg-red-50 rounded-lg text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'tasks' && (
          <TaskBoard teamId={teamId} />
        )}

        {activeTab === 'activity' && (
          <div className="space-y-3">
            {activities.map(activity => (
              <div key={activity.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{activity.userName}</span>
                    {' '}{activity.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(activity.createdAt).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// TASK BOARD (KANBAN) COMPONENT
// ============================================================================

export function TaskBoard({ teamId }: TaskBoardProps): JSX.Element {
  const [tasks, setTasks] = useState<TeamTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTasks()
  }, [teamId])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const data = await teamService.getTasks(teamId)
      setTasks(data)
    } catch (error) {
      console.error('Load tasks error:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns: { id: TaskStatus; title: string; color: string }[] = [
    { id: 'pending', title: 'Pending', color: 'bg-yellow-100' },
    { id: 'in_progress', title: 'Dalam Proses', color: 'bg-blue-100' },
    { id: 'review', title: 'Review', color: 'bg-purple-100' },
    { id: 'done', title: 'Selesai', color: 'bg-green-100' },
  ]

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-600',
      medium: 'bg-blue-100 text-blue-600',
      high: 'bg-orange-100 text-orange-600',
      urgent: 'bg-red-100 text-red-600',
    }
    return colors[priority] || 'bg-gray-100'
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId)
  }

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (!taskId) return

    const success = await teamService.updateTask(taskId, { status })
    if (success) {
      loadTasks()
    }
  }

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto">
        {columns.map(col => (
          <div key={col.id} className="w-72 flex-shrink-0">
            <div className={`${col.color} rounded-t-lg p-3`}>
              <h4 className="font-semibold">{col.title}</h4>
            </div>
            <div className="bg-gray-50 rounded-b-lg p-3 min-h-96 space-y-3">
              <div className="animate-pulse h-24 bg-gray-200 rounded"></div>
              <div className="animate-pulse h-24 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Task Board</h3>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm">
          <Plus className="w-4 h-4" />
          Tambah Tugas
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(column => {
          const columnTasks = tasks.filter(t => t.status === column.id)
          
          return (
            <div
              key={column.id}
              className="w-72 flex-shrink-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className={`${column.color} rounded-t-lg p-3 flex justify-between items-center`}>
                <h4 className="font-semibold">{column.title}</h4>
                <span className="bg-white px-2 py-0.5 rounded text-sm font-medium">
                  {columnTasks.length}
                </span>
              </div>

              {/* Tasks */}
              <div className="bg-gray-50 rounded-b-lg p-3 min-h-96 space-y-3">
                {columnTasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    className={`bg-white rounded-lg p-3 shadow-sm hover:shadow-md cursor-move ${
                      task.isOverdue ? 'border-l-4 border-red-500' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${getPriorityBadge(task.priority)}`}>
                        {task.priority}
                      </span>
                      {task.isOverdue && (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    
                    <h5 className="font-medium text-sm mb-2">{task.title}</h5>
                    
                    {task.assignedToName && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                        <User className="w-3 h-3" />
                        <span>{task.assignedToName}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      <span className={task.isOverdue ? 'text-red-500' : ''}>
                        {task.dueDate 
                          ? new Date(task.dueDate).toLocaleDateString('id-ID')
                          : 'No deadline'
                        }
                      </span>
                    </div>

                    {task.progressPercentage > 0 && (
                      <div className="mt-2">
                        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${task.progressPercentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{task.progressPercentage}%</span>
                      </div>
                    )}
                  </div>
                ))}

                {columnTasks.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Tidak ada tugas
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  TeamList,
  TeamDetail,
  TaskBoard,
}
