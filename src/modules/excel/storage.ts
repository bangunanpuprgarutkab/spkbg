/**
 * FILE HANDLING & STORAGE MODULE
 * Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
 * 
 * Fungsi: Handle upload/download file ke Supabase Storage
 */

import { supabase } from '../../services/supabase/client'

// ============================================================================
// TYPES
// ============================================================================

export interface FileUploadOptions {
  file: File | Blob
  fileName: string
  folder?: string
  contentType?: string
  upsert?: boolean
}

export interface FileUploadResult {
  success: boolean
  fileName: string
  filePath: string
  publicUrl?: string
  size: number
  error?: string
}

export interface FileDownloadResult {
  success: boolean
  data: Blob | null
  fileName: string
  contentType?: string
  error?: string
}

export interface StorageStats {
  used: number
  limit: number
  remaining: number
}

// ============================================================================
// STORAGE BUCKETS
// ============================================================================

export const STORAGE_BUCKETS = {
  TEMPLATES: 'templates',
  EXPORTS: 'exports',
  SIGNATURES: 'signatures',
  TEMP: 'temp-uploads',
} as const

// ============================================================================
// FILE STORAGE SERVICE
// ============================================================================

export class FileStorageService {
  private bucket: string

  constructor(bucket: string = STORAGE_BUCKETS.EXPORTS) {
    this.bucket = bucket
  }

  /**
   * Upload file to Supabase Storage
   */
  async upload(options: FileUploadOptions): Promise<FileUploadResult> {
    const { file, fileName, folder = '', contentType, upsert = false } = options

    try {
      const filePath = folder ? `${folder}/${fileName}` : fileName

      const { data, error } = await supabase.storage
        .from(this.bucket)
        .upload(filePath, file, {
          contentType: contentType || this.getContentType(fileName),
          upsert,
        })

      if (error) {
        throw error
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.bucket)
        .getPublicUrl(filePath)

      return {
        success: true,
        fileName,
        filePath: data.path,
        publicUrl: urlData.publicUrl,
        size: file.size,
      }
    } catch (error: any) {
      return {
        success: false,
        fileName,
        filePath: '',
        size: 0,
        error: error.message || 'Upload failed',
      }
    }
  }

  /**
   * Download file from Supabase Storage
   */
  async download(filePath: string): Promise<FileDownloadResult> {
    try {
      const { data, error } = await supabase.storage
        .from(this.bucket)
        .download(filePath)

      if (error) {
        throw error
      }

      return {
        success: true,
        data,
        fileName: filePath.split('/').pop() || 'download',
      }
    } catch (error: any) {
      return {
        success: false,
        data: null,
        fileName: filePath.split('/').pop() || 'download',
        error: error.message || 'Download failed',
      }
    }
  }

  /**
   * Get signed URL for temporary access
   */
  async getSignedUrl(filePath: string, expiresIn: number = 60): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(this.bucket)
        .createSignedUrl(filePath, expiresIn)

      if (error) {
        throw error
      }

      return data.signedUrl
    } catch {
      return null
    }
  }

  /**
   * Delete file from storage
   */
  async delete(filePath: string): Promise<boolean> {
    try {
      const { error } = await supabase.storage
        .from(this.bucket)
        .remove([filePath])

      return !error
    } catch {
      return false
    }
  }

  /**
   * List files in folder
   */
  async listFiles(folder: string = ''): Promise<string[]> {
    try {
      const { data, error } = await supabase.storage
        .from(this.bucket)
        .list(folder)

      if (error) {
        throw error
      }

      return data.map(item => item.name)
    } catch {
      return []
    }
  }

  /**
   * Check if file exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      const { data } = await supabase.storage
        .from(this.bucket)
        .list(filePath.split('/').slice(0, -1).join('/'))

      if (!data) return false

      const fileName = filePath.split('/').pop()
      return data.some(item => item.name === fileName)
    } catch {
      return false
    }
  }

  /**
   * Get content type from file extension
   */
  private getContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase()
    
    const types: Record<string, string> = {
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'txt': 'text/plain',
    }

    return types[ext || ''] || 'application/octet-stream'
  }
}

// ============================================================================
// EXPORT FILE HANDLING
// ============================================================================

/**
 * Upload exported Excel file
 */
export async function uploadExportFile(
  buffer: ArrayBuffer,
  fileName: string,
  surveyId: string
): Promise<FileUploadResult> {
  const storage = new FileStorageService(STORAGE_BUCKETS.EXPORTS)
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  })

  return storage.upload({
    file: blob,
    fileName,
    folder: surveyId,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/**
 * Upload signature image
 */
export async function uploadSignature(
  imageData: string,
  surveyId: string,
  signerId: string
): Promise<FileUploadResult> {
  const storage = new FileStorageService(STORAGE_BUCKETS.SIGNATURES)
  
  // Convert base64 to blob
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
  const byteCharacters = atob(base64Data)
  const byteNumbers = new Array(byteCharacters.length)
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: 'image/png' })

  const fileName = `signature_${signerId}_${Date.now()}.png`

  return storage.upload({
    file: blob,
    fileName,
    folder: surveyId,
    contentType: 'image/png',
  })
}

/**
 * Download template file
 */
export async function downloadTemplate(templateId: string): Promise<FileDownloadResult> {
  const storage = new FileStorageService(STORAGE_BUCKETS.TEMPLATES)
  return storage.download(`${templateId}.xlsx`)
}

/**
 * Download exported file
 */
export async function downloadExport(
  surveyId: string, 
  fileName: string
): Promise<FileDownloadResult> {
  const storage = new FileStorageService(STORAGE_BUCKETS.EXPORTS)
  return storage.download(`${surveyId}/${fileName}`)
}

/**
 * Get export file URL
 */
export async function getExportUrl(
  surveyId: string, 
  fileName: string,
  expiresIn: number = 300
): Promise<string | null> {
  const storage = new FileStorageService(STORAGE_BUCKETS.EXPORTS)
  return storage.getSignedUrl(`${surveyId}/${fileName}`, expiresIn)
}

// ============================================================================
// FILE UTILITIES
// ============================================================================

/**
 * Generate export file name
 */
export function generateExportFileName(
  kodeSurvey: string,
  type: 'full' | 'summary' | 'analysis' = 'full'
): string {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const typeSuffix = type !== 'full' ? `_${type}` : ''
  return `SPKBG_${kodeSurvey}${typeSuffix}_${timestamp}.xlsx`
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

/**
 * Validate file size
 */
export function validateFileSize(bytes: number, maxMB: number = 10): boolean {
  return bytes <= maxMB * 1024 * 1024
}

/**
 * Read file as ArrayBuffer
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Read file as Data URL (base64)
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export default FileStorageService
