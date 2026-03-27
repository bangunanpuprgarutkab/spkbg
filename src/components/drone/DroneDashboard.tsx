/**
 * DRONE DASHBOARD - UPLOAD & STATS COMPONENTS
 * Smart AI Engineering Platform - SPKBG
 * 
 * Components untuk upload drone images dan menampilkan statistik
 */

import { useState, useCallback, useEffect } from 'react'
import { Camera, MapPin, CheckCircle, AlertCircle, Loader2, Image as ImageIcon, Zap } from 'lucide-react'
import { droneSurveyService, type DroneSurvey } from '@/services/drone/droneSurvey'
import { crackDetectionEngine } from '@/modules/ai/crackDetection'

// ============================================================================
// TYPES
// ============================================================================

interface DroneUploadPanelProps {
  surveyId: string
  projectId: string
  onUploadComplete?: () => void
}

interface DroneStatsPanelProps {
  projectId: string
}

interface ProcessingStatus {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  message: string
}

// ============================================================================
// DRONE UPLOAD PANEL
// ============================================================================

export function DroneUploadPanel({ 
  surveyId, 
  projectId, 
  onUploadComplete 
}: DroneUploadPanelProps): JSX.Element {
  const [files, setFiles] = useState<File[]>([])
  const [uploadStatus, setUploadStatus] = useState<ProcessingStatus>({
    status: 'idle',
    progress: 0,
    message: '',
  })
  const [droneSurvey, setDroneSurvey] = useState<DroneSurvey | null>(null)
  void droneSurvey

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
      f.type.startsWith('image/')
    )
    setFiles(prev => [...prev, ...droppedFiles])
  }, [])

  // Handle file select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(f => 
        f.type.startsWith('image/')
      )
      setFiles(prev => [...prev, ...selectedFiles])
    }
  }

  // Remove file
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Upload and process
  const handleUpload = async () => {
    if (files.length === 0) return

    setUploadStatus({
      status: 'uploading',
      progress: 0,
      message: 'Membuat drone survey...',
    })

    try {
      // Create drone survey
      const survey = await droneSurveyService.createDroneSurvey({
        surveyId,
        projectId,
        droneOperatorId: 'current-user-id',
        droneModel: 'DJI Mavic 3',
        flightDate: new Date().toISOString(),
        flightDuration: 0,
        totalImages: files.length,
        processedImages: 0,
        status: 'uploading',
      } as any)

      if (!survey) {
        throw new Error('Failed to create drone survey')
      }

      setDroneSurvey(survey)

      // Upload images
      setUploadStatus({
        status: 'uploading',
        progress: 0,
        message: `Mengupload 0/${files.length} gambar...`,
      })

      const uploadedImages = await droneSurveyService.uploadDroneImages(
        survey.id,
        files,
        (current, total) => {
          setUploadStatus({
            status: 'uploading',
            progress: (current / total) * 50,
            message: `Mengupload ${current}/${total} gambar...`,
          })
        }
      )

      // Process with AI
      setUploadStatus({
        status: 'processing',
        progress: 50,
        message: 'AI sedang mendeteksi kerusakan...',
      })

      await droneSurveyService.processImagesWithAI(survey.id, crackDetectionEngine)

      setUploadStatus({
        status: 'completed',
        progress: 100,
        message: `Selesai! ${uploadedImages.length} gambar diproses`,
      })

      if (onUploadComplete) {
        onUploadComplete()
      }

    } catch (error: any) {
      setUploadStatus({
        status: 'error',
        progress: 0,
        message: error.message || 'Upload failed',
      })
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h3 className="text-lg font-semibold mb-4">Upload Gambar Drone</h3>

      {/* Drop Zone */}
      {uploadStatus.status === 'idle' && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-green-500 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => document.getElementById('drone-file-input')?.click()}
        >
          <input
            id="drone-file-input"
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 bg-blue-50 rounded-full">
              <Camera className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-700">
                Drop gambar drone atau klik untuk pilih
              </p>
              <p className="text-sm text-gray-500 mt-1">
                JPG, PNG, DNG (dengan metadata GPS)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && uploadStatus.status !== 'completed' && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {files.length} file dipilih
          </p>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <ImageIcon className="w-5 h-5 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="p-1 hover:bg-red-100 rounded text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={uploadStatus.status !== 'idle'}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {uploadStatus.status === 'idle' ? 'Upload & Proses AI' : 'Sedang Memproses...'}
          </button>
        </div>
      )}

      {/* Progress */}
      {uploadStatus.status !== 'idle' && uploadStatus.status !== 'completed' && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            {uploadStatus.status === 'uploading' && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
            {uploadStatus.status === 'processing' && <Zap className="w-5 h-5 text-yellow-600" />}
            {uploadStatus.status === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
            <span className="text-sm font-medium">{uploadStatus.message}</span>
          </div>
          
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 transition-all duration-300"
              style={{ width: `${uploadStatus.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Completed */}
      {uploadStatus.status === 'completed' && (
        <div className="mt-6 p-4 bg-green-50 rounded-lg">
          <div className="flex items-center gap-3 text-green-700">
            <CheckCircle className="w-6 h-6" />
            <span className="font-medium">{uploadStatus.message}</span>
          </div>
          <button
            onClick={() => {
              setFiles([])
              setUploadStatus({ status: 'idle', progress: 0, message: '' })
            }}
            className="mt-3 text-sm text-green-700 hover:underline"
          >
            Upload batch lain
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// DRONE STATS PANEL
// ============================================================================

export function DroneStatsPanel({ projectId }: DroneStatsPanelProps): JSX.Element {
  const [stats, setStats] = useState({
    totalSurveys: 0,
    totalImages: 0,
    processedImages: 0,
    detectedDamages: 0,
    verifiedDamages: 0,
    coverageArea: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [projectId])

  const loadStats = async () => {
    setLoading(true)
    try {
      const data = await droneSurveyService.getStats(projectId)
      setStats(data)
    } catch (error) {
      console.error('Load stats error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h3 className="text-lg font-semibold mb-4">Statistik Drone Survey</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Total Surveys */}
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="flex justify-center mb-2">
            <Camera className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-700">{stats.totalSurveys}</p>
          <p className="text-xs text-blue-600">Misi Drone</p>
        </div>

        {/* Total Images */}
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="flex justify-center mb-2">
            <ImageIcon className="w-6 h-6 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-purple-700">{stats.totalImages}</p>
          <p className="text-xs text-purple-600">Total Gambar</p>
        </div>

        {/* Processed */}
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="flex justify-center mb-2">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-700">{stats.processedImages}</p>
          <p className="text-xs text-green-600">Terproses AI</p>
        </div>

        {/* Detected Damages */}
        <div className="bg-orange-50 rounded-lg p-4 text-center">
          <div className="flex justify-center mb-2">
            <AlertCircle className="w-6 h-6 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-orange-700">{stats.detectedDamages}</p>
          <p className="text-xs text-orange-600">Kerusakan Terdeteksi</p>
        </div>

        {/* Verified */}
        <div className="bg-teal-50 rounded-lg p-4 text-center">
          <div className="flex justify-center mb-2">
            <CheckCircle className="w-6 h-6 text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-teal-700">{stats.verifiedDamages}</p>
          <p className="text-xs text-teal-600">Terverifikasi</p>
        </div>

        {/* Coverage */}
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="flex justify-center mb-2">
            <MapPin className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-2xl font-bold text-gray-700">{stats.coverageArea.toFixed(1)}</p>
          <p className="text-xs text-gray-600">m² Area</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Progress AI Processing</span>
          <span className="font-medium">
            {stats.totalImages > 0 
              ? Math.round((stats.processedImages / stats.totalImages) * 100) 
              : 0}%
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-600 transition-all"
            style={{ 
              width: `${stats.totalImages > 0 
                ? (stats.processedImages / stats.totalImages) * 100 
                : 0}%` 
            }}
          />
        </div>
      </div>

      {/* Verification Rate */}
      <div className="mt-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Tingkat Verifikasi Engineer</span>
          <span className="font-medium">
            {stats.detectedDamages > 0 
              ? Math.round((stats.verifiedDamages / stats.detectedDamages) * 100) 
              : 0}%
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-600 transition-all"
            style={{ 
              width: `${stats.detectedDamages > 0 
                ? (stats.verifiedDamages / stats.detectedDamages) * 100 
                : 0}%` 
            }}
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// DRONE SURVEY LIST
// ============================================================================

interface DroneSurveyListProps {
  projectId: string
  onSelect?: (survey: DroneSurvey) => void
}

export function DroneSurveyList({ projectId, onSelect }: DroneSurveyListProps): JSX.Element {
  const [surveys, setSurveys] = useState<DroneSurvey[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSurveys()
  }, [projectId])

  const loadSurveys = async () => {
    setLoading(true)
    try {
      // This would fetch from a service method
      // const data = await droneSurveyService.getProjectSurveys(projectId)
      // setSurveys(data)
      setSurveys([])
    } catch (error) {
      console.error('Load surveys error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'planning': 'bg-gray-100 text-gray-800',
      'flying': 'bg-blue-100 text-blue-800',
      'uploading': 'bg-purple-100 text-purple-800',
      'processing': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-green-100 text-green-800',
      'failed': 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h3 className="text-lg font-semibold mb-4">Riwayat Drone Survey</h3>
      
      {surveys.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Belum ada drone survey</p>
          <p className="text-sm">Upload gambar drone untuk memulai</p>
        </div>
      ) : (
        <div className="space-y-3">
          {surveys.map(survey => (
            <div
              key={survey.id}
              onClick={() => onSelect?.(survey)}
              className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{survey.droneModel || 'Drone Survey'}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(survey.flightDate).toLocaleDateString('id-ID')}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(survey.status)}`}>
                  {survey.status}
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-sm text-gray-600">
                <span>{survey.totalImages} gambar</span>
                <span>{survey.processedImages} terproses</span>
                {survey.flightDuration && (
                  <span>{survey.flightDuration} menit</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  DroneUploadPanel,
  DroneStatsPanel,
  DroneSurveyList,
}
