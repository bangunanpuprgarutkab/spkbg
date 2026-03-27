/**
 * DRONE GIS DASHBOARD COMPONENT
 * Smart AI Engineering Platform - SPKBG
 * 
 * Dashboard peta dengan visualisasi drone survey dan detected damages
 * Heatmap, cluster markers, dan detail panel
 */

import { useState, useEffect, useMemo } from 'react'
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  CircleMarker,
  useMap,
  LayersControl,
  LayerGroup,
  Tooltip
} from 'react-leaflet'
import { droneSurveyService } from '@/services/drone/droneSurvey'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// ============================================================================
// TYPES
// ============================================================================

interface DroneGISDashboardProps {
  projectId: string
  height?: string
  showHeatmap?: boolean
}

interface DamageMarker {
  id: string
  lat: number
  lng: number
  severity: 'ringan' | 'sedang' | 'berat'
  damageType: string
  widthMm: number
  lengthMm: number
  confidence: number
  imageUrl: string
  isVerified: boolean
}

// ============================================================================
// CUSTOM MARKERS
// ============================================================================

const createDamageIcon = (severity: string, isVerified: boolean): L.DivIcon => {
  const colors = {
    ringan: '#22C55E',
    sedang: '#EAB308',
    berat: '#EF4444',
  }
  
  const color = colors[severity as keyof typeof colors] || '#6B7280'
  const size = severity === 'berat' ? 24 : severity === 'sedang' ? 18 : 12
  const pulse = !isVerified ? 'animation: pulse 2s infinite;' : ''
  
  return L.divIcon({
    className: 'damage-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border: ${isVerified ? '2px solid #10B981' : '2px dashed white'};
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        ${pulse}
      "></div>
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      </style>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

// ============================================================================
// HEATMAP LAYER (Simulated)
// ============================================================================

function HeatmapLayer({ damages }: { damages: DamageMarker[] }) {
  const map = useMap()
  
  useEffect(() => {
    // Create canvas heatmap overlay
    const canvas = document.createElement('canvas')
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '400'
    
    const container = map.getContainer()
    container.appendChild(canvas)
    
    const resize = () => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }
    resize()
    window.addEventListener('resize', resize)
    
    const ctx = canvas.getContext('2d')!
    
    const drawHeatmap = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      damages.forEach(d => {
        const point = map.latLngToContainerPoint([d.lat, d.lng])
        const intensity = d.severity === 'berat' ? 1 : d.severity === 'sedang' ? 0.7 : 0.4
        
        const gradient = ctx.createRadialGradient(
          point.x, point.y, 0,
          point.x, point.y, 50
        )
        gradient.addColorStop(0, `rgba(239, 68, 68, ${intensity * 0.6})`)
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)')
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(point.x, point.y, 50, 0, Math.PI * 2)
        ctx.fill()
      })
    }
    
    map.on('moveend zoomend', drawHeatmap)
    drawHeatmap()
    
    return () => {
      window.removeEventListener('resize', resize)
      map.off('moveend zoomend', drawHeatmap)
      container.removeChild(canvas)
    }
  }, [damages, map])
  
  return null
}

// ============================================================================
// MAP BOUNDS CONTROLLER
// ============================================================================

function MapBoundsController({ damages }: { damages: DamageMarker[] }) {
  const map = useMap()
  
  useEffect(() => {
    if (damages.length > 0) {
      const bounds = L.latLngBounds(damages.map(d => [d.lat, d.lng]))
      map.fitBounds(bounds, { padding: [100, 100] })
    }
  }, [damages, map])
  
  return null
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export function DroneGISDashboard({ 
  projectId, 
  height = '600px',
  showHeatmap = true
}: DroneGISDashboardProps): JSX.Element {
  const [damages, setDamages] = useState<DamageMarker[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDamage, setSelectedDamage] = useState<DamageMarker | null>(null)
  const [filter, setFilter] = useState<{
    severity: string[]
    verified: 'all' | 'verified' | 'unverified'
  }>({
    severity: ['ringan', 'sedang', 'berat'],
    verified: 'all',
  })
  const [stats, setStats] = useState({
    total: 0,
    verified: 0,
    unverified: 0,
    ringan: 0,
    sedang: 0,
    berat: 0,
  })

  // Load damages
  useEffect(() => {
    loadDamages()
  }, [projectId])

  const loadDamages = async () => {
    setLoading(true)
    try {
      const geoDamages = await droneSurveyService.getGeoDamages(projectId)
      
      const markers = geoDamages.map(d => ({
        id: d.id,
        lat: d.latitude,
        lng: d.longitude,
        severity: d.severity,
        damageType: d.damageType,
        widthMm: d.realWidthMm,
        lengthMm: d.realLengthMm,
        confidence: d.aiConfidence,
        imageUrl: d.fullImageUrl,
        isVerified: d.isVerified,
      }))

      setDamages(markers)
      
      // Calculate stats
      setStats({
        total: markers.length,
        verified: markers.filter(m => m.isVerified).length,
        unverified: markers.filter(m => !m.isVerified).length,
        ringan: markers.filter(m => m.severity === 'ringan').length,
        sedang: markers.filter(m => m.severity === 'sedang').length,
        berat: markers.filter(m => m.severity === 'berat').length,
      })
    } catch (error) {
      console.error('Load damages error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter damages
  const filteredDamages = useMemo(() => {
    return damages.filter(d => {
      if (!filter.severity.includes(d.severity)) return false
      if (filter.verified === 'verified' && !d.isVerified) return false
      if (filter.verified === 'unverified' && d.isVerified) return false
      return true
    })
  }, [damages, filter])

  // Default center
  const center = useMemo(() => {
    if (damages.length === 0) return [-6.9, 107.6] as [number, number]
    return [
      damages.reduce((sum, d) => sum + d.lat, 0) / damages.length,
      damages.reduce((sum, d) => sum + d.lng, 0) / damages.length,
    ] as [number, number]
  }, [damages])

  // Legend component
  const Legend = () => (
    <div className="bg-white rounded-lg shadow-lg p-4 space-y-3">
      <h4 className="font-semibold text-sm">Legenda Kerusakan</h4>
      
      {/* Severity */}
      <div className="space-y-1">
        <p className="text-xs text-gray-500 font-medium">Tingkat Kerusakan</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          <span className="text-xs">Ringan (≤0.3mm)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-yellow-500"></span>
          <span className="text-xs">Sedang (0.3-1mm)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-red-500"></span>
          <span className="text-xs">Berat ({'>'}1mm)</span>
        </div>
      </div>

      {/* Verification */}
      <div className="space-y-1">
        <p className="text-xs text-gray-500 font-medium">Status Verifikasi</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-green-500 bg-green-500"></span>
          <span className="text-xs">Terverifikasi</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-dashed border-gray-400 bg-gray-400"></span>
          <span className="text-xs">Belum Verifikasi</span>
        </div>
      </div>

      {/* Stats */}
      <div className="border-t pt-2">
        <p className="text-xs text-gray-600">
          Total: <span className="font-bold">{stats.total}</span> titik
        </p>
        <p className="text-xs text-green-600">
          Terverifikasi: <span className="font-bold">{stats.verified}</span>
        </p>
        <p className="text-xs text-orange-600">
          Belum: <span className="font-bold">{stats.unverified}</span>
        </p>
      </div>
    </div>
  )

  // Detail panel
  const DetailPanel = () => {
    if (!selectedDamage) return null

    return (
      <div className="bg-white rounded-lg shadow-lg p-4 w-80">
        <div className="flex justify-between items-start mb-3">
          <h4 className="font-semibold text-lg">Detail Kerusakan</h4>
          <button 
            onClick={() => setSelectedDamage(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>

        {/* Image */}
        <div className="aspect-video bg-gray-100 rounded-lg mb-3 overflow-hidden">
          <img 
            src={selectedDamage.imageUrl} 
            alt="Damage"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Jenis:</span>
            <span className="font-medium capitalize">{selectedDamage.damageType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Lebar:</span>
            <span className={`font-medium ${
              selectedDamage.widthMm > 1 ? 'text-red-600' :
              selectedDamage.widthMm > 0.3 ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {selectedDamage.widthMm.toFixed(2)} mm
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Panjang:</span>
            <span className="font-medium">{selectedDamage.lengthMm.toFixed(0)} mm</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">AI Confidence:</span>
            <span className="font-medium">{(selectedDamage.confidence * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Status:</span>
            <span className={`px-2 py-0.5 rounded text-xs ${
              selectedDamage.isVerified 
                ? 'bg-green-100 text-green-800' 
                : 'bg-orange-100 text-orange-800'
            }`}>
              {selectedDamage.isVerified ? 'Terverifikasi' : 'Belum Verifikasi'}
            </span>
          </div>
        </div>

        {/* Actions */}
        {!selectedDamage.isVerified && (
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs text-gray-500 mb-2">Verifikasi Engineer:</p>
            <div className="flex gap-2">
              <button className="flex-1 py-1.5 px-3 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                Benar
              </button>
              <button className="flex-1 py-1.5 px-3 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                Koreksi
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Filter panel
  const FilterPanel = () => (
    <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
      <div className="flex flex-wrap gap-4 items-center">
        {/* Severity filter */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Tingkat Kerusakan</label>
          <div className="flex gap-2">
            {['ringan', 'sedang', 'berat'].map(sev => (
              <label key={sev} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filter.severity.includes(sev)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFilter(f => ({ ...f, severity: [...f.severity, sev] }))
                    } else {
                      setFilter(f => ({ ...f, severity: f.severity.filter(s => s !== sev) }))
                    }
                  }}
                  className="rounded"
                />
                <span className="text-xs capitalize">{sev}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Verification filter */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Status Verifikasi</label>
          <select
            value={filter.verified}
            onChange={(e) => setFilter(f => ({ ...f, verified: e.target.value as any }))}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">Semua</option>
            <option value="verified">Terverifikasi</option>
            <option value="unverified">Belum Verifikasi</option>
          </select>
        </div>

        {/* Stats */}
        <div className="ml-auto flex gap-4 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.ringan}</p>
            <p className="text-xs text-gray-500">Ringan</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.sedang}</p>
            <p className="text-xs text-gray-500">Sedang</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{stats.berat}</p>
            <p className="text-xs text-gray-500">Berat</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Filter Panel */}
      <FilterPanel />

      {/* Map Container */}
      <div className="relative rounded-xl overflow-hidden shadow-lg" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-3 text-gray-600 font-medium">Memuat data drone...</p>
            </div>
          </div>
        )}

        <MapContainer
          center={center}
          zoom={18}
          style={{ height: '100%', width: '100%' }}
        >
          <LayersControl position="topright">
            {/* Base layers */}
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap'
              />
            </LayersControl.BaseLayer>
            
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='&copy; Esri'
              />
            </LayersControl.BaseLayer>

            {/* Damage layers */}
            <LayersControl.Overlay checked name="Semua Kerusakan">
              <LayerGroup>
                {filteredDamages.map(damage => (
                  <Marker
                    key={damage.id}
                    position={[damage.lat, damage.lng]}
                    icon={createDamageIcon(damage.severity, damage.isVerified)}
                    eventHandlers={{
                      click: () => setSelectedDamage(damage),
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -10]}>
                      <div className="text-xs">
                        <p className="font-medium">{damage.damageType}</p>
                        <p>{damage.widthMm.toFixed(2)}mm</p>
                      </div>
                    </Tooltip>
                    <Popup>
                      <div className="p-2">
                        <h4 className="font-semibold capitalize">{damage.damageType}</h4>
                        <p className="text-sm">Lebar: {damage.widthMm.toFixed(2)}mm</p>
                        <p className="text-sm">AI: {(damage.confidence * 100).toFixed(1)}%</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>

            {/* Severity-specific layers */}
            <LayersControl.Overlay name="Hanya Berat">
              <LayerGroup>
                {filteredDamages
                  .filter(d => d.severity === 'berat')
                  .map(damage => (
                    <CircleMarker
                      key={damage.id}
                      center={[damage.lat, damage.lng]}
                      radius={15}
                      pathOptions={{ 
                        fillColor: '#EF4444', 
                        color: '#B91C1C',
                        fillOpacity: 0.7 
                      }}
                      eventHandlers={{
                        click: () => setSelectedDamage(damage),
                      }}
                    >
                      <Popup>
                        <div className="p-2">
                          <h4 className="font-semibold text-red-600">KERUSAKAN BERAT</h4>
                          <p className="text-sm">Lebar: {damage.widthMm.toFixed(2)}mm</p>
                          <p className="text-sm">WAJIB verifikasi engineer!</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
              </LayerGroup>
            </LayersControl.Overlay>
          </LayersControl>

          {/* Heatmap */}
          {showHeatmap && filteredDamages.length > 0 && (
            <HeatmapLayer damages={filteredDamages} />
          )}

          {/* Auto-fit bounds */}
          <MapBoundsController damages={filteredDamages} />
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-[1000]">
          <Legend />
        </div>

        {/* Detail Panel */}
        {selectedDamage && (
          <div className="absolute top-4 right-4 z-[1000]">
            <DetailPanel />
          </div>
        )}
      </div>

      {/* Info Bar */}
      <div className="bg-white rounded-lg shadow p-4 flex justify-between items-center text-sm">
        <div>
          <span className="text-gray-600">Menampilkan </span>
          <span className="font-bold">{filteredDamages.length}</span>
          <span className="text-gray-600"> dari </span>
          <span className="font-bold">{stats.total}</span>
          <span className="text-gray-600"> titik kerusakan</span>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>Ringan: {stats.ringan}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span>Sedang: {stats.sedang}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>Berat: {stats.berat}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DroneGISDashboard
