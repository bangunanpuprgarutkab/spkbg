import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { WorkflowStatus, WorkflowTransition, UserRole } from '@/types'

interface WorkflowState {
  // Current workflow state
  currentStatus: WorkflowStatus | null
  availableTransitions: WorkflowTransition[]
  isTransitioning: boolean
  error: string | null
  
  // Workflow history
  workflowHistory: {
    from: WorkflowStatus
    to: WorkflowStatus
    timestamp: Date
    actor?: string
  }[]
  
  // Actions
  setCurrentStatus: (status: WorkflowStatus | null) => void
  setAvailableTransitions: (transitions: WorkflowTransition[]) => void
  setTransitioning: (isTransitioning: boolean) => void
  setError: (error: string | null) => void
  addHistory: (from: WorkflowStatus, to: WorkflowStatus, actor?: string) => void
  clearHistory: () => void
  
  // Getters
  canTransition: (toStatus: WorkflowStatus) => boolean
  getNextStatuses: () => WorkflowStatus[]
  isFinalStatus: () => boolean
}

// Workflow sequence - digunakan untuk validasi urutan (UNUSED - kept for reference)
// const WORKFLOW_SEQUENCE: WorkflowStatus[] = [
//   'disposisi',
//   'persiapan',
//   'survey',
//   'analisis',
//   'penilaian',
//   'diperiksa',
//   'disetujui',
// ]

const VALID_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  disposisi: ['persiapan'],
  persiapan: ['survey', 'disposisi'],
  survey: ['analisis', 'persiapan'],
  analisis: ['penilaian', 'survey'],
  penilaian: ['diperiksa', 'analisis', 'survey'],
  diperiksa: ['disetujui', 'ditolak', 'penilaian'],
  disetujui: [],
  ditolak: ['survey'],
}

export const useWorkflowStore = create<WorkflowState>()(
  devtools(
    (set, get) => ({
      currentStatus: null,
      availableTransitions: [],
      isTransitioning: false,
      error: null,
      workflowHistory: [],
      
      setCurrentStatus: (status) => {
        set({ currentStatus: status })
        
        // Update available transitions
        if (status) {
          const nextStatuses = VALID_TRANSITIONS[status] || []
          const transitions: WorkflowTransition[] = nextStatuses.map(to => ({
            from: status,
            to,
            action: `transition_${status}_to_${to}`,
            label: getTransitionLabel(status, to),
            allowedRoles: getAllowedRoles(status, to),
          }))
          set({ availableTransitions: transitions })
        } else {
          set({ availableTransitions: [] })
        }
      },
      
      setAvailableTransitions: (transitions) => set({ availableTransitions: transitions }),
      
      setTransitioning: (isTransitioning) => set({ isTransitioning }),
      
      setError: (error) => set({ error }),
      
      addHistory: (from, to, actor) => set((state) => ({
        workflowHistory: [
          ...state.workflowHistory,
          { from, to, timestamp: new Date(), actor },
        ],
      })),
      
      clearHistory: () => set({ workflowHistory: [] }),
      
      canTransition: (toStatus) => {
        const { currentStatus } = get()
        if (!currentStatus) return false
        return VALID_TRANSITIONS[currentStatus]?.includes(toStatus) || false
      },
      
      getNextStatuses: () => {
        const { currentStatus } = get()
        if (!currentStatus) return []
        return VALID_TRANSITIONS[currentStatus] || []
      },
      
      isFinalStatus: () => {
        const { currentStatus } = get()
        return currentStatus === 'disetujui'
      },
    }),
    { name: 'workflow-store' }
  )
)

// Helper functions
function getTransitionLabel(from: WorkflowStatus, to: WorkflowStatus): string {
  const labels: Record<string, string> = {
    'disposisi_persiapan': 'Siapkan Survey',
    'persiapan_survey': 'Mulai Survey',
    'survey_analisis': 'Kirim Analisis',
    'analisis_penilaian': 'Lanjut Penilaian',
    'penilaian_diperiksa': 'Kirim Verifikasi',
    'diperiksa_disetujui': 'Setujui',
    'diperiksa_ditolak': 'Tolak',
    'ditolak_survey': 'Perbaiki',
    'persiapan_disposisi': 'Kembalikan',
    'survey_persiapan': 'Kembalikan',
    'analisis_survey': 'Kembalikan',
    'penilaian_analisis': 'Kembalikan',
    'penilaian_survey': 'Revisi',
    'diperiksa_penilaian': 'Kembalikan',
  }
  return labels[`${from}_${to}`] || 'Transisi'
}

function getAllowedRoles(from: WorkflowStatus, to: WorkflowStatus): UserRole[] {
  const roleMap: Record<string, UserRole[]> = {
    'disposisi_persiapan': ['admin', 'surveyor'],
    'persiapan_survey': ['admin'],
    'survey_analisis': ['surveyor', 'admin'],
    'analisis_penilaian': ['surveyor', 'verifikator', 'admin'],
    'penilaian_diperiksa': ['surveyor', 'admin'],
    'diperiksa_disetujui': ['verifikator', 'admin'],
    'diperiksa_ditolak': ['verifikator', 'admin'],
    'ditolak_survey': ['surveyor', 'admin'],
  }
  return roleMap[`${from}_${to}`] || ['admin']
}
