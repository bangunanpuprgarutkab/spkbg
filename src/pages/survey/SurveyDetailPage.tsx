import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Edit, Activity } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import type { Survey, Component } from '@/types'

export default function SurveyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [components, setComponents] = useState<Component[]>([])
  const [result, setResult] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (id) loadSurvey()
  }, [id])

  async function loadSurvey() {
    setIsLoading(true)
    try {
      const { data: surveyData } = await supabase
        .from('surveys')
        .select('*, project:project_id(*)')
        .eq('id', id)
        .single()
      
      if (surveyData) setSurvey(surveyData)

      const { data: componentsData } = await supabase
        .from('components')
        .select('*')
        .eq('survey_id', id)
      
      setComponents(componentsData || [])

      const { data: resultData } = await supabase
        .from('results')
        .select('*')
        .eq('survey_id', id)
        .single()
      
      setResult(resultData)
    } catch (error) {
      console.error('Error loading survey:', error)
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

  if (!survey) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Survey tidak ditemukan</p>
        <Link to="/surveys" className="text-government-green hover:underline mt-2 inline-block">
          Kembali ke daftar
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link to="/surveys" className="mr-4 p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{survey.kode_survey}</h1>
            <p className="text-gray-600">{(survey as any).project?.nama_bangunan}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/analysis/${id}`} className="btn-secondary">
            <Activity className="w-4 h-4 mr-2" />
            Analisis
          </Link>
          <Link to={`/surveys/${id}/edit`} className="btn-primary">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi Survey</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Status</dt>
                <dd className="font-medium">{survey.status}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Tanggal Survey</dt>
                <dd className="font-medium">{survey.tanggal_survey}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Surveyor</dt>
                <dd className="font-medium">{survey.surveyor_id}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Kategori</dt>
                <dd className="font-medium">{result?.kategori_kerusakan || '-'}</dd>
              </div>
            </dl>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Komponen ({components.length})</h2>
            {components.length === 0 ? (
              <p className="text-gray-500">Belum ada data komponen</p>
            ) : (
              <div className="space-y-2">
                {components.slice(0, 5).map(c => (
                  <div key={c.id} className="flex justify-between py-2 border-b">
                    <span>{c.nama_komponen}</span>
                    <span className="text-gray-600">Klasifikasi: {c.klasifikasi || '-'}</span>
                  </div>
                ))}
                {components.length > 5 && (
                  <p className="text-center text-gray-500 mt-2">
                    +{components.length - 5} komponen lainnya
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Hasil Perhitungan</h2>
            {result ? (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-government-green">
                    {result.total_kerusakan}%
                  </p>
                  <p className="text-gray-600">Total Kerusakan</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Struktur</span>
                    <span>{result.total_kerusakan_struktur}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Arsitektur</span>
                    <span>{result.total_kerusakan_arsitektur}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Finishing</span>
                    <span>{result.total_kerusakan_finishing}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Utilitas</span>
                    <span>{result.total_kerusakan_utilitas}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">Belum ada hasil perhitungan</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
