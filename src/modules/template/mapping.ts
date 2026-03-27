/**
 * TEMPLATE MAPPING ENGINE
 * Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
 * 
 * Fungsi: Menangani konversi antara Excel ↔ JSON ↔ Database
 * Rule: Mapping harus fleksibel dan tidak hardcode
 */

import type { ParsedTemplate, ValidationRule } from './parser'

// ============================================================================
// TYPES
// ============================================================================

export interface MappingEngine {
  templateId: string
  version: string
  mappings: FieldMapping[]
  sheetMappings: SheetMapping[]
  cellMappings: CellMapping[]
}

export interface FieldMapping {
  id: string
  excelField: string
  jsonField: string
  dbField: string
  dbTable: string
  dataType: DataType
  isRequired: boolean
  defaultValue?: any
  transformations?: Transformation[]
  validation?: ValidationRule
}

export type DataType = 
  | 'text' 
  | 'number' 
  | 'integer' 
  | 'decimal' 
  | 'boolean' 
  | 'date' 
  | 'datetime' 
  | 'enum' 
  | 'array' 
  | 'json' 
  | 'uuid' 
  | 'code'

export interface Transformation {
  type: 'trim' | 'uppercase' | 'lowercase' | 'replace' | 'format' | 'calculate' | 'lookup'
  params?: Record<string, any>
}

export interface SheetMapping {
  sheetName: string
  sheetIndex: number
  entityType: 'project' | 'survey' | 'component' | 'result' | 'metadata'
  headerRow: number
  dataStartRow: number
  mappings: FieldMapping[]
}

export interface CellMapping {
  id: string
  sheetName: string
  cellAddress: string
  jsonPath: string
  dbField: string
  dataType: DataType
  isFormula?: boolean
  formulaTemplate?: string
}

export interface MappedData {
  excel: Record<string, any>
  json: Record<string, any>
  db: Record<string, any>
  metadata: {
    templateId: string
    version: string
    mappedAt: string
    validationErrors?: ValidationError[]
  }
}

export interface ValidationError {
  field: string
  value: any
  rule: string
  message: string
}

export interface DBRecord {
  table: string
  fields: Record<string, any>
  relations?: DBRecord[]
}

// ============================================================================
// MAPPING ENGINE CLASS
// ============================================================================

export class TemplateMappingEngine {
  private mapping: MappingEngine
  private parsedTemplate: ParsedTemplate | null = null

  constructor(mapping: MappingEngine) {
    this.mapping = mapping
  }

  /**
   * Set parsed template reference
   */
  setTemplate(template: ParsedTemplate): void {
    this.parsedTemplate = template
  }

  /**
   * Get parsed template reference
   */
  getTemplate(): ParsedTemplate | null {
    return this.parsedTemplate
  }

  // ============================================================================
  // EXCEL → JSON
  // ============================================================================

  /**
   * Convert Excel data to JSON format
   */
  mapExcelToJSON(excelData: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {}

    this.mapping.mappings.forEach((fieldMapping) => {
      const excelValue = this.getNestedValue(excelData, fieldMapping.excelField)
      const transformedValue = this.applyTransformations(excelValue, fieldMapping.transformations)
      
      this.setNestedValue(result, fieldMapping.jsonField, transformedValue)
    })

    return result
  }

  /**
   * Convert Excel data to JSON with sheet structure preserved
   */
  mapSheetsToJSON(sheetData: Record<string, Record<string, any>[]>): Record<string, any> {
    const result: Record<string, any> = {
      sheets: {},
      metadata: {
        templateId: this.mapping.templateId,
        version: this.mapping.version,
        mappedAt: new Date().toISOString(),
      }
    }

    this.mapping.sheetMappings.forEach((sheetMapping) => {
      const sheetName = sheetMapping.sheetName
      const rows = sheetData[sheetName] || []
      
      result.sheets[sheetName] = rows.map((row, index) => {
        const mappedRow: Record<string, any> = {
          _rowIndex: index + sheetMapping.dataStartRow,
        }

        sheetMapping.mappings.forEach((fieldMapping) => {
          const excelField = fieldMapping.excelField
          const value = row[excelField]
          const transformedValue = this.applyTransformations(value, fieldMapping.transformations)
          
          this.setNestedValue(mappedRow, fieldMapping.jsonField, transformedValue)
        })

        return mappedRow
      })
    })

    return result
  }

  // ============================================================================
  // JSON → DATABASE
  // ============================================================================

  /**
   * Convert JSON to database record format
   */
  mapJSONToDB(jsonData: Record<string, any>): DBRecord[] {
    const records: DBRecord[] = []

    // Map projects
    const projectRecord = this.createDBRecord('projects', jsonData, this.getMappingsForTable('projects'))
    if (projectRecord) records.push(projectRecord)

    // Map surveys
    const surveyRecord = this.createDBRecord('surveys', jsonData, this.getMappingsForTable('surveys'))
    if (surveyRecord) records.push(surveyRecord)

    // Map components (array)
    const componentMappings = this.getMappingsForTable('components')
    if (jsonData.components && Array.isArray(jsonData.components)) {
      jsonData.components.forEach((component: any, index: number) => {
        const componentRecord = this.createDBRecord('components', component, componentMappings)
        if (componentRecord) {
          componentRecord.fields.urutan = index + 1
          records.push(componentRecord)
        }
      })
    }

    // Map results
    const resultRecord = this.createDBRecord('results', jsonData, this.getMappingsForTable('results'))
    if (resultRecord) records.push(resultRecord)

    return records
  }

  /**
   * Create a single DB record from JSON data
   */
  private createDBRecord(
    table: string, 
    jsonData: Record<string, any>, 
    mappings: FieldMapping[]
  ): DBRecord | null {
    const fields: Record<string, any> = {}
    let hasData = false

    mappings.forEach((mapping) => {
      const value = this.getNestedValue(jsonData, mapping.jsonField)
      if (value !== undefined && value !== null) {
        fields[mapping.dbField] = this.convertToDBType(value, mapping.dataType)
        hasData = true
      } else if (mapping.defaultValue !== undefined) {
        fields[mapping.dbField] = mapping.defaultValue
      }
    })

    return hasData ? { table, fields } : null
  }

  /**
   * Get mappings for specific database table
   */
  private getMappingsForTable(table: string): FieldMapping[] {
    return this.mapping.mappings.filter(m => m.dbTable === table)
  }

  // ============================================================================
  // DATABASE → JSON
  // ============================================================================

  /**
   * Convert database records to JSON format
   */
  mapDBToJSON(records: DBRecord[]): Record<string, any> {
    const result: Record<string, any> = {}

    records.forEach((record) => {
      const tableMappings = this.getMappingsForTable(record.table)
      
      tableMappings.forEach((mapping) => {
        const dbValue = record.fields[mapping.dbField]
        if (dbValue !== undefined) {
          const convertedValue = this.convertFromDBType(dbValue, mapping.dataType)
          this.setNestedValue(result, mapping.jsonField, convertedValue)
        }
      })
    })

    return result
  }

  // ============================================================================
  // JSON → EXCEL (For Export)
  // ============================================================================

  /**
   * Convert JSON to Excel-ready format using cell mappings
   */
  mapJSONToExcelCells(jsonData: Record<string, any>): Record<string, CellValue> {
    const cellValues: Record<string, CellValue> = {}

    this.mapping.cellMappings.forEach((cellMapping) => {
      const value = this.getNestedValue(jsonData, cellMapping.jsonPath)
      
      if (value !== undefined && value !== null) {
        const cellAddress = cellMapping.cellAddress
        const sheetName = cellMapping.sheetName
        const fullAddress = `${sheetName}!${cellAddress}`
        
        cellValues[fullAddress] = {
          address: cellAddress,
          sheet: sheetName,
          value: this.convertToExcelType(value, cellMapping.dataType),
          type: cellMapping.dataType,
          isFormula: cellMapping.isFormula,
          formula: cellMapping.isFormula && cellMapping.formulaTemplate 
            ? this.interpolateFormula(cellMapping.formulaTemplate, jsonData)
            : undefined,
        }
      }
    })

    return cellValues
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) return undefined
      
      // Handle array notation like 'components[0].name'
      const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/)
      if (arrayMatch) {
        const arr = current[arrayMatch[1]]
        return arr ? arr[parseInt(arrayMatch[2])] : undefined
      }
      
      return current[key]
    }, obj)
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: Record<string, any>, path: string, value: any): void {
    const keys = path.split('.')
    let current = obj

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/)
      
      if (arrayMatch) {
        const arrKey = arrayMatch[1]
        const index = parseInt(arrayMatch[2])
        if (!current[arrKey]) current[arrKey] = []
        if (!current[arrKey][index]) current[arrKey][index] = {}
        current = current[arrKey][index]
      } else {
        if (!current[key]) current[key] = {}
        current = current[key]
      }
    }

    const lastKey = keys[keys.length - 1]
    const lastArrayMatch = lastKey.match(/^(\w+)\[(\d+)\]$/)
    
    if (lastArrayMatch) {
      const arrKey = lastArrayMatch[1]
      const index = parseInt(lastArrayMatch[2])
      if (!current[arrKey]) current[arrKey] = []
      current[arrKey][index] = value
    } else {
      current[lastKey] = value
    }
  }

  /**
   * Apply transformations to value
   */
  private applyTransformations(value: any, transformations?: Transformation[]): any {
    if (!transformations || value === null || value === undefined) {
      return value
    }

    let result = value

    transformations.forEach((t) => {
      switch (t.type) {
        case 'trim':
          result = typeof result === 'string' ? result.trim() : result
          break
        case 'uppercase':
          result = typeof result === 'string' ? result.toUpperCase() : result
          break
        case 'lowercase':
          result = typeof result === 'string' ? result.toLowerCase() : result
          break
        case 'replace':
          if (typeof result === 'string' && t.params) {
            const { search, replace } = t.params
            result = result.replace(new RegExp(search, 'g'), replace)
          }
          break
        case 'format':
          if (t.params && t.params.format) {
            result = this.formatValue(result, t.params.format)
          }
          break
        case 'calculate':
          if (t.params && t.params.formula) {
            result = this.calculateValue(result, t.params.formula)
          }
          break
        case 'lookup':
          if (t.params && t.params.map) {
            result = t.params.map[result] ?? result
          }
          break
      }
    })

    return result
  }

  /**
   * Convert value to database type
   */
  private convertToDBType(value: any, dataType: DataType): any {
    switch (dataType) {
      case 'text':
        return String(value)
      case 'number':
      case 'decimal':
        return parseFloat(value) || 0
      case 'integer':
        return parseInt(value) || 0
      case 'boolean':
        return Boolean(value)
      case 'date':
        return value instanceof Date ? value.toISOString().split('T')[0] : value
      case 'datetime':
        return value instanceof Date ? value.toISOString() : value
      case 'json':
        return typeof value === 'string' ? value : JSON.stringify(value)
      case 'uuid':
        return String(value)
      case 'code':
        return String(value).toUpperCase()
      default:
        return value
    }
  }

  /**
   * Convert value from database type
   */
  private convertFromDBType(value: any, dataType: DataType): any {
    switch (dataType) {
      case 'number':
      case 'decimal':
        return parseFloat(value) || 0
      case 'integer':
        return parseInt(value) || 0
      case 'boolean':
        return Boolean(value)
      case 'date':
        return new Date(value)
      case 'json':
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      default:
        return value
    }
  }

  /**
   * Convert value to Excel type
   */
  private convertToExcelType(value: any, dataType: DataType): any {
    switch (dataType) {
      case 'number':
      case 'decimal':
      case 'integer':
        return typeof value === 'number' ? value : parseFloat(value) || 0
      case 'date':
        if (value instanceof Date) return value
        return new Date(value)
      case 'boolean':
        return value ? 'Ya' : 'Tidak'
      default:
        return String(value)
    }
  }

  /**
   * Format value according to format string
   */
  private formatValue(value: any, format: string): string {
    if (format === 'currency') {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
      }).format(value)
    }
    
    if (format === 'percentage') {
      return `${(value * 100).toFixed(2)}%`
    }
    
    if (format === 'number') {
      return new Intl.NumberFormat('id-ID').format(value)
    }
    
    return String(value)
  }

  /**
   * Calculate value using formula
   */
  private calculateValue(value: any, formula: string): number {
    // Simple formula evaluation
    // In production, use a proper formula parser
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('x', `return ${formula}`)
      return fn(value)
    } catch {
      return value
    }
  }

  /**
   * Interpolate formula template with data
   */
  private interpolateFormula(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(data, key)
      return value !== undefined ? String(value) : match
    })
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  /**
   * Validate mapped data
   */
  validate(data: Record<string, any>): ValidationError[] {
    const errors: ValidationError[] = []

    this.mapping.mappings.forEach((fieldMapping) => {
      if (fieldMapping.isRequired) {
        const value = this.getNestedValue(data, fieldMapping.jsonField)
        if (value === undefined || value === null || value === '') {
          errors.push({
            field: fieldMapping.jsonField,
            value,
            rule: 'required',
            message: `Field ${fieldMapping.jsonField} is required`,
          })
        }
      }

      if (fieldMapping.validation) {
        const value = this.getNestedValue(data, fieldMapping.jsonField)
        const validationError = this.validateField(value, fieldMapping.validation, fieldMapping.jsonField)
        if (validationError) {
          errors.push(validationError)
        }
      }
    })

    return errors
  }

  /**
   * Validate single field
   */
  private validateField(value: any, rule: ValidationRule, field: string): ValidationError | null {
    if (value === undefined || value === null) return null

    switch (rule.type) {
      case 'enum':
        if (rule.values && !rule.values.includes(value)) {
          return {
            field,
            value,
            rule: 'enum',
            message: rule.message || `Value must be one of: ${rule.values.join(', ')}`,
          }
        }
        break
      case 'range':
        const numValue = parseFloat(value)
        if (rule.min !== undefined && numValue < rule.min) {
          return {
            field,
            value,
            rule: 'range',
            message: rule.message || `Value must be at least ${rule.min}`,
          }
        }
        if (rule.max !== undefined && numValue > rule.max) {
          return {
            field,
            value,
            rule: 'range',
            message: rule.message || `Value must be at most ${rule.max}`,
          }
        }
        break
      case 'regex':
        if (rule.pattern && !new RegExp(rule.pattern).test(String(value))) {
          return {
            field,
            value,
            rule: 'regex',
            message: rule.message || 'Value does not match required pattern',
          }
        }
        break
    }

    return null
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface CellValue {
  address: string
  sheet: string
  value: any
  type: DataType
  isFormula?: boolean
  formula?: string
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create standard mapping for SPKBG template
 */
export function createSPKBGMapping(templateId: string): MappingEngine {
  return {
    templateId,
    version: '1.0.0',
    mappings: [
      // Project fields
      { id: 'proj-name', excelField: 'nama_bangunan', jsonField: 'project.nama_bangunan', dbField: 'nama_bangunan', dbTable: 'projects', dataType: 'text', isRequired: true },
      { id: 'proj-address', excelField: 'alamat', jsonField: 'project.alamat', dbField: 'alamat', dbTable: 'projects', dataType: 'text', isRequired: true },
      { id: 'proj-lantai', excelField: 'jumlah_lantai', jsonField: 'project.jumlah_lantai', dbField: 'jumlah_lantai', dbTable: 'projects', dataType: 'integer', isRequired: true },
      { id: 'proj-luas', excelField: 'luas_bangunan', jsonField: 'project.luas_bangunan', dbField: 'luas_bangunan', dbTable: 'projects', dataType: 'decimal', isRequired: false },
      
      // Survey fields
      { id: 'srv-date', excelField: 'tanggal_survey', jsonField: 'survey.tanggal_survey', dbField: 'tanggal_survey', dbTable: 'surveys', dataType: 'date', isRequired: true },
      { id: 'srv-kondisi', excelField: 'kondisi_umum', jsonField: 'survey.kondisi_umum', dbField: 'kondisi_umum', dbTable: 'surveys', dataType: 'text', isRequired: false },
      
      // Component fields (will be mapped as array)
      { id: 'comp-kode', excelField: 'kode_komponen', jsonField: 'components[].kode_komponen', dbField: 'kode_komponen', dbTable: 'components', dataType: 'code', isRequired: true },
      { id: 'comp-nama', excelField: 'nama_komponen', jsonField: 'components[].nama_komponen', dbField: 'nama_komponen', dbTable: 'components', dataType: 'text', isRequired: true },
      { id: 'comp-vol-total', excelField: 'volume_total', jsonField: 'components[].volume_total', dbField: 'volume_total', dbTable: 'components', dataType: 'decimal', isRequired: true },
      { id: 'comp-vol-rusak', excelField: 'volume_rusak', jsonField: 'components[].volume_rusak', dbField: 'volume_rusak', dbTable: 'components', dataType: 'decimal', isRequired: true },
      { id: 'comp-klasifikasi', excelField: 'klasifikasi', jsonField: 'components[].klasifikasi', dbField: 'klasifikasi', dbTable: 'components', dataType: 'enum', isRequired: true, validation: { type: 'enum', values: ['1', '2', '3', '4', '5', '6', '7'] } },
      { id: 'comp-deskripsi', excelField: 'deskripsi_kerusakan', jsonField: 'components[].deskripsi_kerusakan', dbField: 'deskripsi_kerusakan', dbTable: 'components', dataType: 'text', isRequired: false },
    ],
    sheetMappings: [
      {
        sheetName: 'Survey Data',
        sheetIndex: 0,
        entityType: 'survey',
        headerRow: 0,
        dataStartRow: 1,
        mappings: [], // Will be populated from main mappings
      },
      {
        sheetName: 'Komponen',
        sheetIndex: 1,
        entityType: 'component',
        headerRow: 0,
        dataStartRow: 1,
        mappings: [],
      },
    ],
    cellMappings: [],
  }
}

/**
 * Create cell mappings for export (template-driven)
 */
export function createCellMappings(): CellMapping[] {
  return [
    // Header info
    { id: 'header-proj-name', sheetName: 'Data Survey', cellAddress: 'B2', jsonPath: 'project.nama_bangunan', dbField: 'nama_bangunan', dataType: 'text' },
    { id: 'header-proj-address', sheetName: 'Data Survey', cellAddress: 'B3', jsonPath: 'project.alamat', dbField: 'alamat', dataType: 'text' },
    { id: 'header-srv-date', sheetName: 'Data Survey', cellAddress: 'B4', jsonPath: 'survey.tanggal_survey', dbField: 'tanggal_survey', dataType: 'date' },
    { id: 'header-surveyor', sheetName: 'Data Survey', cellAddress: 'B5', jsonPath: 'survey.surveyor_name', dbField: 'surveyor_id', dataType: 'text' },
    
    // Results
    { id: 'result-total', sheetName: 'Hasil', cellAddress: 'C10', jsonPath: 'results.total_kerusakan', dbField: 'total_kerusakan', dataType: 'decimal' },
    { id: 'result-kategori', sheetName: 'Hasil', cellAddress: 'C11', jsonPath: 'results.kategori_kerusakan', dbField: 'kategori_kerusakan', dataType: 'text' },
    { id: 'result-struktur', sheetName: 'Hasil', cellAddress: 'C12', jsonPath: 'results.total_kerusakan_struktur', dbField: 'total_kerusakan_struktur', dataType: 'decimal' },
    { id: 'result-arsitektur', sheetName: 'Hasil', cellAddress: 'C13', jsonPath: 'results.total_kerusakan_arsitektur', dbField: 'total_kerusakan_arsitektur', dataType: 'decimal' },
    
    // Component rows (dynamic - will be expanded)
    { id: 'comp-0-nama', sheetName: 'Komponen', cellAddress: 'A10', jsonPath: 'components[0].nama_komponen', dbField: 'nama_komponen', dataType: 'text' },
    { id: 'comp-0-vol-total', sheetName: 'Komponen', cellAddress: 'C10', jsonPath: 'components[0].volume_total', dbField: 'volume_total', dataType: 'decimal' },
    { id: 'comp-0-vol-rusak', sheetName: 'Komponen', cellAddress: 'D10', jsonPath: 'components[0].volume_rusak', dbField: 'volume_rusak', dataType: 'decimal' },
    { id: 'comp-0-klasifikasi', sheetName: 'Komponen', cellAddress: 'E10', jsonPath: 'components[0].klasifikasi', dbField: 'klasifikasi', dataType: 'enum' },
    { id: 'comp-0-nilai', sheetName: 'Komponen', cellAddress: 'H10', jsonPath: 'components[0].nilai_hasil', dbField: 'nilai_hasil', dataType: 'decimal', isFormula: true, formulaTemplate: '=(D10/C10)*E10' },
  ]
}

export default TemplateMappingEngine
