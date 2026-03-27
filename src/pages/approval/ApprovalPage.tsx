import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import SignatureCanvas from 'react-signature-canvas'
import { supabase } from '@/services/supabase/client'

export default function ApprovalPage() {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()
  const sigRef = useRef<SignatureCanvas>(null)
  
  const [survey, setSurvey] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [note, setNote] = useState('')

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
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      alert('Silakan tanda tangan terlebih dahulu')
      return
    }

    setIsProcessing(true)
    try {
      // Get signature as blob
      const signatureBlob = await new Promise<Blob>((resolve) => {
        sigRef.current?.getCanvas().toBlob((blob) => {
          resolve(blob!)
        }, 'image/png')
      })

      // Upload signature to storage
      const fileName = `signatures/${surveyId}/${Date.now()}.png`
      const { error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(fileName, signatureBlob)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('signatures')
        .getPublicUrl(fileName)

      // Execute workflow transition
      const { data: transitionData } = await supabase
        .rpc('execute_workflow_transition', {
          p_survey_id: surveyId,
          p_to_status: 'disetujui',
          p_note: note || 'Disetujui dengan TTE'
        })

      if (transitionData?.success) {
        // Save signature record
        await supabase.from('signatures').insert({
          survey_id: surveyId,
          signature_url: publicUrl,
          signed_at: new Date().toISOString()
        })

        alert('Survey berhasil disetujui')
        navigate('/surveys')
      } else {
        alert(transitionData?.error || 'Gagal menyetujui survey')
      }
    } catch (error: any) {
      console.error('Error approving:', error)
      alert(error.message || 'Gagal menyetujui survey')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!confirm('Yakin ingin menolak survey ini?')) return

    setIsProcessing(true)
    try {
      const { data } = await supabase
        .rpc('execute_workflow_transition', {
          p_survey_id: surveyId,
          p_to_status: 'ditolak',
          p_note: note || 'Ditolak'
        })

      if (data?.success) {
        alert('Survey berhasil ditolak')
        navigate('/surveys')
      } else {
        alert(data?.error || 'Gagal menolak survey')
      }
    } catch (error: any) {
      console.error('Error rejecting:', error)
      alert(error.message || 'Gagal menolak survey')
    } finally {
      setIsProcessing(false)
    }
  }

  const clearSignature = () => {
    sigRef.current?.clear()
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
          <h1 className="text-2xl font-bold text-gray-900">Approval & TTE</h1>
          <p className="text-gray-600">{survey?.kode_survey}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Survey Summary */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ringkasan Survey</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-gray-500">Kode Survey</dt>
              <dd className="font-medium">{survey?.kode_survey}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Bangunan</dt>
              <dd className="font-medium">{survey?.project?.nama_bangunan}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Total Kerusakan</dt>
              <dd className="font-medium">{result?.total_kerusakan}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Kategori</dt>
              <dd className="font-medium">{result?.kategori_kerusakan}</dd>
            </div>
          </dl>

          <div className="mt-6">
            <label className="label">Catatan Approval</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input"
              rows={4}
              placeholder="Tambahkan catatan untuk approval ini..."
            />
          </div>
        </div>

        {/* Signature Pad */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tanda Tangan Elektronik</h2>
          <div className="border-2 border-gray-300 rounded-lg bg-white">
            <SignatureCanvas
              ref={sigRef}
              canvasProps={{
                className: 'w-full h-48 cursor-crosshair'
              }}
              backgroundColor="white"
            />
          </div>
          <button
            onClick={clearSignature}
            className="mt-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Hapus Tanda Tangan
          </button>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleReject}
              disabled={isProcessing}
              className="flex-1 btn-danger"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Tolak
            </button>
            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className="flex-1 btn-primary"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Setujui
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
