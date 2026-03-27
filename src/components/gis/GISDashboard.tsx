/**
 * GIS NATIONAL MAP DASHBOARD
 * Smart AI Engineering Platform - SPKBG
 * 
 * Dashboard peta nasional dengan Leaflet
 * Visualisasi lokasi bangunan dan tingkat kerusakan
 */

import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl, LayerGroup } from 'react-leaflet'
import { multiProjectService } from '@/services/organization/multiProject'
import type { DamageCategory } from '@/types'

// Leaflet CSS akan diimport di globals.css
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ============================================================================
// TYPES
// ============================================================================

interface MapLocation {
  id: string
  nama: string
  lat: number
  lng: number
  status: string
  kategori: DamageCategory
  kerusakan: number
  alamat: string
  organization?: string
  lastUpdated: string
}

interface GISDashboardProps {
  filter?: {
    provinsi?: string
    kabupaten?: string
    organizationId?: string
    kategori?: DamageCategory[]
  }
  height?: string
}

// ============================================================================
// MARKER COLORS
// ============================================================================

const getMarkerColor = (kategori: DamageCategory): string => {
  const colors: Record<DamageCategory, string> = {
    'ringan': '#22C55E',  // Green
    'sedang': '#EAB308',  // Yellow
    'berat': '#EF4444',   // Red
  }
  return colors[kategori] || '#6B7280'
}

const getMarkerIcon = (kategori: DamageCategory, kerusakan: number): L.DivIcon => {
  const color = getMarkerColor(kategori)
  const size = kerusakan > 50 ? 32 : kerusakan > 30 ? 24 : 16
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${size / 3}px;
      ">
        ${kerusakan.toFixed(0)}%
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

// ============================================================================
// MAP CONTROLS
// ============================================================================

function MapBoundsController({ locations }: { locations: MapLocation[] }) {
  const map = useMap()
  
  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds(
        locations.map(loc => [loc.lat, loc.lng])
      )
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [locations, map])
  
  return null
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export function GISNationalDashboard({ filter = {}, height = '600px' }: GISDashboardProps): JSX.Element {
  const [locations, setLocations] = useState<MapLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null)
  const [mapCenter] = useState<[number, number]>([-6.9, 107.6]) // Default: Jawa Barat
  const [mapZoom] = useState(8)

  // Stats
  const stats = useMemo(() => {
    return {
      total: locations.length,
      ringan: locations.filter(l => l.kategori === 'ringan').length,
      sedang: locations.filter(l => l.kategori === 'sedang').length,
      berat: locations.filter(l => l.kategori === 'berat').length,
      avgDamage: locations.length > 0
        ? locations.reduce((sum, l) => sum + l.kerusakan, 0) / locations.length
        : 0,
    }
  }, [locations])

  // Load locations
  useEffect(() => {
    loadLocations()
  }, [filter])

  const loadLocations = async () => {
    setLoading(true)
    try {
      const locs = await multiProjectService.getProjectLocations({
        provinsi: filter.provinsi,
        kabupaten: filter.kabupaten,
        organizationId: filter.organizationId,
      }) as MapLocation[]

      // Filter by kategori if specified
      let filtered = locs
      if (filter.kategori && filter.kategori.length > 0) {
        filtered = locs.filter((l: MapLocation) => filter.kategori!.includes(l.kategori))
      }

      setLocations(filtered)
    } catch (error) {
      console.error('Load locations error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Legend
  const Legend = () => (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-2">
      <h4 className="font-semibold text-sm">Kategori Kerusakan</h4>
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-green-500"></span>
          <span>Ringan (≤30%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-yellow-500"></span>
          <span>Sedang (30-45%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-red-500"></span>
          <span>Berat ({'>'}45%)</span>
        </div>
      </div>
      <div className="border-t pt-2 mt-2">
        <p className="text-xs text-gray-500">
          Total: {stats.total} proyek
        </p>
        <p className="text-xs text-gray-500">
          Avg: {stats.avgDamage.toFixed(1)}%
        </p>
      </div>
    </div>
  )

  // Info Panel
  const InfoPanel = () => {
    if (!selectedLocation) return null

    return (
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex justify-between items-start">
          <h4 className="font-semibold">{selectedLocation.nama}</h4>
          <button
            onClick={() => setSelectedLocation(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">{selectedLocation.alamat}</p>
        <div className="mt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Kerusakan:</span>
            <span className={`font-medium ${
              selectedLocation.kerusakan > 45 ? 'text-red-600' :
              selectedLocation.kerusakan > 30 ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {selectedLocation.kerusakan.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Kategori:</span>
            <span className={`px-2 py-0.5 rounded text-xs ${
              selectedLocation.kategori === 'berat' ? 'bg-red-100 text-red-800' :
              selectedLocation.kategori === 'sedang' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {selectedLocation.kategori.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Status:</span>
            <span className="text-gray-600">{selectedLocation.status}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Update:</span>
            <span className="text-gray-500">
              {new Date(selectedLocation.lastUpdated).toLocaleDateString('id-ID')}
            </span>
          </div>
        </div>
        <a
          href={`/projects/${selectedLocation.id}`}
          className="mt-4 block w-full text-center py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
        >
          Lihat Detail
        </a>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-gray-600">Total Proyek</p>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.ringan}</p>
          <p className="text-xs text-green-700">Ringan</p>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.sedang}</p>
          <p className="text-xs text-yellow-700">Sedang</p>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.berat}</p>
          <p className="text-xs text-red-700">Berat</p>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative rounded-xl overflow-hidden shadow-lg" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Memuat peta...</p>
            </div>
          </div>
        )}

        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
            </LayersControl.BaseLayer>
            
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution='&copy; Esri'
              />
            </LayersControl.BaseLayer>

            <LayersControl.Overlay checked name="Proyek Ringan">
              <LayerGroup>
                {locations
                  .filter(l => l.kategori === 'ringan')
                  .map(loc => (
                    <Marker
                      key={loc.id}
                      position={[loc.lat, loc.lng]}
                      icon={getMarkerIcon(loc.kategori, loc.kerusakan)}
                      eventHandlers={{
                        click: () => setSelectedLocation(loc),
                      }}
                    >
                      <Popup>
                        <div className="p-2">
                          <h4 className="font-semibold">{loc.nama}</h4>
                          <p className="text-sm">Kerusakan: {loc.kerusakan.toFixed(1)}%</p>
                          <p className="text-sm">Kategori: {loc.kategori}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </LayerGroup>
            </LayersControl.Overlay>

            <LayersControl.Overlay checked name="Proyek Sedang">
              <LayerGroup>
                {locations
                  .filter(l => l.kategori === 'sedang')
                  .map(loc => (
                    <Marker
                      key={loc.id}
                      position={[loc.lat, loc.lng]}
                      icon={getMarkerIcon(loc.kategori, loc.kerusakan)}
                      eventHandlers={{
                        click: () => setSelectedLocation(loc),
                      }}
                    >
                      <Popup>
                        <div className="p-2">
                          <h4 className="font-semibold">{loc.nama}</h4>
                          <p className="text-sm">Kerusakan: {loc.kerusakan.toFixed(1)}%</p>
                          <p className="text-sm">Kategori: {loc.kategori}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </LayerGroup>
            </LayersControl.Overlay>

            <LayersControl.Overlay checked name="Proyek Berat">
              <LayerGroup>
                {locations
                  .filter(l => l.kategori === 'berat')
                  .map(loc => (
                    <Marker
                      key={loc.id}
                      position={[loc.lat, loc.lng]}
                      icon={getMarkerIcon(loc.kategori, loc.kerusakan)}
                      eventHandlers={{
                        click: () => setSelectedLocation(loc),
                      }}
                    >
                      <Popup>
                        <div className="p-2">
                          <h4 className="font-semibold">{loc.nama}</h4>
                          <p className="text-sm">Kerusakan: {loc.kerusakan.toFixed(1)}%</p>
                          <p className="text-sm">Kategori: {loc.kategori}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </LayerGroup>
            </LayersControl.Overlay>
          </LayersControl>

          <MapBoundsController locations={locations} />
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-[1000]">
          <Legend />
        </div>

        {/* Info Panel */}
        {selectedLocation && (
          <div className="absolute top-4 right-4 z-[1000] w-72">
            <InfoPanel />
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// STANDALONE MAP VIEW (Simplified)
// ============================================================================

interface SimpleMapProps {
  locations: Array<{
    id: string
    nama: string
    lat: number
    lng: number
    kategori: DamageCategory
    kerusakan: number
  }>
  height?: string
}

export function SimpleMap({ locations, height = '400px' }: SimpleMapProps): JSX.Element {
  const center: [number, number] = locations.length > 0
    ? [locations[0].lat, locations[0].lng]
    : [-6.9, 107.6]

  return (
    <MapContainer
      center={center as [number, number]}
      zoom={13}
      style={{ height, width: '100%', borderRadius: '0.75rem' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />
      {locations.map(loc => (
        <Marker
          key={loc.id}
          position={[loc.lat, loc.lng]}
          icon={getMarkerIcon(loc.kategori, loc.kerusakan)}
        >
          <Popup>
            <div className="p-2">
              <h4 className="font-semibold">{loc.nama}</h4>
              <p className="text-sm">Kerusakan: {loc.kerusakan.toFixed(1)}%</p>
            </div>
          </Popup>
        </Marker>
      ))}
      <MapBoundsController locations={locations as any} />
    </MapContainer>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  GISNationalDashboard,
  SimpleMap,
}
