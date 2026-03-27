/**
 * TEMPLATE PARSER MODULE
 * Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
 * 
 * Fungsi: Membaca dan menganalisis template Excel dari folder Acuan
 * Output: JSON schema yang berisi struktur template
 */

import * as XLSX from 'xlsx'

// ============================================================================
// TYPES
// ============================================================================

export interface ParsedTemplate {
  fileName: string
  filePath: string
  version: string
  sheets: ParsedSheet[]
  metadata: TemplateMetadata
  mapping: ColumnMapping[]
  layout: SheetLayout
}

export interface ParsedSheet {
  name: string
  index: number
  headers: HeaderInfo[]
  dataRows: DataRow[]
  mergeCells: MergeCell[]
  styles: CellStyle[]
  formulas: FormulaCell[]
  rowCount: number
  colCount: number
}

export interface HeaderInfo {
  column: string
  headerText: string
  rowIndex: number
  colIndex: number
  dataType: 'text' | 'number' | 'date' | 'formula' | 'mixed'
  isRequired: boolean
  mappingKey?: string
}

export interface DataRow {
  rowIndex: number
  cells: CellData[]
  isEmpty: boolean
}

export interface CellData {
  address: string
  row: number
  col: number
  value: any
  type: 's' | 'n' | 'b' | 'd' | 'f' | 'e' // string, number, boolean, date, formula, error
  formula?: string
  style?: any
  merged?: boolean
  mergeRange?: string
}

export interface MergeCell {
  range: string
  startRow: number
  startCol: number
  endRow: number
  endCol: number
  width: number
  height: number
}

export interface CellStyle {
  address: string
  font?: any
  fill?: any
  border?: any
  alignment?: any
  numberFormat?: string
}

export interface FormulaCell {
  address: string
  formula: string
  result: any
}

export interface TemplateMetadata {
  title?: string
  createdBy?: string
  createdDate?: string
  version?: string
  description?: string
}

export interface ColumnMapping {
  excelColumn: string
  headerText: string
  jsonField: string
  dbField: string
  dataType: string
  isRequired: boolean
  defaultValue?: any
  validation?: ValidationRule
}

export interface ValidationRule {
  type: 'enum' | 'range' | 'regex' | 'custom'
  values?: any[]
  min?: number
  max?: number
  pattern?: string
  message?: string
}

export interface SheetLayout {
  headerRowIndex: number
  dataStartRow: number
  dataEndRow?: number
  columnWidths: Record<string, number>
  rowHeights: Record<number, number>
}

export interface ParseOptions {
  headerRows?: number[]
  dataStartRow?: number
  sheetIndex?: number | number[]
  includeStyles?: boolean
  includeFormulas?: boolean
  includeEmptyCells?: boolean
}

// ============================================================================
// PARSER CLASS
// ============================================================================

export class TemplateParser {
  private workbook: XLSX.WorkBook | null = null
  private currentFilePath: string = ''

  /**
   * Load template Excel file from buffer or path
   */
  async loadTemplate(file: File | ArrayBuffer | string): Promise<ParsedTemplate> {
    let data: ArrayBuffer

    if (typeof file === 'string') {
      // Assume it's a file path - in browser we need to fetch
      const response = await fetch(file)
      data = await response.arrayBuffer()
      this.currentFilePath = file
    } else if (file instanceof File) {
      data = await file.arrayBuffer()
      this.currentFilePath = file.name
    } else {
      data = file
      this.currentFilePath = 'buffer'
    }

    this.workbook = XLSX.read(data, {
      type: 'array',
      cellFormula: true,
      cellNF: true,
      cellStyles: true,
      cellDates: true,
      sheetStubs: true,
    })

    return this.parseWorkbook()
  }

  /**
   * Parse loaded workbook into structured format
   */
  private parseWorkbook(): ParsedTemplate {
    if (!this.workbook) {
      throw new Error('No workbook loaded. Call loadTemplate() first.')
    }

    const sheetNames = this.workbook.SheetNames
    const sheets: ParsedSheet[] = []

    sheetNames.forEach((name, index) => {
      const worksheet = this.workbook!.Sheets[name]
      const parsedSheet = this.parseSheet(worksheet, name, index)
      sheets.push(parsedSheet)
    })

    // Extract metadata from first sheet
    const metadata = this.extractMetadata(sheets[0])

    // Generate column mappings
    const mapping = this.generateColumnMappings(sheets)

    // Determine layout
    const layout = this.determineLayout(sheets)

    return {
      fileName: this.currentFilePath.split('/').pop() || 'template.xlsx',
      filePath: this.currentFilePath,
      version: metadata.version || '1.0.0',
      sheets,
      metadata,
      mapping,
      layout,
    }
  }

  /**
   * Parse individual worksheet
   */
  private parseSheet(worksheet: XLSX.WorkSheet, name: string, index: number): ParsedSheet {
    const ref = worksheet['!ref']
    if (!ref) {
      return {
        name,
        index,
        headers: [],
        dataRows: [],
        mergeCells: [],
        styles: [],
        formulas: [],
        rowCount: 0,
        colCount: 0,
      }
    }

    const range = XLSX.utils.decode_range(ref)
    const headers: HeaderInfo[] = []
    const dataRows: DataRow[] = []
    const mergeCells: MergeCell[] = []
    const styles: CellStyle[] = []
    const formulas: FormulaCell[] = []

    // Parse merge cells
    if (worksheet['!merges']) {
      worksheet['!merges'].forEach((merge) => {
        mergeCells.push({
          range: XLSX.utils.encode_range(merge),
          startRow: merge.s.r,
          startCol: merge.s.c,
          endRow: merge.e.r,
          endCol: merge.e.c,
          width: merge.e.c - merge.s.c + 1,
          height: merge.e.r - merge.s.r + 1,
        })
      })
    }

    // Iterate through cells
    for (let row = range.s.r; row <= range.e.r; row++) {
      const rowData: DataRow = {
        rowIndex: row,
        cells: [],
        isEmpty: true,
      }

      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
        const cell = worksheet[cellAddress]

        if (cell) {
          const cellData = this.parseCell(cell, cellAddress, row, col)
          rowData.cells.push(cellData)
          rowData.isEmpty = false

          // Check for formula
          if (cell.f) {
            formulas.push({
              address: cellAddress,
              formula: cell.f,
              result: cell.v,
            })
          }

          // Extract style if available
          if (cell.s) {
            styles.push({
              address: cellAddress,
              font: cell.s.font,
              fill: cell.s.fill,
              border: cell.s.border,
              alignment: cell.s.alignment,
              numberFormat: cell.s.numFmt,
            })
          }
        }
      }

      if (!rowData.isEmpty) {
        dataRows.push(rowData)
      }
    }

    // Detect header rows (usually first 1-3 rows)
    const headerRows = this.detectHeaderRows(dataRows)
    headers.push(...headerRows)

    return {
      name,
      index,
      headers,
      dataRows,
      mergeCells,
      styles,
      formulas,
      rowCount: range.e.r - range.s.r + 1,
      colCount: range.e.c - range.s.c + 1,
    }
  }

  /**
   * Parse individual cell
   */
  private parseCell(cell: XLSX.CellObject, address: string, row: number, col: number): CellData {
    let type: CellData['type'] = 's'
    let value = cell.v

    switch (cell.t) {
      case 's':
        type = 's'
        break
      case 'n':
        type = 'n'
        break
      case 'b':
        type = 'b'
        break
      case 'd':
        type = 'd'
        break
      case 'e':
        type = 'e'
        break
      default:
        type = 's'
    }

    return {
      address,
      row,
      col,
      value,
      type,
      formula: cell.f,
      merged: false,
    }
  }

  /**
   * Detect header rows from data
   */
  private detectHeaderRows(dataRows: DataRow[]): HeaderInfo[] {
    const headers: HeaderInfo[] = []
    
    if (dataRows.length === 0) return headers

    // Assume first 1-2 rows are headers if they contain text
    const potentialHeaderRows = dataRows.slice(0, 3)
    
    potentialHeaderRows.forEach((row) => {
      row.cells.forEach((cell) => {
        if (cell.type === 's' && typeof cell.value === 'string') {
          const headerText = cell.value.trim()
          if (headerText.length > 0 && !this.isDataValue(headerText)) {
            headers.push({
              column: this.columnIndexToLetter(cell.col),
              headerText,
              rowIndex: cell.row,
              colIndex: cell.col,
              dataType: 'text',
              isRequired: this.isRequiredHeader(headerText),
              mappingKey: this.generateMappingKey(headerText),
            })
          }
        }
      })
    })

    return headers
  }

  /**
   * Check if text is a data value rather than header
   */
  private isDataValue(text: string): boolean {
    // Check if it's a number
    if (!isNaN(Number(text))) return true
    
    // Check if it looks like a date
    const datePattern = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/
    if (datePattern.test(text)) return true
    
    return false
  }

  /**
   * Check if header is required based on naming
   */
  private isRequiredHeader(headerText: string): boolean {
    const requiredKeywords = ['wajib', 'required', '*', 'harus', 'mandatory']
    const lower = headerText.toLowerCase()
    return requiredKeywords.some(kw => lower.includes(kw))
  }

  /**
   * Generate mapping key from header text
   */
  private generateMappingKey(headerText: string): string {
    return headerText
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
  }

  /**
   * Extract metadata from first sheet
   */
  private extractMetadata(sheet: ParsedSheet): TemplateMetadata {
    const metadata: TemplateMetadata = {}
    
    // Look for common metadata patterns in first few rows
    const firstRows = sheet.dataRows.slice(0, 10)
    
    firstRows.forEach((row) => {
      row.cells.forEach((cell) => {
        if (cell.type === 's' && typeof cell.value === 'string') {
          const text = cell.value.toLowerCase()
          
          if (text.includes('judul') || text.includes('title')) {
            metadata.title = cell.value
          }
          if (text.includes('versi') || text.includes('version')) {
            const match = cell.value.match(/\d+\.?\d*\.?\d*/)
            if (match) metadata.version = match[0]
          }
          if (text.includes('dibuat') || text.includes('created')) {
            metadata.createdBy = cell.value
          }
          if (text.includes('tanggal') || text.includes('date')) {
            metadata.createdDate = cell.value
          }
        }
      })
    })

    return metadata
  }

  /**
   * Generate column mappings from parsed sheets
   */
  private generateColumnMappings(sheets: ParsedSheet[]): ColumnMapping[] {
    const mappings: ColumnMapping[] = []
    
    sheets.forEach((sheet) => {
      sheet.headers.forEach((header) => {
        mappings.push({
          excelColumn: header.column,
          headerText: header.headerText,
          jsonField: header.mappingKey || this.generateMappingKey(header.headerText),
          dbField: this.toSnakeCase(header.mappingKey || header.headerText),
          dataType: this.inferDataType(header.headerText),
          isRequired: header.isRequired,
        })
      })
    })

    return mappings
  }

  /**
   * Infer data type from header text
   */
  private inferDataType(headerText: string): string {
    const lower = headerText.toLowerCase()
    
    if (lower.includes('tanggal') || lower.includes('date')) return 'date'
    if (lower.includes('volume') || lower.includes('bobot') || lower.includes('nilai')) return 'number'
    if (lower.includes('klasifikasi') || lower.includes('kategori')) return 'enum'
    if (lower.includes('kode')) return 'code'
    
    return 'text'
  }

  /**
   * Convert to snake_case
   */
  private toSnakeCase(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
  }

  /**
   * Determine layout structure
   */
  private determineLayout(sheets: ParsedSheet[]): SheetLayout {
    if (sheets.length === 0) {
      return {
        headerRowIndex: 0,
        dataStartRow: 1,
        columnWidths: {},
        rowHeights: {},
      }
    }

    const firstSheet = sheets[0]
    
    // Find header row (usually contains most text cells in early rows)
    let headerRowIndex = 0
    let maxTextCells = 0
    
    firstSheet.dataRows.slice(0, 5).forEach((row, _idx) => {
      const textCells = row.cells.filter(c => c.type === 's').length
      if (textCells > maxTextCells) {
        maxTextCells = textCells
        headerRowIndex = row.rowIndex
      }
    })

    return {
      headerRowIndex,
      dataStartRow: headerRowIndex + 1,
      columnWidths: {},
      rowHeights: {},
    }
  }

  /**
   * Convert column index to letter (0 -> A, 1 -> B, etc.)
   */
  private columnIndexToLetter(col: number): string {
    let result = ''
    let n = col
    
    do {
      result = String.fromCharCode(65 + (n % 26)) + result
      n = Math.floor(n / 26) - 1
    } while (n >= 0)
    
    return result
  }

  /**
   * Get raw workbook for advanced operations
   */
  getWorkbook(): XLSX.WorkBook | null {
    return this.workbook
  }

  /**
   * Get specific worksheet
   */
  getWorksheet(sheetName: string): XLSX.WorkSheet | null {
    if (!this.workbook) return null
    return this.workbook.Sheets[sheetName]
  }

  /**
   * Get sheet names
   */
  getSheetNames(): string[] {
    if (!this.workbook) return []
    return this.workbook.SheetNames
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse template from file path
 */
export async function parseTemplateFile(filePath: string): Promise<ParsedTemplate> {
  const parser = new TemplateParser()
  return parser.loadTemplate(filePath)
}

/**
 * Parse template from File object
 */
export async function parseTemplateFromFile(file: File): Promise<ParsedTemplate> {
  const parser = new TemplateParser()
  return parser.loadTemplate(file)
}

/**
 * Detect template structure from buffer
 */
export async function detectTemplateStructure(buffer: ArrayBuffer): Promise<{
  sheets: string[]
  headers: Record<string, string[]>
  hasFormulas: boolean
  hasMerges: boolean
}> {
  const parser = new TemplateParser()
  const parsed = await parser.loadTemplate(buffer)
  
  const headers: Record<string, string[]> = {}
  parsed.sheets.forEach((sheet) => {
    headers[sheet.name] = sheet.headers.map(h => h.headerText)
  })
  
  return {
    sheets: parsed.sheets.map(s => s.name),
    headers,
    hasFormulas: parsed.sheets.some(s => s.formulas.length > 0),
    hasMerges: parsed.sheets.some(s => s.mergeCells.length > 0),
  }
}

/**
 * Validate if file is valid Excel template
 */
export function isValidExcelFile(file: File): boolean {
  const validExtensions = ['.xlsx', '.xls', '.xlsm', '.xlsb']
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
  return validExtensions.includes(ext)
}

/**
 * Get column letter from index (utility function)
 */
export function getColumnLetter(colIndex: number): string {
  let result = ''
  let n = colIndex
  
  do {
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  
  return result
}

/**
 * Get column index from letter (utility function)
 */
export function getColumnIndex(colLetter: string): number {
  let result = 0
  for (let i = 0; i < colLetter.length; i++) {
    result = result * 26 + (colLetter.charCodeAt(i) - 64)
  }
  return result - 1
}

export default TemplateParser
