/**
 * KPI DASHBOARD COMPONENTS
 * Smart AI Engineering Platform - SPKBG
 * 
 * Komponen visual untuk National Monitoring Dashboard
 */

import { useState, useEffect } from 'react'
import type { NationalDashboardStats, ProjectSummary, LocationStat } from '@/services/dashboard/national'

// ============================================================================
// KPI CARD COMPONENT
// ============================================================================

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  icon: React.ReactNode
  color: 'green' | 'blue' | 'yellow' | 'red'
}

const colorClasses = {
  green: 'bg-green-50 border-green-200 text-green-800',
  blue: 'bg-blue-50 border-blue-200 text-blue-800',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  red: 'bg-red-50 border-red-200 text-red-800',
}

export function KPICard({ title, value, subtitle, trend, trendValue, icon, color }: KPICardProps): JSX.Element {
  return (
    <div className={`p-6 rounded-xl border-2 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <h3 className="text-3xl font-bold mt-2">{value}</h3>
          {subtitle && <p className="text-sm mt-1 opacity-70">{subtitle}</p>}
          {trend && trendValue && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
            }`}>
              <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        <div className="p-3 rounded-lg bg-white/50">
          {icon}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// STATS OVERVIEW COMPONENT
// ============================================================================

interface StatsOverviewProps {
  stats: NationalDashboardStats | null
  loading: boolean
}

export function StatsOverview({ stats, loading }: StatsOverviewProps): JSX.Element {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)} M`
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)} Jt`
    return `Rp ${val.toLocaleString('id-ID')}`
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="Total Proyek"
        value={stats.totalProjects}
        subtitle="Seluruh Indonesia"
        icon={<span className="text-2xl">🏗️</span>}
        color="blue"
      />
      <KPICard
        title="Total Survey"
        value={stats.totalSurveys}
        subtitle="Tahun 2024"
        icon={<span className="text-2xl">📋</span>}
        color="green"
      />
      <KPICard
        title="Estimasi Biaya"
        value={formatCurrency(stats.totalEstimasiBiaya)}
        subtitle="Total perbaikan"
        icon={<span className="text-2xl">💰</span>}
        color="yellow"
      />
      <KPICard
        title="Rata-rata Kerusakan"
        value={`${stats.averageDamagePercentage.toFixed(1)}%`}
        subtitle="Nasional"
        trend={stats.averageDamagePercentage > 30 ? 'up' : 'down'}
        trendValue={stats.averageDamagePercentage > 30 ? 'Di atas normal' : 'Normal'}
        icon={<span className="text-2xl">📊</span>}
        color={stats.averageDamagePercentage > 45 ? 'red' : 'green'}
      />
    </div>
  )
}

// ============================================================================
// CATEGORY DISTRIBUTION CHART
// ============================================================================

interface CategoryDistributionProps {
  data: Record<string, number>
  loading: boolean
}

export function CategoryDistribution({ data, loading }: CategoryDistributionProps): JSX.Element {
  if (loading) {
    return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
  }

  const categories = [
    { key: 'ringan', label: 'Ringan (≤30%)', color: 'bg-blue-500' },
    { key: 'sedang', label: 'Sedang (30-45%)', color: 'bg-yellow-500' },
    { key: 'berat', label: 'Berat (>45%)', color: 'bg-red-500' },
  ]

  const total = Object.values(data).reduce((a, b) => a + b, 0)

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h3 className="text-lg font-semibold mb-4">Distribusi Kategori Kerusakan</h3>
      <div className="space-y-4">
        {categories.map(cat => {
          const count = data[cat.key] || 0
          const percentage = total > 0 ? (count / total) * 100 : 0
          
          return (
            <div key={cat.key}>
              <div className="flex justify-between text-sm mb-1">
                <span>{cat.label}</span>
                <span className="font-medium">{count} ({percentage.toFixed(1)}%)</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${cat.color} transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// TOP LOCATIONS TABLE
// ============================================================================

interface TopLocationsProps {
  data: LocationStat[]
  loading: boolean
}

export function TopLocations({ data, loading }: TopLocationsProps): JSX.Element {
  if (loading) {
    return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h3 className="text-lg font-semibold mb-4">Top 10 Lokasi</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Kabupaten</th>
              <th className="text-left py-2">Provinsi</th>
              <th className="text-right py-2">Proyek</th>
              <th className="text-right py-2">Avg Kerusakan</th>
            </tr>
          </thead>
          <tbody>
            {data.map((loc, idx) => (
              <tr key={idx} className="border-b last:border-0">
                <td className="py-2">{loc.kabupaten}</td>
                <td className="py-2 text-gray-600">{loc.provinsi}</td>
                <td className="py-2 text-right font-medium">{loc.projectCount}</td>
                <td className="py-2 text-right">
                  <span className={`${
                    loc.averageDamage > 45 ? 'text-red-600' : 
                    loc.averageDamage > 30 ? 'text-yellow-600' : 'text-green-600'
                  } font-medium`}>
                    {loc.averageDamage.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================================
// PROJECT LIST COMPONENT
// ============================================================================

interface ProjectListProps {
  projects: ProjectSummary[]
  loading: boolean
}

export function ProjectList({ projects, loading }: ProjectListProps): JSX.Element {
  if (loading) {
    return <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'disposisi': 'bg-gray-100 text-gray-800',
      'persiapan': 'bg-blue-100 text-blue-800',
      'survey': 'bg-yellow-100 text-yellow-800',
      'analisis': 'bg-purple-100 text-purple-800',
      'penilaian': 'bg-orange-100 text-orange-800',
      'diperiksa': 'bg-pink-100 text-pink-800',
      'disetujui': 'bg-green-100 text-green-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getCategoryBadge = (cat?: string) => {
    const colors: Record<string, string> = {
      'ringan': 'bg-blue-100 text-blue-800',
      'sedang': 'bg-yellow-100 text-yellow-800',
      'berat': 'bg-red-100 text-red-800',
    }
    return colors[cat || ''] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h3 className="text-lg font-semibold mb-4">Daftar Proyek</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Kode</th>
              <th className="text-left py-2">Nama Bangunan</th>
              <th className="text-left py-2">Lokasi</th>
              <th className="text-center py-2">Status</th>
              <th className="text-right py-2">Kerusakan</th>
              <th className="text-center py-2">Kategori</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(proj => (
              <tr key={proj.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-3 font-medium">{proj.kodeProject}</td>
                <td className="py-3">{proj.namaBangunan}</td>
                <td className="py-3 text-gray-600">{proj.lokasi}</td>
                <td className="py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(proj.status)}`}>
                    {proj.status}
                  </span>
                </td>
                <td className="py-3 text-right font-medium">
                  {proj.kerusakanTotal.toFixed(1)}%
                </td>
                <td className="py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${getCategoryBadge(proj.kategori)}`}>
                    {proj.kategori || '-'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================================
// FILTER BAR COMPONENT
// ============================================================================

interface FilterBarProps {
  filters: {
    provinsi?: string
    kabupaten?: string
    organizationId?: string
    status?: string
  }
  options: {
    provinsi: string[]
    kabupaten: string[]
    organizations: Array<{ id: string; name: string }>
    status: string[]
  }
  onFilterChange: (filters: any) => void
  loading: boolean
}

export function FilterBar({ filters, options, onFilterChange, loading }: FilterBarProps): JSX.Element {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Provinsi */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Provinsi</label>
          <select
            value={filters.provinsi || ''}
            onChange={(e) => onFilterChange({ ...filters, provinsi: e.target.value || undefined })}
            disabled={loading}
            className="w-full rounded-lg border-gray-300 text-sm"
          >
            <option value="">Semua Provinsi</option>
            {options.provinsi.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Kabupaten */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Kabupaten</label>
          <select
            value={filters.kabupaten || ''}
            onChange={(e) => onFilterChange({ ...filters, kabupaten: e.target.value || undefined })}
            disabled={loading}
            className="w-full rounded-lg border-gray-300 text-sm"
          >
            <option value="">Semua Kabupaten</option>
            {options.kabupaten.map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>

        {/* Organization */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Organisasi</label>
          <select
            value={filters.organizationId || ''}
            onChange={(e) => onFilterChange({ ...filters, organizationId: e.target.value || undefined })}
            disabled={loading}
            className="w-full rounded-lg border-gray-300 text-sm"
          >
            <option value="">Semua Organisasi</option>
            {options.organizations.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={filters.status || ''}
            onChange={(e) => onFilterChange({ ...filters, status: e.target.value || undefined })}
            disabled={loading}
            className="w-full rounded-lg border-gray-300 text-sm"
          >
            <option value="">Semua Status</option>
            {options.status.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Reset */}
        <button
          onClick={() => onFilterChange({})}
          disabled={loading}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border rounded-lg"
        >
          Reset
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// NATIONAL DASHBOARD PAGE
// ============================================================================

import { nationalDashboardService } from '@/services/dashboard/national'

export function NationalDashboardPage(): JSX.Element {
  const [stats, setStats] = useState<NationalDashboardStats | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [filters, setFilters] = useState({})
  const [filterOptions, setFilterOptions] = useState<{
    provinsi: string[]
    kabupaten: string[]
    organizations: Array<{ id: string; name: string }>
    status: string[]
  }>({
    provinsi: [],
    kabupaten: [],
    organizations: [],
    status: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
    loadFilterOptions()
  }, [filters])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const [statsData, projectsData] = await Promise.all([
        nationalDashboardService.getNationalStats(filters),
        nationalDashboardService.getProjectSummaries(50, filters),
      ])
      
      setStats(statsData)
      setProjects(projectsData)
    } catch (error) {
      console.error('Load dashboard error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadFilterOptions = async () => {
    try {
      const options = await nationalDashboardService.getFilterOptions()
      setFilterOptions(options)
    } catch (error) {
      console.error('Load filter options error:', error)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Monitoring Nasional</h1>
        <p className="text-gray-600">Monitoring proyek penilaian kerusakan bangunan gedung</p>
      </div>

      <FilterBar
        filters={filters}
        options={filterOptions}
        onFilterChange={setFilters}
        loading={loading}
      />

      <div className="mb-6">
        <StatsOverview stats={stats} loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <CategoryDistribution 
          data={stats?.projectsByCategory || {}} 
          loading={loading} 
        />
        <TopLocations 
          data={stats?.topLocations || []} 
          loading={loading} 
        />
      </div>

      <ProjectList projects={projects} loading={loading} />
    </div>
  )
}

export default NationalDashboardPage
