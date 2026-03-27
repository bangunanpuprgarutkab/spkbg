import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import WorkflowStepper from '@/components/workflow/WorkflowStepper'
import type { WorkflowStatus } from '@/types'

export default function WorkflowPage() {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()
  const [survey, setSurvey] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [allowedTransitions, setAllowedTransitions] = useState<WorkflowStatus[]>([])

  useEffect(() => {
    if (surveyId) loadSurvey()
  }, [surveyId])

  async function loadSurvey() {
    setIsLoading(true)
    try {
      const { data } = await supabase
        .from('surveys')
        .select('*, project:project_id(*)')
        .eq('id', surveyId)
        .single()
      
      if (data) {
        setSurvey(data)
        // Calculate allowed transitions based on current status
        const validNext: Record<WorkflowStatus, WorkflowStatus[]> = {
          disposisi: ['persiapan'],
          persiapan: ['survey'],
          survey: ['analisis'],
          analisis: ['penilaian'],
          penilaian: ['diperiksa'],
          diperiksa: ['disetujui', 'ditolak'],
          disetujui: [],
          ditolak: ['survey'],
        }
        setAllowedTransitions(validNext[data.status as WorkflowStatus] || [])
      }
    } catch (error) {
      console.error('Error loading survey:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTransition = async (toStatus: WorkflowStatus) => {
    if (!surveyId) return
    
    setIsTransitioning(true)
    try {
      const { data, error } = await supabase
        .rpc('execute_workflow_transition', {
          p_survey_id: surveyId,
          p_to_status: toStatus,
          p_note: 'Workflow transition from UI'
        })
      
      if (error) throw error
      
      if (data?.success) {
        await loadSurvey()
        alert('Status berhasil diperbarui')
      } else {
        alert(data?.error || 'Gagal mengubah status')
      }
    } catch (error: any) {
      console.error('Error transitioning:', error)
      alert(error.message || 'Gagal mengubah status')
    } finally {
      setIsTransitioning(false)
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
      <div className="flex items-center">
        <button onClick={() => navigate(-1)} className="mr-4 p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Management</h1>
          <p className="text-gray-600">{survey?.kode_survey}</p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Status Workflow</h2>
        <WorkflowStepper
          currentStatus={survey?.status || 'disposisi'}
          onTransition={handleTransition}
          allowedTransitions={allowedTransitions}
          isLoading={isTransitioning}
        />
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Detail Survey</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Kode Survey</dt>
            <dd className="font-medium">{survey?.kode_survey}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Status Saat Ini</dt>
            <dd className="font-medium">{survey?.status}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Tanggal Survey</dt>
            <dd className="font-medium">{survey?.tanggal_survey}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Surveyor</dt>
            <dd className="font-medium">{survey?.surveyor_id}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
