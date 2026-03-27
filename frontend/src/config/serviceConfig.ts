/**
 * Unified Service Configuration
 * Smart AI Engineering Platform - SPKBG
 * 
 * Centralized configuration for all services
 * Frontend, Supabase, and AI Service integration
 */

// Check if in production
const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production'

// ============================================================================
// SERVICE URLS
// ============================================================================

export const SERVICE_URLS = {
  // Frontend (current)
  frontend: import.meta.env.VITE_FRONTEND_URL || window.location.origin,
  
  // Supabase - URL disembunyikan di development
  supabase: {
    url: isProduction ? (import.meta.env.VITE_SUPABASE_URL || '') : '',
    anonKey: '', // Never expose in UI
  },
  
  // AI Service - URL disembunyikan di development
  ai: isProduction ? (import.meta.env.VITE_AI_API_URL || '') : '',
  
  // Google Services - disembunyikan di development
  google: {
    drive: isProduction ? (import.meta.env.VITE_GOOGLE_DRIVE_API || '') : '',
    sheets: isProduction ? (import.meta.env.VITE_GOOGLE_SHEETS_API || '') : '',
    docs: isProduction ? (import.meta.env.VITE_GOOGLE_DOCS_API || '') : '',
  },
} as const

// ============================================================================
// SERVICE CONFIG
// ============================================================================

export const SERVICE_CONFIG = {
  // API Timeouts (ms)
  timeouts: {
    default: 30000,
    upload: 120000,
    detection: 60000,
    health: 5000,
  },
  
  // Retry Config
  retry: {
    maxAttempts: 3,
    delay: 1000,
    backoffMultiplier: 2,
  },
  
  // Upload Config
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    chunkSize: 1024 * 1024, // 1MB chunks
  },
  
  // Cache Config
  cache: {
    ttl: 5 * 60 * 1000, // 5 minutes
    staleWhileRevalidate: 60 * 1000, // 1 minute
  },
} as const

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const FEATURE_FLAGS = {
  // AI Features
  aiDetection: true,
  aiBatchProcessing: true,
  aiProgressTracking: true,
  
  // Real-time Features
  realtimeNotifications: true,
  realtimeWorkflow: true,
  realtimeLeaderboard: true,
  
  // Integration Features
  googleDrive: true,
  googleSheets: true,
  googleDocs: true,
  
  // Export Features
  excelExport: true,
  pdfExport: true,
  
  // Collaboration Features
  teamManagement: true,
  taskAssignment: true,
  progressTracking: true,
} as const

// ============================================================================
// SERVICE STATUS
// ============================================================================

export interface ServiceHealth {
  name: string
  connected: boolean
  latency: number
  lastChecked: string
  error?: string
}

export interface SystemStatus {
  allHealthy: boolean
  services: ServiceHealth[]
  timestamp: string
}

// ============================================================================
// SERVICE CHECKERS
// ============================================================================

/**
 * Check AI Service health
 */
export async function checkAIHealth(): Promise<ServiceHealth> {
  const start = performance.now()
  
  try {
    const response = await fetch(`${SERVICE_URLS.ai}/`, {
      method: 'GET',
      signal: AbortSignal.timeout(SERVICE_CONFIG.timeouts.health),
    })
    
    const latency = Math.round(performance.now() - start)
    const data = await response.json()
    
    return {
      name: 'AI Service',
      connected: response.ok && data.status === 'healthy',
      latency,
      lastChecked: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'AI Service',
      connected: false,
      latency: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check Supabase connection
 * (Uses a simple ping or existing client)
 */
export async function checkSupabaseHealth(): Promise<ServiceHealth> {
  const start = performance.now()
  
  try {
    // Simple health check via auth endpoint or use existing supabase client
    const response = await fetch(`${SERVICE_URLS.supabase.url}/auth/v1/health`, {
      method: 'GET',
      headers: {
        'apikey': SERVICE_URLS.supabase.anonKey,
      },
      signal: AbortSignal.timeout(SERVICE_CONFIG.timeouts.health),
    })
    
    const latency = Math.round(performance.now() - start)
    
    return {
      name: 'Supabase',
      connected: response.ok,
      latency,
      lastChecked: new Date().toISOString(),
    }
  } catch (error) {
    return {
      name: 'Supabase',
      connected: false,
      latency: Math.round(performance.now() - start),
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check all services
 */
export async function checkAllServices(): Promise<SystemStatus> {
  const [aiHealth, supabaseHealth] = await Promise.all([
    checkAIHealth(),
    checkSupabaseHealth(),
  ])
  
  const services = [aiHealth, supabaseHealth]
  const allHealthy = services.every(s => s.connected)
  
  return {
    allHealthy,
    services,
    timestamp: new Date().toISOString(),
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const serviceConfig = {
  urls: SERVICE_URLS,
  config: SERVICE_CONFIG,
  features: FEATURE_FLAGS,
  checkAIHealth,
  checkSupabaseHealth,
  checkAllServices,
}

export default serviceConfig
