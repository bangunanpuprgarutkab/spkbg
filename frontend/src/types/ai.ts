/**
 * AI Service Types
 * Smart AI Engineering Platform - SPKBG
 */

// ============================================================================
// DETECTION TYPES
// ============================================================================

export interface DetectionBox {
  x1: number
  y1: number
  x2: number
  y2: number
  confidence: number
  class_id: number
  class_name: string
}

export interface DetectionResult {
  id: string
  image_name: string
  detections: DetectionBox[]
  total_cracks: number
  severity: 'none' | 'low' | 'medium' | 'high'
  processing_time: number
  created_at: string
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface HealthResponse {
  status: string
  model_loaded: boolean
  version: string
  timestamp: string
}

export interface ModelInfo {
  model_loaded: boolean
  model_path: string
  confidence_threshold: number
  iou_threshold: number
  yolo_available: boolean
}

// ============================================================================
// SERVICE STATUS TYPES
// ============================================================================

export interface AIServiceStatus {
  connected: boolean
  modelLoaded: boolean
  latency: number
}

export interface SupabaseServiceStatus {
  connected: boolean
  latency: number
}

export interface ServiceStatus {
  ai: AIServiceStatus
  supabase: SupabaseServiceStatus
}

// ============================================================================
// UPLOAD TYPES
// ============================================================================

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export type ProgressCallback = (progress: UploadProgress) => void
