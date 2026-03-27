/**
 * DRONE SURVEY SERVICE
 * Smart AI Engineering Platform - SPKBG
 * 
 * Integrasi data drone dengan AI crack detection
 * Workflow: Drone → Image → AI → GIS → Dashboard
 */

import { supabase } from '@/services/supabase/client'
import { DroneImageProcessor, type CrackDetectionResult } from '@/modules/ai/crackDetection'

// ============================================================================
// TYPES
// ============================================================================

export interface DroneSurvey {
  id: string
  surveyId: string
  projectId: string
  droneOperatorId: string
  droneModel: string
  flightDate: string
  flightDuration: number // minutes
  totalImages: number
  processedImages: number
  status: 'planning' | 'flying' | 'uploading' | 'processing' | 'completed' | 'failed'
  weatherConditions?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface DroneImage {
  id: string
  droneSurveyId: string
  surveyId: string
  projectId: string
  originalUrl: string
  processedUrl?: string
  thumbnailUrl?: string
  
  // GPS Data
  latitude: number
  longitude: number
  altitude: number
  heading: number
  gimbalPitch: number
  
  // Image Properties
  width: number
  height: number
  fileSize: number
  capturedAt: string
  
  // GSD (Ground Sampling Distance)
  gsdCmPerPixel?: number
  
  // Processing
  isProcessed: boolean
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed'
  detectedDamages: number
  
  createdAt: string
}

export interface GeoDamage {
  id: string
  droneImageId: string
  surveyId: string
  projectId: string
  
  // Location
  latitude: number
  longitude: number
  altitude: number
  
  // Damage Info
  damageType: 'crack' | 'spalling' | 'corrosion' | 'delamination' | 'other'
  severity: 'ringan' | 'sedang' | 'berat'
  classification: string
  
  // Measurements
  pixelWidth: number
  pixelLength: number
  realWidthMm: number
  realLengthMm: number
  
  // Bounding Box (relative to image)
  bboxX: number
  bboxY: number
  bboxWidth: number
  bboxHeight: number
  
  // AI Result
  aiConfidence: number
  aiResult: CrackDetectionResult
  
  // Verification
  isVerified: boolean
  verifiedBy?: string
  verifiedAt?: string
  engineerClassification?: string
  engineerNotes?: string
  
  // Media
  croppedImageUrl?: string
  fullImageUrl: string
  
  createdAt: string
}

export interface DroneMissionPlan {
  projectId: string
  surveyArea: {
    type: 'Polygon'
    coordinates: number[][][]
  }
  flightAltitude: number
  overlap: number
  gsd: number
  estimatedTime: number
  waypoints: Array<{
    lat: number
    lng: number
    altitude: number
    action: string
  }>
}

export interface DroneSurveyStats {
  totalSurveys: number
  totalImages: number
  processedImages: number
  detectedDamages: number
  verifiedDamages: number
  coverageArea: number // m²
  avgGSD: number
}

// ============================================================================
// DRONE SURVEY SERVICE
// ============================================================================

export class DroneSurveyService {
  /**
   * Create new drone survey
   */
  async createDroneSurvey(surveyData: Omit<DroneSurvey, 'id' | 'createdAt' | 'updatedAt'>): Promise<DroneSurvey | null> {
    try {
      const { data, error } = await supabase
        .from('drone_surveys')
        .insert({
          survey_id: surveyData.surveyId,
          project_id: surveyData.projectId,
          drone_operator_id: surveyData.droneOperatorId,
          drone_model: surveyData.droneModel,
          flight_date: surveyData.flightDate,
          flight_duration: surveyData.flightDuration,
          total_images: surveyData.totalImages,
          processed_images: 0,
          status: 'planning',
          weather_conditions: surveyData.weatherConditions,
          notes: surveyData.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      return {
        id: data.id,
        surveyId: data.survey_id,
        projectId: data.project_id,
        droneOperatorId: data.drone_operator_id,
        droneModel: data.drone_model,
        flightDate: data.flight_date,
        flightDuration: data.flight_duration,
        totalImages: data.total_images,
        processedImages: data.processed_images,
        status: data.status,
        weatherConditions: data.weather_conditions,
        notes: data.notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    } catch (error) {
      console.error('Create drone survey error:', error)
      return null
    }
  }

  /**
   * Upload drone images
   */
  async uploadDroneImages(
    droneSurveyId: string,
    files: File[],
    onProgress?: (current: number, total: number) => void
  ): Promise<DroneImage[]> {
    const uploadedImages: DroneImage[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      try {
        // Extract GPS metadata
        const metadata = await DroneImageProcessor.extractGPS(file)

        // Upload to storage
        const fileName = `drone-surveys/${droneSurveyId}/${Date.now()}_${file.name}`
        const { data: _uploadData, error: uploadError } = await supabase.storage
          .from('drone-images')
          .upload(fileName, file)

        if (uploadError) throw uploadError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('drone-images')
          .getPublicUrl(fileName)

        // Create thumbnail (optional - would use image processing library)
        const thumbnailUrl = publicUrl.replace(file.name, `thumb_${file.name}`)

        // Save to database
        const { data, error } = await supabase
          .from('drone_images')
          .insert({
            drone_survey_id: droneSurveyId,
            original_url: publicUrl,
            thumbnail_url: thumbnailUrl,
            latitude: metadata?.lat || 0,
            longitude: metadata?.lng || 0,
            altitude: metadata?.altitude || 0,
            heading: metadata?.heading || 0,
            gimbal_pitch: metadata?.gimbalPitch || 0,
            width: 0, // Would get from image
            height: 0,
            file_size: file.size,
            captured_at: metadata?.timestamp || new Date().toISOString(),
            is_processed: false,
            processing_status: 'pending',
            detected_damages: 0,
            created_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (error) throw error

        uploadedImages.push({
          id: data.id,
          droneSurveyId: data.drone_survey_id,
          surveyId: data.survey_id,
          projectId: data.project_id,
          originalUrl: data.original_url,
          thumbnailUrl: data.thumbnail_url,
          latitude: data.latitude,
          longitude: data.longitude,
          altitude: data.altitude,
          heading: data.heading,
          gimbalPitch: data.gimbal_pitch,
          width: data.width,
          height: data.height,
          fileSize: data.file_size,
          capturedAt: data.captured_at,
          gsdCmPerPixel: data.gsd_cm_per_pixel,
          isProcessed: data.is_processed,
          processingStatus: data.processing_status,
          detectedDamages: data.detected_damages,
          createdAt: data.created_at,
        })

        if (onProgress) {
          onProgress(i + 1, files.length)
        }
      } catch (error) {
        console.error('Upload image error:', error)
      }
    }

    return uploadedImages
  }

  /**
   * Process images with AI crack detection
   */
  async processImagesWithAI(
    droneSurveyId: string,
    crackDetectionEngine: any
  ): Promise<{ processed: number; damages: number }> {
    try {
      // Get unprocessed images
      const { data: images, error } = await supabase
        .from('drone_images')
        .select('*')
        .eq('drone_survey_id', droneSurveyId)
        .eq('processing_status', 'pending')

      if (error) throw error

      let totalDamages = 0

      for (const image of images || []) {
        // Update status to processing
        await supabase
          .from('drone_images')
          .update({ processing_status: 'processing' })
          .eq('id', image.id)

        try {
          // Load image and detect
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.src = image.original_url
          await new Promise((resolve) => { img.onload = resolve })

          // Run detection
          const results = await crackDetectionEngine.detect(img)

          // Save detected damages
          for (const result of results) {
            // Calculate GSD if not available
            let gsd = image.gsd_cm_per_pixel
            if (!gsd) {
              // Estimate GSD based on altitude and typical drone camera
              gsd = DroneImageProcessor.calculateGSD(
                image.altitude,
                24, // Typical focal length
                13.2, // Typical sensor width (1 inch)
                img.width
              ) * 100 // Convert to cm
            }

            // Calculate real measurements
            const measurements = crackDetectionEngine.calculateMeasurementsFromGSD(
              result.bbox[2], // width
              result.bbox[3], // height
              gsd
            )

            // Save to geo_damages
            await supabase.from('geo_damages').insert({
              drone_image_id: image.id,
              survey_id: image.survey_id,
              project_id: image.project_id,
              latitude: image.latitude,
              longitude: image.longitude,
              altitude: image.altitude,
              damage_type: result.class,
              severity: result.severity,
              classification: this.severityToClassification(result.severity),
              pixel_width: measurements.pixelWidth,
              pixel_length: measurements.pixelLength,
              real_width_mm: measurements.realWidthMm,
              real_length_mm: measurements.realLengthMm,
              bbox_x: result.bbox[0],
              bbox_y: result.bbox[1],
              bbox_width: result.bbox[2],
              bbox_height: result.bbox[3],
              ai_confidence: result.confidence,
              ai_result: result,
              is_verified: false,
              full_image_url: image.original_url,
              created_at: new Date().toISOString(),
            })

            totalDamages++
          }

          // Update image status
          await supabase
            .from('drone_images')
            .update({
              processing_status: 'completed',
              is_processed: true,
              detected_damages: results.length,
            })
            .eq('id', image.id)

        } catch (error) {
          console.error('Process image error:', error)
          await supabase
            .from('drone_images')
            .update({ processing_status: 'failed' })
            .eq('id', image.id)
        }
      }

      return { processed: images?.length || 0, damages: totalDamages }
    } catch (error) {
      console.error('Process images error:', error)
      return { processed: 0, damages: 0 }
    }
  }

  /**
   * Get drone survey by ID
   */
  async getDroneSurvey(id: string): Promise<DroneSurvey | null> {
    const { data, error } = await supabase
      .from('drone_surveys')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return null

    return {
      id: data.id,
      surveyId: data.survey_id,
      projectId: data.project_id,
      droneOperatorId: data.drone_operator_id,
      droneModel: data.drone_model,
      flightDate: data.flight_date,
      flightDuration: data.flight_duration,
      totalImages: data.total_images,
      processedImages: data.processed_images,
      status: data.status,
      weatherConditions: data.weather_conditions,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  /**
   * Get drone images for survey
   */
  async getDroneImages(droneSurveyId: string): Promise<DroneImage[]> {
    const { data, error } = await supabase
      .from('drone_images')
      .select('*')
      .eq('drone_survey_id', droneSurveyId)
      .order('captured_at')

    if (error) return []

    return (data || []).map(d => ({
      id: d.id,
      droneSurveyId: d.drone_survey_id,
      surveyId: d.survey_id,
      projectId: d.project_id,
      originalUrl: d.original_url,
      processedUrl: d.processed_url,
      thumbnailUrl: d.thumbnail_url,
      latitude: d.latitude,
      longitude: d.longitude,
      altitude: d.altitude,
      heading: d.heading,
      gimbalPitch: d.gimbal_pitch,
      width: d.width,
      height: d.height,
      fileSize: d.file_size,
      capturedAt: d.captured_at,
      gsdCmPerPixel: d.gsd_cm_per_pixel,
      isProcessed: d.is_processed,
      processingStatus: d.processing_status,
      detectedDamages: d.detected_damages,
      createdAt: d.created_at,
    }))
  }

  /**
   * Get geo damages for project (for map display)
   */
  async getGeoDamages(projectId: string): Promise<GeoDamage[]> {
    const { data, error } = await supabase
      .from('geo_damages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) return []

    return (data || []).map(d => ({
      id: d.id,
      droneImageId: d.drone_image_id,
      surveyId: d.survey_id,
      projectId: d.project_id,
      latitude: d.latitude,
      longitude: d.longitude,
      altitude: d.altitude,
      damageType: d.damage_type,
      severity: d.severity,
      classification: d.classification,
      pixelWidth: d.pixel_width,
      pixelLength: d.pixel_length,
      realWidthMm: d.real_width_mm,
      realLengthMm: d.real_length_mm,
      bboxX: d.bbox_x,
      bboxY: d.bbox_y,
      bboxWidth: d.bbox_width,
      bboxHeight: d.bbox_height,
      aiConfidence: d.ai_confidence,
      aiResult: d.ai_result,
      isVerified: d.is_verified,
      verifiedBy: d.verified_by,
      verifiedAt: d.verified_at,
      engineerClassification: d.engineer_classification,
      engineerNotes: d.engineer_notes,
      croppedImageUrl: d.cropped_image_url,
      fullImageUrl: d.full_image_url,
      createdAt: d.created_at,
    }))
  }

  /**
   * Verify geo damage (engineer validation)
   */
  async verifyGeoDamage(
    geoDamageId: string,
    engineerId: string,
    classification: string,
    notes?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('geo_damages')
        .update({
          is_verified: true,
          verified_by: engineerId,
          verified_at: new Date().toISOString(),
          engineer_classification: classification,
          engineer_notes: notes,
        })
        .eq('id', geoDamageId)

      return !error
    } catch {
      return false
    }
  }

  /**
   * Get drone survey stats
   */
  async getStats(projectId?: string): Promise<DroneSurveyStats> {
    try {
      let query = supabase.from('drone_surveys').select('*')
      if (projectId) {
        query = query.eq('project_id', projectId)
      }

      const { data: surveys } = await query

      let totalImages = 0
      let processedImages = 0

      for (const survey of surveys || []) {
        totalImages += survey.total_images || 0
        processedImages += survey.processed_images || 0
      }

      const { count: damages } = await supabase
        .from('geo_damages')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId || '')

      const { count: verified } = await supabase
        .from('geo_damages')
        .select('*', { count: 'exact', head: true })
        .eq('is_verified', true)
        .eq('project_id', projectId || '')

      return {
        totalSurveys: surveys?.length || 0,
        totalImages,
        processedImages,
        detectedDamages: damages || 0,
        verifiedDamages: verified || 0,
        coverageArea: 0, // Would calculate from polygon
        avgGSD: 0.5, // cm/pixel
      }
    } catch {
      return {
        totalSurveys: 0,
        totalImages: 0,
        processedImages: 0,
        detectedDamages: 0,
        verifiedDamages: 0,
        coverageArea: 0,
        avgGSD: 0,
      }
    }
  }

  /**
   * Convert severity to classification
   */
  private severityToClassification(severity: string): string {
    const map: Record<string, string> = {
      'ringan': '2',
      'sedang': '4',
      'berat': '6',
    }
    return map[severity] || '1'
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const droneSurveyService = new DroneSurveyService()

export default {
  DroneSurveyService,
  droneSurveyService,
}
