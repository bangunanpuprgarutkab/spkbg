/**
 * AUTO MAPPING ENGINE - PERBUP TO KOMPONEN
 * Smart AI Engineering Platform - SPKBG
 * 
 * Hybrid mapping system: Rule-based + Fuzzy Matching + AI Semantic
 * Menghubungkan item Perbup SHS dengan komponen bangunan
 */

import Fuse from 'fuse.js'
import { supabase } from '@/services/supabase/client'

// ============================================================================
// TYPES
// ============================================================================

export interface MappingResult {
  componentId: string
  componentName: string
  matchedItem: CostStandard | null
  confidence: number
  method: 'rule' | 'fuzzy' | 'ai' | 'none'
  warning?: string
  suggestedItems?: CostStandard[]
}

export interface CostStandard {
  id: string
  kodeItem: string
  namaItem: string
  satuan: string
  hargaSatuan: number
  kategori: string
  subKategori?: string
}

export interface ItemMapping {
  id: string
  componentName: string
  itemName: string
  kodeItem: string
  confidence: number
  verified: boolean
  verifiedBy?: string
  createdAt: string
  updatedAt: string
}

export interface MappingConfig {
  fuzzyThreshold: number
  useAI: boolean
  requireVerification: boolean
}

// ============================================================================
// RULE-BASED MAPPING
// ============================================================================

const COMPONENT_RULES: Record<string, string[]> = {
  'dinding': [
    'pasangan bata', 'plesteran', 'cat dinding', 'perbaikan dinding',
    'dinding bata', 'dinding beton', 'acian', 'plester'
  ],
  'kolom': [
    'beton kolom', 'bekisting kolom', 'tulangan kolom', 'perbaikan kolom',
    'kolom beton', 'jacketing kolom'
  ],
  'balok': [
    'beton balok', 'bekisting balok', 'tulangan balok', 'perbaikan balok',
    'balok beton', 'balok lantai'
  ],
  'plat lantai': [
    'beton plat', 'bekisting plat', 'tulangan plat', 'perbaikan lantai',
    'plat beton', 'lantai beton'
  ],
  'pondasi': [
    'urugan', 'batu kali', 'beton pondasi', 'perbaikan pondasi',
    'pondasi tapak', 'pondasi batu', 'footing'
  ],
  'atap': [
    'genteng', 'usuk', 'reng', 'perbaikan atap', 'rangka atap',
    'atap genteng', 'atap metal', 'seng'
  ],
  'lantai': [
    'plesteran lantai', 'keramik', 'granit', 'perbaikan lantai',
    'lantai keramik', 'pasangan lantai'
  ],
  'plafon': [
    'plafon gypsum', 'plafon triplek', 'rangka plafon', 'perbaikan plafon',
    'plafon gipsum', 'plafon akustik'
  ],
  'kusen pintu': [
    'kusen', 'daun pintu', 'engsel', 'handle', 'perbaikan pintu',
    'kusen kayu', 'kusen aluminium', 'kusen upvc'
  ],
  'kusen jendela': [
    'kusen jendela', 'daun jendela', 'kaca', 'perbaikan jendela',
    'jendela kayu', 'jendela aluminium', 'jendela upvc'
  ],
  'sanitasi': [
    'closet', 'wastafel', 'urinoir', 'pipa air', 'sambungan pipa',
    'keran', 'shower', 'bak mandi', 'septic tank'
  ],
  'listrik': [
    'instalasi listrik', 'kabel', 'saklar', 'stop kontak', 'lampu',
    'mcb', 'panel listrik', 'grounding'
  ],
  'finishing': [
    'cat', 'pelapis dinding', 'granit', 'marmer', 'keramik dinding',
    'wallpaper', 'wooden floor'
  ]
}

// ============================================================================
// AUTO MAPPING ENGINE
// ============================================================================

export class AutoMappingEngine {
  private fuse: Fuse<CostStandard> | null = null
  private standards: CostStandard[] = []
  private config: MappingConfig

  constructor(config: Partial<MappingConfig> = {}) {
    this.config = {
      fuzzyThreshold: 0.4,
      useAI: true,
      requireVerification: true,
      ...config,
    }
  }

  /**
   * Initialize with cost standards
   */
  async initialize(kabupaten?: string): Promise<void> {
    let query = supabase
      .from('cost_standards')
      .select('*')
      .eq('is_active', true)
    
    if (kabupaten) {
      query = query.eq('kabupaten', kabupaten)
    }

    const { data, error } = await query
    
    if (error) {
      console.error('Failed to load cost standards:', error)
      return
    }

    this.standards = data || []
    
    // Initialize Fuse.js
    this.fuse = new Fuse(this.standards, {
      keys: [
        { name: 'namaItem', weight: 0.7 },
        { name: 'kodeItem', weight: 0.2 },
        { name: 'subKategori', weight: 0.1 },
      ],
      threshold: this.config.fuzzyThreshold,
      includeScore: true,
      minMatchCharLength: 3,
    })
  }

  /**
   * Auto map single component
   */
  async mapComponent(component: {
    id: string
    name: string
    category?: string
  }): Promise<MappingResult> {
    const componentLower = component.name.toLowerCase()

    // Layer 1: Rule-based (fast & stable)
    const ruleMatch = this.ruleBasedMatch(componentLower)
    if (ruleMatch) {
      return {
        componentId: component.id,
        componentName: component.name,
        matchedItem: ruleMatch.item,
        confidence: ruleMatch.confidence,
        method: 'rule',
      }
    }

    // Layer 2: Fuzzy matching (if Fuse initialized)
    if (this.fuse) {
      const fuzzyResults = this.fuse.search(component.name)
      if (fuzzyResults.length > 0 && fuzzyResults[0].score! <= this.config.fuzzyThreshold) {
        return {
          componentId: component.id,
          componentName: component.name,
          matchedItem: fuzzyResults[0].item,
          confidence: 1 - (fuzzyResults[0].score || 0),
          method: 'fuzzy',
        }
      }
    }

    // Layer 3: AI semantic matching (fallback)
    if (this.config.useAI) {
      const aiMatch = await this.aiSemanticMatch(component.name)
      if (aiMatch) {
        return {
          componentId: component.id,
          componentName: component.name,
          matchedItem: aiMatch.item,
          confidence: aiMatch.confidence,
          method: 'ai',
          warning: 'Mapping dari AI - perlu verifikasi',
        }
      }
    }

    // No match found
    return {
      componentId: component.id,
      componentName: component.name,
      matchedItem: null,
      confidence: 0,
      method: 'none',
      warning: 'Tidak ditemukan item yang cocok - perlu mapping manual',
      suggestedItems: this.getSuggestedItems(component.name),
    }
  }

  /**
   * Batch map multiple components
   */
  async batchMap(components: Array<{ id: string; name: string; category?: string }>): Promise<{
    results: MappingResult[]
    summary: {
      total: number
      ruleMatches: number
      fuzzyMatches: number
      aiMatches: number
      noMatches: number
      needsVerification: number
    }
  }> {
    const results: MappingResult[] = []
    
    for (const comp of components) {
      const result = await this.mapComponent(comp)
      results.push(result)
    }

    // Calculate summary
    const summary = {
      total: results.length,
      ruleMatches: results.filter(r => r.method === 'rule').length,
      fuzzyMatches: results.filter(r => r.method === 'fuzzy').length,
      aiMatches: results.filter(r => r.method === 'ai').length,
      noMatches: results.filter(r => r.method === 'none').length,
      needsVerification: results.filter(r => r.warning).length,
    }

    return { results, summary }
  }

  /**
   * Rule-based matching
   */
  private ruleBasedMatch(componentName: string): { item: CostStandard; confidence: number } | null {
    for (const [componentType, keywords] of Object.entries(COMPONENT_RULES)) {
      // Check if component matches type
      if (componentName.includes(componentType.toLowerCase())) {
        // Find best matching standard for this type
        for (const keyword of keywords) {
          const match = this.standards.find(s => 
            s.namaItem.toLowerCase().includes(keyword.toLowerCase())
          )
          if (match) {
            return { item: match, confidence: 0.95 }
          }
        }
      }
    }

    // Check keywords directly
    for (const [, keywords] of Object.entries(COMPONENT_RULES)) {
      for (const keyword of keywords) {
        if (componentName.includes(keyword.toLowerCase())) {
          const match = this.standards.find(s => 
            s.namaItem.toLowerCase().includes(keyword.toLowerCase())
          )
          if (match) {
            return { item: match, confidence: 0.85 }
          }
        }
      }
    }

    return null
  }

  /**
   * AI semantic matching (fallback)
   * Menggunakan embedding atau keyword extraction
   */
  private async aiSemanticMatch(componentName: string): Promise<{ item: CostStandard; confidence: number } | null> {
    // Simple keyword extraction and matching
    const keywords = this.extractKeywords(componentName)
    
    if (keywords.length === 0) return null

    // Score each standard based on keyword overlap
    let bestMatch: CostStandard | null = null
    let bestScore = 0

    for (const standard of this.standards) {
      const standardKeywords = this.extractKeywords(standard.namaItem)
      const overlap = keywords.filter(k => 
        standardKeywords.some(sk => sk.includes(k) || k.includes(sk))
      ).length
      
      const score = overlap / Math.max(keywords.length, standardKeywords.length)
      
      if (score > bestScore && score > 0.3) {
        bestScore = score
        bestMatch = standard
      }
    }

    if (bestMatch) {
      return { item: bestMatch, confidence: bestScore }
    }

    return null
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const stopWords = ['dan', 'atau', 'yang', 'dari', 'pada', 'untuk', 'dengan', 'di', 'ke']
    
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
  }

  /**
   * Get suggested items when no match
   */
  private getSuggestedItems(componentName: string): CostStandard[] {
    if (!this.fuse) return []
    
    // Get top 5 similar items
    const results = this.fuse.search(componentName)
    return results.slice(0, 5).map(r => r.item)
  }

  /**
   * Save verified mapping to database
   */
  async saveMapping(mapping: Omit<ItemMapping, 'id' | 'createdAt' | 'updatedAt'>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('item_mappings')
        .upsert({
          component_name: mapping.componentName,
          item_name: mapping.itemName,
          kode_item: mapping.kodeItem,
          confidence: mapping.confidence,
          verified: mapping.verified,
          verified_by: mapping.verifiedBy,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'component_name'
        })

      return !error
    } catch {
      return false
    }
  }

  /**
   * Load verified mappings
   */
  async loadVerifiedMappings(): Promise<ItemMapping[]> {
    const { data, error } = await supabase
      .from('item_mappings')
      .select('*')
      .eq('verified', true)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Load mappings error:', error)
      return []
    }

    return (data || []).map(m => ({
      id: m.id,
      componentName: m.component_name,
      itemName: m.item_name,
      kodeItem: m.kode_item,
      confidence: m.confidence,
      verified: m.verified,
      verifiedBy: m.verified_by,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    }))
  }

  /**
   * Apply learning from verified mappings
   */
  async applyLearning(): Promise<void> {
    const verifiedMappings = await this.loadVerifiedMappings()
    
    // Update COMPONENT_RULES with verified mappings
    for (const mapping of verifiedMappings) {
      const componentType = mapping.componentName.toLowerCase()
      const itemKeyword = mapping.itemName.toLowerCase()
      
      if (!COMPONENT_RULES[componentType]) {
        COMPONENT_RULES[componentType] = []
      }
      
      if (!COMPONENT_RULES[componentType].includes(itemKeyword)) {
        COMPONENT_RULES[componentType].push(itemKeyword)
      }
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const autoMappingEngine = new AutoMappingEngine()

export default {
  AutoMappingEngine,
  autoMappingEngine,
  COMPONENT_RULES,
}
