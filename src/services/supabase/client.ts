import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fallback untuk development - tidak throw error
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Missing Supabase environment variables. Using placeholder values for development.')
  console.warn('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file')
}

// Gunakan placeholder jika tidak ada (agar tidak crash)
const url = supabaseUrl || 'https://placeholder.supabase.co'
const key = supabaseAnonKey || 'placeholder-key'

export const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
  global: {
    headers: {
      'apikey': key,
    },
  },
})

export type SupabaseClient = typeof supabase

// Test koneksi Supabase
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  try {
    // Cek health endpoint
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': key,
      },
    })
    
    if (!response.ok) {
      return { 
        success: false, 
        message: `HTTP Error: ${response.status} ${response.statusText}` 
      }
    }
    
    // Cek auth status
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError) {
      return { 
        success: false, 
        message: `Auth Error: ${authError.message}` 
      }
    }
    
    return { 
      success: true, 
      message: session ? 'Connected (Authenticated)' : 'Connected (Not authenticated)'
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Network Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}
