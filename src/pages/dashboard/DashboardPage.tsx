import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Building2, 
  ClipboardCheck, 
  AlertTriangle, 
  TrendingUp,
  Plus
} from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import type { SurveySummary } from '@/types'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalSurveys: 0,
    pendingSurveys: 0,
    approvedSurveys: 0,
    criticalSurveys: 0,
  })
  const [recentSurveys, setRecentSurveys] = useState<SurveySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuthStore()

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    setIsLoading(true)
    try {
      // Load stats from RPC function
      const { data: statsData } = await supabase
        .rpc('get_dashboard_stats')

      if (statsData) {
        setStats({
          totalProjects: statsData.total_projects || 0,
          totalSurveys: statsData.total_surveys || 0,
          pendingSurveys: statsData.pending_surveys || 0,
          approvedSurveys: statsData.approved_surveys || 0,
          criticalSurveys: statsData.critical_surveys || 0,
        })
      }

      // Load recent surveys
      const { data: surveys } = await supabase
        .from('survey_summary')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      setRecentSurveys(surveys || [])
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-government-green"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Selamat datang, {user?.name || 'User'}
          </p>
        </div>
        <Link
          to="/surveys/new"
          className="btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          Survey Baru
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Proyek"
          value={stats.totalProjects}
          icon={Building2}
          color="bg-blue-50 text-blue-700"
        />
        <StatCard
          title="Total Survey"
          value={stats.totalSurveys}
          icon={ClipboardCheck}
          color="bg-gray-50 text-gray-700"
        />
        <StatCard
          title="Menunggu"
          value={stats.pendingSurveys}
          icon={TrendingUp}
          color="bg-amber-50 text-amber-700"
        />
        <StatCard
          title="Disetujui"
          value={stats.approvedSurveys}
          icon={ClipboardCheck}
          color="bg-green-50 text-green-700"
        />
        <StatCard
          title="Kritis"
          value={stats.criticalSurveys}
          icon={AlertTriangle}
          color="bg-red-50 text-red-700"
        />
      </div>

      {/* Recent Surveys */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Survey Terbaru</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kode Survey</th>
                <th>Nama Bangunan</th>
                <th>Tanggal</th>
                <th>Status</th>
                <th>Kategori</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {recentSurveys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    Belum ada survey
                  </td>
                </tr>
              ) : (
                recentSurveys.map((survey) => (
                  <tr key={survey.survey_id}>
                    <td className="font-medium">{survey.kode_survey}</td>
                    <td>{survey.nama_bangunan}</td>
                    <td>{survey.tanggal_survey}</td>
                    <td>
                      <StatusBadge status={survey.status} />
                    </td>
                    <td>
                      {survey.kategori_kerusakan ? (
                        <span className={`badge badge-${survey.kategori_kerusakan}`}>
                          {survey.kategori_kerusakan}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <Link
                        to={`/surveys/${survey.survey_id}`}
                        className="text-government-green hover:underline font-medium"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color 
}: { 
  title: string
  value: number
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    disposisi: 'bg-gray-100 text-gray-800',
    persiapan: 'bg-blue-100 text-blue-800',
    survey: 'bg-amber-100 text-amber-800',
    analisis: 'bg-purple-100 text-purple-800',
    penilaian: 'bg-indigo-100 text-indigo-800',
    diperiksa: 'bg-orange-100 text-orange-800',
    disetujui: 'bg-green-100 text-green-800',
    ditolak: 'bg-red-100 text-red-800',
  }

  const labels: Record<string, string> = {
    disposisi: 'Disposisi',
    persiapan: 'Persiapan',
    survey: 'Survey',
    analisis: 'Analisis',
    penilaian: 'Penilaian',
    diperiksa: 'Diperiksa',
    disetujui: 'Disetujui',
    ditolak: 'Ditolak',
  }

  return (
    <span className={`badge ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  )
}
