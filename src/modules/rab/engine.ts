/**
 * RAB (RENCANA ANGGARAN BIAYA) ENGINE
 * Smart AI Engineering Platform - SPKBG
 * 
 * Generasi RAB lengkap dengan struktur detail
 * Export ke Excel sesuai template standar
 */

import * as XLSX from 'xlsx'
import { supabase } from '@/services/supabase/client'

// ============================================================================
// TYPES
// ============================================================================

export interface RABItem {
  no: number
  uraian: string
  volume: number
  satuan: string
  hargaSatuan: number
  subtotal: number
  keterangan?: string
}

export interface RABSection {
  nama: string
  items: RABItem[]
  subtotal: number
}

export interface RABDocument {
  id: string
  surveyId: string
  projectId: string
  kodeRAB: string
  namaPekerjaan: string
  lokasi: string
  tahunAnggaran: number
  sections: RABSection[]
  
  // Perhitungan
  jumlahHarga: number
  ppn: number // 11%
  totalHarga: number
  dibulatkan: number
  
  // Terbilang
  terbilang: string
  
  // Metadata
  createdAt: string
  updatedAt: string
  createdBy: string
  status: 'draft' | 'final' | 'approved'
}

export interface RABSummary {
  totalItem: number
  totalVolume: number
  totalBiaya: number
  perKategori: Record<string, number>
  komponenTerbesar: string
  komponenTerkecil: string
}

export interface RABExportOptions {
  format: 'xlsx' | 'pdf'
  template?: 'standar' | 'minimalis'
  includePhotos?: boolean
  includeRecommendations?: boolean
}

// ============================================================================
// RAB ENGINE
// ============================================================================

export class RABEngine {
  private ppnRate: number = 0.11 // 11% PPN

  /**
   * Generate RAB from mapped items
   */
  async generateRAB(
    surveyId: string,
    mappedItems: Array<{
      componentId: string
      componentName: string
      matchedItem: {
        kodeItem: string
        namaItem: string
        satuan: string
        hargaSatuan: number
      } | null
      volume: number
    }>
  ): Promise<RABDocument> {
    // Get survey & project info
    const { data: survey } = await supabase
      .from('surveys')
      .select('*, project:projects(*)')
      .eq('id', surveyId)
      .single()

    if (!survey) {
      throw new Error('Survey not found')
    }

    // Group by category
    const sections = this.groupByCategory(mappedItems)

    // Calculate totals
    const jumlahHarga = sections.reduce((sum, s) => sum + s.subtotal, 0)
    const ppn = jumlahHarga * this.ppnRate
    const totalHarga = jumlahHarga + ppn
    const dibulatkan = Math.ceil(totalHarga / 1000) * 1000

    // Generate RAB code
    const kodeRAB = await this.generateRABCode(survey.project_id)

    const rab: RABDocument = {
      id: crypto.randomUUID(),
      surveyId,
      projectId: survey.project_id,
      kodeRAB,
      namaPekerjaan: `Perbaikan ${survey.project?.nama_bangunan || 'Bangunan'}`,
      lokasi: `${survey.project?.alamat || ''}, ${survey.project?.kabupaten || ''}`,
      tahunAnggaran: new Date().getFullYear(),
      sections,
      jumlahHarga,
      ppn,
      totalHarga,
      dibulatkan,
      terbilang: this.terbilangRupiah(dibulatkan),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: survey.surveyor_id,
      status: 'draft',
    }

    // Save to database
    await this.saveRAB(rab)

    return rab
  }

  /**
   * Group items by category
   */
  private groupByCategory(
    mappedItems: Array<{
      componentId: string
      componentName: string
      matchedItem: any
      volume: number
    }>
  ): RABSection[] {
    const groups: Record<string, RABItem[]> = {
      'PEKERJAAN PERSIAPAN': [],
      'PEKERJAAN PONDASI': [],
      'PEKERJAAN STRUKTUR': [],
      'PEKERJAAN DINDING & PARTISI': [],
      'PEKERJAAN LANTAI': [],
      'PEKERJAAN ATAP': [],
      'PEKERJAAN PLAFON': [],
      'PEKERJAAN PINTU & JENDELA': [],
      'PEKERJAAN SANITASI': [],
      'PEKERJAAN LISTRIK': [],
      'PEKERJAAN FINISHING': [],
      'PEKERJAAN LAIN-LAIN': [],
    }

    let itemNo = 1

    for (const item of mappedItems) {
      if (!item.matchedItem) continue

      const category = this.getCategoryFromComponent(item.componentName)
      
      const rabItem: RABItem = {
        no: itemNo++,
        uraian: `${item.matchedItem.namaItem} (${item.componentName})`,
        volume: item.volume,
        satuan: item.matchedItem.satuan,
        hargaSatuan: item.matchedItem.hargaSatuan,
        subtotal: item.volume * item.matchedItem.hargaSatuan,
        keterangan: item.matchedItem.kodeItem,
      }

      groups[category].push(rabItem)
    }

    // Convert to sections (only non-empty)
    return Object.entries(groups)
      .filter(([_, items]) => items.length > 0)
      .map(([nama, items]) => ({
        nama,
        items,
        subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
      }))
  }

  /**
   * Get category from component name
   */
  private getCategoryFromComponent(componentName: string): string {
    const lower = componentName.toLowerCase()
    
    if (lower.includes('pondasi')) return 'PEKERJAAN PONDASI'
    if (lower.includes('kolom') || lower.includes('balok') || lower.includes('plat')) {
      return 'PEKERJAAN STRUKTUR'
    }
    if (lower.includes('dinding')) return 'PEKERJAAN DINDING & PARTISI'
    if (lower.includes('lantai') || lower.includes('floor')) return 'PEKERJAAN LANTAI'
    if (lower.includes('atap') || lower.includes('roof') || lower.includes('genteng')) {
      return 'PEKERJAAN ATAP'
    }
    if (lower.includes('plafon') || lower.includes('ceiling')) return 'PEKERJAAN PLAFON'
    if (lower.includes('pintu') || lower.includes('jendela') || lower.includes('door') || lower.includes('window')) {
      return 'PEKERJAAN PINTU & JENDELA'
    }
    if (lower.includes('sanitasi') || lower.includes('wc') || lower.includes('toilet') || lower.includes('wastafel')) {
      return 'PEKERJAAN SANITASI'
    }
    if (lower.includes('listrik') || lower.includes('electrical') || lower.includes('lampu')) {
      return 'PEKERJAAN LISTRIK'
    }
    if (lower.includes('cat') || lower.includes('plester') || lower.includes('finishing')) {
      return 'PEKERJAAN FINISHING'
    }
    
    return 'PEKERJAAN LAIN-LAIN'
  }

  /**
   * Generate RAB code
   */
  private async generateRABCode(projectId: string): Promise<string> {
    const year = new Date().getFullYear()
    const count = await this.getRABCountForYear(year)
    const seq = String(count + 1).padStart(4, '0')
    
    return `RAB-${year}-${projectId.substring(0, 4)}-${seq}`
  }

  /**
   * Get RAB count for year
   */
  private async getRABCountForYear(year: number): Promise<number> {
    const { count, error: _error } = await supabase
      .from('rab_documents')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${year}-01-01`)
      .lt('created_at', `${year + 1}-01-01`)

    return count || 0
  }

  /**
   * Save RAB to database
   */
  private async saveRAB(rab: RABDocument): Promise<void> {
    const { error } = await supabase.from('rab_documents').insert({
      id: rab.id,
      survey_id: rab.surveyId,
      project_id: rab.projectId,
      kode_rab: rab.kodeRAB,
      nama_pekerjaan: rab.namaPekerjaan,
      lokasi: rab.lokasi,
      tahun_anggaran: rab.tahunAnggaran,
      sections: rab.sections,
      jumlah_harga: rab.jumlahHarga,
      ppn: rab.ppn,
      total_harga: rab.totalHarga,
      dibulatkan: rab.dibulatkan,
      terbilang: rab.terbilang,
      created_at: rab.createdAt,
      updated_at: rab.updatedAt,
      created_by: rab.createdBy,
      status: rab.status,
    })

    if (error) throw error
  }

  /**
   * Terbilang rupiah
   */
  terbilangRupiah(amount: number): string {
    const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas']
    
    const convert = (n: number): string => {
      if (n < 12) return satuan[n]
      if (n < 20) return satuan[n - 10] + ' Belas'
      if (n < 100) return satuan[Math.floor(n / 10)] + ' Puluh ' + satuan[n % 10]
      if (n < 200) return 'Seratus ' + convert(n - 100)
      if (n < 1000) return satuan[Math.floor(n / 100)] + ' Ratus ' + convert(n % 100)
      if (n < 2000) return 'Seribu ' + convert(n - 1000)
      if (n < 1000000) return convert(Math.floor(n / 1000)) + ' Ribu ' + convert(n % 1000)
      if (n < 1000000000) return convert(Math.floor(n / 1000000)) + ' Juta ' + convert(n % 1000000)
      return convert(Math.floor(n / 1000000000)) + ' Miliar ' + convert(n % 1000000000)
    }

    return convert(amount) + ' Rupiah'
  }

  /**
   * Export RAB to Excel
   */
  exportRABToExcel(rab: RABDocument, _options: RABExportOptions = { format: 'xlsx' }): ArrayBuffer {
    const wb = XLSX.utils.book_new()

    // Header sheet - data prepared for future use
    const _headerData = [
      ['RENCANA ANGGARAN BIAYA (RAB)'],
      [''],
      ['Kode RAB', rab.kodeRAB],
      ['Nama Pekerjaan', rab.namaPekerjaan],
      ['Lokasi', rab.lokasi],
      ['Tahun Anggaran', rab.tahunAnggaran],
      ['Tanggal', new Date(rab.createdAt).toLocaleDateString('id-ID')],
      [''],
    ]
    void _headerData

    // Items sheets by section
    for (const section of rab.sections) {
      const sectionData = [
        [section.nama],
        [''],
        ['No', 'Uraian', 'Volume', 'Satuan', 'Harga Satuan (Rp)', 'Jumlah (Rp)', 'Keterangan'],
        ...section.items.map(item => [
          item.no,
          item.uraian,
          item.volume,
          item.satuan,
          item.hargaSatuan,
          item.subtotal,
          item.keterangan || '',
        ]),
        ['', '', '', '', 'Subtotal', section.subtotal, ''],
        [''],
      ]

      const ws = XLSX.utils.aoa_to_sheet(sectionData)
      XLSX.utils.book_append_sheet(wb, ws, section.nama.substring(0, 31))
    }

    // Summary sheet
    const summaryData = [
      ['RINGKASAN RAB'],
      [''],
      ['Jumlah Harga', rab.jumlahHarga],
      ['PPN (11%)', rab.ppn],
      ['Total Harga', rab.totalHarga],
      ['Dibulatkan', rab.dibulatkan],
      [''],
      ['Terbilang:', rab.terbilang],
    ]

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Ringkasan')

    // Combined sheet with all items
    const allItemsData = [
      ['RENCANA ANGGARAN BIAYA (RAB)'],
      [''],
      ['Kode RAB:', rab.kodeRAB],
      ['Nama Pekerjaan:', rab.namaPekerjaan],
      ['Lokasi:', rab.lokasi],
      [''],
      ['No', 'Kelompok Pekerjaan', 'Uraian', 'Volume', 'Satuan', 'Harga Satuan (Rp)', 'Jumlah (Rp)'],
    ]

    let globalNo = 1
    for (const section of rab.sections) {
      for (const item of section.items) {
        allItemsData.push([
          String(globalNo++),
          section.nama,
          item.uraian,
          String(item.volume),
          item.satuan,
          String(item.hargaSatuan),
          String(item.subtotal),
        ])
      }
    }

    allItemsData.push(
      [''],
      ['', '', '', '', '', 'Jumlah Harga', String(rab.jumlahHarga)],
      ['', '', '', '', '', 'PPN (11%)', String(rab.ppn)],
      ['', '', '', '', '', 'TOTAL HARGA', String(rab.totalHarga)],
      ['', '', '', '', '', 'Dibulatkan', String(rab.dibulatkan)],
      [''],
      ['Terbilang: ' + rab.terbilang]
    )

    const combinedWs = XLSX.utils.aoa_to_sheet(allItemsData)
    XLSX.utils.book_append_sheet(wb, combinedWs, 'RAB Lengkap')

    // Generate buffer
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  }

  /**
   * Get RAB summary
   */
  getSummary(rab: RABDocument): RABSummary {
    const allItems = rab.sections.flatMap(s => s.items)
    
    const perKategori: Record<string, number> = {}
    for (const section of rab.sections) {
      perKategori[section.nama] = section.subtotal
    }

    // Find largest and smallest
    const sortedBySubtotal = [...allItems].sort((a, b) => b.subtotal - a.subtotal)

    return {
      totalItem: allItems.length,
      totalVolume: allItems.reduce((sum, i) => sum + i.volume, 0),
      totalBiaya: rab.dibulatkan,
      perKategori,
      komponenTerbesar: sortedBySubtotal[0]?.uraian || '-',
      komponenTerkecil: sortedBySubtotal[sortedBySubtotal.length - 1]?.uraian || '-',
    }
  }

  /**
   * Load RAB from database
   */
  async loadRAB(rabId: string): Promise<RABDocument | null> {
    const { data, error } = await supabase
      .from('rab_documents')
      .select('*')
      .eq('id', rabId)
      .single()

    if (error || !data) return null

    return {
      id: data.id,
      surveyId: data.survey_id,
      projectId: data.project_id,
      kodeRAB: data.kode_rab,
      namaPekerjaan: data.nama_pekerjaan,
      lokasi: data.lokasi,
      tahunAnggaran: data.tahun_anggaran,
      sections: data.sections,
      jumlahHarga: data.jumlah_harga,
      ppn: data.ppn,
      totalHarga: data.total_harga,
      dibulatkan: data.dibulatkan,
      terbilang: data.terbilang,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: data.created_by,
      status: data.status,
    }
  }

  /**
   * Get all RABs for project
   */
  async getProjectRABs(projectId: string): Promise<RABDocument[]> {
    const { data, error } = await supabase
      .from('rab_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) return []

    return (data || []).map(d => ({
      id: d.id,
      surveyId: d.survey_id,
      projectId: d.project_id,
      kodeRAB: d.kode_rab,
      namaPekerjaan: d.nama_pekerjaan,
      lokasi: d.lokasi,
      tahunAnggaran: d.tahun_anggaran,
      sections: d.sections,
      jumlahHarga: d.jumlah_harga,
      ppn: d.ppn,
      totalHarga: d.total_harga,
      dibulatkan: d.dibulatkan,
      terbilang: d.terbilang,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      createdBy: d.created_by,
      status: d.status,
    }))
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const rabEngine = new RABEngine()

export default {
  RABEngine,
  rabEngine,
}
