/**
 * AI CRACK DETECTION - MODEL TRAINING & INFERENCE
 * Smart AI Engineering Platform - SPKBG
 * 
 * YOLOv8-based crack detection for structural damage assessment
 * Supports: crack detection, width estimation, drone integration
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CrackDetectionResult {
  class: 'crack' | 'spalling' | 'corrosion' | 'delamination'
  confidence: number
  bbox: [number, number, number, number] // [x, y, width, height]
  segmentation?: number[][] // Polygon points for segmentation
  width?: number // Estimated crack width in mm
  length?: number // Estimated crack length in mm
  severity: 'ringan' | 'sedang' | 'berat'
}

export interface DroneImageMetadata {
  lat: number
  lng: number
  altitude: number
  heading: number
  gimbalPitch: number
  timestamp: string
  imageWidth: number
  imageHeight: number
  gsd?: number // Ground Sampling Distance in cm/pixel
}

export interface CrackMeasurement {
  pixelWidth: number
  pixelLength: number
  realWidthMm: number
  realLengthMm: number
  referenceMethod: 'gsd' | 'reference_object' | 'scale_estimate'
}

export interface ModelConfig {
  modelPath: string
  confidenceThreshold: number
  iouThreshold: number
  imgSize: number
  device: 'cpu' | 'cuda'
}

export interface TrainingConfig {
  dataYamlPath: string
  epochs: number
  imgsz: number
  batch: number
  model: 'yolov8n' | 'yolov8s' | 'yolov8m' | 'yolov8l' | 'yolov8x'
  patience: number
  save: boolean
  pretrained: boolean
}

// ============================================================================
// CRACK DETECTION ENGINE (TensorFlow.js version for frontend)
// ============================================================================

export class CrackDetectionEngine {
  private model: any = null
  private config: ModelConfig
  private isLoaded: boolean = false

  constructor(config: Partial<ModelConfig> = {}) {
    this.config = {
      modelPath: '/models/crack-detection/model.json',
      confidenceThreshold: 0.5,
      iouThreshold: 0.45,
      imgSize: 640,
      device: 'cpu',
      ...config,
    }
  }

  /**
   * Load model (TensorFlow.js or API fallback)
   */
  async loadModel(): Promise<boolean> {
    try {
      // Try to load TensorFlow.js model
      if (typeof window !== 'undefined' && (window as any).tf) {
        const tf = (window as any).tf
        this.model = await tf.loadGraphModel(this.config.modelPath)
        this.isLoaded = true
        console.log('Crack detection model loaded successfully')
        return true
      }
      
      // Fallback: use API-based detection
      console.log('Using API-based crack detection')
      this.isLoaded = true
      return true
    } catch (error) {
      console.error('Failed to load crack detection model:', error)
      return false
    }
  }

  /**
   * Detect cracks in image
   */
  async detect(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<CrackDetectionResult[]> {
    if (!this.isLoaded) {
      await this.loadModel()
    }

    // If TensorFlow.js model available
    if (this.model && typeof window !== 'undefined' && (window as any).tf) {
      return this.detectWithTFJS(imageElement)
    }

    // Fallback to API
    return this.detectWithAPI(imageElement)
  }

  /**
   * Detect using TensorFlow.js
   */
  private async detectWithTFJS(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<CrackDetectionResult[]> {
    const tf = (window as any).tf
    
    // Preprocess image
    const tensor = tf.browser.fromPixels(imageElement)
      .resizeNearestNeighbor([this.config.imgSize, this.config.imgSize])
      .expandDims(0)
      .div(255.0)

    // Run inference
    const predictions = await this.model.predict(tensor)
    
    // Process results
    const results = this.processPredictions(predictions, imageElement)
    
    // Cleanup
    tensor.dispose()
    predictions.dispose()

    return results
  }

  /**
   * Detect using Backend API
   */
  private async detectWithAPI(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<CrackDetectionResult[]> {
    // Convert to blob
    const canvas = document.createElement('canvas')
    canvas.width = imageElement.width || (imageElement as HTMLCanvasElement).width
    canvas.height = imageElement.height || (imageElement as HTMLCanvasElement).height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(imageElement, 0, 0)
    
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9)
    })

    // Send to API
    const formData = new FormData()
    formData.append('image', blob, 'crack.jpg')

    const response = await fetch('/api/ai/detect-crack', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Detection API failed')
    }

    const data = await response.json()
    return data.results || []
  }

  /**
   * Process YOLO predictions
   */
  private processPredictions(
    predictions: any,
    imageElement: HTMLImageElement | HTMLCanvasElement
  ): CrackDetectionResult[] {
    const results: CrackDetectionResult[] = []
    const imgWidth = imageElement.width || (imageElement as HTMLCanvasElement).width
    const imgHeight = imageElement.height || (imageElement as HTMLCanvasElement).height

    // Parse YOLO output format
    // Assuming predictions is [batch, num_detections, 6] where 6 = [x, y, w, h, conf, class]
    const data = predictions.dataSync()
    const numDetections = predictions.shape[1]

    for (let i = 0; i < numDetections; i++) {
      const offset = i * 6
      const x = data[offset]
      const y = data[offset + 1]
      const w = data[offset + 2]
      const h = data[offset + 3]
      const confidence = data[offset + 4]
      const classId = data[offset + 5]

      if (confidence < this.config.confidenceThreshold) continue

      // Convert normalized coordinates to pixel
      const bbox: [number, number, number, number] = [
        x * imgWidth,
        y * imgHeight,
        w * imgWidth,
        h * imgHeight,
      ]

      // Estimate width
      const estimatedWidth = this.estimateCrackWidth(bbox, imgWidth)
      const severity = this.classifySeverity(estimatedWidth)

      results.push({
        class: this.classIdToName(classId),
        confidence,
        bbox,
        width: estimatedWidth,
        length: w * imgWidth, // Simplified
        severity,
      })
    }

    return this.applyNMS(results)
  }

  /**
   * Apply Non-Maximum Suppression
   */
  private applyNMS(results: CrackDetectionResult[]): CrackDetectionResult[] {
    // Sort by confidence
    const sorted = [...results].sort((a, b) => b.confidence - a.confidence)
    const filtered: CrackDetectionResult[] = []

    for (const result of sorted) {
      let shouldKeep = true
      
      for (const kept of filtered) {
        const iou = this.calculateIoU(result.bbox, kept.bbox)
        if (iou > this.config.iouThreshold) {
          shouldKeep = false
          break
        }
      }

      if (shouldKeep) {
        filtered.push(result)
      }
    }

    return filtered
  }

  /**
   * Calculate IoU between two bounding boxes
   */
  private calculateIoU(box1: [number, number, number, number], box2: [number, number, number, number]): number {
    const [x1, y1, w1, h1] = box1
    const [x2, y2, w2, h2] = box2

    const xLeft = Math.max(x1, x2)
    const yTop = Math.max(y1, y2)
    const xRight = Math.min(x1 + w1, x2 + w2)
    const yBottom = Math.min(y1 + h1, y2 + h2)

    if (xRight < xLeft || yBottom < yTop) return 0

    const intersectionArea = (xRight - xLeft) * (yBottom - yTop)
    const box1Area = w1 * h1
    const box2Area = w2 * h2

    return intersectionArea / (box1Area + box2Area - intersectionArea)
  }

  /**
   * Estimate crack width from bounding box
   */
  private estimateCrackWidth(
    bbox: [number, number, number, number],
    _imageWidth: number,
    gsd?: number // Ground Sampling Distance
  ): number {
    const [, , w, h] = bbox
    const pixelWidth = Math.min(w, h) // Crack is typically thin

    if (gsd) {
      // Using GSD from drone metadata
      return pixelWidth * gsd * 10 // Convert to mm
    }

    // Estimate based on typical concrete crack proportions
    // Assuming 1 pixel ≈ 0.5mm for standard photos
    const estimatedMm = pixelWidth * 0.5
    return estimatedMm
  }

  /**
   * Classify severity based on crack width
   */
  private classifySeverity(widthMm: number): 'ringan' | 'sedang' | 'berat' {
    if (widthMm < 0.3) return 'ringan' // < 0.3mm: hairline
    if (widthMm < 1.0) return 'sedang' // 0.3-1mm: moderate
    return 'berat' // > 1mm: severe
  }

  /**
   * Convert class ID to name
   */
  private classIdToName(classId: number): 'crack' | 'spalling' | 'corrosion' | 'delamination' {
    const classes: Array<'crack' | 'spalling' | 'corrosion' | 'delamination'> = ['crack', 'spalling', 'corrosion', 'delamination']
    return classes[classId] || 'crack'
  }

  /**
   * Calculate real-world measurements using reference object
   */
  calculateRealMeasurements(
    pixelWidth: number,
    pixelLength: number,
    referenceObject: { pixelSize: number; realSizeMm: number }
  ): CrackMeasurement {
    const scale = referenceObject.realSizeMm / referenceObject.pixelSize
    
    return {
      pixelWidth,
      pixelLength,
      realWidthMm: pixelWidth * scale,
      realLengthMm: pixelLength * scale,
      referenceMethod: 'reference_object',
    }
  }

  /**
   * Calculate real-world measurements using GSD
   */
  calculateMeasurementsFromGSD(
    pixelWidth: number,
    pixelLength: number,
    gsdCmPerPixel: number
  ): CrackMeasurement {
    return {
      pixelWidth,
      pixelLength,
      realWidthMm: pixelWidth * gsdCmPerPixel * 10,
      realLengthMm: pixelLength * gsdCmPerPixel * 10,
      referenceMethod: 'gsd',
    }
  }
}

// ============================================================================
// DRONE IMAGE PROCESSOR
// ============================================================================

export class DroneImageProcessor {
  /**
   * Extract EXIF GPS data from image
   */
  static async extractGPS(imageFile: File): Promise<Partial<DroneImageMetadata> | null> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const view = new DataView(e.target?.result as ArrayBuffer)
        
        // Check for EXIF marker
        if (view.getUint16(0, false) !== 0xFFD8) {
          resolve(null)
          return
        }

        let offset = 2
        let gpsData: Partial<DroneImageMetadata> = {}

        while (offset < view.byteLength) {
          const marker = view.getUint16(offset, false)
          
          if (marker === 0xFFE1) { // APP1 (EXIF)
            // Parse EXIF for GPS - skip length, parse GPS data
            gpsData = this.parseExifGPS(view, offset + 4)
            break
          }
          
          offset += 2 + view.getUint16(offset + 2, false)
        }

        resolve(gpsData)
      }

      reader.readAsArrayBuffer(imageFile.slice(0, 65536))
    })
  }

  /**
   * Parse EXIF GPS data
   */
  private static parseExifGPS(_view: DataView, _offset: number): Partial<DroneImageMetadata> {
    // Simplified EXIF parsing - in production use exif-js library
    return {
      lat: 0,
      lng: 0,
      altitude: 0,
    }
  }

  /**
   * Calculate GSD (Ground Sampling Distance)
   */
  static calculateGSD(
    altitude: number, // meters
    focalLength: number, // mm
    sensorWidth: number, // mm
    imageWidth: number // pixels
  ): number {
    // GSD = (sensor_width * altitude) / (focal_length * image_width)
    // Result in meters per pixel
    return (sensorWidth * altitude) / (focalLength * imageWidth)
  }

  /**
   * Batch process drone images
   */
  static async batchProcess(
    files: File[],
    onProgress?: (current: number, total: number) => void
  ): Promise<Array<{ file: File; metadata: Partial<DroneImageMetadata> | null }>> {
    const results: Array<{ file: File; metadata: Partial<DroneImageMetadata> | null }> = []
    
    for (let i = 0; i < files.length; i++) {
      const metadata = await this.extractGPS(files[i])
      results.push({ file: files[i], metadata })
      
      if (onProgress) {
        onProgress(i + 1, files.length)
      }
    }

    return results
  }
}

// ============================================================================
// TRAINING CONFIGURATION GENERATOR
// ============================================================================

export function generateYOLODatasetYaml(
  datasetPath: string,
  classNames: string[]
): string {
  return `
train: ${datasetPath}/train/images
val: ${datasetPath}/val/images
test: ${datasetPath}/test/images

nc: ${classNames.length}
names: ${JSON.stringify(classNames)}

# Download script
# roboflow:
#   workspace: workspace-name
#   project: project-name
#   version: 1
`
}

export function generateTrainingConfig(
  overrides: Partial<TrainingConfig> = {}
): TrainingConfig {
  return {
    dataYamlPath: 'dataset.yaml',
    epochs: 50,
    imgsz: 640,
    batch: 16,
    model: 'yolov8n',
    patience: 10,
    save: true,
    pretrained: true,
    ...overrides,
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const crackDetectionEngine = new CrackDetectionEngine()

export default {
  CrackDetectionEngine,
  DroneImageProcessor,
  crackDetectionEngine,
  generateYOLODatasetYaml,
  generateTrainingConfig,
}
