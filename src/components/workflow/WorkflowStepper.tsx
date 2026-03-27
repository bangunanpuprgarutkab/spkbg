import type { WorkflowStatus } from '@/types'

interface WorkflowStepperProps {
  currentStatus: WorkflowStatus
  onTransition?: (toStatus: WorkflowStatus) => void
  allowedTransitions?: WorkflowStatus[]
  isLoading?: boolean
}

const WORKFLOW_STEPS: { id: WorkflowStatus; label: string; description: string }[] = [
  { id: 'disposisi', label: 'Disposisi', description: 'Proyek didaftarkan' },
  { id: 'persiapan', label: 'Persiapan', description: 'Penugasan tim' },
  { id: 'survey', label: 'Survey', description: 'Input data lapangan' },
  { id: 'analisis', label: 'Analisis', description: 'Perhitungan otomatis' },
  { id: 'penilaian', label: 'Penilaian', description: 'Review hasil' },
  { id: 'diperiksa', label: 'Diperiksa', description: 'Verifikasi data' },
  { id: 'disetujui', label: 'Disetujui', description: 'Survey selesai' },
]

export default function WorkflowStepper({ 
  currentStatus, 
  onTransition,
  allowedTransitions = [],
  isLoading = false 
}: WorkflowStepperProps) {
  const currentIndex = WORKFLOW_STEPS.findIndex(step => step.id === currentStatus)

  const getStepStatus = (index: number) => {
    if (index < currentIndex) return 'completed'
    if (index === currentIndex) return 'current'
    return 'pending'
  }

  const canTransitionTo = (stepId: WorkflowStatus) => {
    return allowedTransitions.includes(stepId)
  }

  return (
    <div className="w-full">
      <div className="flex items-start justify-between">
        {WORKFLOW_STEPS.map((step, index) => {
          const status = getStepStatus(index)
          const isClickable = canTransitionTo(step.id) && onTransition && !isLoading

          return (
            <div key={step.id} className="flex flex-col items-center flex-1">
              {/* Connector line */}
              {index > 0 && (
                <div 
                  className={`absolute left-0 right-0 h-0.5 -translate-y-1/2 top-4 -z-10 ${
                    index <= currentIndex ? 'bg-government-green' : 'bg-gray-200'
                  }`}
                  style={{
                    left: `${((index - 1) / (WORKFLOW_STEPS.length - 1)) * 100}%`,
                    right: `${(1 - index / (WORKFLOW_STEPS.length - 1)) * 100}%`,
                  }}
                />
              )}

              {/* Step circle */}
              <button
                onClick={() => isClickable && onTransition?.(step.id)}
                disabled={!isClickable}
                className={`
                  relative w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  transition-all duration-200 z-10
                  ${status === 'completed' ? 'bg-government-green text-white' : ''}
                  ${status === 'current' ? 'bg-white border-2 border-government-green text-government-green' : ''}
                  ${status === 'pending' ? 'bg-gray-100 border-2 border-gray-300 text-gray-400' : ''}
                  ${isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                `}
              >
                {index + 1}
              </button>

              {/* Step label */}
              <div className="mt-2 text-center">
                <p className={`text-sm font-medium ${
                  status === 'current' ? 'text-government-green' : 
                  status === 'completed' ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {step.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">
                  {step.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Simplified vertical version for mobile
export function WorkflowStepperVertical({ 
  currentStatus, 
  onTransition,
  allowedTransitions = [],
  isLoading = false 
}: WorkflowStepperProps) {
  const currentIndex = WORKFLOW_STEPS.findIndex(step => step.id === currentStatus)

  return (
    <div className="space-y-4">
      {WORKFLOW_STEPS.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const isPending = index > currentIndex
        const canClick = allowedTransitions.includes(step.id) && onTransition && !isLoading

        return (
          <div 
            key={step.id}
            className={`flex items-center p-3 rounded-lg ${
              isCurrent ? 'bg-government-green/5 border border-government-green/20' : ''
            }`}
          >
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mr-4
              ${isCompleted ? 'bg-government-green text-white' : ''}
              ${isCurrent ? 'bg-white border-2 border-government-green text-government-green' : ''}
              ${isPending ? 'bg-gray-100 border-2 border-gray-300 text-gray-400' : ''}
            `}>
              {index + 1}
            </div>
            <div className="flex-1">
              <p className={`font-medium ${
                isCurrent ? 'text-government-green' : 
                isCompleted ? 'text-gray-900' : 'text-gray-400'
              }`}>
                {step.label}
              </p>
              <p className="text-sm text-gray-500">{step.description}</p>
            </div>
            {canClick && (
              <button
                onClick={() => onTransition(step.id)}
                disabled={isLoading}
                className="px-3 py-1 text-sm bg-government-green text-white rounded hover:bg-opacity-90"
              >
                {isLoading ? '...' : '→'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
