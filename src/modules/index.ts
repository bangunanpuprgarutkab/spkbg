/**
 * EXCEL ENGINE MODULE - Index
 * Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
 * 
 * Export semua modul Excel Engine dan Template Mapping
 */

// Template Parser
export { 
  TemplateParser,
  parseTemplateFile,
  parseTemplateFromFile,
  detectTemplateStructure,
  isValidExcelFile,
  getColumnLetter,
  getColumnIndex,
} from './template/parser'

export type {
  ParsedTemplate,
  ParsedSheet,
  HeaderInfo,
  DataRow,
  CellData,
  MergeCell,
  CellStyle,
  FormulaCell,
  TemplateMetadata,
  ColumnMapping as TemplateColumnMapping,
  ValidationRule as TemplateValidationRule,
  SheetLayout,
  ParseOptions,
} from './template/parser'

// Template Mapping Engine
export {
  TemplateMappingEngine,
  createSPKBGMapping,
  createCellMappings,
} from './template/mapping'

export type {
  MappingEngine,
  FieldMapping,
  DataType,
  Transformation,
  SheetMapping,
  CellMapping,
  MappedData,
  ValidationError,
  DBRecord,
} from './template/mapping'

// Cell Mapping System
export {
  CellMappingManager,
  SPKBG_CELL_MAPPING,
  createMappingSchema,
  mergeMappingSchemas,
  isValidCellAddress,
  columnNumberToLetter,
  columnLetterToNumber,
} from './excel/cellMapping'

export type {
  CellMappingSchema,
  CellMappingEntry,
  DynamicRangeConfig,
  ArrayItemMapping,
  FormulaConfig,
  CellValidationRule,
  CellFormat,
  StyleConfig,
  MappingContext,
} from './excel/cellMapping'

// Excel Export Engine
export {
  ExcelExportEngine,
  createCellMappingsFromData,
  generateComponentCellMappings,
  exportToExcel,
} from './excel/export'

export type {
  ExportOptions,
  CellMappingConfig,
  SignatureConfig,
  ExportResult,
  CellPosition,
  SheetRange,
} from './excel/export'

// Data Normalization
export {
  DataNormalizer,
  normalizeSurveyData,
  normalizeComponentData,
  validateExportData,
  formatExcelNumber,
  formatExcelDate,
} from './excel/normalizer'

export type {
  NormalizationRule,
  NormalizationResult,
  ComponentNormalization,
} from './excel/normalizer'

// Validation System
export {
  ExportValidator,
  validateCellValue,
  quickValidate,
  canExport,
  getValidationSummary,
  preflightCheck,
} from './excel/validation'

export type {
  ValidationContext,
  ValidationIssue,
  ValidationResult,
  ValidationRuleSet,
  ValidationRule,
  ComponentValidation,
} from './excel/validation'

// File Storage
export {
  FileStorageService,
  uploadExportFile,
  uploadSignature,
  downloadTemplate,
  downloadExport,
  getExportUrl,
  generateExportFileName,
  formatFileSize,
  validateFileSize,
  readFileAsArrayBuffer,
  readFileAsDataURL,
  downloadBlob,
  STORAGE_BUCKETS,
} from './excel/storage'

export type {
  FileUploadOptions,
  FileUploadResult,
  FileDownloadResult,
  StorageStats,
} from './excel/storage'

// Google Integration
export {
  GoogleIntegrationService,
  initGoogleIntegration,
  getGoogleService,
  uploadExportToGoogle,
  syncToGoogleSheets,
  isGoogleAPIAvailable,
  generateShareableLink,
  formatCellRef,
} from './excel/google'

export type {
  GoogleIntegrationConfig,
  GoogleUploadOptions,
  GoogleUploadResult,
  SheetsSyncOptions,
  SheetsSyncResult,
} from './excel/google'

// ============================================================================
// COMPOSITE EXPORTS - Easy-to-use functions
// ============================================================================

import { ExcelExportEngine as _ExcelExportEngine } from './excel/export'
import { CellMappingManager as _CellMappingManager, SPKBG_CELL_MAPPING } from './excel/cellMapping'
import { normalizeSurveyData, normalizeComponentData } from './excel/normalizer'
import { quickValidate } from './excel/validation'
import { uploadExportFile, generateExportFileName } from './excel/storage'
import { uploadExportToGoogle } from './excel/google'
import { TemplateParser as _TemplateParser } from './template/parser'
import { TemplateMappingEngine as _TemplateMappingEngine } from './template/mapping'
import { DataNormalizer as _DataNormalizer } from './excel/normalizer'
import { ExportValidator as _ExportValidator } from './excel/validation'
import { FileStorageService as _FileStorageService } from './excel/storage'
import { GoogleIntegrationService as _GoogleIntegrationService } from './excel/google'

/**
 * Complete export workflow
 * 1. Validate data
 * 2. Normalize data
 * 3. Generate cell mappings
 * 4. Export to Excel
 * 5. Upload to storage
 * 6. Upload to Google (if enabled)
 */
export async function completeExportWorkflow(
  templatePath: string,
  surveyData: Record<string, any>,
  options: {
    uploadToStorage?: boolean
    uploadToGoogle?: boolean
    surveyId?: string
  } = {}
): Promise<{
  success: boolean
  fileName?: string
  fileUrl?: string
  googleUrl?: string
  errors: string[]
  warnings: string[]
}> {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    // 1. Validate
    const validation = quickValidate(surveyData)
    if (!validation.valid) {
      validation.errors.forEach(e => errors.push(e.message))
    }
    validation.warnings.forEach(w => warnings.push(w.message))

    if (!validation.canProceed && errors.length > 0) {
      return { success: false, errors, warnings }
    }

    // 2. Normalize
    const normalizedSurvey = normalizeSurveyData(surveyData)
    if (!normalizedSurvey.normalized) {
      normalizedSurvey.errors.forEach(e => errors.push(e.message))
    }
    normalizedSurvey.warnings.forEach(w => warnings.push(w))

    // Normalize components
    if (surveyData.components) {
      const normalizedComponents = normalizeComponentData(surveyData.components)
      normalizedComponents.errors.forEach(e => errors.push(e.message))
      normalizedComponents.warnings.forEach(w => warnings.push(w))
      
      // Update data with normalized components
      surveyData.components = normalizedComponents.normalized
    }

    // 3. Generate cell mappings
    const mappingManager = new _CellMappingManager(SPKBG_CELL_MAPPING)
    const cellMappings = mappingManager.generateCellMappings(surveyData)

    // 4. Export
    const fileName = generateExportFileName(
      surveyData.survey?.kode_survey || 'UNKNOWN',
      'full'
    )

    const exportEngine = new _ExcelExportEngine()
    const exportResult = await exportEngine.export({
      templatePath,
      outputFileName: fileName,
      data: surveyData,
      cellMappings: cellMappings.map((m: { sheet: string; cell: string; value: any; dataType: string }) => ({
        sheetName: m.sheet,
        cellAddress: m.cell,
        value: m.value,
        dataType: m.dataType as any,
      })),
    })

    if (!exportResult.success || !exportResult.buffer) {
      errors.push(exportResult.error || 'Export failed')
      return { success: false, errors, warnings }
    }

    let fileUrl: string | undefined
    let googleUrl: string | undefined

    // 5. Upload to Supabase Storage
    if (options.uploadToStorage && options.surveyId) {
      const uploadResult = await uploadExportFile(
        exportResult.buffer,
        fileName,
        options.surveyId
      )
      
      if (uploadResult.success) {
        fileUrl = uploadResult.publicUrl
      } else {
        warnings.push(`Storage upload failed: ${uploadResult.error}`)
      }
    }

    // 6. Upload to Google Drive
    if (options.uploadToGoogle) {
      const googleResult = await uploadExportToGoogle(
        exportResult.buffer,
        fileName,
        surveyData
      )
      
      if (googleResult.success) {
        googleUrl = googleResult.fileUrl
      } else {
        warnings.push(`Google upload failed: ${googleResult.error}`)
      }
    }

    // Download locally if not uploaded
    if (!fileUrl && !googleUrl && exportResult.buffer) {
      const blob = new Blob([exportResult.buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      fileUrl = url
    }

    return {
      success: true,
      fileName,
      fileUrl,
      googleUrl,
      errors,
      warnings,
    }
  } catch (error: any) {
    errors.push(error.message || 'Unknown error')
    return { success: false, errors, warnings }
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  TemplateParser: _TemplateParser,
  TemplateMappingEngine: _TemplateMappingEngine,
  CellMappingManager: _CellMappingManager,
  ExcelExportEngine: _ExcelExportEngine,
  DataNormalizer: _DataNormalizer,
  ExportValidator: _ExportValidator,
  FileStorageService: _FileStorageService,
  GoogleIntegrationService: _GoogleIntegrationService,
  completeExportWorkflow,
}
