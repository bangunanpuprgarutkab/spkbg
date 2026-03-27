/**
 * REPAIR RECOMMENDATION ENGINE
 * Smart AI Engineering Platform - SPKBG
 * 
 * Sistem rekomendasi perbaikan berbasis Rule Engine + AI Enhancement
 * Memberikan saran teknis metode perbaikan berdasarkan komponen dan klasifikasi
 */

import { supabase } from '@/services/supabase/client'
import type { DamageClassification } from '@/types'

// ============================================================================
// TYPES
// ============================================================================

export interface RepairRecommendation {
  id: string
  componentType: string
  classification: DamageClassification
  severity: 'ringan' | 'sedang' | 'berat'
  rekomendasiTeknis: string
  metodePerbaikan: string
  materials: string[]
  peralatan: string[]
  estimasiWaktu: string
  catatanSafety: string[]
  aiGenerated: boolean
  verified: boolean
  createdAt: string
  updatedAt: string
}

export interface RecommendationInput {
  componentName: string
  componentCategory: string
  classification: DamageClassification
  damageType?: string
  volumeRusak?: number
  deskripsiKerusakan?: string
  hasPhoto?: boolean
}

export interface RecommendationResult {
  recommendation: RepairRecommendation
  alternatifRekomendasi: RepairRecommendation[]
  confidence: number
  needsExpertReview: boolean
  warnings: string[]
}

// ============================================================================
// RULE ENGINE - CORE RECOMMENDATIONS
// ============================================================================

const CORE_RECOMMENDATIONS: Record<string, Record<string, Partial<RepairRecommendation>>> = {
  'dinding': {
    '1': {
      rekomendasiTeknis: 'Tidak perlu perbaikan struktural, hanya perawatan rutin',
      metodePerbaikan: 'Pembersihan dan pengecekan berkala',
      materials: ['Deterjen', 'Sikat', 'Air'],
      peralatan: ['Sikat keras', 'Kain lap'],
      estimasiWaktu: '1 hari',
      catatanSafety: ['Gunakan APD standar'],
    },
    '2': {
      rekomendasiTeknis: 'Perbaikan retak ringan dengan plester ulang',
      metodePerbaikan: 'Injeksi retak + plesteran lokal',
      materials: ['Semen PC', 'Pasir halus', 'Epoxy resin', 'Injeksi port'],
      peralatan: ['Mesin injeksi', 'Trowel', 'Sikat besi'],
      estimasiWaktu: '2-3 hari',
      catatanSafety: ['Kenakan masker debu', 'Gunakan sarung tangan'],
    },
    '3': {
      rekomendasiTeknis: 'Perbaikan retak sedang dengan penguatan',
      metodePerbaikan: 'Injeksi epoxy + wire mesh + plester ulang',
      materials: ['Epoxy resin', 'Wire mesh', 'Semen PC', 'Pasir halus', 'Bonding agent'],
      peralatan: ['Mesin injeksi', 'Gerinda', 'Trowel', 'Wire cutter'],
      estimasiWaktu: '3-5 hari',
      catatanSafety: ['Ventilasi baik saat menggunakan epoxy', 'APD lengkap'],
    },
    '4': {
      rekomendasiTeknis: 'Perbaikan kerusakan lokal dengan pembetonan ulang',
      metodePerbaikan: 'Bongkar bagian rusak → tulangan tambahan → bekisting → cor ulang',
      materials: ['Beton K-225', 'Bekisting', 'Tulangan tambahan', 'Sika additive'],
      peralatan: ['Concrete mixer', 'Vibrator', 'Trowel', 'Cetok'],
      estimasiWaktu: '5-7 hari',
      catatanSafety: ['Pengamanan area kerja', 'Tanda bahaya', 'APD lengkap'],
    },
    '5': {
      rekomendasiTeknis: 'Penggantian dinding sebagian dengan struktur baru',
      metodePerbaikan: 'Bongkar 50-70% dinding → pasang tulangan baru → cor ulang',
      materials: ['Beton K-250', 'Bekisting', 'Tulangan D13', 'Sika additive', 'Batu bata (jika pasangan)'],
      peralatan: ['Concrete mixer', 'Vibrator', 'Pompa cor', 'Gerinda'],
      estimasiWaktu: '7-14 hari',
      catatanSafety: ['Pengamanan struktur sementara', 'Pantau struktur tetangga', 'Ahli struktur on-site'],
    },
    '6': {
      rekomendasiTeknis: 'Rekonstruksi dinding besar-besaran',
      metodePerbaikan: 'Bongkar total dinding → fondasi baru → dinding baru',
      materials: ['Beton K-300', 'Bekisting berkualitas tinggi', 'Tulangan D16', 'Waterstop'],
      peralatan: ['Heavy equipment', 'Concrete pump', 'Vibrator', 'Rebar cutter'],
      estimasiWaktu: '14-21 hari',
      catatanSafety: ['Izin khusus', 'Engineer struktur wajib', 'Pantau bangunan sekitar'],
    },
    '7': {
      rekomendasiTeknis: 'DEMOLISH DAN BANGUN ULANG TOTAL',
      metodePerbaikan: 'Bongkar total → desain ulang → konstruksi baru',
      materials: ['Beton K-350+', 'Baja tulangan berkualitas tinggi', 'Waterproofing'],
      peralatan: ['Heavy demolition equipment', 'Engineering survey tools'],
      estimasiWaktu: '30+ hari',
      catatanSafety: ['WAJIB konsultasi ahli struktur', 'Izin bongkar', 'Evakuasi area'],
    },
  },

  'kolom': {
    '1': {
      rekomendasiTeknis: 'Perawatan permukaan',
      metodePerbaikan: 'Cat ulang / coating pelindung',
      materials: ['Cat epoxy', 'Thinner', 'Kanvas'],
      peralatan: ['Kuas', 'Roller', 'Compressor'],
      estimasiWaktu: '1 hari',
      catatanSafety: ['Ventilasi baik'],
    },
    '2': {
      rekomendasiTeknis: 'Repair spalling ringan',
      metodePerbaikan: 'Bersihkan → bonding → mortar repair',
      materials: ['Mortar repair', 'Bonding agent', 'Semen PC'],
      peralatan: ['Trowel', 'Sikat besi', 'Compressor'],
      estimasiWaktu: '2 hari',
      catatanSafety: ['APD standar'],
    },
    '3': {
      rekomendasiTeknis: 'Injeksi retak + patching',
      metodePerbaikan: 'Injeksi epoxy → repair mortar → cat ulang',
      materials: ['Epoxy injeksi', 'Repair mortar', 'Wire mesh'],
      peralatan: ['Mesin injeksi', 'Trowel', 'Wire cutter'],
      estimasiWaktu: '3-4 hari',
      catatanSafety: ['Ventilasi epoxy', 'APD lengkap'],
    },
    '4': {
      rekomendasiTeknis: 'Jacketing kolom setempat',
      metodePerbaikan: 'Tambahan bekisting → tulangan tambahan → cor tambahan',
      materials: ['Beton K-250', 'Bekisting', 'Tulangan D13', 'Coupler'],
      peralatan: ['Concrete mixer', 'Vibrator', 'Rebar tools'],
      estimasiWaktu: '5-7 hari',
      catatanSafety: ['Support sementara', 'Pantau defleksi'],
    },
    '5': {
      rekomendasiTeknis: 'Full jacketing kolom',
      metodePerbaikan: 'Selubung beton baru di sekeliling kolom existing',
      materials: ['Beton K-300', 'Bekisting', 'Tulangan D16', 'Shear connector'],
      peralatan: ['Concrete pump', 'Vibrator', 'Rebar bender'],
      estimasiWaktu: '7-10 hari',
      catatanSafety: ['Engineer on-site', 'Support sementara wajib'],
    },
    '6': {
      rekomendasiTeknis: 'Perkuatan kolom dengan CFRP/Steel plate',
      metodePerbaikan: 'Wrapping CFRP atau steel plate bonding',
      materials: ['CFRP sheet / Steel plate', 'Structural adhesive', 'Primer'],
      peralatan: ['Rollers', 'Heating equipment', 'Clamps'],
      estimasiWaktu: '7-14 hari',
      catatanSafety: ['Ahli komposit wajib', 'Quality control strict'],
    },
    '7': {
      rekomendasiTeknis: 'GANTI KOLOM BARU / REKONSTRUKSI',
      metodePerbaikan: 'Support struktur → bongkar kolom → kolom baru',
      materials: ['Beton K-350', 'Tulangan D19', 'High-strength materials'],
      peralatan: ['Heavy equipment', 'Temporary supports'],
      estimasiWaktu: '14-30 hari',
      catatanSafety: ['WAJIB ahli struktur', 'Izin khusus', 'Monitoring real-time'],
    },
  },

  'pondasi': {
    '1': {
      rekomendasiTeknis: 'Pengecekan dan dokumentasi',
      metodePerbaikan: 'Survey kondisi → dokumentasi',
      materials: ['Alat survey', 'Kamera'],
      peralatan: ['Waterpass', 'Theodolite'],
      estimasiWaktu: '1 hari',
      catatanSafety: ['APD standar'],
    },
    '2': {
      rekomendasiTeknis: 'Perbaikan retak pondasi ringan',
      metodePerbaikan: 'Injeksi epoxy pada retak',
      materials: ['Epoxy injeksi', 'Port injeksi'],
      peralatan: ['Mesin injeksi', 'Bor'],
      estimasiWaktu: '2-3 hari',
      catatanSafety: ['Kenakan masker'],
    },
    '3': {
      rekomendasiTeknis: 'Grouting pondasi',
      metodePerbaikan: 'Injeksi grouting untuk perkuatan',
      materials: ['Grouting material', 'Admixture'],
      peralatan: ['Grouting pump', 'Mixer'],
      estimasiWaktu: '3-5 hari',
      catatanSafety: ['Ventilasi'],
    },
    '4': {
      rekomendasiTeknis: 'Underpinning setempat',
      metodePerbaikan: 'Tambahan pondasi mikropile atau jet grouting',
      materials: ['Mikropile', 'Beton grout', 'Baja'],
      peralatan: ['Drilling rig', 'Grouting equipment'],
      estimasiWaktu: '7-14 hari',
      catatanSafety: ['Ahli fondasi wajib', 'Monitoring settlement'],
    },
    '5': {
      rekomendasiTeknis: 'Perkuatan pondasi dengan tiang pancang tambahan',
      metodePerbaikan: 'Tiang pancang baru + pile cap baru',
      materials: ['Tiang pancang', 'Pile cap beton', 'Tulangan'],
      peralatan: ['Piling rig', 'Concrete equipment'],
      estimasiWaktu: '14-21 hari',
      catatanSafety: ['Engineer geoteknik wajib', 'Noise control'],
    },
    '6': {
      rekomendasiTeknis: 'Rekonstruksi pondasi parsial',
      metodePerbaikan: 'Bongkar pondasi rusak → pondasi baru',
      materials: ['Beton K-300', 'Tiang pancang', 'Waterproofing'],
      peralatan: ['Heavy equipment', 'Dewatering system'],
      estimasiWaktu: '21-30 hari',
      catatanSafety: ['Ahli struktur + geoteknik', 'Izin khusus'],
    },
    '7': {
      rekomendasiTeknis: 'REKONSTRUKSI PONDASI TOTAL',
      metodePerbaikan: 'Lift building / underpinning total',
      materials: ['High-capacity piles', 'Grade beam baru', 'Void formers'],
      peralatan: ['Jacking system', 'Heavy equipment'],
      estimasiWaktu: '30-60 hari',
      catatanSafety: ['WAJIB ahli struktur senior', 'Engineering peer review', 'Evakuasi'],
    },
  },

  'default': {
    '1': {
      rekomendasiTeknis: 'Perawatan rutin',
      metodePerbaikan: 'Pembersihan dan inspeksi',
      materials: ['Material cleaning'],
      peralatan: ['Peralatan standar'],
      estimasiWaktu: '1 hari',
      catatanSafety: ['APD standar'],
    },
    '2': {
      rekomendasiTeknis: 'Perbaikan minor',
      metodePerbaikan: 'Repair lokal',
      materials: ['Repair mortar', 'Cat'],
      peralatan: ['Tools standar'],
      estimasiWaktu: '1-2 hari',
      catatanSafety: ['APD standar'],
    },
    '3': {
      rekomendasiTeknis: 'Perbaikan sedang',
      metodePerbaikan: 'Repair dengan penguatan',
      materials: ['Repair materials', 'Reinforcement'],
      peralatan: ['Tools + small equipment'],
      estimasiWaktu: '2-4 hari',
      catatanSafety: ['APD lengkap'],
    },
    '4': {
      rekomendasiTeknis: 'Perbaikan besar',
      metodePerbaikan: 'Rekonstruksi parsial',
      materials: ['Beton', 'Bekisting', 'Tulangan'],
      peralatan: ['Concrete equipment'],
      estimasiWaktu: '5-10 hari',
      catatanSafety: ['Engineer supervision'],
    },
    '5': {
      rekomendasiTeknis: 'Perbaikan struktural',
      metodePerbaikan: 'Strengthening / retrofitting',
      materials: ['Structural materials', 'CFRP/Steel'],
      peralatan: ['Specialized equipment'],
      estimasiWaktu: '7-14 hari',
      catatanSafety: ['Ahli struktur wajib'],
    },
    '6': {
      rekomendasiTeknis: 'Rekonstruksi major',
      metodePerbaikan: 'Bongkar dan bangun ulang parsial',
      materials: ['High-strength concrete', 'Premium materials'],
      peralatan: ['Heavy equipment'],
      estimasiWaktu: '14-30 hari',
      catatanSafety: ['Ahli struktur + izin'],
    },
    '7': {
      rekomendasiTeknis: 'REKONSTRUKSI TOTAL',
      metodePerbaikan: 'Bongkar total dan bangun baru',
      materials: ['All new construction materials'],
      peralatan: ['Full construction equipment'],
      estimasiWaktu: '30+ hari',
      catatanSafety: ['WAJIB ahli struktur senior', 'Full engineering team'],
    },
  },
}

// ============================================================================
// RECOMMENDATION ENGINE
// ============================================================================

export class RepairRecommendationEngine {
  /**
   * Get repair recommendation
   */
  async getRecommendation(input: RecommendationInput): Promise<RecommendationResult> {
    const componentType = this.normalizeComponentType(input.componentName, input.componentCategory)
    const classification = input.classification

    // Get core recommendation from rule engine
    const coreRec = this.getCoreRecommendation(componentType, classification)
    
    // Enhance with AI if needed
    const enhancedRec = await this.enhanceWithAI(coreRec, input)

    // Create full recommendation
    const recommendation: RepairRecommendation = {
      id: crypto.randomUUID(),
      componentType: input.componentName,
      classification,
      severity: this.classificationToSeverity(classification),
      rekomendasiTeknis: enhancedRec.rekomendasiTeknis || 'Perlu analisis lanjutan',
      metodePerbaikan: enhancedRec.metodePerbaikan || 'Metode standar',
      materials: enhancedRec.materials || [],
      peralatan: enhancedRec.peralatan || [],
      estimasiWaktu: enhancedRec.estimasiWaktu || '1-3 hari',
      catatanSafety: enhancedRec.catatanSafety || [],
      aiGenerated: false,
      verified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Get alternatives
    const alternatifRekomendasi = this.getAlternativeRecommendations(componentType, classification)

    // Calculate confidence and warnings
    const { confidence, warnings } = this.calculateConfidenceAndWarnings(input, recommendation)

    return {
      recommendation,
      alternatifRekomendasi,
      confidence,
      needsExpertReview: classification >= '5' || confidence < 0.7,
      warnings,
    }
  }

  /**
   * Get core recommendation from rule engine
   */
  getCoreRecommendation(
    componentType: string,
    classification: DamageClassification
  ): Partial<RepairRecommendation> {
    const componentRules = CORE_RECOMMENDATIONS[componentType] || CORE_RECOMMENDATIONS['default']
    return componentRules[classification] || CORE_RECOMMENDATIONS['default'][classification]
  }

  /**
   * Enhance recommendation with AI/context
   */
  private async enhanceWithAI(
    coreRec: Partial<RepairRecommendation>,
    input: RecommendationInput
  ): Promise<Partial<RepairRecommendation>> {
    const enhanced = { ...coreRec }

    // Add photo-based context if available
    if (input.hasPhoto && input.damageType) {
      enhanced.catatanSafety = [
        ...(enhanced.catatanSafety || []),
        `Verifikasi visual: ${input.damageType}`,
      ]
    }

    // Add volume-based context
    if (input.volumeRusak && input.volumeRusak > 10) {
      enhanced.catatanSafety = [
        ...(enhanced.catatanSafety || []),
        'Volume kerusakan besar - perhatikan pengamanan area',
      ]
    }

    return enhanced
  }

  /**
   * Get alternative recommendations
   */
  private getAlternativeRecommendations(
    componentType: string,
    classification: DamageClassification
  ): RepairRecommendation[] {
    const alternatives: RepairRecommendation[] = []
    const clsNum = parseInt(classification)

    // Suggest one level up (more conservative)
    if (clsNum < 7) {
      const upRec = this.getCoreRecommendation(componentType, String(clsNum + 1) as DamageClassification)
      alternatives.push({
        id: crypto.randomUUID(),
        componentType: 'Alternative (Lebih Konservatif)',
        classification: String(clsNum + 1) as DamageClassification,
        severity: this.classificationToSeverity(String(clsNum + 1) as DamageClassification),
        rekomendasiTeknis: upRec.rekomendasiTeknis || 'Perlu analisis lanjutan',
        metodePerbaikan: upRec.metodePerbaikan || 'Metode standar',
        materials: upRec.materials || [],
        peralatan: upRec.peralatan || [],
        estimasiWaktu: upRec.estimasiWaktu || '1-3 hari',
        catatanSafety: upRec.catatanSafety || [],
        aiGenerated: false,
        verified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }

    // Suggest one level down (if applicable)
    if (clsNum > 1 && clsNum <= 3) {
      const downRec = this.getCoreRecommendation(componentType, String(clsNum - 1) as DamageClassification)
      alternatives.push({
        id: crypto.randomUUID(),
        componentType: 'Alternative (Minimalis)',
        classification: String(clsNum - 1) as DamageClassification,
        severity: this.classificationToSeverity(String(clsNum - 1) as DamageClassification),
        rekomendasiTeknis: downRec.rekomendasiTeknis || 'Perlu analisis lanjutan',
        metodePerbaikan: downRec.metodePerbaikan || 'Metode standar',
        materials: downRec.materials || [],
        peralatan: downRec.peralatan || [],
        estimasiWaktu: downRec.estimasiWaktu || '1-3 hari',
        catatanSafety: downRec.catatanSafety || [],
        aiGenerated: false,
        verified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }

    return alternatives
  }

  /**
   * Normalize component type
   */
  private normalizeComponentType(name: string, category?: string): string {
    const lowerName = name.toLowerCase()
    
    // Direct mapping
    if (lowerName.includes('dinding') || lowerName.includes('wall')) return 'dinding'
    if (lowerName.includes('kolom') || lowerName.includes('column')) return 'kolom'
    if (lowerName.includes('balok') || lowerName.includes('beam')) return 'balok'
    if (lowerName.includes('plat') || lowerName.includes('slab')) return 'plat lantai'
    if (lowerName.includes('pondasi') || lowerName.includes('foundation')) return 'pondasi'
    if (lowerName.includes('atap') || lowerName.includes('roof')) return 'atap'
    if (lowerName.includes('lantai') || lowerName.includes('floor')) return 'lantai'
    
    // Category-based fallback
    if (category) {
      const lowerCat = category.toLowerCase()
      if (lowerCat.includes('struktur')) {
        if (lowerName.includes('vertikal')) return 'kolom'
        if (lowerName.includes('horizontal')) return 'balok'
      }
    }

    return 'default'
  }

  /**
   * Classification to severity
   */
  private classificationToSeverity(cls: DamageClassification): 'ringan' | 'sedang' | 'berat' {
    const num = parseInt(cls)
    if (num <= 2) return 'ringan'
    if (num <= 4) return 'sedang'
    return 'berat'
  }

  /**
   * Calculate confidence and warnings
   */
  private calculateConfidenceAndWarnings(
    input: RecommendationInput,
    rec: RepairRecommendation
  ): { confidence: number; warnings: string[] } {
    const warnings: string[] = []
    let confidence = 0.9

    // Lower confidence for high classifications
    if (parseInt(input.classification) >= 6) {
      confidence = 0.7
      warnings.push('Kerusakan berat - wajib konsultasi ahli struktur')
    }

    // Warning for structural components
    if (['kolom', 'balok', 'pondasi'].includes(rec.componentType.toLowerCase())) {
      warnings.push('Komponen struktural kritis - perlu perhitungan struktur')
    }

    // Warning for large volumes
    if (input.volumeRusak && input.volumeRusak > 50) {
      warnings.push('Volume kerusakan besar - pertimbangkan rekonstruksi parsial')
    }

    // Warning for critical damage types
    if (input.damageType?.includes('runtuh') || input.damageType?.includes('patah')) {
      warnings.push('Kerusakan struktural kritis - evakuasi dan ahli struktur wajib')
      confidence = 0.5
    }

    return { confidence, warnings }
  }

  /**
   * Save recommendation to database
   */
  async saveRecommendation(rec: RepairRecommendation): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('repair_recommendations')
        .insert({
          id: rec.id,
          component_type: rec.componentType,
          classification: rec.classification,
          rekomendasi_teknis: rec.rekomendasiTeknis,
          metode_perbaikan: rec.metodePerbaikan,
          materials: rec.materials,
          peralatan: rec.peralatan,
          estimasi_waktu: rec.estimasiWaktu,
          catatan_safety: rec.catatanSafety,
          ai_generated: rec.aiGenerated,
          verified: rec.verified,
          created_at: rec.createdAt,
          updated_at: rec.updatedAt,
        })

      return !error
    } catch {
      return false
    }
  }

  /**
   * Get recommendations for survey
   */
  async getSurveyRecommendations(surveyId: string): Promise<RecommendationResult[]> {
    try {
      // Get components
      const { data: components } = await supabase
        .from('components')
        .select('*')
        .eq('survey_id', surveyId)

      if (!components) return []

      // Get recommendations for each
      const results: RecommendationResult[] = []
      for (const comp of components) {
        const result = await this.getRecommendation({
          componentName: comp.nama_komponen,
          componentCategory: comp.kategori,
          classification: comp.klasifikasi,
          volumeRusak: comp.volume_rusak,
          deskripsiKerusakan: comp.deskripsi_kerusakan,
        })
        results.push(result)
      }

      return results
    } catch {
      return []
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const repairRecommendationEngine = new RepairRecommendationEngine()

export function getRepairRecommendation(componentName: string, klasifikasi: string): string {
  const engine = new RepairRecommendationEngine()
  const rec = engine.getCoreRecommendation(
    engine['normalizeComponentType'](componentName, undefined),
    klasifikasi as DamageClassification
  )
  return rec.rekomendasiTeknis || 'Perlu analisis lanjutan'
}

export default {
  RepairRecommendationEngine,
  repairRecommendationEngine,
  getRepairRecommendation,
  CORE_RECOMMENDATIONS,
}
