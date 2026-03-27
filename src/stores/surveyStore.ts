import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Survey, Component, WorkflowStatus } from '@/types'

interface SurveyState {
  // Current survey data
  currentSurvey: Survey | null
  components: Component[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
  
  // Draft management
  draftData: Record<string, Partial<Component>>
  hasUnsavedChanges: boolean
  
  // Actions
  setCurrentSurvey: (survey: Survey | null) => void
  setComponents: (components: Component[]) => void
  updateDraft: (componentId: string, data: Partial<Component>) => void
  clearDraft: () => void
  setLoading: (loading: boolean) => void
  setSaving: (saving: boolean) => void
  setError: (error: string | null) => void
  markAsSaved: () => void
  
  // Getters
  getComponentById: (componentId: string) => Component | undefined
  getComponentsByCategory: (category: string) => Component[]
  getDraftCompletion: () => number
  isEditable: () => boolean
}

export const useSurveyStore = create<SurveyState>()(
  devtools(
    (set, get) => ({
      currentSurvey: null,
      components: [],
      isLoading: false,
      isSaving: false,
      error: null,
      draftData: {},
      hasUnsavedChanges: false,
      
      setCurrentSurvey: (survey) => set({ 
        currentSurvey: survey,
        draftData: {},
        hasUnsavedChanges: false,
      }),
      
      setComponents: (components) => set({ components }),
      
      updateDraft: (componentId, data) => set((state) => ({
        draftData: {
          ...state.draftData,
          [componentId]: {
            ...state.draftData[componentId],
            ...data,
          },
        },
        hasUnsavedChanges: true,
      })),
      
      clearDraft: () => set({ 
        draftData: {}, 
        hasUnsavedChanges: false 
      }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      setSaving: (isSaving) => set({ isSaving }),
      
      setError: (error) => set({ error }),
      
      markAsSaved: () => set({ 
        hasUnsavedChanges: false,
        isSaving: false,
      }),
      
      getComponentById: (componentId) => {
        const { components } = get()
        return components.find(c => c.id === componentId)
      },
      
      getComponentsByCategory: (category) => {
        const { components } = get()
        return components.filter(c => c.kategori === category)
      },
      
      getDraftCompletion: () => {
        const { draftData } = get()
        const total = Object.keys(draftData).length
        if (total === 0) return 0
        
        const completed = Object.values(draftData).filter(d => 
          d.volume_total && d.volume_total > 0 && d.klasifikasi
        ).length
        
        return Math.round((completed / total) * 100)
      },
      
      isEditable: () => {
        const { currentSurvey } = get()
        if (!currentSurvey) return false
        
        const editableStatuses: WorkflowStatus[] = ['survey', 'ditolak']
        return editableStatuses.includes(currentSurvey.status) || currentSurvey.is_draft
      },
    }),
    { name: 'survey-store' }
  )
)
