/**
 * EXCEL EXPORT ENGINE (KRITIKAL)
 * Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
 * 
 * RULE PALING PENTING:
 * - Load template ASLI, isi data ke cell spesifik
 * - JANGAN ubah: style, merge, formula
 * - Output HARUS IDENTIK dengan template
 */

import * as XLSX from 'xlsx'

// ============================================================================
// TYPES
// ============================================================================

export interface ExportOptions {
  templatePath: string
  outputFileName: string
  data: Record<string, any>
  cellMappings: CellMappingConfig[]
  signatures?: SignatureConfig[]
  includeMetadata?: boolean
  protectStructure?: boolean
}

export interface CellMappingConfig {
  cellAddress: string
  sheetName: string
  value: any
  dataType?: 'string' | 'number' | 'date' | 'formula' | 'boolean'
  preserveFormula?: boolean
  numberFormat?: string
}

export interface SignatureConfig {
  imageData: string // base64
  sheetName: string
  cellAddress: string
  width?: number
  height?: number
  position?: 'center' | 'top-left' | 'bottom-right'
}

export interface ExportResult {
  success: boolean
  fileName: string
  filePath?: string
  fileUrl?: string
  buffer?: ArrayBuffer
  error?: string
  warnings?: string[]
}

export interface CellPosition {
  row: number
  col: number
  address: string
}

export interface SheetRange {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

// ============================================================================
// EXCEL EXPORT ENGINE CLASS
// ============================================================================

export class ExcelExportEngine {
  private workbook: XLSX.WorkBook | null = null
  private warnings: string[] = []

  /**
   * Load template Excel file
   * CRITICAL: Template harus di-load asli, tidak boleh di-generate dari nol
   */
  async loadTemplate(templatePath: string | ArrayBuffer): Promise<void> {
    let buffer: ArrayBuffer

    if (typeof templatePath === 'string') {
      // Fetch from URL/path
      const response = await fetch(templatePath)
      buffer = await response.arrayBuffer()
    } else {
      buffer = templatePath
    }

    // Parse workbook with full options to preserve everything
    this.workbook = XLSX.read(buffer, {
      type: 'array',
      cellFormula: true,
      cellNF: true,
      cellStyles: true,
      cellDates: true,
      sheetStubs: true,
      bookDeps: true,
      bookFiles: true,
      bookProps: true,
      bookSheets: true,
    })

    this.warnings = []
  }

  /**
   * Export data to Excel using template
   * CRITICAL: Isi hanya data, jangan ubah format
   */
  async export(options: ExportOptions): Promise<ExportResult> {
    try {
      // 1. Load template if not loaded
      if (!this.workbook) {
        await this.loadTemplate(options.templatePath)
      }

      // 2. Validate workbook
      if (!this.workbook) {
        return {
          success: false,
          fileName: options.outputFileName,
          error: 'Failed to load template',
        }
      }

      // 3. Apply cell mappings
      this.applyCellMappings(options.cellMappings)

      // 4. Inject signatures if provided
      if (options.signatures && options.signatures.length > 0) {
        await this.injectSignatures(options.signatures)
      }

      // 5. Add metadata
      if (options.includeMetadata) {
        this.addMetadata(options.data)
      }

      // 6. Generate output
      const outputBuffer = this.generateOutput()

      return {
        success: true,
        fileName: options.outputFileName,
        buffer: outputBuffer,
        warnings: this.warnings.length > 0 ? this.warnings : undefined,
      }
    } catch (error) {
      return {
        success: false,
        fileName: options.outputFileName,
        error: error instanceof Error ? error.message : 'Unknown error during export',
      }
    }
  }

  /**
   * Apply cell mappings to workbook
   * PRESERVE: style, merge, formula
   */
  private applyCellMappings(mappings: CellMappingConfig[]): void {
    if (!this.workbook) return

    mappings.forEach((mapping) => {
      const { sheetName, cellAddress, value, dataType, preserveFormula, numberFormat } = mapping

      // Get worksheet
      const worksheet = this.workbook!.Sheets[sheetName]
      if (!worksheet) {
        this.warnings.push(`Sheet "${sheetName}" not found`)
        return
      }

      // Get existing cell to check for formula
      const existingCell = worksheet[cellAddress]
      const hasFormula = existingCell?.f !== undefined

      // If cell has formula and preserveFormula is true, don't overwrite
      if (hasFormula && preserveFormula) {
        return
      }

      // Convert value to appropriate Excel type
      const cellValue = this.convertValueToExcel(value, dataType)

      // Set cell value
      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = {}
      }

      worksheet[cellAddress].v = cellValue

      // Set cell type
      if (dataType === 'number') {
        worksheet[cellAddress].t = 'n'
      } else if (dataType === 'date') {
        worksheet[cellAddress].t = 'd'
      } else if (dataType === 'boolean') {
        worksheet[cellAddress].t = 'b'
      } else {
        worksheet[cellAddress].t = 's'
      }

      // Apply number format if specified
      if (numberFormat) {
        worksheet[cellAddress].z = numberFormat
      }

      // Preserve existing formula if not overwriting
      if (hasFormula && !preserveFormula) {
        delete worksheet[cellAddress].f
      }
    })
  }

  /**
   * Set single cell value
   * UTILITY FUNCTION untuk mengisi data ke cell spesifik
   */
  setCellValue(
    sheetName: string, 
    cellAddress: string, 
    value: any, 
    options: { 
      dataType?: 'string' | 'number' | 'date' | 'formula' | 'boolean'
      numberFormat?: string
      preserveStyle?: boolean
    } = {}
  ): void {
    if (!this.workbook) {
      throw new Error('Template not loaded. Call loadTemplate() first.')
    }

    const worksheet = this.workbook.Sheets[sheetName]
    if (!worksheet) {
      throw new Error(`Sheet "${sheetName}" not found`)
    }

    const { dataType, numberFormat, preserveStyle = true } = options

    // Get existing cell
    const existingCell = worksheet[cellAddress]
    const existingStyle = preserveStyle && existingCell ? existingCell.s : undefined

    // Convert value
    const cellValue = this.convertValueToExcel(value, dataType)

    // Create or update cell
    if (!worksheet[cellAddress]) {
      worksheet[cellAddress] = {}
    }

    worksheet[cellAddress].v = cellValue

    // Set type
    if (dataType === 'number') {
      worksheet[cellAddress].t = 'n'
    } else if (dataType === 'date') {
      worksheet[cellAddress].t = 'd'
    } else if (dataType === 'boolean') {
      worksheet[cellAddress].t = 'b'
    } else if (dataType === 'formula') {
      worksheet[cellAddress].t = 'f'
      worksheet[cellAddress].f = value
    } else {
      worksheet[cellAddress].t = 's'
    }

    // Apply number format
    if (numberFormat) {
      worksheet[cellAddress].z = numberFormat
    }

    // Preserve style
    if (existingStyle) {
      worksheet[cellAddress].s = existingStyle
    }
  }

  /**
   * Set range of cells
   */
  setCellRange(
    sheetName: string,
    startCell: string,
    values: any[][],
    options: {
      direction?: 'row' | 'column'
      dataType?: 'string' | 'number' | 'date' | 'boolean'
    } = {}
  ): void {
    const { direction = 'row', dataType } = options

    const startPos = this.parseCellAddress(startCell)

    values.forEach((rowValues, index) => {
      if (direction === 'row') {
        const row = startPos.row + index
        rowValues.forEach((value, colIndex) => {
          const col = startPos.col + colIndex
          const cellAddress = this.encodeCellAddress(row, col)
          this.setCellValue(sheetName, cellAddress, value, { dataType })
        })
      } else {
        const col = startPos.col + index
        rowValues.forEach((value, rowIndex) => {
          const row = startPos.row + rowIndex
          const cellAddress = this.encodeCellAddress(row, col)
          this.setCellValue(sheetName, cellAddress, value, { dataType })
        })
      }
    })
  }

  /**
   * Inject signature images into Excel
   */
  private async injectSignatures(signatures: SignatureConfig[]): Promise<void> {
    if (!this.workbook) return

    // Note: True image injection requires more complex XLSX manipulation
    // This is a placeholder for the implementation
    // In production, this would use XLSX's image embedding capabilities
    
    signatures.forEach((sig) => {
      // For now, add placeholder text
      this.setCellValue(sig.sheetName, sig.cellAddress, '[TANDA TANGAN]', {
        dataType: 'string',
      })
      
      this.warnings.push(`Image injection not fully implemented for ${sig.cellAddress}`)
    })
  }

  /**
   * Add metadata to workbook
   */
  private addMetadata(data: Record<string, any>): void {
    if (!this.workbook) return

    // Update workbook properties
    this.workbook.Props = {
      ...this.workbook.Props,
      Title: data.title || 'SPKBG Export',
      Subject: 'Sistem Penilaian Kerusakan Bangunan Gedung',
      Author: data.author || 'SPKBG System',
      CreatedDate: new Date(),
      ModifiedDate: new Date(),
    }
  }

  /**
   * Generate output buffer
   */
  private generateOutput(): ArrayBuffer {
    if (!this.workbook) {
      throw new Error('No workbook to export')
    }

    // Write with options to preserve as much as possible
    const output = XLSX.write(this.workbook, {
      type: 'array',
      bookType: 'xlsx',
      cellStyles: true,
      cellDates: true,
      compression: true,
    })

    return output
  }

  /**
   * Convert value to Excel-compatible format
   */
  private convertValueToExcel(value: any, dataType?: string): any {
    if (value === null || value === undefined) {
      return ''
    }

    switch (dataType) {
      case 'number':
        return typeof value === 'number' ? value : parseFloat(value) || 0
      case 'date':
        if (value instanceof Date) return value
        const parsedDate = new Date(value)
        return isNaN(parsedDate.getTime()) ? value : parsedDate
      case 'boolean':
        return Boolean(value)
      case 'formula':
        return String(value)
      default:
        return String(value)
    }
  }

  /**
   * Parse cell address (A1 -> {row: 0, col: 0})
   */
  private parseCellAddress(address: string): CellPosition {
    const match = address.match(/^([A-Z]+)(\d+)$/)
    if (!match) {
      throw new Error(`Invalid cell address: ${address}`)
    }

    const colLetters = match[1]
    const row = parseInt(match[2]) - 1 // 0-indexed

    let col = 0
    for (let i = 0; i < colLetters.length; i++) {
      col = col * 26 + (colLetters.charCodeAt(i) - 64)
    }
    col-- // 0-indexed

    return { row, col, address }
  }

  /**
   * Encode cell address ({row: 0, col: 0} -> A1)
   */
  private encodeCellAddress(row: number, col: number): string {
    let colLetters = ''
    let n = col + 1

    do {
      colLetters = String.fromCharCode(65 + ((n - 1) % 26)) + colLetters
      n = Math.floor((n - 1) / 26)
    } while (n > 0)

    return `${colLetters}${row + 1}`
  }

  /**
   * Get workbook for advanced operations
   */
  getWorkbook(): XLSX.WorkBook | null {
    return this.workbook
  }

  /**
   * Get sheet names
   */
  getSheetNames(): string[] {
    if (!this.workbook) return []
    return this.workbook.SheetNames
  }

  /**
   * Clone current workbook
   */
  cloneWorkbook(): XLSX.WorkBook | null {
    if (!this.workbook) return null

    // Serialize and re-parse to create a deep clone
    const serialized = XLSX.write(this.workbook, {
      type: 'array',
      bookType: 'xlsx',
      cellStyles: true,
      cellDates: true,
    })

    return XLSX.read(serialized, {
      type: 'array',
      cellStyles: true,
      cellDates: true,
    })
  }

  /**
   * Reset engine
   */
  reset(): void {
    this.workbook = null
    this.warnings = []
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create cell mappings from data object
 */
export function createCellMappingsFromData(
  data: Record<string, any>,
  baseMappings: CellMappingConfig[]
): CellMappingConfig[] {
  const mappings: CellMappingConfig[] = []

  baseMappings.forEach((baseMapping) => {
    const value = getNestedValue(data, baseMapping.cellAddress)
    if (value !== undefined) {
      mappings.push({
        ...baseMapping,
        value,
      })
    }
  })

  return mappings
}

/**
 * Get nested value from object
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined
    
    // Handle array notation
    const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/)
    if (arrayMatch) {
      const arr = current[arrayMatch[1]]
      return arr ? arr[parseInt(arrayMatch[2])] : undefined
    }
    
    return current[key]
  }, obj)
}

/**
 * Generate dynamic cell mappings for components
 */
export function generateComponentCellMappings(
  components: any[],
  startRow: number,
  sheetName: string
): CellMappingConfig[] {
  const mappings: CellMappingConfig[] = []

  components.forEach((component, index) => {
    const row = startRow + index

    // Map common component fields
    if (component.kode_komponen) {
      mappings.push({
        sheetName,
        cellAddress: `A${row}`,
        value: component.kode_komponen,
        dataType: 'string',
      })
    }

    if (component.nama_komponen) {
      mappings.push({
        sheetName,
        cellAddress: `B${row}`,
        value: component.nama_komponen,
        dataType: 'string',
      })
    }

    if (component.volume_total !== undefined) {
      mappings.push({
        sheetName,
        cellAddress: `C${row}`,
        value: component.volume_total,
        dataType: 'number',
        numberFormat: '0.00',
      })
    }

    if (component.volume_rusak !== undefined) {
      mappings.push({
        sheetName,
        cellAddress: `D${row}`,
        value: component.volume_rusak,
        dataType: 'number',
        numberFormat: '0.00',
      })
    }

    if (component.klasifikasi) {
      mappings.push({
        sheetName,
        cellAddress: `E${row}`,
        value: component.klasifikasi,
        dataType: 'string',
      })
    }

    if (component.nilai_hasil !== undefined) {
      mappings.push({
        sheetName,
        cellAddress: `H${row}`,
        value: component.nilai_hasil,
        dataType: 'number',
        numberFormat: '0.0000',
        preserveFormula: true,
      })
    }
  })

  return mappings
}

/**
 * Quick export function
 */
export async function exportToExcel(
  templatePath: string,
  outputFileName: string,
  data: Record<string, any>,
  mappings: CellMappingConfig[]
): Promise<ExportResult> {
  const engine = new ExcelExportEngine()
  
  return engine.export({
    templatePath,
    outputFileName,
    data,
    cellMappings: mappings,
  })
}

export default ExcelExportEngine
