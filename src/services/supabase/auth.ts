import { supabase } from './client'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types'

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) throw error
  
  // Fetch user profile after sign in
  if (data.user) {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single()
    
    if (profileError) throw profileError
    
    // Update auth store
    useAuthStore.getState().setUser(profile as User)
    useAuthStore.getState().setSession(data.session)
    useAuthStore.getState().setLoading(false)
    
    return { user: profile, session: data.session }
  }
  
  return data
}

/**
 * Sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  
  // Clear auth store
  useAuthStore.getState().logout()
}

/**
 * Get current session
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

/**
 * Initialize auth state on app load
 */
export async function initializeAuth() {
  const store = useAuthStore.getState()
  store.setLoading(true)
  
  try {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user) {
      // Fetch user profile
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()
      
      if (error) {
        // User exists in auth but not in users table
        console.error('User profile not found:', error)
        await signOut()
        return null
      }
      
      store.setUser(profile as User)
      store.setSession(session)
    }
  } catch (error) {
    console.error('Auth initialization error:', error)
  } finally {
    store.setLoading(false)
  }
}

/**
 * Subscribe to auth changes
 */
export function subscribeToAuthChanges() {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    const store = useAuthStore.getState()
    
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        if (profile) {
          store.setUser(profile as User)
          store.setSession(session)
        }
      }
    } else if (event === 'SIGNED_OUT') {
      store.logout()
    }
  })
}

/**
 * Check if user has required role
 */
export function hasRole(user: User | null, roles: string[]): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return roles.includes(user.role)
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: string): string {
  const names: Record<string, string> = {
    admin: 'Administrator',
    surveyor: 'Surveyor',
    verifikator: 'Verifikator',
    approver: 'Approver',
  }
  return names[role] || role
}
