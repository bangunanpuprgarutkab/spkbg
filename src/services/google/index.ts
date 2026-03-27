/**
 * GOOGLE API SERVICE
 * Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
 * 
 * Integrasi lengkap dengan Google Drive, Sheets, dan Docs
 * Menggunakan OAuth 2.0 untuk autentikasi
 */

import { supabase } from '@/services/supabase/client'

// ============================================================================
// TYPES
// ============================================================================

export interface GoogleAuthConfig {
  clientId: string
  apiKey: string
  scopes: string[]
  discoveryDocs: string[]
}

export interface GoogleToken {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  token_type: string
  expiry_date?: number
}

export interface GoogleUser {
  id: string
  email: string
  name: string
  picture?: string
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  webContentLink?: string
  size?: number
  createdTime: string
  modifiedTime: string
  parents?: string[]
}

export interface DriveFolder {
  id: string
  name: string
}

export interface SpreadsheetData {
  spreadsheetId: string
  title: string
  sheets: Array<{
    sheetId: number
    title: string
  }>
}

export interface DocsDocument {
  documentId: string
  title: string
  url: string
}

// ============================================================================
// GOOGLE AUTH SERVICE
// ============================================================================

export class GoogleAuthService {
  private config: GoogleAuthConfig
  private token: GoogleToken | null = null
  private gapi: any = null
  private isInitialized: boolean = false

  constructor(config: GoogleAuthConfig) {
    this.config = {
      ...config,
      scopes: config.scopes || [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/documents',
      ],
      discoveryDocs: config.discoveryDocs || [
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
        'https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest',
        'https://www.googleapis.com/discovery/v1/apis/docs/v1/rest',
      ],
    }
  }

  /**
   * Initialize Google API
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true

    try {
      // Load GAPI script
      await this.loadScript()
      
      // Initialize client
      await this.initClient()
      
      this.isInitialized = true
      return true
    } catch (error) {
      console.error('Failed to initialize Google API:', error)
      return false
    }
  }

  /**
   * Load Google API script
   */
  private loadScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).gapi) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://apis.google.com/js/api.js'
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Google API'))
      document.head.appendChild(script)
    })
  }

  /**
   * Initialize GAPI client
   */
  private initClient(): Promise<void> {
    return new Promise((resolve, reject) => {
      const gapi = (window as any).gapi
      
      gapi.load('client:auth2', async () => {
        try {
          await gapi.client.init({
            apiKey: this.config.apiKey,
            clientId: this.config.clientId,
            scope: this.config.scopes.join(' '),
            discoveryDocs: this.config.discoveryDocs,
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
   * Sign in dengan Google OAuth
   */
  async signIn(): Promise<GoogleUser | null> {
    if (!this.isInitialized) {
      const initialized = await this.initialize()
      if (!initialized) return null
    }

    try {
      const GoogleAuth = this.gapi.auth2.getAuthInstance()
      const user = await GoogleAuth.signIn()
      
      const profile = user.getBasicProfile()
      const authResponse = user.getAuthResponse()
      
      this.token = {
        access_token: authResponse.access_token,
        expires_in: authResponse.expires_in,
        scope: authResponse.scope,
        token_type: authResponse.token_type,
        expiry_date: Date.now() + (authResponse.expires_in * 1000),
      }

      // Save token to Supabase
      await this.saveTokenToSupabase(this.token)

      return {
        id: profile.getId(),
        email: profile.getEmail(),
        name: profile.getName(),
        picture: profile.getImageUrl(),
      }
    } catch (error) {
      console.error('Sign in failed:', error)
      return null
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    if (!this.gapi) return
    
    const GoogleAuth = this.gapi.auth2.getAuthInstance()
    await GoogleAuth.signOut()
    
    this.token = null
    
    // Clear token from Supabase
    await this.clearTokenFromSupabase()
  }

  /**
   * Check if signed in
   */
  isSignedIn(): boolean {
    if (!this.gapi) return false
    
    const GoogleAuth = this.gapi.auth2.getAuthInstance()
    return GoogleAuth.isSignedIn.get()
  }

  /**
   * Get current user
   */
  getCurrentUser(): GoogleUser | null {
    if (!this.gapi || !this.isSignedIn()) return null
    
    const GoogleAuth = this.gapi.auth2.getAuthInstance()
    const user = GoogleAuth.currentUser.get()
    const profile = user.getBasicProfile()
    
    return {
      id: profile.getId(),
      email: profile.getEmail(),
      name: profile.getName(),
      picture: profile.getImageUrl(),
    }
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    // Check if token is expired
    if (this.token && this.token.expiry_date && Date.now() > this.token.expiry_date) {
      this.token = null
    }
    
    return this.token?.access_token || null
  }

  /**
   * Refresh token if needed
   */
  async refreshToken(): Promise<boolean> {
    if (!this.gapi) return false
    
    try {
      const GoogleAuth = this.gapi.auth2.getAuthInstance()
      const user = GoogleAuth.currentUser.get()
      const authResponse = await user.reloadAuthResponse()
      
      this.token = {
        access_token: authResponse.access_token,
        expires_in: authResponse.expires_in,
        scope: authResponse.scope,
        token_type: authResponse.token_type,
        expiry_date: Date.now() + (authResponse.expires_in * 1000),
      }
      
      await this.saveTokenToSupabase(this.token)
      return true
    } catch {
      return false
    }
  }

  /**
   * Save token to Supabase
   */
  private async saveTokenToSupabase(token: GoogleToken): Promise<void> {
    try {
      await supabase.from('user_google_tokens').upsert({
        token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: token.expiry_date,
        updated_at: new Date().toISOString(),
      })
    } catch {
      // Silent fail - token storage is optional
    }
  }

  /**
   * Clear token from Supabase
   */
  private async clearTokenFromSupabase(): Promise<void> {
    try {
      await supabase.from('user_google_tokens').delete().neq('id', 0)
    } catch {
      // Silent fail
    }
  }

  /**
   * Get gapi instance
   */
  getGAPI(): any {
    return this.gapi
  }
}

// ============================================================================
// GOOGLE DRIVE SERVICE
// ============================================================================

export class GoogleDriveService {
  private authService: GoogleAuthService

  constructor(authService: GoogleAuthService) {
    this.authService = authService
  }

  /**
   * Upload file to Google Drive
   */
  async uploadFile(
    fileData: Blob | ArrayBuffer,
    fileName: string,
    mimeType: string,
    folderId?: string,
    description?: string
  ): Promise<DriveFile | null> {
    const gapi = this.authService.getGAPI()
    if (!gapi || !this.authService.isSignedIn()) {
      throw new Error('Not authenticated')
    }

    try {
      // Create metadata
      const metadata: any = {
        name: fileName,
        mimeType: mimeType,
        description: description,
      }
      
      if (folderId) {
        metadata.parents = [folderId]
      }

      // Create multipart form
      const form = new FormData()
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
      form.append('file', new Blob([fileData], { type: mimeType }))

      // Get access token
      const token = this.authService.getAccessToken()
      
      // Upload
      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size,createdTime,modifiedTime',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: form,
        }
      )

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()
      
      return {
        id: result.id,
        name: result.name,
        mimeType: result.mimeType,
        webViewLink: result.webViewLink,
        webContentLink: result.webContentLink,
        size: parseInt(result.size),
        createdTime: result.createdTime,
        modifiedTime: result.modifiedTime,
        parents: folderId ? [folderId] : undefined,
      }
    } catch (error) {
      console.error('Upload failed:', error)
      throw error
    }
  }

  /**
   * Create or get folder
   */
  async getOrCreateFolder(folderName: string, parentId: string = 'root'): Promise<string> {
    const gapi = this.authService.getGAPI()
    if (!gapi || !this.authService.isSignedIn()) {
      throw new Error('Not authenticated')
    }

    try {
      // Search for existing folder
      const searchResponse = await gapi.client.drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      })

      if (searchResponse.result.files && searchResponse.result.files.length > 0) {
        return searchResponse.result.files[0].id
      }

      // Create new folder
      const createResponse = await gapi.client.drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        },
        fields: 'id',
      })

      return createResponse.result.id
    } catch (error) {
      console.error('Folder creation failed:', error)
      throw error
    }
  }

  /**
   * Get file by ID
   */
  async getFile(fileId: string): Promise<DriveFile | null> {
    const gapi = this.authService.getGAPI()
    if (!gapi || !this.authService.isSignedIn()) return null

    try {
      const response = await gapi.client.drive.files.get({
        fileId: fileId,
        fields: 'id,name,mimeType,webViewLink,webContentLink,size,createdTime,modifiedTime,parents',
      })

      const result = response.result
      
      return {
        id: result.id,
        name: result.name,
        mimeType: result.mimeType,
        webViewLink: result.webViewLink,
        webContentLink: result.webContentLink,
        size: parseInt(result.size),
        createdTime: result.createdTime,
        modifiedTime: result.modifiedTime,
        parents: result.parents,
      }
    } catch {
      return null
    }
  }

  /**
   * Convert Excel to Google Sheets
   */
  async convertExcelToSheets(fileId: string): Promise<string | null> {
    const gapi = this.authService.getGAPI()
    if (!gapi || !this.authService.isSignedIn()) return null

    try {
      const response = await gapi.client.drive.files.copy({
        fileId: fileId,
        resource: {
          mimeType: 'application/vnd.google-apps.spreadsheet',
        },
      })

      return response.result.id
    } catch {
      return null
    }
  }

  /**
   * Set file permissions (share)
   */
  async shareFile(fileId: string, email?: string, role: 'reader' | 'writer' = 'reader'): Promise<boolean> {
    const gapi = this.authService.getGAPI()
    if (!gapi || !this.authService.isSignedIn()) return false

    try {
      const permission: any = {
        role: role,
        type: email ? 'user' : 'anyone',
      }
      
      if (email) {
        permission.emailAddress = email
      }

      await gapi.client.drive.permissions.create({
        fileId: fileId,
        resource: permission,
      })

      return true
    } catch {
      return false
    }
  }
}

// ============================================================================
// GOOGLE SHEETS SERVICE
// ============================================================================

export class GoogleSheetsService {
  private authService: GoogleAuthService

  constructor(authService: GoogleAuthService) {
    this.authService = authService
  }

  /**
   * Create new spreadsheet
   */
  async createSpreadsheet(title: string): Promise<SpreadsheetData | null> {
    const gapi = this.authService.getGAPI()
    if (!gapi || !this.authService.isSignedIn()) return null

    try {
      const response = await gapi.client.sheets.spreadsheets.create({
        resource: {
          properties: {
            title,
          },
        },
      })

      return {
        spreadsheetId: response.result.spreadsheetId,
        title: response.result.properties.title,
        sheets: response.result.sheets.map((s: any) => ({
          sheetId: s.properties.sheetId,
          title: s.properties.title,
        })),
      }
    } catch {
      return null
    }
  }

  /**
   * Update spreadsheet values
   */
  async updateValues(
    spreadsheetId: string,
    range: string,
    values: any[][],
    valueInputOption: 'RAW' | 'USER_ENTERED' = 'USER_ENTERED'
  ): Promise<boolean> {
    const gapi = this.authService.getGAPI()
    if (!gapi || !this.authService.isSignedIn()) return false

    try {
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption,
        resource: {
          values,
        },
      })

      return true
    } catch {
      return false
    }
  }

  /**
   * Append values to spreadsheet
   */
  async appendValues(
    spreadsheetId: string,
    range: string,
    values: any[][],
    valueInputOption: 'RAW' | 'USER_ENTERED' = 'USER_ENTERED'
  ): Promise<boolean> {
    const gapi = this.authService.getGAPI()
    if (!gapi || !this.authService.isSignedIn()) return false

    try {
      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption,
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values,
        },
      })

      return true
    } catch {
      return false
    }
  }

  /**
   * Get spreadsheet values
   */
  async getValues(spreadsheetId: string, range: string): Promise<any[][] | null> {
    const gapi = this.authService.getGAPI()
    if (!gapi || !this.authService.isSignedIn()) return null

    try {
      const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      })

      return response.result.values
    } catch {
      return null
    }
  }

  /**
   * Clear range
   */
  async clearRange(spreadsheetId: string, range: string): Promise<boolean> {
    const gapi = this.authService.getGAPI()
    if (!gapi || !this.authService.isSignedIn()) return false

    try {
      await gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId,
        range,
      })

      return true
    } catch {
      return false
    }
  }
}

// ============================================================================
// GOOGLE DOCS SERVICE
// ============================================================================

export class GoogleDocsService {
  private authService: GoogleAuthService

  constructor(authService: GoogleAuthService) {
    this.authService = authService
  }

  /**
   * Create new document
   */
  async createDocument(title: string): Promise<DocsDocument | null> {
    const gapi = this.authService.getGAPI()
    if (!gapi || !this.authService.isSignedIn()) return null

    try {
      const response = await gapi.client.docs.documents.create({
        resource: {
          title,
        },
      })

      return {
        documentId: response.result.documentId,
        title: response.result.title,
        url: `https://docs.google.com/document/d/${response.result.documentId}/edit`,
      }
    } catch {
      return null
    }
  }

  /**
   * Insert text to document
   */
  async insertText(documentId: string, text: string, index: number = 1): Promise<boolean> {
    const gapi = this.authService.getGAPI()
    if (!gapi || !this.authService.isSignedIn()) return false

    try {
      await gapi.client.docs.documents.batchUpdate({
        documentId,
        resource: {
          requests: [
            {
              insertText: {
                location: {
                  index,
                },
                text,
              },
            },
          ],
        },
      })

      return true
    } catch {
      return false
    }
  }

  /**
   * Generate laporan document
   */
  async generateLaporan(
    surveyData: Record<string, any>,
    _templateDocId?: string
  ): Promise<DocsDocument | null> {
    const title = `Laporan SPKBG - ${surveyData.survey?.kode_survey || 'Unknown'}`
    
    // Create new document
    const doc = await this.createDocument(title)
    if (!doc) return null

    // Build content
    const content = this.buildLaporanContent(surveyData)
    
    // Insert content
    await this.insertText(doc.documentId, content)

    return doc
  }

  /**
   * Build laporan content
   */
  private buildLaporanContent(data: Record<string, any>): string {
    const lines: string[] = []
    
    // Header
    lines.push('LAPORAN PENILAIAN KERUSAKAN BANGUNAN GEDUNG')
    lines.push('')
    lines.push('═══════════════════════════════════════════')
    lines.push('')
    
    // Data Umum
    lines.push('DATA BANGUNAN')
    lines.push('')
    lines.push(`Kode Survey    : ${data.survey?.kode_survey || '-'}`)
    lines.push(`Tanggal        : ${data.survey?.tanggal_survey || '-'}`)
    lines.push(`Nama Bangunan  : ${data.project?.nama_bangunan || '-'}`)
    lines.push(`Alamat         : ${data.project?.alamat || '-'}`)
    lines.push(`Jumlah Lantai  : ${data.project?.jumlah_lantai || '-'}`)
    lines.push(`Luas Bangunan  : ${data.project?.luas_bangunan || '-'} m²`)
    lines.push('')
    
    // Surveyor
    lines.push('PETUGAS SURVEY')
    lines.push('')
    lines.push(`Nama   : ${data.survey?.surveyor_name || '-'}`)
    lines.push(`NIP    : ${data.survey?.surveyor_nip || '-'}`)
    lines.push('')
    
    // Hasil Analisis
    lines.push('HASIL ANALISIS')
    lines.push('')
    lines.push(`Total Kerusakan : ${data.results?.total_kerusakan || 0}%`)
    lines.push(`Kategori        : ${data.results?.kategori_kerusakan?.toUpperCase() || '-'}`)
    lines.push('')
    
    // Detail per kategori
    lines.push('Detail per Kategori:')
    lines.push(`- Struktur   : ${data.results?.total_kerusakan_struktur || 0}%`)
    lines.push(`- Arsitektur : ${data.results?.total_kerusakan_arsitektur || 0}%`)
    lines.push(`- Utilitas   : ${data.results?.total_kerusakan_utilitas || 0}%`)
    lines.push(`- Finishing  : ${data.results?.total_kerusakan_finishing || 0}%`)
    lines.push('')
    
    // Rekomendasi
    lines.push('REKOMENDASI')
    lines.push('')
    lines.push(data.results?.rekomendasi || 'Berdasarkan hasil penilaian, bangunan memerlukan perhatian sesuai kategori kerusakan.')
    lines.push('')
    
    // Footer
    lines.push('═══════════════════════════════════════════')
    lines.push('')
    lines.push(`Dicetak pada: ${new Date().toLocaleDateString('id-ID')}`)
    
    return lines.join('\n')
  }
}

// ============================================================================
// FACTORY & EXPORTS
// ============================================================================

let googleAuthService: GoogleAuthService | null = null
let googleDriveService: GoogleDriveService | null = null
let googleSheetsService: GoogleSheetsService | null = null
let googleDocsService: GoogleDocsService | null = null

/**
 * Initialize Google services
 */
export function initializeGoogleServices(config: GoogleAuthConfig): {
  auth: GoogleAuthService
  drive: GoogleDriveService
  sheets: GoogleSheetsService
  docs: GoogleDocsService
} {
  if (!googleAuthService) {
    googleAuthService = new GoogleAuthService(config)
  }
  
  if (!googleDriveService) {
    googleDriveService = new GoogleDriveService(googleAuthService)
  }
  
  if (!googleSheetsService) {
    googleSheetsService = new GoogleSheetsService(googleAuthService)
  }
  
  if (!googleDocsService) {
    googleDocsService = new GoogleDocsService(googleAuthService)
  }

  return {
    auth: googleAuthService,
    drive: googleDriveService,
    sheets: googleSheetsService,
    docs: googleDocsService,
  }
}

/**
 * Get Google services
 */
export function getGoogleServices(): {
  auth: GoogleAuthService | null
  drive: GoogleDriveService | null
  sheets: GoogleSheetsService | null
  docs: GoogleDocsService | null
} {
  return {
    auth: googleAuthService,
    drive: googleDriveService,
    sheets: googleSheetsService,
    docs: googleDocsService,
  }
}

// Default config (gunakan env variables)
export const defaultGoogleConfig: GoogleAuthConfig = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
  scopes: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/documents',
  ],
  discoveryDocs: [
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
    'https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest',
    'https://www.googleapis.com/discovery/v1/apis/docs/v1/rest',
  ],
}
