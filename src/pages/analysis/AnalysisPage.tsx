import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { formatPercentage, getDamageCategoryLabel, getDamageCategoryColor } from '@/utils/calculateDamage'

export default function AnalysisPage() {
  const { surveyId } = useParams<{ surveyId: string }>()
  const [result, setResult] = useState<any>(null)
  const [survey, setSurvey] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (surveyId) loadData()
  }, [surveyId])

  async function loadData() {
    setIsLoading(true)
    try {
      const { data: surveyData } = await supabase
        .from('surveys')
        .select('*, project:project_id(*)')
        .eq('id', surveyId)
        .single()
      
      setSurvey(surveyData)

      const { data: resultData } = await supabase
        .from('results')
        .select('*')
        .eq('survey_id', surveyId)
        .single()
      
      setResult(resultData)
    } catch (error) {
      console.error('Error loading analysis:', error)
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
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link to={`/surveys/${surveyId}`} className="mr-4 p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Hasil Analisis</h1>
            <p className="text-gray-600">{survey?.kode_survey}</p>
          </div>
        </div>
        <button className="btn-secondary">
          <Download className="w-4 h-4 mr-2" />
          Export
        </button>
      </div>

      {result ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-6 text-center">
              <p className="text-4xl font-bold text-government-green">
                {formatPercentage(result.total_kerusakan)}
              </p>
              <p className="text-gray-600 mt-1">Total Kerusakan</p>
            </div>
            <div className={`card p-6 text-center ${getDamageCategoryColor(result.kategori_kerusakan)}`}>
              <p className="text-2xl font-bold">
                {getDamageCategoryLabel(result.kategori_kerusakan)}
              </p>
              <p className="mt-1">Kategori Kerusakan</p>
            </div>
            <div className="card p-6 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {formatPercentage(result.total_kerusakan_struktur)}
              </p>
              <p className="text-gray-600 mt-1">Struktur</p>
            </div>
            <div className="card p-6 text-center">
              <p className="text-2xl font-bold text-purple-600">
                {formatPercentage(result.total_kerusakan_arsitektur + result.total_kerusakan_finishing + result.total_kerusakan_utilitas)}
              </p>
              <p className="text-gray-600 mt-1">Non-Struktur</p>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Detail Perhitungan</h2>
            <div className="space-y-4">
              <div className="flex items-center">
                <span className="w-32">Struktur</span>
                <div className="flex-1 bg-gray-200 rounded-full h-4 mx-4">
                  <div 
                    className="bg-blue-600 h-4 rounded-full" 
                    style={{ width: `${Math.min(result.total_kerusakan_struktur, 100)}%` }}
                  ></div>
                </div>
                <span className="w-20 text-right">{formatPercentage(result.total_kerusakan_struktur)}</span>
              </div>
              <div className="flex items-center">
                <span className="w-32">Arsitektur</span>
                <div className="flex-1 bg-gray-200 rounded-full h-4 mx-4">
                  <div 
                    className="bg-green-600 h-4 rounded-full" 
                    style={{ width: `${Math.min(result.total_kerusakan_arsitektur, 100)}%` }}
                  ></div>
                </div>
                <span className="w-20 text-right">{formatPercentage(result.total_kerusakan_arsitektur)}</span>
              </div>
              <div className="flex items-center">
                <span className="w-32">Finishing</span>
                <div className="flex-1 bg-gray-200 rounded-full h-4 mx-4">
                  <div 
                    className="bg-purple-600 h-4 rounded-full" 
                    style={{ width: `${Math.min(result.total_kerusakan_finishing, 100)}%` }}
                  ></div>
                </div>
                <span className="w-20 text-right">{formatPercentage(result.total_kerusakan_finishing)}</span>
              </div>
              <div className="flex items-center">
                <span className="w-32">Utilitas</span>
                <div className="flex-1 bg-gray-200 rounded-full h-4 mx-4">
                  <div 
                    className="bg-orange-600 h-4 rounded-full" 
                    style={{ width: `${Math.min(result.total_kerusakan_utilitas, 100)}%` }}
                  ></div>
                </div>
                <span className="w-20 text-right">{formatPercentage(result.total_kerusakan_utilitas)}</span>
              </div>
            </div>
          </div>

          {result.is_critical && (
            <div className="card p-6 bg-red-50 border-red-200">
              <h2 className="text-lg font-semibold text-red-800 mb-2">Peringatan Kritis</h2>
              <p className="text-red-700">Survey ini memiliki kondisi kritis yang memerlukan perhatian segera.</p>
            </div>
          )}
        </>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-gray-600">Belum ada hasil analisis untuk survey ini.</p>
          <p className="text-gray-500 mt-2">Pastikan semua komponen telah diisi dan survey sudah dikirim untuk analisis.</p>
        </div>
      )}
    </div>
  )
}
