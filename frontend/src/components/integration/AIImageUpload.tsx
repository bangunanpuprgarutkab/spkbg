/**
 * AI Image Upload Component
 * Smart AI Engineering Platform - SPKBG
 * 
 * Komponen upload gambar dengan AI crack detection
 * - Drag & drop upload
 * - Progress tracking
 * - Preview dengan bounding boxes
 */

import { useState, useCallback } from 'react'
import { Upload, Image, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useAIDetection } from '@/hooks/useAIDetection'
import type { DetectionBox } from '@/types/ai'

// ============================================================================
// TYPES
// ============================================================================

interface AIImageUploadProps {
  surveyId?: string
  componentId?: string
  onDetectionComplete?: (result: { hasCracks: boolean; count: number; severity: string }) => void
  onImageUpload?: (file: File) => void
}

// ============================================================================
// DETECTION OVERLAY COMPONENT
// ============================================================================

interface DetectionOverlayProps {
  imageUrl: string
  detections: DetectionBox[]
  width: number
  height: number
}

function DetectionOverlay({ imageUrl, detections, width, height }: DetectionOverlayProps): JSX.Element {
  return (
    <div className="relative" style={{ width, height }}>
      <img
        src={imageUrl}
        alt="Detection preview"
        className="w-full h-full object-contain"
      />
      
      {/* Bounding boxes */}
      {detections.map((detection, index) => (
        <div
          key={index}
          className="absolute border-2 border-red-500 bg-red-500/20"
          style={{
            left: `${(detection.x1 / width) * 100}%`,
            top: `${(detection.y1 / height) * 100}%`,
            width: `${((detection.x2 - detection.x1) / width) * 100}%`,
            height: `${((detection.y2 - detection.y1) / height) * 100}%`,
          }}
          title={`Crack detected (${Math.round(detection.confidence * 100)}% confidence)`}
        >
          <span className="absolute -top-5 left-0 bg-red-500 text-white text-xs px-1 rounded">
            {Math.round(detection.confidence * 100)}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIImageUpload({
  surveyId,
  componentId,
  onDetectionComplete,
  onImageUpload,
}: AIImageUploadProps): JSX.Element {
  const [dragActive, setDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  
  const {
    isLoading,
    isUploading,
    uploadProgress,
    result,
    error,
    detect,
    reset,
    hasCracks,
    crackCount,
    severity,
  } = useAIDetection()
  
  // Drag handlers
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
    if (files?.[0]) {
      handleFile(files[0])
    }
  }, [])
  
  // File handler
  const handleFile = useCallback((file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }
    
    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }
    
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    onImageUpload?.(file)
    
    // Auto detect
    detect(file, surveyId, componentId)
  }, [detect, onImageUpload, surveyId, componentId])
  
  // Input change handler
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    const files = e.target.files
    if (files?.[0]) {
      handleFile(files[0])
    }
  }, [handleFile])
  
  // Reset handler
  const handleReset = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setSelectedFile(null)
    reset()
  }, [previewUrl, reset])
  
  // Call callback when detection complete
  if (result && onDetectionComplete) {
    onDetectionComplete({
      hasCracks,
      count: crackCount,
      severity,
    })
  }
  
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Upload Area */}
      {!previewUrl && (
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            className="hidden"
            id="image-upload"
            accept="image/*"
            onChange={handleChange}
          />
          
          <label
            htmlFor="image-upload"
            className="cursor-pointer flex flex-col items-center"
          >
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              Drop an image here, or click to select
            </p>
            <p className="text-sm text-gray-500">
              Supports: JPG, PNG, WebP (max 10MB)
            </p>
          </label>
        </div>
      )}
      
      {/* Preview & Detection Result */}
      {previewUrl && (
        <div className="mt-4">
          {/* Image Preview */}
          <div className="relative bg-gray-100 rounded-lg overflow-hidden">
            {result?.detections && result.detections.length > 0 ? (
              <DetectionOverlay
                imageUrl={previewUrl}
                detections={result.detections}
                width={800}
                height={600}
              />
            ) : (
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-64 object-contain"
              />
            )}
            
            {/* Close button */}
            <button
              onClick={handleReset}
              className="absolute top-2 right-2 p-1 bg-white rounded-full shadow hover:bg-gray-100"
              disabled={isLoading}
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          {/* Progress Bar */}
          {(isUploading || isLoading) && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">
                  {isUploading ? 'Uploading...' : 'Analyzing...'}
                </span>
                <span className="text-gray-900 font-medium">
                  {isUploading ? `${uploadProgress}%` : 'Processing'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${isUploading ? uploadProgress : 100}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Detection Result */}
          {result && !isLoading && (
            <div className={`mt-4 p-4 rounded-lg ${
              hasCracks
                ? severity === 'high'
                  ? 'bg-red-50 border border-red-200'
                  : severity === 'medium'
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-green-50 border border-green-200'
                : 'bg-green-50 border border-green-200'
            }`}>
              <div className="flex items-start gap-3">
                {hasCracks ? (
                  <AlertCircle className={`w-5 h-5 mt-0.5 ${
                    severity === 'high'
                      ? 'text-red-600'
                      : severity === 'medium'
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`} />
                ) : (
                  <CheckCircle2 className="w-5 h-5 mt-0.5 text-green-600" />
                )}
                
                <div>
                  <h4 className={`font-semibold ${
                    hasCracks
                      ? severity === 'high'
                        ? 'text-red-900'
                        : severity === 'medium'
                        ? 'text-yellow-900'
                        : 'text-green-900'
                      : 'text-green-900'
                  }`}>
                    {hasCracks
                      ? `${crackCount} Crack${crackCount > 1 ? 's' : ''} Detected`
                      : 'No Cracks Detected'}
                  </h4>
                  
                  {hasCracks && (
                    <>
                      <p className="text-sm mt-1 capitalize">
                        Severity: <span className="font-medium">{severity}</span>
                      </p>
                      <p className="text-xs mt-1 opacity-75">
                        Processing time: {result.processing_time.toFixed(2)}s
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Error */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900">Detection Failed</h4>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default AIImageUpload
