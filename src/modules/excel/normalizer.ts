/**
 * DATA NORMALIZATION MODULE
 * Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
 * 
 * Fungsi: Membersihkan dan memvalidasi data sebelum export
 */

import type { DataType } from '../template/mapping'

// ============================================================================
// TYPES
// ============================================================================

export interface NormalizationRule {
  field: string
  dataType: DataType
  required: boolean
  defaultValue?: any
  min?: number
  max?: number
  precision?: number
  pattern?: string
  transform?: 'trim' | 'uppercase' | 'lowercase' | 'capitalize'
}

export interface NormalizationResult {
  data: Record<string, any>
  errors: ValidationError[]
  warnings: string[]
  normalized: boolean
}

export interface ValidationError {
  field: string
  value: any
  code: string
  message: string
}

export interface ComponentNormalization {
  kode_komponen: string
  nama_komponen: string
  volume_total: number
  volume_rusak: number
  klasifikasi: string
  bobot_komponen: number
  nilai_kerusakan: number
  satuan: string
}

// ============================================================================
// DATA NORMALIZER CLASS
// ============================================================================

export class DataNormalizer {
  private rules: NormalizationRule[]

  constructor(rules: NormalizationRule[] = []) {
    this.rules = rules
  }

  /**
   * Normalize data object
   */
  normalize(data: Record<string, any>): NormalizationResult {
    const result: Record<string, any> = {}
    const errors: ValidationError[] = []
    const warnings: string[] = []

    // Apply rules
    this.rules.forEach(rule => {
      let value = data[rule.field]

      // Check required
      if (rule.required && (value === undefined || value === null || value === '')) {
        if (rule.defaultValue !== undefined) {
          value = rule.defaultValue
          warnings.push(`Field "${rule.field}" menggunakan default value`)
        } else {
          errors.push({
            field: rule.field,
            value,
            code: 'REQUIRED',
            message: `Field "${rule.field}" wajib diisi`,
          })
          return
        }
      }

      // Skip if null and not required
      if (value === undefined || value === null) {
        return
      }

      // Apply transformation
      if (rule.transform) {
        value = this.applyTransform(value, rule.transform)
      }

      // Type conversion and validation
      const normalized = this.normalizeValue(value, rule)
      
      if (normalized.error) {
        errors.push({
          field: rule.field,
          value,
          code: normalized.error.code,
          message: normalized.error.message,
        })
      } else {
        result[rule.field] = normalized.value
      }
    })

    // Copy fields without rules
    Object.keys(data).forEach(key => {
      if (!(key in result)) {
        result[key] = data[key]
      }
    })

    return {
      data: result,
      errors,
      warnings,
      normalized: errors.length === 0,
    }
  }

  /**
   * Normalize single value
   */
  private normalizeValue(
    value: any, 
    rule: NormalizationRule
  ): { value: any; error?: ValidationError } {
    switch (rule.dataType) {
      case 'text':
        return this.normalizeText(value, rule)
      case 'number':
      case 'decimal':
        return this.normalizeNumber(value, rule)
      case 'integer':
        return this.normalizeInteger(value, rule)
      case 'boolean':
        return this.normalizeBoolean(value)
      case 'date':
        return this.normalizeDate(value)
      case 'enum':
        return this.normalizeEnum(value, rule)
      default:
        return { value }
    }
  }

  /**
   * Normalize text
   */
  private normalizeText(
    value: any, 
    rule: NormalizationRule
  ): { value: any; error?: ValidationError } {
    let text = String(value)

    // Trim if specified
    if (rule.transform === 'trim') {
      text = text.trim()
    }

    // Check pattern
    if (rule.pattern && !new RegExp(rule.pattern).test(text)) {
      return {
        value,
        error: {
          field: rule.field,
          value,
          code: 'PATTERN_MISMATCH',
          message: `Format tidak valid untuk "${rule.field}"`,
        },
      }
    }

    return { value: text }
  }

  /**
   * Normalize number
   */
  private normalizeNumber(
    value: any, 
    rule: NormalizationRule
  ): { value: any; error?: ValidationError } {
    const num = typeof value === 'number' ? value : parseFloat(value)

    if (isNaN(num)) {
      return {
        value,
        error: {
          field: rule.field,
          value,
          code: 'INVALID_NUMBER',
          message: `Nilai "${rule.field}" bukan angka yang valid`,
        },
      }
    }

    // Check min
    if (rule.min !== undefined && num < rule.min) {
      return {
        value,
        error: {
          field: rule.field,
          value,
          code: 'MIN_VIOLATION',
          message: `Nilai "${rule.field}" minimal ${rule.min}`,
        },
      }
    }

    // Check max
    if (rule.max !== undefined && num > rule.max) {
      return {
        value,
        error: {
          field: rule.field,
          value,
          code: 'MAX_VIOLATION',
          message: `Nilai "${rule.field}" maksimal ${rule.max}`,
        },
      }
    }

    // Apply precision
    let result = num
    if (rule.precision !== undefined) {
      const factor = Math.pow(10, rule.precision)
      result = Math.round(num * factor) / factor
    }

    return { value: result }
  }

  /**
   * Normalize integer
   */
  private normalizeInteger(
    value: any, 
    rule: NormalizationRule
  ): { value: any; error?: ValidationError } {
    const int = typeof value === 'number' ? Math.round(value) : parseInt(value)

    if (isNaN(int)) {
      return {
        value,
        error: {
          field: rule.field,
          value,
          code: 'INVALID_INTEGER',
          message: `Nilai "${rule.field}" bukan bilangan bulat`,
        },
      }
    }

    // Check min
    if (rule.min !== undefined && int < rule.min) {
      return {
        value,
        error: {
          field: rule.field,
          value,
          code: 'MIN_VIOLATION',
          message: `Nilai "${rule.field}" minimal ${rule.min}`,
        },
      }
    }

    // Check max
    if (rule.max !== undefined && int > rule.max) {
      return {
        value,
        error: {
          field: rule.field,
          value,
          code: 'MAX_VIOLATION',
          message: `Nilai "${rule.field}" maksimal ${rule.max}`,
        },
      }
    }

    return { value: int }
  }

  /**
   * Normalize boolean
   */
  private normalizeBoolean(value: any): { value: any } {
    if (typeof value === 'boolean') {
      return { value }
    }

    const str = String(value).toLowerCase().trim()
    const truthy = ['ya', 'yes', 'true', '1', 'y', '✓', 'v']
    const falsy = ['tidak', 'no', 'false', '0', 'n', '-', 'x']

    if (truthy.includes(str)) {
      return { value: true }
    }
    if (falsy.includes(str)) {
      return { value: false }
    }

    // Default to false for unknown
    return { value: false }
  }

  /**
   * Normalize date
   */
  private normalizeDate(value: any): { value: any; error?: ValidationError } {
    let date: Date

    if (value instanceof Date) {
      date = value
    } else {
      date = new Date(value)
    }

    if (isNaN(date.getTime())) {
      return {
        value,
        error: {
          field: 'date',
          value,
          code: 'INVALID_DATE',
          message: 'Format tanggal tidak valid',
        },
      }
    }

    return { value: date }
  }

  /**
   * Normalize enum
   */
  private normalizeEnum(
    value: any, 
    rule: NormalizationRule
  ): { value: any; error?: ValidationError } {
    const str = String(value).trim()
    
    // For klasifikasi 1-7
    if (rule.pattern === 'klasifikasi') {
      if (!/^[1-7]$/.test(str)) {
        return {
          value,
          error: {
            field: rule.field,
            value,
            code: 'INVALID_KLASIFIKASI',
            message: 'Klasifikasi harus antara 1-7',
          },
        }
      }
    }

    return { value: str }
  }

  /**
   * Apply text transformation
   */
  private applyTransform(value: any, transform: string): any {
    if (typeof value !== 'string') return value

    switch (transform) {
      case 'trim':
        return value.trim()
      case 'uppercase':
        return value.toUpperCase()
      case 'lowercase':
        return value.toLowerCase()
      case 'capitalize':
        return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
      default:
        return value
    }
  }
}

// ============================================================================
// SURVEY DATA NORMALIZATION
// ============================================================================

/**
 * Normalize survey data for export
 */
export function normalizeSurveyData(data: Record<string, any>): NormalizationResult {
  const normalizer = new DataNormalizer([
    // Project fields
    { field: 'project.nama_bangunan', dataType: 'text', required: true, transform: 'trim' },
    { field: 'project.alamat', dataType: 'text', required: true, transform: 'trim' },
    { field: 'project.jumlah_lantai', dataType: 'integer', required: true, min: 1 },
    { field: 'project.luas_bangunan', dataType: 'number', required: false, min: 0 },
    { field: 'project.fungsi_bangunan', dataType: 'text', required: false },
    { field: 'project.tahun_bangunan', dataType: 'integer', required: false, min: 1900, max: 2100 },
    
    // Survey fields
    { field: 'survey.kode_survey', dataType: 'text', required: true, transform: 'uppercase' },
    { field: 'survey.tanggal_survey', dataType: 'date', required: true },
    { field: 'survey.kondisi_umum', dataType: 'text', required: false },
    { field: 'survey.catatan_umum', dataType: 'text', required: false },
    
    // Surveyor fields
    { field: 'survey.surveyor_name', dataType: 'text', required: true },
    { field: 'survey.surveyor_nip', dataType: 'text', required: false, pattern: '^[0-9]*$' },
    { field: 'survey.surveyor_instansi', dataType: 'text', required: false },
    
    // Safety checks
    { field: 'survey.has_kolom_patah', dataType: 'boolean', required: true, defaultValue: false },
    { field: 'survey.has_pondasi_bergeser', dataType: 'boolean', required: true, defaultValue: false },
    { field: 'survey.has_struktur_runtuh', dataType: 'boolean', required: true, defaultValue: false },
    
    // Results
    { field: 'results.total_kerusakan', dataType: 'number', required: false, min: 0, max: 100, precision: 4 },
    { field: 'results.kategori_kerusakan', dataType: 'text', required: false },
    { field: 'results.is_critical', dataType: 'boolean', required: false, defaultValue: false },
  ])

  return normalizer.normalize(data)
}

/**
 * Normalize component data
 */
export function normalizeComponentData(components: any[]): {
  normalized: ComponentNormalization[]
  errors: ValidationError[]
  warnings: string[]
} {
  const normalized: ComponentNormalization[] = []
  const errors: ValidationError[] = []
  const warnings: string[] = []

  components.forEach((comp, index) => {
    // Validate required fields
    if (!comp.kode_komponen) {
      errors.push({
        field: `components[${index}].kode_komponen`,
        value: comp.kode_komponen,
        code: 'REQUIRED',
        message: `Komponen ke-${index + 1} tidak memiliki kode`,
      })
      return
    }

    // Normalize volumes
    const volTotal = parseFloat(comp.volume_total) || 0
    const volRusak = parseFloat(comp.volume_rusak) || 0

    if (volTotal < 0) {
      errors.push({
        field: `components[${index}].volume_total`,
        value: comp.volume_total,
        code: 'NEGATIVE',
        message: `Volume total tidak boleh negatif untuk ${comp.kode_komponen}`,
      })
    }

    if (volRusak < 0) {
      errors.push({
        field: `components[${index}].volume_rusak`,
        value: comp.volume_rusak,
        code: 'NEGATIVE',
        message: `Volume rusak tidak boleh negatif untuk ${comp.kode_komponen}`,
      })
    }

    if (volRusak > volTotal) {
      warnings.push(`Volume rusak > volume total untuk ${comp.kode_komponen}`)
    }

    // Validate klasifikasi
    const klasifikasi = String(comp.klasifikasi || '').trim()
    if (!/^[1-7]$/.test(klasifikasi)) {
      warnings.push(`Klasifikasi tidak valid untuk ${comp.kode_komponen}, menggunakan 1`)
    }

    // Calculate nilai kerusakan
    const bobot = parseFloat(comp.bobot_komponen) || 0
    const nilaiKlasifikasi = getKlasifikasiValue(klasifikasi)
    const nilaiKerusakan = volTotal > 0 ? (volRusak / volTotal) * nilaiKlasifikasi * bobot : 0

    normalized.push({
      kode_komponen: comp.kode_komponen.toUpperCase(),
      nama_komponen: String(comp.nama_komponen || ''),
      volume_total: volTotal,
      volume_rusak: volRusak,
      klasifikasi: klasifikasi || '1',
      bobot_komponen: bobot,
      nilai_kerusakan: nilaiKerusakan,
      satuan: comp.satuan || '',
    })
  })

  return { normalized, errors, warnings }
}

/**
 * Get klasifikasi value
 */
function getKlasifikasiValue(klasifikasi: string): number {
  const values: Record<string, number> = {
    '1': 0.00,
    '2': 0.20,
    '3': 0.35,
    '4': 0.50,
    '5': 0.70,
    '6': 0.85,
    '7': 1.00,
  }
  return values[klasifikasi] || 0.00
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate data before export
 */
export function validateExportData(data: Record<string, any>): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required fields
  const requiredFields = [
    'project.nama_bangunan',
    'project.alamat',
    'project.jumlah_lantai',
    'survey.kode_survey',
    'survey.tanggal_survey',
    'survey.surveyor_name',
  ]

  requiredFields.forEach(field => {
    const value = getNestedValue(data, field)
    if (!value || value === '') {
      errors.push(`Field "${field}" wajib diisi`)
    }
  })

  // Check components
  if (!data.components || data.components.length === 0) {
    warnings.push('Tidak ada data komponen')
  } else {
    const compCheck = normalizeComponentData(data.components)
    compCheck.errors.forEach(e => errors.push(e.message))
    compCheck.warnings.forEach(w => warnings.push(w))
  }

  // Check results
  if (data.results) {
    const total = parseFloat(data.results.total_kerusakan)
    if (isNaN(total) || total < 0 || total > 100) {
      errors.push('Total kerusakan harus antara 0-100')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Get nested value
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined
    return current[key]
  }, obj)
}

/**
 * Format number for Excel
 */
export function formatExcelNumber(
  value: number, 
  precision: number = 4, 
  useComma: boolean = false
): string {
  const factor = Math.pow(10, precision)
  const rounded = Math.round(value * factor) / factor
  
  if (useComma) {
    return rounded.toLocaleString('id-ID', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    })
  }
  
  return rounded.toFixed(precision)
}

/**
 * Format date for Excel
 */
export function formatExcelDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return ''
  
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  
  return `${day}/${month}/${year}`
}

export default DataNormalizer
