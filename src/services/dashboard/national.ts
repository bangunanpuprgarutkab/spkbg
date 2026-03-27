/**
 * NATIONAL MONITORING DASHBOARD SERVICE
 * Smart AI Engineering Platform - SPKBG
 * 
 * Dashboard monitoring multi-proyek & nasional
 * Aggregasi data per lokasi, instansi, dan waktu
 */

import { supabase } from '@/services/supabase/client'

// ============================================================================
// TYPES
// ============================================================================

export interface NationalDashboardStats {
  totalProjects: number
  totalSurveys: number
  totalEstimasiBiaya: number
  averageDamagePercentage: number
  projectsByCategory: Record<string, number>
  projectsByStatus: Record<string, number>
  surveysByMonth: MonthlyStat[]
  topLocations: LocationStat[]
  criticalProjects: number
}

export interface MonthlyStat {
  month: string
  year: number
  count: number
  averageDamage: number
}

export interface LocationStat {
  provinsi: string
  kabupaten: string
  projectCount: number
  averageDamage: number
  totalEstimasi: number
}

export interface OrganizationStat {
  organizationId: string
  organizationName: string
  projectCount: number
  surveyCount: number
  completedSurveys: number
  averageDamage: number
  totalEstimasiBiaya: number
}

export interface ProjectSummary {
  id: string
  kodeProject: string
  namaBangunan: string
  lokasi: string
  status: string
  kerusakanTotal: number
  kategori: string
  estimasiBiaya: number
  progress: number
  lastUpdated: string
}

export interface KPIMetrics {
  surveysThisMonth: number
  surveysGrowth: number // percentage
  criticalAlerts: number
  pendingApprovals: number
  avgProcessingTime: number // days
}

export interface FilterOptions {
  provinsi?: string
  kabupaten?: string
  organizationId?: string
  dateRange?: { start: string; end: string }
  status?: string[]
  category?: string[]
}

// ============================================================================
// NATIONAL DASHBOARD SERVICE
// ============================================================================

export class NationalDashboardService {
  /**
   * Get national-level statistics
   */
  async getNationalStats(filter?: FilterOptions): Promise<NationalDashboardStats> {
    try {
      // Build base query
      let projectsQuery = supabase.from('projects').select('*')
      let surveysQuery = supabase.from('survey_summaries').select('*')
      
      if (filter?.provinsi) {
        projectsQuery = projectsQuery.eq('provinsi', filter.provinsi)
      }
      
      if (filter?.organizationId) {
        projectsQuery = projectsQuery.eq('organization_id', filter.organizationId)
      }

      // Fetch data
      const [{ data: projects }, { data: surveys }] = await Promise.all([
        projectsQuery,
        surveysQuery,
      ])

      const projectList = projects || []
      const surveyList = surveys || []

      // Calculate stats
      const totalProjects = projectList.length
      const totalSurveys = surveyList.length
      
      // Get estimations
      const estimasiTotal = await this.calculateTotalEstimasi(filter)
      
      // Calculate average damage
      const avgDamage = surveyList.length > 0
        ? surveyList.reduce((sum, s) => sum + (s.total_kerusakan || 0), 0) / surveyList.length
        : 0

      // By category
      const byCategory: Record<string, number> = {}
      surveyList.forEach(s => {
        const cat = s.kategori_kerusakan || 'unknown'
        byCategory[cat] = (byCategory[cat] || 0) + 1
      })

      // By status
      const byStatus: Record<string, number> = {}
      projectList.forEach(p => {
        byStatus[p.status_workflow] = (byStatus[p.status_workflow] || 0) + 1
      })

      // Monthly stats
      const byMonth = this.aggregateByMonth(surveyList)

      // Top locations
      const topLocations = this.aggregateByLocation(surveyList, projectList)

      // Critical projects
      const criticalCount = surveyList.filter(s => s.is_critical).length

      return {
        totalProjects,
        totalSurveys,
        totalEstimasiBiaya: estimasiTotal,
        averageDamagePercentage: avgDamage,
        projectsByCategory: byCategory,
        projectsByStatus: byStatus,
        surveysByMonth: byMonth,
        topLocations,
        criticalProjects: criticalCount,
      }
    } catch (error) {
      console.error('Get national stats error:', error)
      return this.getEmptyStats()
    }
  }

  /**
   * Get KPI metrics
   */
  async getKPIMetrics(filter?: FilterOptions): Promise<KPIMetrics> {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    try {
      // Surveys this month
      let query = supabase
        .from('surveys')
        .select('*', { count: 'exact' })
        .gte('created_at', startOfMonth.toISOString())
      
      if (filter?.organizationId) {
        query = query.eq('organization_id', filter.organizationId)
      }
      
      const { count: thisMonthCount } = await query

      // Surveys last month for growth calc
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
      
      const { count: lastMonthCount } = await supabase
        .from('surveys')
        .select('*', { count: 'exact' })
        .gte('created_at', startOfLastMonth.toISOString())
        .lte('created_at', endOfLastMonth.toISOString())

      const growth = lastMonthCount && lastMonthCount > 0
        ? ((thisMonthCount || 0) - lastMonthCount) / lastMonthCount * 100
        : 0

      // Critical alerts
      const { count: criticalCount } = await supabase
        .from('surveys')
        .select('*', { count: 'exact' })
        .eq('is_critical', true)
        .eq('status', 'disetujui')

      // Pending approvals
      const { count: pendingCount } = await supabase
        .from('surveys')
        .select('*', { count: 'exact' })
        .in('status', ['penilaian', 'diperiksa'])

      // Average processing time
      const avgDays = await this.calculateAvgProcessingTime(filter)

      return {
        surveysThisMonth: thisMonthCount || 0,
        surveysGrowth: parseFloat(growth.toFixed(1)),
        criticalAlerts: criticalCount || 0,
        pendingApprovals: pendingCount || 0,
        avgProcessingTime: avgDays,
      }
    } catch (error) {
      console.error('Get KPI metrics error:', error)
      return {
        surveysThisMonth: 0,
        surveysGrowth: 0,
        criticalAlerts: 0,
        pendingApprovals: 0,
        avgProcessingTime: 0,
      }
    }
  }

  /**
   * Get organization statistics
   */
  async getOrganizationStats(): Promise<OrganizationStat[]> {
    try {
      const { data: orgs, error } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          projects:projects(count),
          surveys:surveys(count),
          completed:surveys(count)
        `)
        .order('name')

      if (error) throw error

      // Calculate stats for each org
      const stats: OrganizationStat[] = []
      
      for (const org of orgs || []) {
        const { data: surveys } = await supabase
          .from('survey_summaries')
          .select('total_kerusakan')
          .eq('organization_id', org.id)
        
        const avgDamage = surveys && surveys.length > 0
          ? surveys.reduce((sum, s) => sum + (s.total_kerusakan || 0), 0) / surveys.length
          : 0

        const totalEstimasi = await this.calculateOrgEstimasi(org.id)

        stats.push({
          organizationId: org.id,
          organizationName: org.name,
          projectCount: org.projects?.[0]?.count || 0,
          surveyCount: org.surveys?.[0]?.count || 0,
          completedSurveys: org.completed?.[0]?.count || 0,
          averageDamage: avgDamage,
          totalEstimasiBiaya: totalEstimasi,
        })
      }

      return stats
    } catch (error) {
      console.error('Get organization stats error:', error)
      return []
    }
  }

  /**
   * Get project summaries for dashboard
   */
  async getProjectSummaries(
    limit: number = 50,
    filter?: FilterOptions
  ): Promise<ProjectSummary[]> {
    try {
      let query = supabase
        .from('project_summaries')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(limit)

      if (filter?.provinsi) {
        query = query.eq('provinsi', filter.provinsi)
      }
      
      if (filter?.organizationId) {
        query = query.eq('organization_id', filter.organizationId)
      }

      const { data, error } = await query

      if (error) throw error

      return (data || []).map(p => ({
        id: p.id,
        kodeProject: p.kode_project,
        namaBangunan: p.nama_bangunan,
        lokasi: `${p.kabupaten}, ${p.provinsi}`,
        status: p.status_workflow,
        kerusakanTotal: p.latest_survey?.total_kerusakan || 0,
        kategori: p.latest_survey?.kategori_kerusakan || '-',
        estimasiBiaya: p.total_estimasi || 0,
        progress: this.calculateProgress(p.status_workflow),
        lastUpdated: p.updated_at,
      }))
    } catch (error) {
      console.error('Get project summaries error:', error)
      return []
    }
  }

  /**
   * Get filter options (distinct values)
   */
  async getFilterOptions(): Promise<{
    provinsi: string[]
    kabupaten: string[]
    organizations: Array<{ id: string; name: string }>
    status: string[]
  }> {
    try {
      const [{ data: provs }, { data: kabs }, { data: orgs }] = await Promise.all([
        supabase.from('projects').select('provinsi').not('provinsi', 'is', null),
        supabase.from('projects').select('kabupaten').not('kabupaten', 'is', null),
        supabase.from('organizations').select('id, name'),
      ])

      const provinsi = [...new Set((provs || []).map(p => p.provinsi).filter(Boolean))]
      const kabupaten = [...new Set((kabs || []).map(k => k.kabupaten).filter(Boolean))]
      
      return {
        provinsi: provinsi.sort(),
        kabupaten: kabupaten.sort(),
        organizations: orgs || [],
        status: ['disposisi', 'persiapan', 'survey', 'analisis', 'penilaian', 'diperiksa', 'disetujui'],
      }
    } catch (error) {
      console.error('Get filter options error:', error)
      return { provinsi: [], kabupaten: [], organizations: [], status: [] }
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async calculateTotalEstimasi(filter?: FilterOptions): Promise<number> {
    try {
      let query = supabase.from('cost_estimations').select('total_biaya')
      
      if (filter?.organizationId) {
        query = query.eq('organization_id', filter.organizationId)
      }

      const { data } = await query
      
      return (data || []).reduce((sum, e) => sum + (e.total_biaya || 0), 0)
    } catch {
      return 0
    }
  }

  private async calculateOrgEstimasi(orgId: string): Promise<number> {
    try {
      const { data } = await supabase
        .from('cost_estimations')
        .select('total_biaya')
        .eq('organization_id', orgId)
      
      return (data || []).reduce((sum, e) => sum + (e.total_biaya || 0), 0)
    } catch {
      return 0
    }
  }

  private async calculateAvgProcessingTime(filter?: FilterOptions): Promise<number> {
    try {
      let query = supabase
        .from('surveys')
        .select('created_at, completed_at')
        .not('completed_at', 'is', null)
      
      if (filter?.organizationId) {
        query = query.eq('organization_id', filter.organizationId)
      }

      const { data } = await query
      
      if (!data || data.length === 0) return 0

      let totalDays = 0
      let count = 0

      for (const s of data) {
        const start = new Date(s.created_at)
        const end = new Date(s.completed_at!)
        const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        
        if (days > 0 && days < 365) { // Filter outliers
          totalDays += days
          count++
        }
      }

      return count > 0 ? parseFloat((totalDays / count).toFixed(1)) : 0
    } catch {
      return 0
    }
  }

  private aggregateByMonth(surveys: any[]): MonthlyStat[] {
    const months: Record<string, MonthlyStat> = {}
    
    for (const s of surveys) {
      const date = new Date(s.created_at)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!months[key]) {
        months[key] = {
          month: key,
          year: date.getFullYear(),
          count: 0,
          averageDamage: 0,
        }
      }
      
      months[key].count++
      months[key].averageDamage += s.total_kerusakan || 0
    }

    // Calculate averages
    for (const m of Object.values(months)) {
      m.averageDamage = m.count > 0 ? m.averageDamage / m.count : 0
    }

    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month))
  }

  private aggregateByLocation(surveys: any[], projects: any[]): LocationStat[] {
    const locs: Record<string, LocationStat> = {}
    
    // Create project lookup
    const projectMap = new Map(projects.map(p => [p.id, p]))
    
    for (const s of surveys) {
      const proj = projectMap.get(s.project_id)
      if (!proj) continue
      
      const key = `${proj.provinsi}-${proj.kabupaten}`
      
      if (!locs[key]) {
        locs[key] = {
          provinsi: proj.provinsi,
          kabupaten: proj.kabupaten,
          projectCount: 0,
          averageDamage: 0,
          totalEstimasi: 0,
        }
      }
      
      locs[key].projectCount++
      locs[key].averageDamage += s.total_kerusakan || 0
    }

    // Calculate averages
    for (const l of Object.values(locs)) {
      l.averageDamage = l.projectCount > 0 ? l.averageDamage / l.projectCount : 0
    }

    return Object.values(locs)
      .sort((a, b) => b.projectCount - a.projectCount)
      .slice(0, 10)
  }

  private calculateProgress(status: string): number {
    const statusMap: Record<string, number> = {
      'disposisi': 10,
      'persiapan': 20,
      'survey': 40,
      'analisis': 60,
      'penilaian': 75,
      'diperiksa': 90,
      'disetujui': 100,
    }
    
    return statusMap[status] || 0
  }

  private getEmptyStats(): NationalDashboardStats {
    return {
      totalProjects: 0,
      totalSurveys: 0,
      totalEstimasiBiaya: 0,
      averageDamagePercentage: 0,
      projectsByCategory: {},
      projectsByStatus: {},
      surveysByMonth: [],
      topLocations: [],
      criticalProjects: 0,
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const nationalDashboardService = new NationalDashboardService()

export default NationalDashboardService
