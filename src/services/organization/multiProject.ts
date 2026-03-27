/**
 * MULTI-PROJECT & ORGANIZATION SERVICE
 * Smart AI Engineering Platform - SPKBG
 * 
 * Multi-tenancy system untuk enterprise SaaS
 * Organisasi-based data isolation
 */

import { supabase } from '@/services/supabase/client'

// ============================================================================
// TYPES
// ============================================================================

export interface Organization {
  id: string
  name: string
  type: 'pemerintah' | 'swasta' | 'bumn' | 'universitas' | 'lainnya'
  alamat?: string
  provinsi?: string
  kabupaten?: string
  telepon?: string
  email?: string
  website?: string
  logoUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: 'org_admin' | 'project_manager' | 'member'
  isActive: boolean
  joinedAt: string
}

export interface ProjectWithOrg {
  id: string
  organizationId: string
  organizationName?: string
  kodeProject: string
  namaBangunan: string
  alamat: string
  provinsi: string
  kabupaten: string
  kecamatan?: string
  kodePos?: string
  jumlahLantai: number
  luasBangunan?: number
  tahunBangunan?: number
  fungsiBangunan?: string
  latitude?: number
  longitude?: number
  statusWorkflow: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface MultiProjectFilter {
  organizationId?: string
  provinsi?: string
  kabupaten?: string
  status?: string
  dateRange?: { start: string; end: string }
}

export interface ProjectStats {
  total: number
  byStatus: Record<string, number>
  byCategory: Record<string, number>
  totalEstimasi: number
  avgDamage: number
}

// ============================================================================
// ORGANIZATION SERVICE
// ============================================================================

export class OrganizationService {
  /**
   * Create new organization
   */
  async createOrganization(org: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organization | null> {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          ...org,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Create organization error:', error)
      return null
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganization(id: string): Promise<Organization | null> {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Get organization error:', error)
      return null
    }
  }

  /**
   * Get all organizations
   */
  async getAllOrganizations(): Promise<Organization[]> {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Get all organizations error:', error)
      return []
    }
  }

  /**
   * Update organization
   */
  async updateOrganization(id: string, updates: Partial<Organization>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      return !error
    } catch {
      return false
    }
  }

  /**
   * Add member to organization
   */
  async addMember(
    organizationId: string,
    userId: string,
    role: OrganizationMember['role'] = 'member'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          role,
          is_active: true,
          joined_at: new Date().toISOString(),
        })

      return !error
    } catch {
      return false
    }
  }

  /**
   * Get organization members
   */
  async getMembers(organizationId: string): Promise<OrganizationMember[]> {
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          *,
          user:users(id, name, email, role)
        `)
        .eq('organization_id', organizationId)
        .eq('is_active', true)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Get members error:', error)
      return []
    }
  }

  /**
   * Get user's organizations
   */
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          organization:organizations(*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)

      if (error) throw error
      return ((data || []) as any[]).map(d => d.organization as Organization)
    } catch (error) {
      console.error('Get user organizations error:', error)
      return []
    }
  }
}

// ============================================================================
// MULTI-PROJECT SERVICE
// ============================================================================

export class MultiProjectService {
  /**
   * Create project with organization
   */
  async createProject(project: Omit<ProjectWithOrg, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProjectWithOrg | null> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          ...project,
          kode_project: await this.generateProjectCode(project.organizationId),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Create project error:', error)
      return null
    }
  }

  /**
   * Get projects with filtering
   */
  async getProjects(filter?: MultiProjectFilter, limit: number = 100): Promise<ProjectWithOrg[]> {
    try {
      let query = supabase
        .from('projects')
        .select(`
          *,
          organization:organizations(id, name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (filter?.organizationId) {
        query = query.eq('organization_id', filter.organizationId)
      }

      if (filter?.provinsi) {
        query = query.eq('provinsi', filter.provinsi)
      }

      if (filter?.kabupaten) {
        query = query.eq('kabupaten', filter.kabupaten)
      }

      if (filter?.status) {
        query = query.eq('status_workflow', filter.status)
      }

      if (filter?.dateRange) {
        query = query
          .gte('created_at', filter.dateRange.start)
          .lte('created_at', filter.dateRange.end)
      }

      const { data, error } = await query

      if (error) throw error

      return (data || []).map(p => ({
        ...p,
        organizationName: p.organization?.name,
      }))
    } catch (error) {
      console.error('Get projects error:', error)
      return []
    }
  }

  /**
   * Get project by ID
   */
  async getProject(id: string): Promise<ProjectWithOrg | null> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          organization:organizations(id, name)
        `)
        .eq('id', id)
        .single()

      if (error) throw error

      return {
        ...data,
        organizationName: data.organization?.name,
      }
    } catch (error) {
      console.error('Get project error:', error)
      return null
    }
  }

  /**
   * Get project statistics
   */
  async getProjectStats(organizationId?: string): Promise<ProjectStats> {
    try {
      let query = supabase.from('projects').select('*')
      
      if (organizationId) {
        query = query.eq('organization_id', organizationId)
      }

      const { data: projects, error } = await query

      if (error) throw error

      const projectList = projects || []

      // By status
      const byStatus: Record<string, number> = {}
      projectList.forEach(p => {
        byStatus[p.status_workflow] = (byStatus[p.status_workflow] || 0) + 1
      })

      // Get surveys for damage calculation
      const { data: surveys } = await supabase
        .from('survey_summaries')
        .select('kategori_kerusakan, total_kerusakan, project_id')
        .in('project_id', projectList.map(p => p.id))

      const surveyList = surveys || []

      // By category
      const byCategory: Record<string, number> = {}
      surveyList.forEach(s => {
        const cat = s.kategori_kerusakan || 'unknown'
        byCategory[cat] = (byCategory[cat] || 0) + 1
      })

      // Average damage
      const avgDamage = surveyList.length > 0
        ? surveyList.reduce((sum, s) => sum + (s.total_kerusakan || 0), 0) / surveyList.length
        : 0

      // Total estimasi
      const { data: estimasi } = await supabase
        .from('cost_estimations')
        .select('total_biaya')
        .in('project_id', projectList.map(p => p.id))

      const totalEstimasi = (estimasi || []).reduce((sum, e) => sum + (e.total_biaya || 0), 0)

      return {
        total: projectList.length,
        byStatus,
        byCategory,
        totalEstimasi,
        avgDamage,
      }
    } catch (error) {
      console.error('Get project stats error:', error)
      return {
        total: 0,
        byStatus: {},
        byCategory: {},
        totalEstimasi: 0,
        avgDamage: 0,
      }
    }
  }

  /**
   * Update project
   */
  async updateProject(id: string, updates: Partial<ProjectWithOrg>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      return !error
    } catch {
      return false
    }
  }

  /**
   * Delete project (soft delete)
   */
  async deleteProject(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status_workflow: 'dihapus' })
        .eq('id', id)

      return !error
    } catch {
      return false
    }
  }

  /**
   * Get locations for map display
   */
  async getProjectLocations(filter?: MultiProjectFilter): Promise<Array<{
    id: string
    nama: string
    lat: number
    lng: number
    status: string
    kerusakan: number
  }>> {
    try {
      let query = supabase
        .from('projects')
        .select('id, nama_bangunan, latitude, longitude, status_workflow')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)

      if (filter?.organizationId) {
        query = query.eq('organization_id', filter.organizationId)
      }

      const { data: projects, error } = await query

      if (error) throw error

      // Get latest survey data for each project
      const locations = []
      
      for (const p of (projects || [])) {
        const { data: survey } = await supabase
          .from('survey_summaries')
          .select('total_kerusakan')
          .eq('project_id', p.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        locations.push({
          id: p.id,
          nama: p.nama_bangunan,
          lat: p.latitude,
          lng: p.longitude,
          status: p.status_workflow,
          kerusakan: survey?.total_kerusakan || 0,
        })
      }

      return locations
    } catch (error) {
      console.error('Get project locations error:', error)
      return []
    }
  }

  /**
   * Generate unique project code
   */
  private async generateProjectCode(organizationId?: string): Promise<string> {
    const prefix = 'PRJ'
    const org = organizationId ? organizationId.substring(0, 4).toUpperCase() : 'GEN'
    const timestamp = Date.now().toString(36).toUpperCase()
    
    return `${prefix}-${org}-${timestamp}`
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const organizationService = new OrganizationService()
export const multiProjectService = new MultiProjectService()

export default {
  OrganizationService,
  MultiProjectService,
  organizationService,
  multiProjectService,
}
