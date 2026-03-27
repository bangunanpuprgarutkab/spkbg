import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { initializeAuth, subscribeToAuthChanges } from '@/services/supabase/auth'
import { useAuthStore } from '@/stores/authStore'

// Layouts
import MainLayout from '@/layouts/MainLayout'
import AuthLayout from '@/layouts/AuthLayout'

// Pages
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import SurveyListPage from '@/pages/survey/SurveyListPage'
import SurveyDetailPage from '@/pages/survey/SurveyDetailPage'
import SurveyFormPage from '@/pages/survey/SurveyFormPage'
import AnalysisPage from '@/pages/analysis/AnalysisPage'
import WorkflowPage from '@/pages/workflow/WorkflowPage'
import ApprovalPage from '@/pages/approval/ApprovalPage'
import NotFoundPage from '@/pages/error/NotFoundPage'

// Components
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import LoadingScreen from '@/components/ui/LoadingScreen'

function App() {
  const { isLoading } = useAuthStore()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    // Initialize auth on app load
    initializeAuth().then(() => {
      setInitialized(true)
    })

    // Subscribe to auth changes
    const { data: authListener } = subscribeToAuthChanges()

    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [])

  if (isLoading || !initialized) {
    return <LoadingScreen />
  }

  return (
    <Routes>
      {/* Root redirect to login */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* Public Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          
          {/* Survey Routes */}
          <Route path="/surveys" element={<SurveyListPage />} />
          <Route path="/surveys/:id" element={<SurveyDetailPage />} />
          <Route path="/surveys/:id/edit" element={<SurveyFormPage />} />
          <Route path="/surveys/new" element={<SurveyFormPage />} />
          
          {/* Analysis Routes */}
          <Route path="/analysis/:surveyId" element={<AnalysisPage />} />
          
          {/* Workflow Routes */}
          <Route path="/workflow/:surveyId" element={<WorkflowPage />} />
          
          {/* Approval Routes */}
          <Route path="/approval/:surveyId" element={<ApprovalPage />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
