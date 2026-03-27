/**
 * IMAGE UPLOAD & AI ANALYSIS COMPONENT
 * Smart AI Engineering Platform - SPKBG
 * 
 * Komponen untuk upload foto dan analisis AI kerusakan
 */

import { useState, useRef, useCallback } from 'react'
import { Camera, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { aiDamageDetector, type DamageDetectionResult, type DamageType } from '@/modules/ai/detection'
import { supabase } from '@/services/supabase/client'

// ============================================================================
// TYPES
// ============================================================================

interface ImageUploadAIProps {
  surveyId: string
  componentId?: string
  onAnalysisComplete?: (result: DamageDetectionResult & { imageUrl: string }) => void
  maxImages?: number
}

interface UploadedImage {
  id: string
  file: File
  preview: string
  status: 'uploading' | 'analyzing' | 'completed' | 'error'
  result?: DamageDetectionResult
  imageUrl?: string
  error?: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ImageUploadAI({ 
  surveyId, 
  componentId, 
  onAnalysisComplete,
  maxImages = 5 
}: ImageUploadAIProps): JSX.Element {
  const [images, setImages] = useState<UploadedImage[]>([])
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ============================================================================
  // FILE HANDLING
  // ============================================================================

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    handleFiles(files)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }

  const handleFiles = (files: FileList) => {
    if (images.length + files.length > maxImages) {
      alert(`Maksimal ${maxImages} gambar`)
      return
    }

    const newImages: UploadedImage[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert(`File ${file.name} bukan gambar`)
        continue
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} terlalu besar (max 10MB)`)
        continue
      }

      const id = crypto.randomUUID()
      const preview = URL.createObjectURL(file)

      newImages.push({
        id,
        file,
        preview,
        status: 'uploading',
      })
    }

    setImages(prev => [...prev, ...newImages])

    // Process each image
    newImages.forEach(processImage)
  }

  // ============================================================================
  // IMAGE PROCESSING
  // ============================================================================

  const processImage = async (image: UploadedImage) => {
    try {
      // Step 1: Upload to Supabase Storage
      const fileExt = image.file.name.split('.').pop()
      const fileName = `${surveyId}/${image.id}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('component-photos')
        .upload(fileName, image.file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('component-photos')
        .getPublicUrl(fileName)

      // Update status to analyzing
      setImages(prev => prev.map(img => 
        img.id === image.id 
          ? { ...img, status: 'analyzing', imageUrl: publicUrl }
          : img
      ))

      // Step 2: AI Analysis
      const img = new Image()
      img.src = image.preview
      await new Promise((resolve) => { img.onload = resolve })

      const aiResult = await aiDamageDetector.analyzeImage(img)

      // Step 3: Save to database
      const { error: dbError } = await supabase
        .from('damage_images')
        .insert({
          survey_id: surveyId,
          component_id: componentId,
          image_url: publicUrl,
          ai_result: aiResult,
          confidence: aiResult.confidence,
          damage_type: aiResult.damageType,
          suggested_classification: aiResult.suggestedClassification,
          user_verified: false,
        })

      if (dbError) throw dbError

      // Update status to completed
      setImages(prev => prev.map(img => 
        img.id === image.id 
          ? { ...img, status: 'completed', result: aiResult }
          : img
      ))

      // Callback
      if (onAnalysisComplete) {
        onAnalysisComplete({ ...aiResult, imageUrl: publicUrl })
      }

    } catch (error: any) {
      console.error('Process image error:', error)
      setImages(prev => prev.map(img => 
        img.id === image.id 
          ? { ...img, status: 'error', error: error.message }
          : img
      ))
    }
  }

  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id)
      if (img) {
        URL.revokeObjectURL(img.preview)
      }
      return prev.filter(i => i.id !== id)
    })
  }

  const verifyResult = async (id: string, override: string) => {
    const image = images.find(i => i.id === id)
    if (!image || !image.result) return

    try {
      await supabase
        .from('damage_images')
        .update({
          user_verified: true,
          user_override: override,
          verified_at: new Date().toISOString(),
        })
        .eq('id', id)

      setImages(prev => prev.map(img => 
        img.id === id 
          ? { ...img, result: { ...img.result!, userVerified: true, userOverride: override as any } }
          : img
      ))
    } catch (error) {
      console.error('Verify error:', error)
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  const getDamageTypeLabel = (type: DamageType): string => {
    const labels: Record<DamageType, string> = {
      'retak': 'Retak',
      'spalling': 'Spalling (Lepas Permukaan)',
      'korosi_tulangan': 'Korosi Tulangan',
      'kerusakan_finishing': 'Kerusakan Finishing',
      'pondasi_bergeser': 'Pondasi Bergeser',
      'kolom_patah': 'Kolom Patah',
      'tidak_terdeteksi': 'Tidak Terdeteksi',
    }
    return labels[type] || type
  }

  const getSeverityColor = (severity: string): string => {
    const colors: Record<string, string> = {
      'ringan': 'bg-blue-100 text-blue-800',
      'sedang': 'bg-yellow-100 text-yellow-800',
      'berat': 'bg-red-100 text-red-800',
    }
    return colors[severity] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragActive ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-3">
          <div className="p-4 bg-gray-100 rounded-full">
            <Camera className="w-8 h-8 text-gray-500" />
          </div>
          <div>
            <p className="text-lg font-medium text-gray-700">
              Upload Foto Kerusakan
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Drag & drop atau{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-green-600 hover:underline font-medium"
              >
                pilih file
              </button>
            </p>
            <p className="text-xs text-gray-400 mt-2">
              JPG, PNG (Max 10MB, Maks {maxImages} gambar)
            </p>
          </div>
        </div>
      </div>

      {/* Image List */}
      {images.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {images.map((image) => (
            <div key={image.id} className="bg-white rounded-xl border overflow-hidden">
              {/* Image Preview */}
              <div className="relative aspect-video bg-gray-100">
                <img
                  src={image.preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                
                {/* Remove Button */}
                <button
                  onClick={() => removeImage(image.id)}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Status Badge */}
                <div className="absolute top-2 left-2">
                  {image.status === 'uploading' && (
                    <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded-full flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Uploading
                    </span>
                  )}
                  {image.status === 'analyzing' && (
                    <span className="px-2 py-1 bg-yellow-500 text-white text-xs rounded-full flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      AI Analyzing
                    </span>
                  )}
                  {image.status === 'completed' && (
                    <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Selesai
                    </span>
                  )}
                  {image.status === 'error' && (
                    <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Error
                    </span>
                  )}
                </div>
              </div>

              {/* Analysis Result */}
              {image.result && (
                <div className="p-4 space-y-3">
                  {/* AI Result */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Hasil Analisis AI
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Jenis Kerusakan:</span>
                        <span className="font-medium">
                          {getDamageTypeLabel(image.result.damageType)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Confidence:</span>
                        <span className="font-medium">
                          {(image.result.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Keparahan:</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${getSeverityColor(image.result.severity)}`}>
                          {image.result.severity.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Klasifikasi:</span>
                        <span className="font-medium text-lg">
                          {image.result.suggestedClassification}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Verification Override */}
                  {!image.result.userVerified ? (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">
                        Apakah hasil AI sudah benar? Jika tidak, pilih klasifikasi yang sesuai:
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => verifyResult(image.id, image.result!.suggestedClassification)}
                          className="flex-1 py-2 px-3 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                        >
                          Benar ✓
                        </button>
                        {['1', '2', '3', '4', '5', '6', '7'].map((num) => (
                          <button
                            key={num}
                            onClick={() => verifyResult(image.id, num)}
                            className={`w-10 h-10 rounded-lg text-sm font-medium ${
                              num === image.result!.suggestedClassification
                                ? 'bg-blue-100 text-blue-700 border-2 border-blue-500'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">
                        Terverifikasi: Klasifikasi {image.result.userOverride || image.result.suggestedClassification}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {image.error && (
                <div className="p-4 bg-red-50 text-red-700 text-sm">
                  Error: {image.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ImageUploadAI
