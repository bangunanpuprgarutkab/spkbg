/**
 * GOOGLE INTEGRATION HOOK
 * Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
 * 
 * Fungsi: Upload hasil export ke Google Drive & Google Sheets
 * Hook-based: Bisa di-enable/disable via config
 */

// ============================================================================
// TYPES
// ============================================================================

export interface GoogleIntegrationConfig {
  enabled: boolean
  clientId?: string
  apiKey?: string
  scopes: string[]
  folders: {
    exports: string
    reports: string
    signatures: string
  }
}

export interface GoogleUploadOptions {
  fileData: Blob | ArrayBuffer
  fileName: string
  mimeType: string
  folderId: string
  description?: string
  metadata?: Record<string, any>
}

export interface GoogleUploadResult {
  success: boolean
  fileId?: string
  fileUrl?: string
  webViewLink?: string
  error?: string
}

export interface SheetsSyncOptions {
  spreadsheetId: string
  sheetName: string
  data: any[][]
  startCell?: string
}

export interface SheetsSyncResult {
  success: boolean
  updatedRange?: string
  updatedRows?: number
  error?: string
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: GoogleIntegrationConfig = {
  enabled: false,
  scopes: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
  ],
  folders: {
    exports: 'SPKBG_Exports',
    reports: 'SPKBG_Reports',
    signatures: 'SPKBG_Signatures',
  },
}

// ============================================================================
// GOOGLE INTEGRATION SERVICE
// ============================================================================

export class GoogleIntegrationService {
  private config: GoogleIntegrationConfig
  private gapi: any = null
  private isInitialized: boolean = false

  constructor(config: Partial<GoogleIntegrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Check if integration is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Initialize Google API
   */
  async initialize(): Promise<boolean> {
    if (!this.config.enabled) {
      console.log('Google integration is disabled')
      return false
    }

    try {
      // Load Google API script dynamically
      await this.loadGoogleAPIScript()
      
      // Initialize GAPI client
      await this.initGAPI()
      
      this.isInitialized = true
      return true
    } catch (error) {
      console.error('Failed to initialize Google API:', error)
      this.isInitialized = false
      return false
    }
  }

  /**
   * Load Google API script
   */
  private loadGoogleAPIScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.getElementById('google-api-script')) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.id = 'google-api-script'
      script.src = 'https://apis.google.com/js/api.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Google API'))
      document.body.appendChild(script)
    })
  }

  /**
   * Initialize GAPI client
   */
  private initGAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      const gapi = (window as any).gapi
      
      gapi.load('client:auth2', async () => {
        try {
          await gapi.client.init({
            apiKey: this.config.apiKey,
            clientId: this.config.clientId,
            scope: this.config.scopes.join(' '),
            discoveryDocs: [
              'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
              'https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest',
            ],
          })
          this.gapi = gapi
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * Sign in to Google
   */
  async signIn(): Promise<boolean> {
    if (!this.isInitialized || !this.gapi) return false

    try {
      const GoogleAuth = this.gapi.auth2.getAuthInstance()
      const user = await GoogleAuth.signIn()
      return user.isSignedIn()
    } catch {
      return false
    }
  }

  /**
   * Sign out from Google
   */
  async signOut(): Promise<void> {
    if (!this.isInitialized || !this.gapi) return

    const GoogleAuth = this.gapi.auth2.getAuthInstance()
    await GoogleAuth.signOut()
  }

  /**
   * Check if user is signed in
   */
  isSignedIn(): boolean {
    if (!this.isInitialized || !this.gapi) return false

    const GoogleAuth = this.gapi.auth2.getAuthInstance()
    return GoogleAuth.isSignedIn.get()
  }

  /**
   * Upload file to Google Drive
   */
  async uploadToDrive(options: GoogleUploadOptions): Promise<GoogleUploadResult> {
    if (!this.isInitialized || !this.isSignedIn()) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      // Convert ArrayBuffer to Blob if needed
      const blob = options.fileData instanceof Blob 
        ? options.fileData 
        : new Blob([options.fileData], { type: options.mimeType })

      // Create file metadata
      const metadata = {
        name: options.fileName,
        mimeType: options.mimeType,
        parents: [options.folderId],
        description: options.description,
        appProperties: options.metadata,
      }

      // Create multipart request
      const form = new FormData()
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
      form.append('file', blob)

      // Upload using fetch API
      const accessToken = this.gapi.auth.getToken().access_token
      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          body: form,
        }
      )

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()

      return {
        success: true,
        fileId: result.id,
        fileUrl: `https://drive.google.com/file/d/${result.id}/view`,
        webViewLink: result.webViewLink,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Upload failed',
      }
    }
  }

  /**
   * Create or get folder
   */
  async getOrCreateFolder(folderName: string, parentId: string = 'root'): Promise<string | null> {
    if (!this.isInitialized || !this.isSignedIn()) return null

    try {
      // Search for existing folder
      const response = await this.gapi.client.drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      })

      if (response.result.files && response.result.files.length > 0) {
        return response.result.files[0].id
      }

      // Create new folder
      const createResponse = await this.gapi.client.drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        },
        fields: 'id',
      })

      return createResponse.result.id
    } catch {
      return null
    }
  }

  /**
   * Sync data to Google Sheets
   */
  async syncToSheets(options: SheetsSyncOptions): Promise<SheetsSyncResult> {
    if (!this.isInitialized || !this.isSignedIn()) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const response = await this.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: options.spreadsheetId,
        range: `${options.sheetName}!${options.startCell || 'A1'}`,
        valueInputOption: 'RAW',
        resource: {
          values: options.data,
        },
      })

      return {
        success: true,
        updatedRange: response.result.updatedRange,
        updatedRows: response.result.updatedRows,
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Sync failed',
      }
    }
  }

  /**
   * Create new spreadsheet
   */
  async createSpreadsheet(title: string): Promise<{ id: string; url: string } | null> {
    if (!this.isInitialized || !this.isSignedIn()) return null

    try {
      const response = await this.gapi.client.sheets.spreadsheets.create({
        resource: {
          properties: {
            title,
          },
        },
      })

      return {
        id: response.result.spreadsheetId,
        url: `https://docs.google.com/spreadsheets/d/${response.result.spreadsheetId}/edit`,
      }
    } catch {
      return null
    }
  }
}

// ============================================================================
// HOOK FUNCTIONS
// ============================================================================

let googleService: GoogleIntegrationService | null = null

/**
 * Initialize Google integration hook
 */
export function initGoogleIntegration(config?: Partial<GoogleIntegrationConfig>): GoogleIntegrationService {
  if (!googleService) {
    googleService = new GoogleIntegrationService(config)
  }
  return googleService
}

/**
 * Get Google service instance
 */
export function getGoogleService(): GoogleIntegrationService | null {
  return googleService
}

/**
 * Upload export to Google Drive (hook)
 */
export async function uploadExportToGoogle(
  buffer: ArrayBuffer,
  fileName: string,
  surveyData: Record<string, any>
): Promise<GoogleUploadResult> {
  const service = getGoogleService()
  
  if (!service || !service.isEnabled()) {
    return { success: false, error: 'Google integration disabled' }
  }

  // Initialize if not already
  if (!service.isSignedIn()) {
    const initialized = await service.initialize()
    if (!initialized) {
      return { success: false, error: 'Failed to initialize Google API' }
    }
    
    const signedIn = await service.signIn()
    if (!signedIn) {
      return { success: false, error: 'User not signed in' }
    }
  }

  // Get or create exports folder
  const folderId = await service.getOrCreateFolder('SPKBG_Exports')
  if (!folderId) {
    return { success: false, error: 'Failed to get/create folder' }
  }

  // Upload file
  return service.uploadToDrive({
    fileData: buffer,
    fileName,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    folderId,
    description: `Export from SPKBG - Survey: ${surveyData.survey?.kode_survey || 'Unknown'}`,
    metadata: {
      surveyId: surveyData.survey?.id,
      kodeSurvey: surveyData.survey?.kode_survey,
      exportedAt: new Date().toISOString(),
    },
  })
}

/**
 * Sync survey data to Google Sheets (hook)
 */
export async function syncToGoogleSheets(
  spreadsheetId: string,
  surveyData: Record<string, any>
): Promise<SheetsSyncResult> {
  const service = getGoogleService()
  
  if (!service || !service.isEnabled()) {
    return { success: false, error: 'Google integration disabled' }
  }

  // Prepare data
  const data = prepareSheetsData(surveyData)

  return service.syncToSheets({
    spreadsheetId,
    sheetName: 'Survey Data',
    data,
    startCell: 'A1',
  })
}

/**
 * Prepare data for Google Sheets
 */
function prepareSheetsData(surveyData: Record<string, any>): any[][] {
  const data: any[][] = []
  
  // Header row
  data.push([
    'Kode Survey',
    'Tanggal',
    'Nama Bangunan',
    'Alamat',
    'Jumlah Lantai',
    'Surveyor',
    'Total Kerusakan (%)',
    'Kategori',
  ])

  // Data row
  data.push([
    surveyData.survey?.kode_survey || '',
    surveyData.survey?.tanggal_survey || '',
    surveyData.project?.nama_bangunan || '',
    surveyData.project?.alamat || '',
    surveyData.project?.jumlah_lantai || '',
    surveyData.survey?.surveyor_name || '',
    surveyData.results?.total_kerusakan || 0,
    surveyData.results?.kategori_kerusakan || '',
  ])

  return data
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if Google API is available
 */
export function isGoogleAPIAvailable(): boolean {
  return typeof window !== 'undefined' && 'gapi' in window
}

/**
 * Generate Google Drive shareable link
 */
export function generateShareableLink(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`
}

/**
 * Format Google Sheets cell reference
 */
export function formatCellRef(row: number, col: number): string {
  const colLetter = columnToLetter(col)
  return `${colLetter}${row}`
}

/**
 * Convert column number to letter
 */
function columnToLetter(col: number): string {
  let result = ''
  let n = col
  
  do {
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result
    n = Math.floor((n - 1) / 26)
  } while (n > 0)
  
  return result
}

export default GoogleIntegrationService
