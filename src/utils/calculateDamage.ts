import type { DamageClassification, DamageCategory, Component } from '@/types'

/**
 * Classification values mapping (1-7 to decimal)
 */
export const CLASSIFICATION_VALUES: Record<DamageClassification, number> = {
  '1': 0.00,  // Tidak ada kerusakan
  '2': 0.20,  // Kerusakan ringan
  '3': 0.35,  // Kerusakan sedang-ringan
  '4': 0.50,  // Kerusakan sedang
  '5': 0.70,  // Kerusakan sedang-berat
  '6': 0.85,  // Kerusakan berat
  '7': 1.00,  // Kerusakan sangat berat/hancur
}

/**
 * Thresholds for damage categories
 */
export const DAMAGE_THRESHOLDS = {
  RINGAN: 30,
  SEDANG: 45,
} as const

/**
 * Calculate individual component damage value
 * Formula: (volume_rusak / volume_total) * classification_value * bobot_komponen
 */
export function calculateComponentDamage(
  volumeTotal: number,
  volumeRusak: number,
  klasifikasi: DamageClassification,
  bobotKomponen: number
): number {
  if (volumeTotal <= 0 || !klasifikasi) return 0
  
  const nilaiKlasifikasi = CLASSIFICATION_VALUES[klasifikasi]
  const ratio = Math.min(volumeRusak / volumeTotal, 1) // Cap at 100%
  
  return ratio * nilaiKlasifikasi * bobotKomponen
}

/**
 * Calculate total damage from all components
 */
export function calculateTotalDamage(components: Component[]): {
  total: number
  byCategory: Record<string, number>
  isCritical: boolean
} {
  const byCategory: Record<string, number> = {
    struktur: 0,
    arsitektur: 0,
    utilitas: 0,
    finishing: 0,
  }
  
  let isCritical = false
  
  components.forEach((component) => {
    if (!component.klasifikasi) return
    
    const damage = calculateComponentDamage(
      component.volume_total,
      component.volume_rusak,
      component.klasifikasi,
      component.bobot_komponen
    )
    
    // Add to category total
    if (byCategory[component.kategori] !== undefined) {
      byCategory[component.kategori] += damage
    }
    
    // Check for critical classification (7 = hancur total)
    if (component.klasifikasi === '7') {
      isCritical = true
    }
  })
  
  const total = Object.values(byCategory).reduce((sum, val) => sum + val, 0)
  
  return { total, byCategory, isCritical }
}

/**
 * Determine damage category from total percentage
 */
export function getDamageCategory(total: number): DamageCategory {
  if (total <= DAMAGE_THRESHOLDS.RINGAN) return 'ringan'
  if (total <= DAMAGE_THRESHOLDS.SEDANG) return 'sedang'
  return 'berat'
}

/**
 * Get classification label
 */
export function getClassificationLabel(klasifikasi: DamageClassification): string {
  const labels: Record<DamageClassification, string> = {
    '1': '1 - Tidak ada kerusakan',
    '2': '2 - Kerusakan ringan',
    '3': '3 - Kerusakan sedang-ringan',
    '4': '4 - Kerusakan sedang',
    '5': '5 - Kerusakan sedang-berat',
    '6': '6 - Kerusakan berat',
    '7': '7 - Hancur total',
  }
  return labels[klasifikasi] || 'Tidak diketahui'
}

/**
 * Get damage category label
 */
export function getDamageCategoryLabel(category: DamageCategory): string {
  const labels: Record<DamageCategory, string> = {
    ringan: 'Ringan (≤30%)',
    sedang: 'Sedang (30-45%)',
    berat: 'Berat (>45%)',
  }
  return labels[category]
}

/**
 * Get category color for UI
 */
export function getDamageCategoryColor(category: DamageCategory): string {
  const colors: Record<DamageCategory, string> = {
    ringan: 'bg-blue-100 text-blue-800 border-blue-200',
    sedang: 'bg-amber-100 text-amber-800 border-amber-200',
    berat: 'bg-red-100 text-red-800 border-red-200',
  }
  return colors[category]
}

/**
 * Format percentage value
 */
export function formatPercentage(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Check if survey has critical safety issues
 */
export function hasCriticalIssues(survey: {
  has_kolom_patah?: boolean
  has_pondasi_bergeser?: boolean
  has_struktur_runtuh?: boolean
  is_critical?: boolean
}): boolean {
  return !!(
    survey.has_kolom_patah ||
    survey.has_pondasi_bergeser ||
    survey.has_struktur_runtuh ||
    survey.is_critical
  )
}

/**
 * Calculate completion rate of survey components
 */
export function calculateCompletionRate(
  components: Component[],
  minKlasifikasi = true
): number {
  if (components.length === 0) return 0
  
  const completed = components.filter((c) => {
    const hasVolume = c.volume_total > 0 && c.volume_rusak >= 0
    const hasKlasifikasi = !minKlasifikasi || !!c.klasifikasi
    return hasVolume && hasKlasifikasi
  }).length
  
  return Math.round((completed / components.length) * 100)
}

/**
 * Validate volume input
 */
export function validateVolume(
  volumeTotal: number,
  volumeRusak: number
): { valid: boolean; error?: string } {
  if (volumeTotal < 0) {
    return { valid: false, error: 'Volume total tidak boleh negatif' }
  }
  if (volumeRusak < 0) {
    return { valid: false, error: 'Volume rusak tidak boleh negatif' }
  }
  if (volumeRusak > volumeTotal) {
    return { valid: false, error: 'Volume rusak tidak boleh melebihi volume total' }
  }
  return { valid: true }
}
