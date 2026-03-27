/**
 * AI DAMAGE DETECTION ENGINE
 * Smart AI Engineering Platform - SPKBG
 * 
 * TensorFlow.js-based image analysis untuk deteksi kerusakan bangunan
 * Features: Retak, Spalling, Korosi, Kerusakan Finishing
 */

import * as tf from '@tensorflow/tfjs'
import type { DamageClassification } from '@/types'

// ============================================================================
// TYPES
// ============================================================================

export interface DamageDetectionResult {
  damageType: DamageType
  confidence: number
  severity: 'ringan' | 'sedang' | 'berat'
  suggestedClassification: DamageClassification
  boundingBox?: BoundingBox
  analysisDetails: AnalysisDetail[]
  userVerified: boolean
  userOverride?: DamageClassification
}

export type DamageType = 
  | 'retak' 
  | 'spalling' 
  | 'korosi_tulangan' 
  | 'kerusakan_finishing'
  | 'pondasi_bergeser'
  | 'kolom_patah'
  | 'tidak_terdeteksi'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface AnalysisDetail {
  feature: string
  value: string
  confidence: number
}

export interface DamageImage {
  id: string
  surveyId: string
  componentId?: string
  imageUrl: string
  aiResult?: DamageDetectionResult
  confidence: number
  createdAt: string
  verifiedBy?: string
  verifiedAt?: string
}

export interface AIDetectionConfig {
  modelUrl?: string
  confidenceThreshold: number
  maxDetections: number
  enableBoundingBoxes: boolean
}

// ============================================================================
// AI DAMAGE DETECTOR CLASS
// ============================================================================

export class AIDamageDetector {
  private model: tf.LayersModel | null = null
  private isModelLoaded: boolean = false

  constructor(_config: Partial<AIDetectionConfig> = {}) {
    // Config stored but not currently used in methods
    void _config
  }

  /**
   * Load TensorFlow.js model
   */
  async loadModel(modelUrl?: string): Promise<boolean> {
    try {
      if (modelUrl) {
        this.model = await tf.loadLayersModel(modelUrl)
      } else {
        // Use default model atau buat model sederhana
        this.model = await this.createDefaultModel()
      }
      
      this.isModelLoaded = true
      console.log('AI Model loaded successfully')
      return true
    } catch (error) {
      console.error('Failed to load AI model:', error)
      return false
    }
  }

  /**
   * Create default model (fallback)
   * Model sederhana untuk demo
   */
  private async createDefaultModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.conv2d({
          inputShape: [224, 224, 3],
          filters: 32,
          kernelSize: 3,
          activation: 'relu',
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        tf.layers.conv2d({ filters: 64, kernelSize: 3, activation: 'relu' }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        tf.layers.flatten(),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({ units: 7, activation: 'softmax' }), // 7 klasifikasi kerusakan
      ],
    })

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    })

    return model
  }

  /**
   * Analyze image for damage detection
   */
  async analyzeImage(imageElement: HTMLImageElement | ImageData): Promise<DamageDetectionResult> {
    if (!this.isModelLoaded || !this.model) {
      // Fallback: rule-based analysis
      return this.ruleBasedAnalysis(imageElement)
    }

    try {
      // Preprocess image
      const tensor = this.preprocessImage(imageElement)
      
      // Predict
      const predictions = this.model.predict(tensor) as tf.Tensor
      const probabilities = await predictions.data()
      
      // Cleanup
      tensor.dispose()
      predictions.dispose()

      // Process results
      return this.processPredictions(probabilities)
    } catch (error) {
      console.error('AI analysis failed:', error)
      return this.ruleBasedAnalysis(imageElement)
    }
  }

  /**
   * Preprocess image for model input
   */
  private preprocessImage(image: HTMLImageElement | ImageData): tf.Tensor {
    let tensor: tf.Tensor

    if (image instanceof HTMLImageElement) {
      tensor = tf.browser.fromPixels(image)
    } else {
      tensor = tf.browser.fromPixels(image)
    }

    // Resize to 224x224
    const resized = tf.image.resizeBilinear(tensor as tf.Tensor3D, [224, 224])
    
    // Normalize to [0, 1]
    const normalized = resized.div(255.0)
    
    // Add batch dimension
    const batched = normalized.expandDims(0)

    tensor.dispose()
    resized.dispose()
    normalized.dispose()

    return batched
  }

  /**
   * Process model predictions
   */
  private processPredictions(probabilities: Float32Array | Int32Array | Uint8Array): DamageDetectionResult {
    const damageTypes: DamageType[] = [
      'tidak_terdeteksi',
      'retak',
      'spalling',
      'korosi_tulangan',
      'kerusakan_finishing',
      'pondasi_bergeser',
      'kolom_patah',
    ]

    // Find highest probability
    let maxIndex = 0
    let maxProb = probabilities[0]
    
    for (let i = 1; i < probabilities.length; i++) {
      if (probabilities[i] > maxProb) {
        maxProb = probabilities[i]
        maxIndex = i
      }
    }

    const damageType = damageTypes[maxIndex]
    const confidence = maxProb

    // Determine severity dan klasifikasi
    const { severity, suggestedClassification } = this.deriveClassification(damageType, confidence)

    return {
      damageType,
      confidence,
      severity,
      suggestedClassification,
      analysisDetails: [
        { feature: 'damage_type', value: damageType, confidence },
        { feature: 'severity', value: severity, confidence },
        { feature: 'model_confidence', value: `${(confidence * 100).toFixed(1)}%`, confidence },
      ],
      userVerified: false,
    }
  }

  /**
   * Rule-based analysis (fallback tanpa AI model)
   * Menggunakan image analysis sederhana
   */
  private async ruleBasedAnalysis(image: HTMLImageElement | ImageData): Promise<DamageDetectionResult> {
    // Create canvas untuk analisis
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      return this.createEmptyResult()
    }

    // Set canvas size
    if (image instanceof HTMLImageElement) {
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      ctx.drawImage(image, 0, 0)
    } else {
      canvas.width = image.width
      canvas.height = image.height
      ctx.putImageData(image, 0, 0)
    }

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Analisis sederhana berdasarkan pixel
    const analysis = this.analyzePixels(data, canvas.width, canvas.height)

    // Derive klasifikasi dari analisis
    const { damageType, severity, suggestedClassification, confidence } = analysis

    return {
      damageType,
      confidence,
      severity,
      suggestedClassification,
      analysisDetails: [
        { feature: 'edge_detection', value: analysis.edgeDensity > 0.1 ? 'high' : 'low', confidence },
        { feature: 'texture_variance', value: analysis.textureVariance > 50 ? 'rough' : 'smooth', confidence },
        { feature: 'color_anomaly', value: analysis.colorAnomaly ? 'detected' : 'none', confidence },
      ],
      userVerified: false,
    }
  }

  /**
   * Analyze pixels for damage patterns
   */
  private analyzePixels(data: Uint8ClampedArray, width: number, height: number) {
    let edgeCount = 0
    let totalVariance = 0
    let darkPixelCount = 0
    let totalPixels = width * height

    // Sample pixels (every 10th pixel untuk performance)
    for (let i = 0; i < data.length; i += 40) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      // Check for dark pixels (potential cracks)
      const brightness = (r + g + b) / 3
      if (brightness < 50) {
        darkPixelCount++
      }

      // Simple edge detection (compare dengan pixel berikutnya)
      if (i + 4 < data.length) {
        const nextR = data[i + 4]
        const diff = Math.abs(r - nextR)
        if (diff > 30) {
          edgeCount++
        }
        totalVariance += diff
      }
    }

    const edgeDensity = edgeCount / (totalPixels / 10)
    const textureVariance = totalVariance / (totalPixels / 10)
    const darkRatio = darkPixelCount / (totalPixels / 10)

    // Determine damage type
    let damageType: DamageType = 'tidak_terdeteksi'
    let severity: 'ringan' | 'sedang' | 'berat' = 'ringan'
    let suggestedClassification: DamageClassification = '1'
    let confidence = 0.5

    if (darkRatio > 0.05 && edgeDensity > 0.08) {
      damageType = 'retak'
      
      if (darkRatio > 0.15) {
        severity = 'berat'
        suggestedClassification = '5'
        confidence = 0.75
      } else if (darkRatio > 0.08) {
        severity = 'sedang'
        suggestedClassification = '3'
        confidence = 0.65
      } else {
        severity = 'ringan'
        suggestedClassification = '2'
        confidence = 0.55
      }
    } else if (textureVariance > 100) {
      damageType = 'spalling'
      severity = 'sedang'
      suggestedClassification = '4'
      confidence = 0.6
    } else if (darkRatio > 0.2) {
      damageType = 'korosi_tulangan'
      severity = 'berat'
      suggestedClassification = '6'
      confidence = 0.7
    }

    return {
      damageType,
      severity,
      suggestedClassification,
      confidence,
      edgeDensity,
      textureVariance,
      colorAnomaly: darkRatio > 0.1,
    }
  }

  /**
   * Derive klasifikasi from damage type
   */
  private deriveClassification(
    damageType: DamageType,
    confidence: number
  ): { severity: 'ringan' | 'sedang' | 'berat'; suggestedClassification: DamageClassification } {
    const rules: Record<DamageType, { severity: 'ringan' | 'sedang' | 'berat'; classification: DamageClassification }> = {
      'tidak_terdeteksi': { severity: 'ringan', classification: '1' },
      'retak': { severity: 'sedang', classification: '3' },
      'spalling': { severity: 'sedang', classification: '4' },
      'korosi_tulangan': { severity: 'berat', classification: '6' },
      'kerusakan_finishing': { severity: 'ringan', classification: '2' },
      'pondasi_bergeser': { severity: 'berat', classification: '7' },
      'kolom_patah': { severity: 'berat', classification: '7' },
    }

    const rule = rules[damageType]
    
    // Adjust based on confidence
    if (confidence < 0.5) {
      return { severity: 'ringan', suggestedClassification: '1' }
    }

    return {
      severity: rule.severity,
      suggestedClassification: rule.classification,
    }
  }

  /**
   * Create empty result
   */
  private createEmptyResult(): DamageDetectionResult {
    return {
      damageType: 'tidak_terdeteksi',
      confidence: 0,
      severity: 'ringan',
      suggestedClassification: '1',
      analysisDetails: [],
      userVerified: false,
    }
  }

  /**
   * Batch analyze multiple images
   */
  async batchAnalyze(images: HTMLImageElement[]): Promise<DamageDetectionResult[]> {
    const results: DamageDetectionResult[] = []
    
    for (const image of images) {
      const result = await this.analyzeImage(image)
      results.push(result)
    }

    return results
  }

  /**
   * Check if model is loaded
   */
  isReady(): boolean {
    return this.isModelLoaded
  }
}

// ============================================================================
// AI ASSIST ENGINE
// ============================================================================

export class AIAssistEngine {
  /**
   * Detect anomalies in survey data
   */
  detectAnomalies(data: Record<string, any>): AnomalyReport[] {
    const anomalies: AnomalyReport[] = []

    // Check for unusual volume ratios
    if (data.volume_rusak > data.volume_total) {
      anomalies.push({
        type: 'volume_error',
        field: 'volume_rusak',
        message: 'Volume rusak tidak boleh melebihi volume total',
        severity: 'error',
      })
    }

    // Check for extreme values
    if (data.volume_rusak / data.volume_total > 0.9) {
      anomalies.push({
        type: 'extreme_damage',
        field: 'volume_rusak',
        message: 'Kerusakan > 90%, perlu verifikasi khusus',
        severity: 'warning',
      })
    }

    // Check for inconsistent klasifikasi
    const ratio = data.volume_rusak / data.volume_total
    const klasifikasi = parseInt(data.klasifikasi)
    
    if (ratio > 0.5 && klasifikasi < 3) {
      anomalies.push({
        type: 'klasifikasi_warning',
        field: 'klasifikasi',
        message: 'Klasifikasi mungkin terlalu rendah untuk rasio kerusakan',
        severity: 'warning',
      })
    }

    return anomalies
  }

  /**
   * Suggest repair methods based on damage type
   */
  suggestRepair(damageType: DamageType, severity: string): RepairSuggestion {
    const suggestions: Record<string, RepairSuggestion> = {
      'retak_ringan': {
        method: 'Injeksi Epoxy',
        materials: ['Epoxy resin', 'Injector'],
        estimatedCost: 'Rp 50.000 - 100.000/m',
        timeline: '1-2 hari',
      },
      'retak_sedang': {
        method: 'Pembetonan Ulang',
        materials: ['Beton K-225', 'Bekisting', 'Tulangan tambahan'],
        estimatedCost: 'Rp 200.000 - 500.000/m²',
        timeline: '3-5 hari',
      },
      'retak_berat': {
        method: 'Rekonstruksi',
        materials: ['Beton K-250', 'Bekisting', 'Tulangan baru'],
        estimatedCost: 'Rp 500.000 - 1.000.000/m²',
        timeline: '7-14 hari',
      },
      'spalling': {
        method: 'Patching Concrete',
        materials: ['Mortar repair', 'Bonding agent'],
        estimatedCost: 'Rp 150.000 - 300.000/m²',
        timeline: '2-3 hari',
      },
      'korosi_tulangan': {
        method: 'Penggantian Tulangan',
        materials: ['Tulangan baru', 'Anti-karat coating'],
        estimatedCost: 'Rp 300.000 - 600.000/m²',
        timeline: '5-7 hari',
      },
    }

    const key = `${damageType}_${severity}`
    return suggestions[key] || {
      method: 'Konsultasi Ahli',
      materials: ['Perlu survey lapangan'],
      estimatedCost: 'TBD',
      timeline: 'TBD',
    }
  }

  /**
   * Validate classification rules
   */
  validateClassification(components: any[]): ValidationResult {
    const results: ComponentValidation[] = []
    let isCritical = false
    let criticalReasons: string[] = []

    for (const comp of components) {
      const hasKolomPatah = comp.nama_komponen?.toLowerCase().includes('kolom') && 
                           comp.deskripsi_kerusakan?.toLowerCase().includes('patah')
      
      const hasPondasiBergeser = comp.nama_komponen?.toLowerCase().includes('pondasi') && 
                                comp.deskripsi_kerusakan?.toLowerCase().includes('geser')
      
      const hasStrukturRuntuh = comp.klasifikasi === '7' || 
                               comp.deskripsi_kerusakan?.toLowerCase().includes('runtuh')

      if (hasKolomPatah || hasPondasiBergeser || hasStrukturRuntuh) {
        isCritical = true
        
        if (hasKolomPatah) criticalReasons.push('Kolom patah terdeteksi')
        if (hasPondasiBergeser) criticalReasons.push('Pondasi bergeser terdeteksi')
        if (hasStrukturRuntuh) criticalReasons.push('Struktur runtuh terdeteksi')
      }

      results.push({
        componentId: comp.id,
        isValid: true,
        warnings: [],
      })
    }

    return {
      isValid: true,
      isCritical,
      criticalReasons,
      components: results,
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface AnomalyReport {
  type: string
  field: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

interface RepairSuggestion {
  method: string
  materials: string[]
  estimatedCost: string
  timeline: string
}

interface ComponentValidation {
  componentId: string
  isValid: boolean
  warnings: string[]
}

interface ValidationResult {
  isValid: boolean
  isCritical: boolean
  criticalReasons: string[]
  components: ComponentValidation[]
}

// ============================================================================
// EXPORTS
// ============================================================================

export const aiDamageDetector = new AIDamageDetector()
export const aiAssistEngine = new AIAssistEngine()

export default {
  AIDamageDetector,
  AIAssistEngine,
  aiDamageDetector,
  aiAssistEngine,
}
