/**
 * VALIDATION SYSTEM MODULE
 * Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
 * 
 * Fungsi: Validasi data sebelum export dengan aturan berbasis template
 */

import type { CellValidationRule } from './cellMapping'

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationContext {
  surveyId: string
  templateId: string
  version: string
  data: Record<string, any>
}

export interface ValidationIssue {
  type: 'error' | 'warning'
  code: string
  field: string
  message: string
  value?: any
  expected?: any
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  canProceed: boolean
}

export interface ValidationRuleSet {
  rules: ValidationRule[]
  strict: boolean // if true, warnings also block proceed
}

export interface ValidationRule {
  id: string
  name: string
  description: string
  check: (context: ValidationContext) => ValidationIssue | null
  severity: 'error' | 'warning'
}

export interface ComponentValidation {
  totalVolume: number
  damagedVolume: number
  classification: string
  ratio: number
  isValid: boolean
  issues: string[]
}

// ============================================================================
// VALIDATOR CLASS
// ============================================================================

export class ExportValidator {
  private rules: ValidationRule[]

  constructor() {
    this.rules = this.getDefaultRules()
  }

  /**
   * Validate export data
   */
  validate(context: ValidationContext): ValidationResult {
    const errors: ValidationIssue[] = []
    const warnings: ValidationIssue[] = []

    this.rules.forEach((rule) => {
      const issue = rule.check(context)
      if (issue) {
        if (issue.type === 'error') {
          errors.push(issue)
        } else {
          warnings.push(issue)
        }
      }
    })

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      canProceed: errors.length === 0,
    }
  }

  /**
   * Get default validation rules
   */
  private getDefaultRules(): ValidationRule[] {
    return [
      // Check project name
      {
        id: 'project-name-required',
        name: 'Nama Bangunan Wajib',
        description: 'Nama bangunan harus diisi',
        severity: 'error',
        check: (ctx) => {
          const name = ctx.data.project?.nama_bangunan
          if (!name || String(name).trim() === '') {
            return {
              type: 'error',
              code: 'PROJECT_NAME_REQUIRED',
              field: 'project.nama_bangunan',
              message: 'Nama bangunan wajib diisi',
            }
          }
          return null
        },
      },

      // Check project address
      {
        id: 'project-address-required',
        name: 'Alamat Wajib',
        description: 'Alamat bangunan harus diisi',
        severity: 'error',
        check: (ctx) => {
          const address = ctx.data.project?.alamat
          if (!address || String(address).trim() === '') {
            return {
              type: 'error',
              code: 'PROJECT_ADDRESS_REQUIRED',
              field: 'project.alamat',
              message: 'Alamat bangunan wajib diisi',
            }
          }
          return null
        },
      },

      // Check jumlah lantai
      {
        id: 'jumlah-lantai-valid',
        name: 'Jumlah Lantai Valid',
        description: 'Jumlah lantai minimal 1',
        severity: 'error',
        check: (ctx) => {
          const lantai = parseInt(ctx.data.project?.jumlah_lantai)
          if (isNaN(lantai) || lantai < 1) {
            return {
              type: 'error',
              code: 'JUMLAH_LANTAI_INVALID',
              field: 'project.jumlah_lantai',
              message: 'Jumlah lantai minimal 1',
              value: ctx.data.project?.jumlah_lantai,
            }
          }
          return null
        },
      },

      // Check survey code
      {
        id: 'survey-code-required',
        name: 'Kode Survey Wajib',
        description: 'Kode survey harus diisi',
        severity: 'error',
        check: (ctx) => {
          const code = ctx.data.survey?.kode_survey
          if (!code || String(code).trim() === '') {
            return {
              type: 'error',
              code: 'SURVEY_CODE_REQUIRED',
              field: 'survey.kode_survey',
              message: 'Kode survey wajib diisi',
            }
          }
          return null
        },
      },

      // Check survey date
      {
        id: 'survey-date-valid',
        name: 'Tanggal Survey Valid',
        description: 'Tanggal survey harus valid',
        severity: 'error',
        check: (ctx) => {
          const dateStr = ctx.data.survey?.tanggal_survey
          if (!dateStr) {
            return {
              type: 'error',
              code: 'SURVEY_DATE_REQUIRED',
              field: 'survey.tanggal_survey',
              message: 'Tanggal survey wajib diisi',
            }
          }
          const date = new Date(dateStr)
          if (isNaN(date.getTime())) {
            return {
              type: 'error',
              code: 'SURVEY_DATE_INVALID',
              field: 'survey.tanggal_survey',
              message: 'Format tanggal tidak valid',
              value: dateStr,
            }
          }
          return null
        },
      },

      // Check surveyor
      {
        id: 'surveyor-required',
        name: 'Surveyor Wajib',
        description: 'Nama surveyor harus diisi',
        severity: 'error',
        check: (ctx) => {
          const surveyor = ctx.data.survey?.surveyor_name
          if (!surveyor || String(surveyor).trim() === '') {
            return {
              type: 'error',
              code: 'SURVEYOR_REQUIRED',
              field: 'survey.surveyor_name',
              message: 'Nama surveyor wajib diisi',
            }
          }
          return null
        },
      },

      // Check components exist
      {
        id: 'components-exist',
        name: 'Komponen Ada',
        description: 'Minimal harus ada data komponen',
        severity: 'warning',
        check: (ctx) => {
          const components = ctx.data.components
          if (!components || components.length === 0) {
            return {
              type: 'warning',
              code: 'NO_COMPONENTS',
              field: 'components',
              message: 'Tidak ada data komponen, hasil akan kosong',
            }
          }
          return null
        },
      },

      // Check results calculated
      {
        id: 'results-calculated',
        name: 'Hasil Terhitung',
        description: 'Hasil perhitungan harus sudah tersedia',
        severity: 'warning',
        check: (ctx) => {
          const total = ctx.data.results?.total_kerusakan
          if (total === undefined || total === null) {
            return {
              type: 'warning',
              code: 'RESULTS_NOT_CALCULATED',
              field: 'results.total_kerusakan',
              message: 'Hasil perhitungan belum tersedia',
            }
          }
          return null
        },
      },

      // Check total damage in valid range
      {
        id: 'total-damage-valid',
        name: 'Total Kerusakan Valid',
        description: 'Total kerusakan harus antara 0-100',
        severity: 'error',
        check: (ctx) => {
          const total = parseFloat(ctx.data.results?.total_kerusakan)
          if (!isNaN(total) && (total < 0 || total > 100)) {
            return {
              type: 'error',
              code: 'TOTAL_DAMAGE_INVALID',
              field: 'results.total_kerusakan',
              message: 'Total kerusakan harus antara 0-100',
              value: total,
            }
          }
          return null
        },
      },

      // Check if approved (for final export)
      {
        id: 'check-approved',
        name: 'Status Disetujui',
        description: 'Survey sebaiknya sudah disetujui',
        severity: 'warning',
        check: (ctx) => {
          const status = ctx.data.survey?.status
          if (status !== 'disetujui') {
            return {
              type: 'warning',
              code: 'NOT_APPROVED',
              field: 'survey.status',
              message: `Survey belum disetujui (status: ${status})`,
              value: status,
            }
          }
          return null
        },
      },
    ]
  }

  /**
   * Add custom rule
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule)
  }

  /**
   * Validate components
   */
  validateComponents(components: any[]): ComponentValidation[] {
    return components.map((comp) => {
      const issues: string[] = []
      
      const volTotal = parseFloat(comp.volume_total) || 0
      const volRusak = parseFloat(comp.volume_rusak) || 0
      const klasifikasi = String(comp.klasifikasi || '').trim()

      // Check volumes
      if (volTotal <= 0) {
        issues.push('Volume total harus > 0')
      }

      if (volRusak < 0) {
        issues.push('Volume rusak tidak boleh negatif')
      }

      if (volRusak > volTotal) {
        issues.push('Volume rusak tidak boleh melebihi volume total')
      }

      // Check klasifikasi
      if (!/^[1-7]$/.test(klasifikasi)) {
        issues.push('Klasifikasi harus 1-7')
      }

      // Check ratio
      const ratio = volTotal > 0 ? volRusak / volTotal : 0

      return {
        totalVolume: volTotal,
        damagedVolume: volRusak,
        classification: klasifikasi,
        ratio,
        isValid: issues.length === 0,
        issues,
      }
    })
  }
}

// ============================================================================
// CELL VALIDATION
// ============================================================================

/**
 * Validate single cell value
 */
export function validateCellValue(
  value: any,
  rule: CellValidationRule,
  fieldName: string
): { valid: boolean; message?: string } {
  switch (rule.type) {
    case 'required':
      if (value === undefined || value === null || String(value).trim() === '') {
        return { valid: false, message: rule.message || `${fieldName} wajib diisi` }
      }
      return { valid: true }

    case 'range':
      const num = parseFloat(value)
      if (isNaN(num)) {
        return { valid: false, message: rule.message || `${fieldName} harus angka` }
      }
      if (rule.min !== undefined && num < rule.min) {
        return { valid: false, message: rule.message || `${fieldName} minimal ${rule.min}` }
      }
      if (rule.max !== undefined && num > rule.max) {
        return { valid: false, message: rule.message || `${fieldName} maksimal ${rule.max}` }
      }
      return { valid: true }

    case 'enum':
      if (rule.values && !rule.values.includes(value)) {
        return { valid: false, message: rule.message || `${fieldName} tidak valid` }
      }
      return { valid: true }

    case 'regex':
      if (rule.pattern && !new RegExp(rule.pattern).test(String(value))) {
        return { valid: false, message: rule.message || `${fieldName} format tidak valid` }
      }
      return { valid: true }

    case 'custom':
      if (rule.validator && !rule.validator(value)) {
        return { valid: false, message: rule.message || `${fieldName} tidak valid` }
      }
      return { valid: true }

    default:
      return { valid: true }
  }
}

// ============================================================================
// QUICK VALIDATION FUNCTIONS
// ============================================================================

/**
 * Quick validate for export
 */
export function quickValidate(data: Record<string, any>): ValidationResult {
  const validator = new ExportValidator()
  return validator.validate({
    surveyId: data.survey?.id || '',
    templateId: data.survey?.template_id || '',
    version: '1.0.0',
    data,
  })
}

/**
 * Check if can export
 */
export function canExport(data: Record<string, any>): boolean {
  const result = quickValidate(data)
  return result.canProceed
}

/**
 * Get validation summary
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.valid && result.warnings.length === 0) {
    return 'Data valid, siap export'
  }

  const parts: string[] = []
  
  if (result.errors.length > 0) {
    parts.push(`${result.errors.length} error`)
  }
  
  if (result.warnings.length > 0) {
    parts.push(`${result.warnings.length} warning`)
  }

  return parts.join(', ')
}

/**
 * Pre-flight check before export
 */
export function preflightCheck(data: Record<string, any>): {
  ready: boolean
  issues: string[]
  suggestions: string[]
} {
  const issues: string[] = []
  const suggestions: string[] = []

  // Critical checks
  if (!data.project?.nama_bangunan) {
    issues.push('Nama bangunan belum diisi')
  }

  if (!data.survey?.kode_survey) {
    issues.push('Kode survey belum diisi')
  }

  if (!data.survey?.tanggal_survey) {
    issues.push('Tanggal survey belum diisi')
  }

  if (!data.survey?.surveyor_name) {
    issues.push('Nama surveyor belum diisi')
  }

  // Component check
  const components = data.components || []
  if (components.length === 0) {
    issues.push('Belum ada data komponen')
  } else {
    const incomplete = components.filter((c: any) => 
      !c.volume_total || !c.volume_rusak || !c.klasifikasi
    )
    if (incomplete.length > 0) {
      suggestions.push(`${incomplete.length} komponen belum lengkap`)
    }
  }

  // Results check
  if (!data.results?.total_kerusakan) {
    suggestions.push('Hasil perhitungan belum tersedia')
  }

  return {
    ready: issues.length === 0,
    issues,
    suggestions,
  }
}

export default ExportValidator
