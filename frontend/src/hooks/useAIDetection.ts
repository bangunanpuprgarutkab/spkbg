/**
 * AI Integration Hook
 * Smart AI Engineering Platform - SPKBG
 * 
 * React hook untuk integrasi AI crack detection
 * dengan state management dan error handling
 */

import { useState, useCallback } from 'react'
import { aiService } from '@/services/ai/aiClient'
import type { DetectionResult, UploadProgress } from '@/types/ai'

// ============================================================================
// TYPES
// ============================================================================

interface UseAIDetectionReturn {
  // State
  isLoading: boolean
  isUploading: boolean
  uploadProgress: number
  result: DetectionResult | null
  error: string | null
  
  // Actions
  detect: (file: File, surveyId?: string, componentId?: string) => Promise<void>
  detectBatch: (files: File[]) => Promise<void>
  reset: () => void
  
  // Helpers
  hasCracks: boolean
  crackCount: number
  severity: string
}

// ============================================================================
// HOOK
// ============================================================================

export function useAIDetection(): UseAIDetectionReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  /**
   * Single image detection
   */
  const detect = useCallback(async (
    file: File,
    surveyId?: string,
    componentId?: string
  ): Promise<void> => {
    setIsLoading(true)
    setIsUploading(true)
    setUploadProgress(0)
    setError(null)
    setResult(null)
    
    try {
      const detectionResult = await aiService.detectCrackWithProgress(
        file,
        (progress: UploadProgress) => {
          setUploadProgress(progress.percentage)
          if (progress.percentage === 100) {
            setIsUploading(false)
          }
        },
        { surveyId, componentId }
      )
      
      setResult(detectionResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Detection failed')
    } finally {
      setIsLoading(false)
      setIsUploading(false)
    }
  }, [])
  
  /**
   * Batch detection
   */
  const detectBatch = useCallback(async (files: File[]): Promise<void> => {
    setIsLoading(true)
    setError(null)
    
    try {
      const batchResult = await aiService.detectCrackBatch(files)
      
      // Aggregate results
      const totalCracks = batchResult.results.reduce(
        (sum, r) => sum + (r.result?.total_cracks || 0), 
        0
      )
      
      // Create aggregated result
      const aggregatedResult: DetectionResult = {
        id: 'batch-' + Date.now(),
        image_name: `${files.length} images`,
        detections: [],
        total_cracks: totalCracks,
        severity: totalCracks > 5 ? 'high' : totalCracks > 2 ? 'medium' : 'low',
        processing_time: 0,
        created_at: new Date().toISOString(),
      }
      
      setResult(aggregatedResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch detection failed')
    } finally {
      setIsLoading(false)
    }
  }, [])
  
  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setIsLoading(false)
    setIsUploading(false)
    setUploadProgress(0)
    setResult(null)
    setError(null)
  }, [])
  
  // Computed properties
  const hasCracks = result ? result.total_cracks > 0 : false
  const crackCount = result?.total_cracks || 0
  const severity = result?.severity || 'none'
  
  return {
    isLoading,
    isUploading,
    uploadProgress,
    result,
    error,
    detect,
    detectBatch,
    reset,
    hasCracks,
    crackCount,
    severity,
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default useAIDetection
