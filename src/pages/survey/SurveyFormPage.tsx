import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
// import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Save, Send } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { useSurveyStore } from '@/stores/surveyStore'
import { useAuthStore } from '@/stores/authStore'
import type { ComponentDefinition, DamageClassification } from '@/types'

const componentSchema = z.object({
  volume_total: z.number().min(0),
  volume_rusak: z.number().min(0),
  klasifikasi: z.enum(['1', '2', '3', '4', '5', '6', '7']),
  deskripsi_kerusakan: z.string().optional(),
})

type ComponentFormData = z.infer<typeof componentSchema>

const CATEGORIES = [
  { id: 'struktur', label: 'Struktur', color: 'bg-blue-50' },
  { id: 'arsitektur', label: 'Arsitektur', color: 'bg-green-50' },
  { id: 'finishing', label: 'Finishing', color: 'bg-purple-50' },
  { id: 'utilitas', label: 'Utilitas', color: 'bg-orange-50' },
]

export default function SurveyFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: _user } = useAuthStore()
  const { 
    currentSurvey, 
    setCurrentSurvey, 
    draftData, 
    updateDraft, 
    isEditable 
  } = useSurveyStore()
  
  const [definitions, setDefinitions] = useState<ComponentDefinition[]>([])
  const [activeCategory, setActiveCategory] = useState('struktur')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const { register: _register, handleSubmit: _handleSubmit, watch: _watch, formState: { errors: _errors } } = useForm<ComponentFormData>()

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setIsLoading(true)
    try {
      // Load component definitions
      const { data: defs } = await supabase
        .from('component_definitions')
        .select('*')
        .eq('is_active', true)
        .order('urutan')
      
      setDefinitions(defs || [])

      // Load existing survey if editing
      if (id) {
        const { data: survey } = await supabase
          .from('surveys')
          .select('*, components(*)')
          .eq('id', id)
          .single()
        
        if (survey) {
          setCurrentSurvey(survey)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleComponentUpdate = (componentId: string, field: string, value: any) => {
    updateDraft(componentId, { [field]: value })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Save all draft components
      const componentsToSave = Object.entries(draftData).map(([kode_komponen, data]) => ({
        survey_id: id,
        kode_komponen,
        ...data,
      }))

      if (componentsToSave.length > 0) {
        await supabase.from('components').upsert(componentsToSave)
      }

      alert('Data berhasil disimpan')
    } catch (error) {
      console.error('Error saving:', error)
      alert('Gagal menyimpan data')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmitSurvey = async () => {
    if (!confirm('Yakin ingin mengirim survey ini? Data tidak dapat diubah setelah dikirim.')) {
      return
    }

    try {
      await supabase
        .from('surveys')
        .update({ is_draft: false, status: 'analisis' })
        .eq('id', id)
      
      navigate('/surveys')
    } catch (error) {
      console.error('Error submitting:', error)
      alert('Gagal mengirim survey')
    }
  }

  const filteredDefinitions = definitions.filter(d => d.kategori === activeCategory)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-government-green"></div>
      </div>
    )
  }

  const editable = isEditable()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/surveys')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {id ? 'Edit Survey' : 'Survey Baru'}
            </h1>
            <p className="text-gray-600">
              {currentSurvey?.kode_survey || 'Draft Survey'}
            </p>
          </div>
        </div>
        
        {editable && (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-secondary"
            >
              <Save className="w-4 h-4 mr-2" />
              Simpan Draft
            </button>
            <button
              onClick={handleSubmitSurvey}
              className="btn-primary"
            >
              <Send className="w-4 h-4 mr-2" />
              Kirim
            </button>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeCategory === cat.id
                ? 'bg-government-green text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Component Forms */}
      <div className={`card ${CATEGORIES.find(c => c.id === activeCategory)?.color}`}>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Komponen {CATEGORIES.find(c => c.id === activeCategory)?.label}
          </h2>
          
          <div className="space-y-4">
            {filteredDefinitions.map(def => {
              const draft = draftData[def.kode_komponen] || {}
              
              return (
                <div key={def.kode_komponen} className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-1">
                      <p className="font-medium text-gray-900">{def.nama_komponen}</p>
                      <p className="text-sm text-gray-500">Kode: {def.kode_komponen}</p>
                      <p className="text-sm text-gray-500">Bobot: {def.bobot_komponen}</p>
                    </div>
                    
                    <div>
                      <label className="label">Volume Total ({def.satuan})</label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={!editable}
                        value={draft.volume_total || ''}
                        onChange={(e) => handleComponentUpdate(def.kode_komponen, 'volume_total', parseFloat(e.target.value))}
                        className="input"
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <label className="label">Volume Rusak ({def.satuan})</label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={!editable}
                        value={draft.volume_rusak || ''}
                        onChange={(e) => handleComponentUpdate(def.kode_komponen, 'volume_rusak', parseFloat(e.target.value))}
                        className="input"
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <label className="label">Klasifikasi (1-7)</label>
                      <select
                        disabled={!editable}
                        value={draft.klasifikasi || ''}
                        onChange={(e) => handleComponentUpdate(def.kode_komponen, 'klasifikasi', e.target.value as DamageClassification)}
                        className="input"
                      >
                        <option value="">Pilih...</option>
                        <option value="1">1 - Tidak ada kerusakan</option>
                        <option value="2">2 - Kerusakan ringan</option>
                        <option value="3">3 - Kerusakan sedang-ringan</option>
                        <option value="4">4 - Kerusakan sedang</option>
                        <option value="5">5 - Kerusakan sedang-berat</option>
                        <option value="6">6 - Kerusakan berat</option>
                        <option value="7">7 - Hancur total</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <label className="label">Deskripsi Kerusakan</label>
                    <textarea
                      disabled={!editable}
                      value={draft.deskripsi_kerusakan || ''}
                      onChange={(e) => handleComponentUpdate(def.kode_komponen, 'deskripsi_kerusakan', e.target.value)}
                      className="input"
                      rows={2}
                      placeholder="Jelaskan kondisi kerusakan..."
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
