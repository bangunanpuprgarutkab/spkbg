/**
 * SUPABASE API PATTERNS
 * Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
 * 
 * This file contains example usage patterns for supabase-js client
 */

// ============================================================
// 1. SUPABASE CLIENT SETUP
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { 
  User, Project, Survey, Component, SurveySummary, 
  WorkflowStatus, UserRole 
} from '@/types';

// Environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
  db: {
    schema: 'public',
  },
});

// ============================================================
// 2. AUTHENTICATION PATTERNS
// ============================================================

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

/**
 * Sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current session
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Get current user with profile
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Subscribe to auth changes
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback);
}

// ============================================================
// 3. USER MANAGEMENT PATTERNS
// ============================================================

/**
 * Get all users (admin only)
 */
export async function getAllUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

/**
 * Get users by role
 */
export async function getUsersByRole(role: UserRole): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', role)
    .eq('is_active', true)
    .order('name');
  
  if (error) throw error;
  return data || [];
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string, 
  updates: Partial<User>
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ============================================================
// 4. PROJECT PATTERNS
// ============================================================

/**
 * Get all accessible projects
 */
export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      assigned_surveyor:surveyor_id(name),
      assigned_verifikator:verifikator_id(name),
      assigned_approver:approver_id(name)
    `)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

/**
 * Get project by ID with related data
 */
export async function getProjectById(projectId: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      assigned_surveyor:surveyor_id(*),
      assigned_verifikator:verifikator_id(*),
      assigned_approver:approver_id(*),
      created_by_user:created_by(*)
    `)
    .eq('id', projectId)
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Create new project
 */
export async function createProject(
  projectData: Omit<Project, 'id' | 'kode_project' | 'created_at' | 'updated_at'>
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...projectData,
      status_workflow: 'disposisi',
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update project
 */
export async function updateProject(
  projectId: string, 
  updates: Partial<Project>
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Assign surveyor to project
 */
export async function assignSurveyor(
  projectId: string, 
  surveyorId: string
): Promise<Project> {
  return updateProject(projectId, {
    assigned_surveyor: surveyorId,
    status_workflow: 'persiapan',
  });
}

/**
 * Delete project (admin only)
 */
export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);
  
  if (error) throw error;
}

// ============================================================
// 5. SURVEY PATTERNS
// ============================================================

/**
 * Get surveys with summary view
 */
export async function getSurveys(): Promise<SurveySummary[]> {
  const { data, error } = await supabase
    .from('survey_summary')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

/**
 * Get surveys by project
 */
export async function getSurveysByProject(projectId: string): Promise<Survey[]> {
  const { data, error } = await supabase
    .from('surveys')
    .select(`
      *,
      surveyor:surveyor_id(name),
      results:results(*)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

/**
 * Get survey by ID with all details
 */
export async function getSurveyById(surveyId: string): Promise<Survey | null> {
  const { data, error } = await supabase
    .from('surveys')
    .select(`
      *,
      project:project_id(*),
      surveyor:surveyor_id(*),
      verifikator:verifikator_id(*),
      approver:approver_id(*),
      components:components(*),
      results:results(*),
      signatures:signatures(*)
    `)
    .eq('id', surveyId)
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Create new survey
 */
export async function createSurvey(
  surveyData: {
    project_id: string;
    tanggal_survey: string;
    template_id?: string;
  }
): Promise<Survey> {
  const { data: project } = await supabase
    .from('projects')
    .select('assigned_surveyor, template_id')
    .eq('id', surveyData.project_id)
    .single();
  
  const { data, error } = await supabase
    .from('surveys')
    .insert({
      ...surveyData,
      surveyor_id: project?.assigned_surveyor,
      template_id: surveyData.template_id || project?.template_id,
      status: 'survey',
      is_draft: true,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update survey (draft only)
 */
export async function updateSurvey(
  surveyId: string, 
  updates: Partial<Survey>
): Promise<Survey> {
  const { data, error } = await supabase
    .from('surveys')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', surveyId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Save survey draft
 */
export async function saveSurveyDraft(
  surveyId: string, 
  draftData: Partial<Survey>
): Promise<Survey> {
  return updateSurvey(surveyId, {
    ...draftData,
    is_draft: true,
  });
}

/**
 * Submit survey for analysis
 */
export async function submitSurvey(surveyId: string): Promise<Survey> {
  const { data, error } = await supabase
    .from('surveys')
    .update({
      is_draft: false,
      status: 'analisis',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', surveyId)
    .eq('is_draft', true) // Ensure it's still draft
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Delete survey (admin or draft only)
 */
export async function deleteSurvey(surveyId: string): Promise<void> {
  const { error } = await supabase
    .from('surveys')
    .delete()
    .eq('id', surveyId);
  
  if (error) throw error;
}

// ============================================================
// 6. COMPONENT PATTERNS
// ============================================================

/**
 * Get components by survey
 */
export async function getComponentsBySurvey(surveyId: string): Promise<Component[]> {
  const { data, error } = await supabase
    .from('components')
    .select('*')
    .eq('survey_id', surveyId)
    .order('kategori')
    .order('kode_komponen');
  
  if (error) throw error;
  return data || [];
}

/**
 * Get component by ID
 */
export async function getComponentById(componentId: string): Promise<Component | null> {
  const { data, error } = await supabase
    .from('components')
    .select('*')
    .eq('id', componentId)
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Create or update component (upsert)
 */
export async function upsertComponent(
  component: Partial<Component> & { survey_id: string; kode_komponen: string }
): Promise<Component> {
  // Get bobot_komponen from definitions if not provided
  if (!component.bobot_komponen) {
    const { data: definition } = await supabase
      .from('component_definitions')
      .select('bobot_komponen, nama_komponen, kategori')
      .eq('kode_komponen', component.kode_komponen)
      .single();
    
    if (definition) {
      component.bobot_komponen = definition.bobot_komponen;
      component.nama_komponen = component.nama_komponen || definition.nama_komponen;
      component.kategori = component.kategori || definition.kategori;
    }
  }
  
  const { data, error } = await supabase
    .from('components')
    .upsert({
      ...component,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'survey_id,kode_komponen',
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Batch upsert components
 */
export async function batchUpsertComponents(
  components: (Partial<Component> & { survey_id: string; kode_komponen: string })[]
): Promise<Component[]> {
  const { data, error } = await supabase
    .from('components')
    .upsert(
      components.map(c => ({
        ...c,
        updated_at: new Date().toISOString(),
      })),
      {
        onConflict: 'survey_id,kode_komponen',
      }
    )
    .select();
  
  if (error) throw error;
  return data || [];
}

/**
 * Delete component
 */
export async function deleteComponent(componentId: string): Promise<void> {
  const { error } = await supabase
    .from('components')
    .delete()
    .eq('id', componentId);
  
  if (error) throw error;
}

/**
 * Get component definitions (master data)
 */
export async function getComponentDefinitions(
  kategori?: string
): Promise<any[]> {
  let query = supabase
    .from('component_definitions')
    .select('*')
    .eq('is_active', true)
    .order('urutan');
  
  if (kategori) {
    query = query.eq('kategori', kategori);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ============================================================
// 7. WORKFLOW PATTERNS
// ============================================================

/**
 * Execute workflow transition (using RPC function)
 */
export async function executeWorkflowTransition(
  surveyId: string,
  toStatus: WorkflowStatus,
  note?: string
): Promise<{ success: boolean; log_id?: string; error?: string }> {
  const { data, error } = await supabase
    .rpc('execute_workflow_transition', {
      p_survey_id: surveyId,
      p_to_status: toStatus,
      p_note: note,
    });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return data;
}

/**
 * Get workflow logs for survey
 */
export async function getWorkflowLogs(surveyId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('workflow_logs')
    .select(`
      *,
      actor:actor_id(name, role)
    `)
    .eq('survey_id', surveyId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

/**
 * Get workflow timeline view
 */
export async function getWorkflowTimeline(surveyId?: string): Promise<any[]> {
  let query = supabase
    .from('workflow_timeline')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (surveyId) {
    query = query.eq('survey_id', surveyId);
  }
  
  const { data, error } = await query.limit(100);
  if (error) throw error;
  return data || [];
}

// ============================================================
// 8. CALCULATION PATTERNS
// ============================================================

/**
 * Calculate survey damage (trigger RPC function)
 */
export async function calculateSurveyDamage(surveyId: string): Promise<any> {
  const { data, error } = await supabase
    .rpc('calculate_survey_damage', {
      p_survey_id: surveyId,
    });
  
  if (error) throw error;
  return data;
}

/**
 * Get calculation results
 */
export async function getResults(surveyId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('results')
    .select('*')
    .eq('survey_id', surveyId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data;
}

/**
 * Verify results (verifikator only)
 */
export async function verifyResults(
  surveyId: string,
  verifiedBy: string
): Promise<any> {
  const { data, error } = await supabase
    .from('results')
    .update({
      verified_by: verifiedBy,
      verified_at: new Date().toISOString(),
    })
    .eq('survey_id', surveyId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Approve results (approver only)
 */
export async function approveResults(
  surveyId: string,
  approvedBy: string
): Promise<any> {
  const { data, error } = await supabase
    .from('results')
    .update({
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('survey_id', surveyId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ============================================================
// 9. STORAGE PATTERNS
// ============================================================

/**
 * Upload file to storage bucket
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<{ path: string; url: string }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
  
  if (error) throw error;
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);
  
  return { path: data.path, url: publicUrl };
}

/**
 * Upload signature
 */
export async function uploadSignature(
  surveyId: string,
  userId: string,
  signatureBlob: Blob
): Promise<string> {
  const path = `signatures/${surveyId}/${userId}_${Date.now()}.png`;
  const { path: storedPath } = await uploadFile('signatures', path, 
    new File([signatureBlob], 'signature.png', { type: 'image/png' })
  );
  return storedPath;
}

/**
 * Upload component photo
 */
export async function uploadComponentPhoto(
  surveyId: string,
  componentId: string,
  photo: File
): Promise<string> {
  const path = `photos/${surveyId}/${componentId}_${Date.now()}_${photo.name}`;
  const { path: storedPath } = await uploadFile('component-photos', path, photo);
  return storedPath;
}

/**
 * Delete file from storage
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);
  
  if (error) throw error;
}

// ============================================================
// 10. NOTIFICATION PATTERNS
// ============================================================

/**
 * Get user notifications
 */
export async function getNotifications(
  userId: string, 
  unreadOnly: boolean = false
): Promise<any[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (unreadOnly) {
    query = query.eq('is_read', false);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId);
  
  if (error) throw error;
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('is_read', false);
  
  if (error) throw error;
}

// ============================================================
// 11. REALTIME SUBSCRIPTIONS
// ============================================================

/**
 * Subscribe to survey changes
 */
export function subscribeToSurvey(
  surveyId: string, 
  callback: (payload: any) => void
) {
  return supabase
    .channel(`survey_${surveyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'surveys',
        filter: `id=eq.${surveyId}`,
      },
      callback
    )
    .subscribe();
}

/**
 * Subscribe to component changes
 */
export function subscribeToComponents(
  surveyId: string,
  callback: (payload: any) => void
) {
  return supabase
    .channel(`components_${surveyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'components',
        filter: `survey_id=eq.${surveyId}`,
      },
      callback
    )
    .subscribe();
}

/**
 * Subscribe to user notifications
 */
export function subscribeToNotifications(
  userId: string,
  callback: (payload: any) => void
) {
  return supabase
    .channel(`notifications_${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();
}

// ============================================================
// 12. DASHBOARD & ANALYTICS
// ============================================================

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<any> {
  const { data, error } = await supabase
    .rpc('get_dashboard_stats');
  
  if (error) throw error;
  return data;
}

/**
 * Get project progress
 */
export async function getProjectProgress(): Promise<any[]> {
  const { data, error } = await supabase
    .from('project_progress')
    .select('*')
    .order('progress_percentage', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

/**
 * Get surveys summary
 */
export async function getSurveysSummary(): Promise<SurveySummary[]> {
  const { data, error } = await supabase
    .from('survey_summary')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// ============================================================
// 13. ERROR HANDLING PATTERNS
// ============================================================

/**
 * Handle Supabase errors with proper typing
 */
export function handleSupabaseError(error: any): Error {
  if (error.code === '42501') {
    return new Error('Akses ditolak. Anda tidak memiliki izin untuk melakukan operasi ini.');
  }
  if (error.code === '23505') {
    return new Error('Data sudah ada. Tidak dapat membuat duplikat.');
  }
  if (error.code === '23503') {
    return new Error('Data referensi tidak ditemukan.');
  }
  if (error.code === 'PGRST116') {
    return new Error('Data tidak ditemukan.');
  }
  return new Error(error.message || 'Terjadi kesalahan pada database.');
}

// ============================================================
// 14. TRANSACTION PATTERNS (Batch Operations)
// ============================================================

/**
 * Batch operations helper
 * Note: Supabase doesn't support true transactions across multiple tables
 * Use this pattern for related operations
 */
export async function batchOperations<T>(
  operations: (() => Promise<T>)[]
): Promise<{ results: T[]; errors: any[] }> {
  const results: T[] = [];
  const errors: any[] = [];
  
  for (const operation of operations) {
    try {
      const result = await operation();
      results.push(result);
    } catch (error) {
      errors.push(error);
    }
  }
  
  return { results, errors };
}

// ============================================================
// 15. UTILITY FUNCTIONS
// ============================================================

/**
 * Check if user has specific role
 */
export function hasRole(user: User | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

/**
 * Check if survey is editable by user
 */
export function isSurveyEditable(
  survey: Survey, 
  user: User
): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'surveyor' && survey.surveyor_id === user.id) {
    return survey.is_draft || survey.status === 'survey' || survey.status === 'ditolak';
  }
  return false;
}

/**
 * Check if user can approve
 */
export function canApprove(
  survey: Survey, 
  user: User
): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'verifikator') {
    return survey.verifikator_id === user.id && survey.status === 'diperiksa';
  }
  if (user.role === 'approver') {
    return survey.approver_id === user.id && survey.status === 'disetujui';
  }
  return false;
}

// Export all patterns
export const supabaseApi = {
  // Auth
  signIn,
  signOut,
  getSession,
  getCurrentUser,
  onAuthStateChange,
  
  // Users
  getAllUsers,
  getUsersByRole,
  updateUserProfile,
  
  // Projects
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  assignSurveyor,
  deleteProject,
  
  // Surveys
  getSurveys,
  getSurveysByProject,
  getSurveyById,
  createSurvey,
  updateSurvey,
  saveSurveyDraft,
  submitSurvey,
  deleteSurvey,
  
  // Components
  getComponentsBySurvey,
  getComponentById,
  upsertComponent,
  batchUpsertComponents,
  deleteComponent,
  getComponentDefinitions,
  
  // Workflow
  executeWorkflowTransition,
  getWorkflowLogs,
  getWorkflowTimeline,
  
  // Calculations
  calculateSurveyDamage,
  getResults,
  verifyResults,
  approveResults,
  
  // Storage
  uploadFile,
  uploadSignature,
  uploadComponentPhoto,
  deleteFile,
  
  // Notifications
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  
  // Realtime
  subscribeToSurvey,
  subscribeToComponents,
  subscribeToNotifications,
  
  // Dashboard
  getDashboardStats,
  getProjectProgress,
  getSurveysSummary,
  
  // Utilities
  handleSupabaseError,
  batchOperations,
  hasRole,
  isSurveyEditable,
  canApprove,
};

export default supabaseApi;
