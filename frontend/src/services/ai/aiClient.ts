/**
 * AI Service Client
 * Smart AI Engineering Platform - SPKBG
 * 
 * Client untuk komunikasi dengan FastAPI AI Service
 * - Crack detection
 * - Batch processing
 * - Health checks
 */

import type { DetectionResult, HealthResponse, ModelInfo } from '@/types/ai'

// ============================================================================
// CONFIGURATION
// ============================================================================

const AI_API_URL = import.meta.env.VITE_AI_API_URL || 'http://localhost:8000'

// ============================================================================
// TYPES
// ============================================================================

interface DetectCrackOptions {
  surveyId?: string
  componentId?: string
}

interface BatchDetectResult {
  processed: number
  results: Array<{
    success: boolean
    result?: DetectionResult
    error?: string
    filename?: string
  }>
}

// ============================================================================
// AI SERVICE CLIENT
// ============================================================================

/**
 * Health check AI Service
 */
export async function checkAIHealth(): Promise<HealthResponse> {
  const response = await fetch(`${AI_API_URL}/`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`)
  }

  return response.json()
}

/**
 * Get model information
 */
export async function getModelInfo(): Promise<ModelInfo> {
  const response = await fetch(`${AI_API_URL}/model-info`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get model info: ${response.status}`)
  }

  return response.json()
}

/**
 * Detect cracks in single image
 */
export async function detectCrack(
  imageFile: File,
  options?: DetectCrackOptions
): Promise<DetectionResult> {
  const formData = new FormData()
  formData.append('file', imageFile)
  
  if (options?.surveyId) {
    formData.append('survey_id', options.surveyId)
  }
  
  if (options?.componentId) {
    formData.append('component_id', options.componentId)
  }

  const response = await fetch(`${AI_API_URL}/detect`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || `Detection failed: ${response.status}`)
  }

  return response.json()
}

/**
 * Batch crack detection
 */
export async function detectCrackBatch(imageFiles: File[]): Promise<BatchDetectResult> {
  const formData = new FormData()
  
  imageFiles.forEach((file) => {
    formData.append(`files`, file)
  })

  const response = await fetch(`${AI_API_URL}/detect-batch`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || `Batch detection failed: ${response.status}`)
  }

  return response.json()
}

// ============================================================================
// UPLOAD WITH PROGRESS
// ============================================================================

interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

type ProgressCallback = (progress: UploadProgress) => void

/**
 * Detect cracks with upload progress
 */
export function detectCrackWithProgress(
  imageFile: File,
  onProgress: ProgressCallback,
  options?: DetectCrackOptions
): Promise<DetectionResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    
    formData.append('file', imageFile)
    
    if (options?.surveyId) {
      formData.append('survey_id', options.surveyId)
    }
    
    if (options?.componentId) {
      formData.append('component_id', options.componentId)
    }

    // Progress handler
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        })
      }
    })

    // Completion handler
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText)
          resolve(result)
        } catch (error) {
          reject(new Error('Invalid JSON response'))
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`))
      }
    })

    // Error handler
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })

    // Abort handler
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'))
    })

    // Start request
    xhr.open('POST', `${AI_API_URL}/detect`)
    xhr.send(formData)
  })
}

// ============================================================================
// SERVICE STATUS
// ============================================================================

export interface ServiceStatus {
  ai: {
    connected: boolean
    modelLoaded: boolean
    latency: number
  }
  supabase: {
    connected: boolean
    latency: number
  }
}

/**
 * Check all service statuses
 */
export async function checkAllServices(): Promise<ServiceStatus> {
  const startTime = Date.now()
  
  // Check AI Service
  let aiStatus = { connected: false, modelLoaded: false, latency: 0 }
  try {
    const aiStart = Date.now()
    const health = await checkAIHealth()
    aiStatus = {
      connected: true,
      modelLoaded: health.model_loaded,
      latency: Date.now() - aiStart,
    }
  } catch {
    aiStatus.latency = Date.now() - startTime
  }

  // Check Supabase (via simple ping or use existing client)
  const supabaseStatus = { connected: true, latency: 0 } // Placeholder
  
  return {
    ai: aiStatus,
    supabase: supabaseStatus,
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const aiService = {
  checkHealth: checkAIHealth,
  getModelInfo,
  detectCrack,
  detectCrackBatch,
  detectCrackWithProgress,
  checkAllServices,
}

export default aiService
