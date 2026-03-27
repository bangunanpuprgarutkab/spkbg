import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import type { SurveySummary } from '@/types'

export default function SurveyListPage() {
  const [surveys, setSurveys] = useState<SurveySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    loadSurveys()
  }, [])

  async function loadSurveys() {
    setIsLoading(true)
    try {
      const { data } = await supabase
        .from('survey_summary')
        .select('*')
        .order('created_at', { ascending: false })
      
      setSurveys(data || [])
    } catch (error) {
      console.error('Error loading surveys:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredSurveys = surveys.filter(s => 
    s.kode_survey?.toLowerCase().includes(filter.toLowerCase()) ||
    s.nama_bangunan?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daftar Survey</h1>
          <p className="text-gray-600">Kelola dan pantau survey kerusakan bangunan</p>
        </div>
        <Link to="/surveys/new" className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Survey Baru
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cari survey..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Kode Survey</th>
              <th>Nama Bangunan</th>
              <th>Status</th>
              <th>Tanggal</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-8">Memuat...</td>
              </tr>
            ) : filteredSurveys.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">Tidak ada survey</td>
              </tr>
            ) : (
              filteredSurveys.map(survey => (
                <tr key={survey.survey_id}>
                  <td className="font-medium">{survey.kode_survey}</td>
                  <td>{survey.nama_bangunan}</td>
                  <td>
                    <span className="badge bg-blue-100 text-blue-800">{survey.status}</span>
                  </td>
                  <td>{survey.tanggal_survey}</td>
                  <td>
                    <Link 
                      to={`/surveys/${survey.survey_id}`}
                      className="text-government-green hover:underline"
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
  )
}
