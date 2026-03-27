/**
 * COST ESTIMATION ENGINE
 * Smart AI Engineering Platform - SPKBG
 * 
 * Estimasi biaya perbaikan berdasarkan Perbup Standar Harga Satuan (SHS)
 * Kabupaten Garut
 * 
 * RULE KRITIS:
 * - Harga HARUS sesuai Perbup
 * - Tidak boleh estimasi liar
 * - Semua sumber harus tercatat
 */

import { supabase } from '@/services/supabase/client'

// ============================================================================
// TYPES
// ============================================================================

export interface CostStandard {
  id: string
  kodeItem: string
  namaItem: string
  satuan: string
  hargaSatuan: number
  sumber: string // Perbup No. X Tahun Y
  tahun: number
  kategori: 'material' | 'upah' | 'alat'
  subKategori?: string
  provinsi?: string
  kabupaten: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CostEstimation {
  id: string
  surveyId: string
  componentId?: string
  itemPekerjaan: string
  volume: number
  satuan: string
  hargaSatuan: number
  totalBiaya: number
  costStandardId?: string
  catatan?: string
  createdAt: string
  updatedAt: string
}

export interface CostBreakdown {
  material: number
  upah: number
  alat: number
  total: number
}

export interface RepairEstimate {
  komponen: string
  jenisKerusakan: string
  volumeRusak: number
  satuan: string
  itemPekerjaan: CostStandard[]
  totalEstimasi: number
  rincian: CostEstimation[]
}

export interface PerbupDocument {
  id: string
  nama: string
  nomor: string
  tahun: number
  kabupaten: string
  fileUrl: string
  isParsed: boolean
  parsedAt?: string
  totalItems: number
}

export interface ParsedPerbupItem {
  kode: string
  nama: string
  satuan: string
  harga: number
  halaman?: number
}

// ============================================================================
// PERBUP PARSER
// ============================================================================

export class PerbupParser {
  /**
   * Parse Excel/CSV Perbup document
   */
  async parseDocument(file: File): Promise<ParsedPerbupItem[]> {
    const extension = file.name.split('.').pop()?.toLowerCase()
    
    if (extension === 'csv') {
      return this.parseCSV(file)
    } else if (['xlsx', 'xls'].includes(extension || '')) {
      return this.parseExcel(file)
    }
    
    throw new Error('Format file tidak didukung. Gunakan CSV atau Excel.')
  }

  /**
   * Parse CSV file
   */
  private async parseCSV(file: File): Promise<ParsedPerbupItem[]> {
    const text = await file.text()
    const lines = text.split('\n')
    const items: ParsedPerbupItem[] = []

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const columns = line.split(',')
      
      // Expected format: kode, nama, satuan, harga
      if (columns.length >= 4) {
        const harga = parseFloat(columns[3].replace(/[^0-9]/g, ''))
        
        if (!isNaN(harga) && harga > 0) {
          items.push({
            kode: columns[0].trim(),
            nama: columns[1].trim(),
            satuan: columns[2].trim(),
            harga: harga,
          })
        }
      }
    }

    return items
  }

  /**
   * Parse Excel file (placeholder)
   */
  private async parseExcel(_file: File): Promise<ParsedPerbupItem[]> {
    // Will be implemented with SheetJS
    // For now, return empty array
    console.log('Excel parsing to be implemented with SheetJS')
    return []
  }

  /**
   * Validate parsed items
   */
  validateItems(items: ParsedPerbupItem[]): { valid: ParsedPerbupItem[]; invalid: ParsedPerbupItem[] } {
    const valid: ParsedPerbupItem[] = []
    const invalid: ParsedPerbupItem[] = []

    for (const item of items) {
      const isValid = 
        item.kode && 
        item.nama && 
        item.satuan && 
        item.harga > 0 &&
        item.harga < 100000000000 // Max 100 M (sanity check)

      if (isValid) {
        valid.push(item)
      } else {
        invalid.push(item)
      }
    }

    return { valid, invalid }
  }
}

// ============================================================================
// COST ESTIMATION ENGINE
// ============================================================================

export class CostEstimationEngine {
  private perbupParser: PerbupParser

  constructor() {
    this.perbupParser = new PerbupParser()
  }

  /**
   * Upload dan parse Perbup document
   */
  async uploadPerbup(
    file: File,
    metadata: {
      nomor: string
      tahun: number
      kabupaten: string
    }
  ): Promise<{ success: boolean; items: CostStandard[]; errors?: string[] }> {
    try {
      // Upload file to storage
      const fileName = `perbup/${metadata.kabupaten}_${metadata.tahun}_${Date.now()}.csv`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('templates')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Parse document
      const parsedItems = await this.perbupParser.parseDocument(file)
      const { valid, invalid } = this.perbupParser.validateItems(parsedItems)

      // Create Perbup record
      const { data: _perbupData, error: perbupError } = await supabase
        .from('perbup_documents')
        .insert({
          nama: file.name,
          nomor: metadata.nomor,
          tahun: metadata.tahun,
          kabupaten: metadata.kabupaten,
          file_url: uploadData.path,
          is_parsed: true,
          parsed_at: new Date().toISOString(),
          total_items: valid.length,
        })
        .select()
        .single()

      if (perbupError) throw perbupError

      // Convert to CostStandards
      const costStandards: CostStandard[] = valid.map(item => ({
        id: crypto.randomUUID(),
        kodeItem: item.kode,
        namaItem: item.nama,
        satuan: item.satuan,
        hargaSatuan: item.harga,
        sumber: `Perbup ${metadata.nomor} Tahun ${metadata.tahun} Kab. ${metadata.kabupaten}`,
        tahun: metadata.tahun,
        kategori: this.categorizeItem(item.nama),
        kabupaten: metadata.kabupaten,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))

      // Save to database
      const { error: insertError } = await supabase
        .from('cost_standards')
        .insert(costStandards)

      if (insertError) throw insertError

      return {
        success: true,
        items: costStandards,
        errors: invalid.length > 0 ? [`${invalid.length} item tidak valid`] : undefined,
      }
    } catch (error: any) {
      return {
        success: false,
        items: [],
        errors: [error.message || 'Upload failed'],
      }
    }
  }

  /**
   * Categorize item based on name
   */
  private categorizeItem(nama: string): 'material' | 'upah' | 'alat' {
    const lower = nama.toLowerCase()
    
    // Material keywords
    if (/semen|pasir|batu|besi|beton|cat|keramik|genteng|kayu|pipa|kabel|cat|pelapis/.test(lower)) {
      return 'material'
    }
    
    // Upah keywords
    if (/tukang|pekerja|mandor|tenaga kerja|upah|pemasangan|pengerjaan/.test(lower)) {
      return 'upah'
    }
    
    // Default to alat
    return 'alat'
  }

  /**
   * Search cost standards by keyword
   */
  async searchCostStandards(keyword: string, kabupaten?: string): Promise<CostStandard[]> {
    let query = supabase
      .from('cost_standards')
      .select('*')
      .ilike('nama_item', `%${keyword}%`)
      .eq('is_active', true)
    
    if (kabupaten) {
      query = query.eq('kabupaten', kabupaten)
    }
    
    const { data, error } = await query.order('nama_item').limit(50)
    
    if (error) {
      console.error('Search error:', error)
      return []
    }
    
    return data || []
  }

  /**
   * Get cost standards by component mapping
   */
  async getCostForComponent(
    komponenNama: string,
    _jenisKerusakan: string,
    kabupaten: string
  ): Promise<CostStandard[]> {
    // Map komponen to Perbup items
    const mappingRules: Record<string, string[]> = {
      'dinding': ['pasangan bata', 'plesteran', 'cat dinding', 'perbaikan dinding'],
      'lantai': ['plesteran lantai', 'keramik', 'perbaikan lantai'],
      'atap': ['genteng', 'usuk', 'reng', 'perbaikan atap'],
      'pondasi': ['urugan', 'batu kali', 'beton', 'perbaikan pondasi'],
      'kolom': ['beton kolom', 'bekisting', 'perbaikan kolom'],
      'balok': ['beton balok', 'bekisting', 'perbaikan balok'],
    }
    
    const keywords = mappingRules[komponenNama.toLowerCase()] || [komponenNama]
    const results: CostStandard[] = []
    
    for (const keyword of keywords) {
      const items = await this.searchCostStandards(keyword, kabupaten)
      results.push(...items)
    }
    
    // Remove duplicates
    return results.filter((item, index, self) => 
      index === self.findIndex(i => i.kodeItem === item.kodeItem)
    )
  }

  /**
   * Calculate total cost for repair
   */
  calculateRepairCost(
    volume: number,
    hargaSatuan: number,
    tambahan: { keuntungan?: number; ppn?: number } = {}
  ): CostBreakdown {
    const baseTotal = volume * hargaSatuan
    const keuntungan = baseTotal * (tambahan.keuntungan || 0.1) // 10% default
    const ppn = (baseTotal + keuntungan) * (tambahan.ppn || 0.11) // 11% PPN
    
    return {
      material: baseTotal * 0.6, // Asumsi 60% material
      upah: baseTotal * 0.3, // Asumsi 30% upah
      alat: baseTotal * 0.1, // Asumsi 10% alat
      total: baseTotal + keuntungan + ppn,
    }
  }

  /**
   * Generate cost estimation for survey
   */
  async generateSurveyEstimation(
    surveyId: string,
    kabupaten: string
  ): Promise<{ estimations: CostEstimation[]; total: number; errors: string[] }> {
    const errors: string[] = []
    const estimations: CostEstimation[] = []
    let total = 0
    
    try {
      // Get survey components
      const { data: components, error } = await supabase
        .from('components')
        .select('*')
        .eq('survey_id', surveyId)
      
      if (error) throw error
      
      if (!components || components.length === 0) {
        errors.push('Tidak ada komponen untuk diestimasi')
        return { estimations, total, errors }
      }
      
      for (const comp of components) {
        if (comp.volume_rusak <= 0) continue
        
        // Find matching cost standards
        const standards = await this.getCostForComponent(
          comp.nama_komponen,
          comp.deskripsi_kerusakan || '',
          kabupaten
        )
        
        if (standards.length === 0) {
          errors.push(`Tidak ditemukan harga untuk ${comp.nama_komponen}`)
          continue
        }
        
        // Use first match (best match)
        const standard = standards[0]
        
        // Calculate cost
        const breakdown = this.calculateRepairCost(comp.volume_rusak, standard.hargaSatuan)
        
        const estimation: CostEstimation = {
          id: crypto.randomUUID(),
          surveyId,
          componentId: comp.id,
          itemPekerjaan: standard.namaItem,
          volume: comp.volume_rusak,
          satuan: standard.satuan,
          hargaSatuan: standard.hargaSatuan,
          totalBiaya: breakdown.total,
          costStandardId: standard.id,
          catatan: `Sumber: ${standard.sumber}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        
        estimations.push(estimation)
        total += breakdown.total
      }
      
      // Save to database
      if (estimations.length > 0) {
        const { error: saveError } = await supabase
          .from('cost_estimations')
          .upsert(estimations)
        
        if (saveError) {
          errors.push(`Gagal menyimpan estimasi: ${saveError.message}`)
        }
      }
      
    } catch (error: any) {
      errors.push(error.message || 'Gagal generate estimasi')
    }
    
    return { estimations, total, errors }
  }

  /**
   * Get estimations for survey
   */
  async getSurveyEstimations(surveyId: string): Promise<CostEstimation[]> {
    const { data, error } = await supabase
      .from('cost_estimations')
      .select('*')
      .eq('survey_id', surveyId)
      .order('created_at')
    
    if (error) {
      console.error('Get estimations error:', error)
      return []
    }
    
    return data || []
  }

  /**
   * Format currency
   */
  formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const perbupParser = new PerbupParser()
export const costEstimationEngine = new CostEstimationEngine()

export default {
  PerbupParser,
  CostEstimationEngine,
  perbupParser,
  costEstimationEngine,
}
