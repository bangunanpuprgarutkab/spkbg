/**
 * CELL MAPPING SYSTEM
 * Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
 * 
 * Struktur mapping yang configurable antara data dan cell Excel
 */

import type { DataType } from '../template/mapping'

// ============================================================================
// TYPES
// ============================================================================

export interface CellMappingSchema {
  version: string
  templateId: string
  description?: string
  mappings: CellMappingEntry[]
  dynamicRanges: DynamicRangeConfig[]
  formulas: FormulaConfig[]
  styles?: StyleConfig[]
}

export interface CellMappingEntry {
  id: string
  cellAddress: string // "A1", "B2", etc
  sheetName: string
  jsonPath: string // dot notation path in JSON
  dbField: string
  dbTable: string
  dataType: DataType
  isRequired: boolean
  defaultValue?: any
  isFormula?: boolean
  formulaTemplate?: string
  dependsOn?: string[] // other mapping IDs this depends on
  validation?: CellValidationRule
  format?: CellFormat
}

export interface DynamicRangeConfig {
  id: string
  sheetName: string
  startCell: string
  endCell?: string
  direction: 'horizontal' | 'vertical'
  dataArrayPath: string // JSON path to array data
  itemMappings: ArrayItemMapping[]
  maxRows?: number
  maxCols?: number
}

export interface ArrayItemMapping {
  field: string
  offset: number // offset from startCell
  dataType: DataType
}

export interface FormulaConfig {
  id: string
  cellAddress: string
  sheetName: string
  formula: string
  dependsOn: string[] // cell addresses this formula references
  calculateOnExport: boolean
}

export interface CellValidationRule {
  type: 'required' | 'range' | 'enum' | 'regex' | 'custom'
  message?: string
  min?: number
  max?: number
  values?: any[]
  pattern?: string
  validator?: (value: any) => boolean
}

export interface CellFormat {
  numberFormat?: string
  dateFormat?: string
  font?: {
    bold?: boolean
    italic?: boolean
    size?: number
    color?: string
  }
  alignment?: 'left' | 'center' | 'right'
  fill?: {
    color: string
    pattern?: string
  }
}

export interface StyleConfig {
  cellRange: string
  sheetName: string
  preserve: boolean
}

export interface MappingContext {
  surveyId: string
  projectId: string
  templateId: string
  userId: string
  timestamp: string
  [key: string]: any
}

// ============================================================================
// PREDEFINED MAPPINGS FOR SPKBG
// ============================================================================

/**
 * Standard cell mapping untuk template SPKBG
 * BERDASARKAN template KemenPU yang sebenarnya
 */
export const SPKBG_CELL_MAPPING: CellMappingSchema = {
  version: '1.0.0',
  templateId: 'template_kemenpu_2024',
  description: 'Mapping untuk template Excel Penilaian Kerusakan Bangunan Gedung KemenPU',
  
  mappings: [
    // ============================================
    // HEADER INFO - Sheet "Data Umum"
    // ============================================
    {
      id: 'header-kode-survey',
      cellAddress: 'B4',
      sheetName: 'Data Umum',
      jsonPath: 'survey.kode_survey',
      dbField: 'kode_survey',
      dbTable: 'surveys',
      dataType: 'text',
      isRequired: true,
    },
    {
      id: 'header-tanggal-survey',
      cellAddress: 'B5',
      sheetName: 'Data Umum',
      jsonPath: 'survey.tanggal_survey',
      dbField: 'tanggal_survey',
      dbTable: 'surveys',
      dataType: 'date',
      isRequired: true,
      format: { dateFormat: 'DD/MM/YYYY' },
    },
    {
      id: 'header-nama-bangunan',
      cellAddress: 'B6',
      sheetName: 'Data Umum',
      jsonPath: 'project.nama_bangunan',
      dbField: 'nama_bangunan',
      dbTable: 'projects',
      dataType: 'text',
      isRequired: true,
    },
    {
      id: 'header-alamat',
      cellAddress: 'B7',
      sheetName: 'Data Umum',
      jsonPath: 'project.alamat',
      dbField: 'alamat',
      dbTable: 'projects',
      dataType: 'text',
      isRequired: true,
    },
    {
      id: 'header-jumlah-lantai',
      cellAddress: 'B8',
      sheetName: 'Data Umum',
      jsonPath: 'project.jumlah_lantai',
      dbField: 'jumlah_lantai',
      dbTable: 'projects',
      dataType: 'integer',
      isRequired: true,
    },
    {
      id: 'header-luas-bangunan',
      cellAddress: 'B9',
      sheetName: 'Data Umum',
      jsonPath: 'project.luas_bangunan',
      dbField: 'luas_bangunan',
      dbTable: 'projects',
      dataType: 'decimal',
      isRequired: false,
      format: { numberFormat: '#,##0.00' },
    },
    {
      id: 'header-fungsi-bangunan',
      cellAddress: 'B10',
      sheetName: 'Data Umum',
      jsonPath: 'project.fungsi_bangunan',
      dbField: 'fungsi_bangunan',
      dbTable: 'projects',
      dataType: 'text',
      isRequired: false,
    },
    {
      id: 'header-tahun-bangunan',
      cellAddress: 'B11',
      sheetName: 'Data Umum',
      jsonPath: 'project.tahun_bangunan',
      dbField: 'tahun_bangunan',
      dbTable: 'projects',
      dataType: 'integer',
      isRequired: false,
    },
    
    // ============================================
    // SURVEYOR INFO - Sheet "Data Umum"
    // ============================================
    {
      id: 'surveyor-nama',
      cellAddress: 'B14',
      sheetName: 'Data Umum',
      jsonPath: 'survey.surveyor_name',
      dbField: 'surveyor_id',
      dbTable: 'surveys',
      dataType: 'text',
      isRequired: true,
    },
    {
      id: 'surveyor-nip',
      cellAddress: 'B15',
      sheetName: 'Data Umum',
      jsonPath: 'survey.surveyor_nip',
      dbField: 'surveyor_nip',
      dbTable: 'surveys',
      dataType: 'text',
      isRequired: false,
    },
    {
      id: 'surveyor-instansi',
      cellAddress: 'B16',
      sheetName: 'Data Umum',
      jsonPath: 'survey.surveyor_instansi',
      dbField: 'surveyor_instansi',
      dbTable: 'surveys',
      dataType: 'text',
      isRequired: false,
    },
    
    // ============================================
    // SAFETY CHECKS - Sheet "Tahap 1"
    // ============================================
    {
      id: 'safety-kolom-patah',
      cellAddress: 'B5',
      sheetName: 'Tahap 1',
      jsonPath: 'survey.has_kolom_patah',
      dbField: 'has_kolom_patah',
      dbTable: 'surveys',
      dataType: 'boolean',
      isRequired: true,
    },
    {
      id: 'safety-pondasi-bergeser',
      cellAddress: 'B6',
      sheetName: 'Tahap 1',
      jsonPath: 'survey.has_pondasi_bergeser',
      dbField: 'has_pondasi_bergeser',
      dbTable: 'surveys',
      dataType: 'boolean',
      isRequired: true,
    },
    {
      id: 'safety-struktur-runtuh',
      cellAddress: 'B7',
      sheetName: 'Tahap 1',
      jsonPath: 'survey.has_struktur_runtuh',
      dbField: 'has_struktur_runtuh',
      dbTable: 'surveys',
      dataType: 'boolean',
      isRequired: true,
    },
    
    // ============================================
    // HASIL PERHITUNGAN - Sheet "Hasil"
    // ============================================
    {
      id: 'hasil-total-kerusakan',
      cellAddress: 'C10',
      sheetName: 'Hasil',
      jsonPath: 'results.total_kerusakan',
      dbField: 'total_kerusakan',
      dbTable: 'results',
      dataType: 'decimal',
      isRequired: false,
      isFormula: false,
      format: { numberFormat: '0.0000' },
    },
    {
      id: 'hasil-kategori',
      cellAddress: 'C11',
      sheetName: 'Hasil',
      jsonPath: 'results.kategori_kerusakan',
      dbField: 'kategori_kerusakan',
      dbTable: 'results',
      dataType: 'text',
      isRequired: false,
    },
    {
      id: 'hasil-is-critical',
      cellAddress: 'C12',
      sheetName: 'Hasil',
      jsonPath: 'results.is_critical',
      dbField: 'is_critical',
      dbTable: 'results',
      dataType: 'boolean',
      isRequired: false,
    },
    {
      id: 'hasil-struktur',
      cellAddress: 'C15',
      sheetName: 'Hasil',
      jsonPath: 'results.total_kerusakan_struktur',
      dbField: 'total_kerusakan_struktur',
      dbTable: 'results',
      dataType: 'decimal',
      isRequired: false,
      format: { numberFormat: '0.0000' },
    },
    {
      id: 'hasil-arsitektur',
      cellAddress: 'C16',
      sheetName: 'Hasil',
      jsonPath: 'results.total_kerusakan_arsitektur',
      dbField: 'total_kerusakan_arsitektur',
      dbTable: 'results',
      dataType: 'decimal',
      isRequired: false,
      format: { numberFormat: '0.0000' },
    },
    {
      id: 'hasil-utilitas',
      cellAddress: 'C17',
      sheetName: 'Hasil',
      jsonPath: 'results.total_kerusakan_utilitas',
      dbField: 'total_kerusakan_utilitas',
      dbTable: 'results',
      dataType: 'decimal',
      isRequired: false,
      format: { numberFormat: '0.0000' },
    },
    {
      id: 'hasil-finishing',
      cellAddress: 'C18',
      sheetName: 'Hasil',
      jsonPath: 'results.total_kerusakan_finishing',
      dbField: 'total_kerusakan_finishing',
      dbTable: 'results',
      dataType: 'decimal',
      isRequired: false,
      format: { numberFormat: '0.0000' },
    },
    
    // ============================================
    // APPROVAL INFO - Sheet "Hasil"
    // ============================================
    {
      id: 'approval-nama',
      cellAddress: 'B25',
      sheetName: 'Hasil',
      jsonPath: 'approval.approver_name',
      dbField: 'approved_by',
      dbTable: 'results',
      dataType: 'text',
      isRequired: false,
    },
    {
      id: 'approval-nip',
      cellAddress: 'B26',
      sheetName: 'Hasil',
      jsonPath: 'approval.approver_nip',
      dbField: 'approver_nip',
      dbTable: 'results',
      dataType: 'text',
      isRequired: false,
    },
    {
      id: 'approval-tanggal',
      cellAddress: 'B27',
      sheetName: 'Hasil',
      jsonPath: 'approval.approved_at',
      dbField: 'approved_at',
      dbTable: 'results',
      dataType: 'date',
      isRequired: false,
    },
  ],
  
  // ============================================
  // DYNAMIC RANGES - Komponen
  // ============================================
  dynamicRanges: [
    {
      id: 'komponen-struktur',
      sheetName: 'Struktur',
      startCell: 'A10',
      direction: 'vertical',
      dataArrayPath: 'components.struktur',
      itemMappings: [
        { field: 'kode_komponen', offset: 0, dataType: 'text' },
        { field: 'nama_komponen', offset: 1, dataType: 'text' },
        { field: 'satuan', offset: 2, dataType: 'text' },
        { field: 'volume_total', offset: 3, dataType: 'decimal' },
        { field: 'volume_rusak', offset: 4, dataType: 'decimal' },
        { field: 'klasifikasi', offset: 5, dataType: 'text' },
        { field: 'bobot_komponen', offset: 6, dataType: 'decimal' },
        { field: 'nilai_hasil', offset: 7, dataType: 'decimal' },
      ],
      maxRows: 50,
    },
    {
      id: 'komponen-arsitektur',
      sheetName: 'Arsitektur',
      startCell: 'A10',
      direction: 'vertical',
      dataArrayPath: 'components.arsitektur',
      itemMappings: [
        { field: 'kode_komponen', offset: 0, dataType: 'text' },
        { field: 'nama_komponen', offset: 1, dataType: 'text' },
        { field: 'satuan', offset: 2, dataType: 'text' },
        { field: 'volume_total', offset: 3, dataType: 'decimal' },
        { field: 'volume_rusak', offset: 4, dataType: 'decimal' },
        { field: 'klasifikasi', offset: 5, dataType: 'text' },
        { field: 'bobot_komponen', offset: 6, dataType: 'decimal' },
        { field: 'nilai_hasil', offset: 7, dataType: 'decimal' },
      ],
      maxRows: 50,
    },
    {
      id: 'komponen-finishing',
      sheetName: 'Finishing',
      startCell: 'A10',
      direction: 'vertical',
      dataArrayPath: 'components.finishing',
      itemMappings: [
        { field: 'kode_komponen', offset: 0, dataType: 'text' },
        { field: 'nama_komponen', offset: 1, dataType: 'text' },
        { field: 'satuan', offset: 2, dataType: 'text' },
        { field: 'volume_total', offset: 3, dataType: 'decimal' },
        { field: 'volume_rusak', offset: 4, dataType: 'decimal' },
        { field: 'klasifikasi', offset: 5, dataType: 'text' },
        { field: 'bobot_komponen', offset: 6, dataType: 'decimal' },
        { field: 'nilai_hasil', offset: 7, dataType: 'decimal' },
      ],
      maxRows: 50,
    },
    {
      id: 'komponen-utilitas',
      sheetName: 'Utilitas',
      startCell: 'A10',
      direction: 'vertical',
      dataArrayPath: 'components.utilitas',
      itemMappings: [
        { field: 'kode_komponen', offset: 0, dataType: 'text' },
        { field: 'nama_komponen', offset: 1, dataType: 'text' },
        { field: 'satuan', offset: 2, dataType: 'text' },
        { field: 'volume_total', offset: 3, dataType: 'decimal' },
        { field: 'volume_rusak', offset: 4, dataType: 'decimal' },
        { field: 'klasifikasi', offset: 5, dataType: 'text' },
        { field: 'bobot_komponen', offset: 6, dataType: 'decimal' },
        { field: 'nilai_hasil', offset: 7, dataType: 'decimal' },
      ],
      maxRows: 50,
    },
  ],
  
  // ============================================
  // FORMULAS
  // ============================================
  formulas: [
    {
      id: 'formula-nilai-komponen',
      cellAddress: 'H10',
      sheetName: 'Struktur',
      formula: '=(D10/C10)*F10*G10',
      dependsOn: ['D10', 'C10', 'F10', 'G10'],
      calculateOnExport: false, // Sudah dihitung di backend
    },
    {
      id: 'formula-total-struktur',
      cellAddress: 'C15',
      sheetName: 'Hasil',
      formula: '=SUM(Struktur!H10:H59)',
      dependsOn: ['Struktur!H10:H59'],
      calculateOnExport: true,
    },
    {
      id: 'formula-total-keseluruhan',
      cellAddress: 'C10',
      sheetName: 'Hasil',
      formula: '=C15+C16+C17+C18',
      dependsOn: ['C15', 'C16', 'C17', 'C18'],
      calculateOnExport: true,
    },
  ],
}

// ============================================================================
// CELL MAPPING MANAGER
// ============================================================================

export class CellMappingManager {
  private schema: CellMappingSchema

  constructor(schema: CellMappingSchema = SPKBG_CELL_MAPPING) {
    this.schema = schema
  }

  /**
   * Get mapping by ID
   */
  getMappingById(id: string): CellMappingEntry | undefined {
    return this.schema.mappings.find(m => m.id === id)
  }

  /**
   * Get mapping by cell address
   */
  getMappingByCell(sheetName: string, cellAddress: string): CellMappingEntry | undefined {
    return this.schema.mappings.find(
      m => m.sheetName === sheetName && m.cellAddress === cellAddress
    )
  }

  /**
   * Get mapping by JSON path
   */
  getMappingByJsonPath(jsonPath: string): CellMappingEntry | undefined {
    return this.schema.mappings.find(m => m.jsonPath === jsonPath)
  }

  /**
   * Get all mappings for a sheet
   */
  getMappingsForSheet(sheetName: string): CellMappingEntry[] {
    return this.schema.mappings.filter(m => m.sheetName === sheetName)
  }

  /**
   * Get all mappings for a database table
   */
  getMappingsForTable(tableName: string): CellMappingEntry[] {
    return this.schema.mappings.filter(m => m.dbTable === tableName)
  }

  /**
   * Get dynamic range config
   */
  getDynamicRange(id: string): DynamicRangeConfig | undefined {
    return this.schema.dynamicRanges.find(r => r.id === id)
  }

  /**
   * Get all dynamic ranges
   */
  getAllDynamicRanges(): DynamicRangeConfig[] {
    return this.schema.dynamicRanges
  }

  /**
   * Resolve cell address from JSON path
   */
  resolveCellAddress(jsonPath: string): { sheet: string; cell: string } | null {
    const mapping = this.getMappingByJsonPath(jsonPath)
    if (!mapping) return null
    
    return {
      sheet: mapping.sheetName,
      cell: mapping.cellAddress,
    }
  }

  /**
   * Resolve JSON path from cell address
   */
  resolveJsonPath(sheetName: string, cellAddress: string): string | null {
    const mapping = this.getMappingByCell(sheetName, cellAddress)
    return mapping ? mapping.jsonPath : null
  }

  /**
   * Get required fields
   */
  getRequiredFields(): CellMappingEntry[] {
    return this.schema.mappings.filter(m => m.isRequired)
  }

  /**
   * Validate data completeness
   */
  validateDataCompleteness(data: Record<string, any>): {
    valid: boolean
    missing: string[]
  } {
    const required = this.getRequiredFields()
    const missing: string[] = []

    required.forEach(field => {
      const value = this.getNestedValue(data, field.jsonPath)
      if (value === undefined || value === null || value === '') {
        missing.push(field.jsonPath)
      }
    })

    return {
      valid: missing.length === 0,
      missing,
    }
  }

  /**
   * Generate cell mappings from data
   */
  generateCellMappings(data: Record<string, any>): Array<{
    sheet: string
    cell: string
    value: any
    dataType: DataType
  }> {
    const mappings: Array<{
      sheet: string
      cell: string
      value: any
      dataType: DataType
    }> = []

    this.schema.mappings.forEach(mapping => {
      const value = this.getNestedValue(data, mapping.jsonPath)
      if (value !== undefined && value !== null) {
        mappings.push({
          sheet: mapping.sheetName,
          cell: mapping.cellAddress,
          value,
          dataType: mapping.dataType,
        })
      }
    })

    // Process dynamic ranges
    this.schema.dynamicRanges.forEach(range => {
      const arrayData = this.getNestedValue(data, range.dataArrayPath)
      if (Array.isArray(arrayData)) {
        arrayData.forEach((item, index) => {
          const rowOffset = range.direction === 'vertical' ? index : 0
          const colOffset = range.direction === 'horizontal' ? index : 0
          
          range.itemMappings.forEach(itemMapping => {
            const cell = this.offsetCell(range.startCell, 
              range.direction === 'vertical' ? itemMapping.offset : 0,
              range.direction === 'horizontal' ? itemMapping.offset : 0,
              rowOffset,
              colOffset
            )
            
            const value = item[itemMapping.field]
            if (value !== undefined) {
              mappings.push({
                sheet: range.sheetName,
                cell,
                value,
                dataType: itemMapping.dataType,
              })
            }
          })
        })
      }
    })

    return mappings
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    const keys = path.split('.')
    let current = obj

    for (const key of keys) {
      if (current === null || current === undefined) return undefined
      
      // Handle array notation
      const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/)
      if (arrayMatch) {
        const arr = current[arrayMatch[1]]
        current = arr ? arr[parseInt(arrayMatch[2])] : undefined
      } else {
        current = current[key]
      }
    }

    return current
  }

  /**
   * Calculate offset cell address
   */
  private offsetCell(
    startCell: string, 
    colOffset: number, 
    rowOffsetBase: number,
    additionalRow: number,
    additionalCol: number
  ): string {
    const match = startCell.match(/^([A-Z]+)(\d+)$/)
    if (!match) return startCell

    const colLetters = match[1]
    const startRow = parseInt(match[2])

    // Convert column letters to index
    let colIndex = 0
    for (let i = 0; i < colLetters.length; i++) {
      colIndex = colIndex * 26 + (colLetters.charCodeAt(i) - 64)
    }

    // Apply offsets
    const finalRow = startRow + rowOffsetBase + additionalRow
    const finalCol = colIndex + colOffset + additionalCol

    // Convert back to letters
    let finalColLetters = ''
    let n = finalCol
    do {
      finalColLetters = String.fromCharCode(65 + ((n - 1) % 26)) + finalColLetters
      n = Math.floor((n - 1) / 26)
    } while (n > 0)

    return `${finalColLetters}${finalRow}`
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create custom mapping schema
 */
export function createMappingSchema(
  templateId: string,
  version: string,
  mappings: CellMappingEntry[]
): CellMappingSchema {
  return {
    version,
    templateId,
    mappings,
    dynamicRanges: [],
    formulas: [],
  }
}

/**
 * Merge multiple mapping schemas
 */
export function mergeMappingSchemas(...schemas: CellMappingSchema[]): CellMappingSchema {
  const merged: CellMappingSchema = {
    version: 'merged',
    templateId: 'merged',
    mappings: [],
    dynamicRanges: [],
    formulas: [],
  }

  schemas.forEach(schema => {
    merged.mappings.push(...schema.mappings)
    merged.dynamicRanges.push(...schema.dynamicRanges)
    merged.formulas.push(...schema.formulas)
  })

  return merged
}

/**
 * Validate cell address format
 */
export function isValidCellAddress(address: string): boolean {
  return /^[A-Z]+\d+$/.test(address)
}

/**
 * Convert column number to letter
 */
export function columnNumberToLetter(col: number): string {
  let result = ''
  let n = col
  do {
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result
    n = Math.floor((n - 1) / 26)
  } while (n > 0)
  return result
}

/**
 * Convert column letter to number
 */
export function columnLetterToNumber(letters: string): number {
  let result = 0
  for (let i = 0; i < letters.length; i++) {
    result = result * 26 + (letters.charCodeAt(i) - 64)
  }
  return result
}

export default CellMappingManager
