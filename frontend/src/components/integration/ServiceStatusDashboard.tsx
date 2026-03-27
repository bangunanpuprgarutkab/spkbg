/**
 * Service Status Dashboard Component
 * Smart AI Engineering Platform - SPKBG
 * 
 * Dashboard untuk memantau status semua service
 * - AI Service (FastAPI + YOLO)
 * - Supabase (PostgreSQL + Auth)
 * - Frontend
 */

import { useEffect, useState, useCallback } from 'react'
import { 
  Activity, 
  Server, 
  Database, 
  Cpu,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Wifi
} from 'lucide-react'
import { serviceConfig, type SystemStatus, type ServiceHealth } from '@/config/serviceConfig'

// ============================================================================
// TYPES
// ============================================================================

interface ServiceCardProps {
  service: ServiceHealth
  icon: React.ReactNode
  color: string
}

// ============================================================================
// SERVICE CARD COMPONENT
// ============================================================================

function ServiceCard({ service, icon, color }: ServiceCardProps): JSX.Element {
  const statusColor = service.connected ? 'bg-green-500' : 'bg-red-500'
  const statusIcon = service.connected ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-lg ${color}`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{service.name}</h3>
            <p className="text-sm text-gray-500">
              {service.connected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
        </div>
        <div className={`p-2 rounded-full text-white ${statusColor}`}>
          {statusIcon}
        </div>
      </div>
      
      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Latency</span>
          <span className="font-medium text-gray-900">{service.latency}ms</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Last Check</span>
          <span className="font-medium text-gray-900">
            {new Date(service.lastChecked).toLocaleTimeString()}
          </span>
        </div>
        {service.error && (
          <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600">
            {service.error}
          </div>
        )}
      </div>
    </div>
  )
}

// Check if in production mode
const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production'

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export function ServiceStatusDashboard(): JSX.Element {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  
  const checkStatus = useCallback(async () => {
    setLoading(true)
    try {
      const result = await serviceConfig.checkAllServices()
      setStatus(result)
    } catch (error) {
      console.error('Failed to check services:', error)
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    // Initial check
    checkStatus()
    
    // Auto refresh every 30 seconds
    let interval: ReturnType<typeof setInterval> | null = null
    
    if (autoRefresh) {
      interval = setInterval(checkStatus, 30000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [checkStatus, autoRefresh])
  
  const allHealthy = status?.allHealthy ?? false
  
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Status</h1>
          <p className="text-gray-600 mt-1">
            Monitor integrasi semua service SPKBG
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Auto Refresh Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Auto Refresh</span>
          </label>
          
          {/* Refresh Button */}
          <button
            onClick={checkStatus}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
      
      {/* Overall Status */}
      <div className={`mb-6 p-4 rounded-lg border ${
        allHealthy 
          ? 'bg-green-50 border-green-200' 
          : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-center gap-3">
          {allHealthy ? (
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-red-600" />
          )}
          <div>
            <h2 className={`font-semibold ${allHealthy ? 'text-green-900' : 'text-red-900'}`}>
              {allHealthy ? 'All Systems Operational' : 'Some Services Unavailable'}
            </h2>
            <p className={`text-sm ${allHealthy ? 'text-green-700' : 'text-red-700'}`}>
              Last updated: {status ? new Date(status.timestamp).toLocaleString() : 'Never'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* AI Service */}
        {status?.services.map((service) => {
          let icon = <Server className="w-6 h-6 text-white" />
          let color = 'bg-blue-500'
          
          if (service.name === 'AI Service') {
            icon = <Cpu className="w-6 h-6 text-white" />
            color = 'bg-purple-500'
          } else if (service.name === 'Supabase') {
            icon = <Database className="w-6 h-6 text-white" />
            color = 'bg-green-500'
          }
          
          return (
            <ServiceCard
              key={service.name}
              service={service}
              icon={icon}
              color={color}
            />
          )
        })}
        
        {/* Frontend (always available if this renders) */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-500">
                <Wifi className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Frontend</h3>
                <p className="text-sm text-gray-500">Connected</p>
              </div>
            </div>
            <div className="p-2 rounded-full text-white bg-green-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Status</span>
              <span className="font-medium text-gray-900">Running</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Version</span>
              <span className="font-medium text-gray-900">1.0.0</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Configuration - HIDDEN in development for security */}
      {isProduction && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* AI Service Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              AI Service Actions
            </h3>
            <div className="space-y-2">
              <a 
                href={`${serviceConfig.urls.ai}/docs`}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm text-gray-700"
              >
                Open API Documentation →
              </a>
              <a 
                href={serviceConfig.urls.ai}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm text-gray-700"
              >
                Test Health Endpoint →
              </a>
            </div>
          </div>
          
          {/* Configuration */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Configuration</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">AI API URL</span>
                <span className="font-mono text-gray-900 truncate max-w-[200px]">
                  {serviceConfig.urls.ai}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Supabase URL</span>
                <span className="font-mono text-gray-900 truncate max-w-[200px]">
                  {serviceConfig.urls.supabase.url ? 'Configured' : 'Not set'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Auto Refresh</span>
                <span className="font-medium text-gray-900">
                  {autoRefresh ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// COMPACT STATUS INDICATOR
// ============================================================================

export function ServiceStatusIndicator(): JSX.Element {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  
  useEffect(() => {
    const check = async () => {
      try {
        const result = await serviceConfig.checkAllServices()
        setStatus(result)
      } catch (error) {
        console.error('Status check failed:', error)
      }
    }
    
    check()
    const interval = setInterval(check, 60000) // Check every minute
    
    return () => clearInterval(interval)
  }, [])
  
  const allHealthy = status?.allHealthy ?? false
  const connectedCount = status?.services.filter(s => s.connected).length ?? 0
  const totalCount = status?.services.length ?? 0
  
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
      <div className={`w-2 h-2 rounded-full ${allHealthy ? 'bg-green-500' : 'bg-yellow-500'}`} />
      <span className="text-xs text-gray-600">
        {connectedCount}/{totalCount} Services
      </span>
    </div>
  )
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ServiceStatusDashboard,
  ServiceStatusIndicator,
}
