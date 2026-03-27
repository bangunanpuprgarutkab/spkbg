# Workflow State Machine
# Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)

## 1. OVERVIEW

Sistem workflow mengimplementasikan **Finite State Machine (FSM)** dengan 7 status utama. Setiap transisi memiliki guard conditions dan actions yang ketat.

## 2. STATE DEFINITIONS

```
┌─────────────────────────────────────────────────────────────────┐
│                        WORKFLOW STATES                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐                                                   │
│   │ DISPOSISI│  ←── Entry point (dibuat oleh admin/surveyor)     │
│   └──────────┘                                                   │
│        │                                                         │
│        ▼ prepare()                                               │
│   ┌──────────┐                                                   │
│   │PERSIAPAN │  ←── Assign surveyor, verifikator, approver        │
│   └──────────┘                                                   │
│        │                                                         │
│        ▼ startSurvey()                                           │
│   ┌──────────┐                                                   │
│   │  SURVEY  │  ←── Input data kerusakan komponen                │
│   └──────────┘                                                   │
│        │                                                         │
│        ▼ submitSurvey()                                          │
│   ┌──────────┐                                                   │
│   │ ANALISIS │  ←── Perhitungan otomatis, review data            │
│   └──────────┘                                                   │
│        │                                                         │
│        ▼ completeAnalysis()                                      │
│   ┌──────────┐                                                   │
│   │PENILAIAN │  ←── Review hasil, final check                     │
│   └──────────┘                                                   │
│        │                                                         │
│        ▼ submitForApproval()                                     │
│   ┌──────────┐                                                   │
│   │ DIPERIKSA│  ←── Verifikator review                           │
│   └──────────┘                                                   │
│        │                                                         │
│        ▼ approve() / reject()                                    │
│   ┌──────────┐      ┌──────────┐                                 │
│   │ DISETUJUI│      │  DITOLAK │                                 │
│   └──────────┘      └──────────┘                                 │
│        │              │                                          │
│        ▼              ▼ returnToSurvey()                         │
│   [FINAL]         ┌──────────┐                                   │
│                   │  SURVEY  │                                   │
│                   └──────────┘                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 3. STATE DETAILS

### 3.1 State: DISPOSISI
```typescript
{
  id: 'disposisi',
  label: 'Disposisi',
  description: 'Proyek baru didaftarkan, menunggu penugasan tim',
  allowedRoles: ['admin', 'surveyor'],
  editableFields: ['all'],
  actions: ['prepare', 'delete'],
  notifications: ['admin', 'assigned_surveyor'],
  timeout: null
}
```

**Guard Conditions:**
- `canPrepare()`: User adalah admin atau pembuat project
- `project.created_by === currentUser.id || isAdmin()`

### 3.2 State: PERSIAPAN
```typescript
{
  id: 'persiapan',
  label: 'Persiapan',
  description: 'Menugaskan surveyor, verifikator, dan approver',
  allowedRoles: ['admin'],
  editableFields: ['assigned_surveyor', 'assigned_verifikator', 'assigned_approver', 'template_id'],
  actions: ['startSurvey', 'returnToDisposisi'],
  notifications: ['assigned_surveyor'],
  timeout: null
}
```

**Guard Conditions:**
- `canStartSurvey()`: Semua role sudah di-assign
- `project.assigned_surveyor !== null && project.assigned_verifikator !== null && project.assigned_approver !== null`

### 3.3 State: SURVEY
```typescript
{
  id: 'survey',
  label: 'Survey',
  description: 'Input data survei lapangan',
  allowedRoles: ['surveyor', 'admin'],
  editableFields: ['components', 'safety_check', 'kondisi_umum', 'catatan'],
  actions: ['saveDraft', 'submitSurvey', 'returnToPersiapan'],
  notifications: ['surveyor'],
  timeout: { days: 30, warning: 7 },
  autoSave: true
}
```

**Guard Conditions:**
- `canSubmitSurvey()`: Minimal 50% komponen sudah diisi atau is_critical = true
- `components.length > 0 && (completionRate >= 0.5 || survey.is_critical === true)`

**Validation Rules:**
```typescript
const surveyValidationRules = {
  minComponents: 1,
  minCompletionRate: 0.5, // 50%
  requiredFields: ['tanggal_survey', 'surveyor_id'],
  criticalCheck: ['has_kolom_patah', 'has_pondasi_bergeser', 'has_struktur_runtuh']
}
```

### 3.4 State: ANALISIS
```typescript
{
  id: 'analisis',
  label: 'Analisis',
  description: 'Sistem melakukan perhitungan otomatis',
  allowedRoles: ['surveyor', 'verifikator', 'admin'],
  editableFields: ['none'], // Read only, system calculates
  actions: ['recalculate', 'completeAnalysis', 'returnToSurvey'],
  notifications: ['surveyor', 'verifikator'],
  timeout: null,
  systemActions: ['autoCalculate']
}
```

**System Actions:**
```typescript
const analysisActions = {
  onEnter: [
    'calculateComponentValues',
    'calculateCategoryTotals',
    'calculateOverallDamage',
    'determineDamageCategory',
    'generateResultsRecord'
  ],
  onRecalculate: [
    'recalculateAll',
    'updateResultsRecord'
  ]
}
```

### 3.5 State: PENILAIAN
```typescript
{
  id: 'penilaian',
  label: 'Penilaian',
  description: 'Review hasil perhitungan sebelum diserahkan ke verifikator',
  allowedRoles: ['surveyor', 'admin'],
  editableFields: ['catatan', 'rekomendasi'],
  actions: ['submitForApproval', 'returnToAnalysis', 'returnToSurvey'],
  notifications: ['surveyor', 'assigned_verifikator'],
  timeout: { days: 7 }
}
```

**Guard Conditions:**
- `canSubmitForApproval()`: Hasil perhitungan sudah final
- `results.calculated_at !== null && survey.status === 'penilaian'`

### 3.6 State: DIPERIKSA
```typescript
{
  id: 'diperiksa',
  label: 'Diperiksa',
  description: 'Verifikator memeriksa hasil survey dan perhitungan',
  allowedRoles: ['verifikator', 'admin'],
  editableFields: ['verification_note', 'verification_status'],
  actions: ['approve', 'reject', 'requestRevision', 'returnToPenilaian'],
  notifications: ['assigned_verifikator', 'surveyor'],
  timeout: { days: 14, warning: 3 }
}
```

**Guard Conditions:**
- `canApprove()`: Verifikator yang di-assign
- `project.assigned_verifikator === currentUser.id || isAdmin()`
- `canReject()`: Sama dengan canApprove()

### 3.7 State: DISETUJUI
```typescript
{
  id: 'disetujui',
  label: 'Disetujui',
  description: 'Survey telah disetujui, dapat diexport',
  allowedRoles: ['approver', 'admin'],
  editableFields: ['none'], // Immutable
  actions: ['sign', 'export', 'generateReport'],
  notifications: ['all_assigned', 'admin'],
  timeout: null,
  isFinal: true
}
```

**Guard Conditions:**
- `canSign()`: Approver yang di-assign
- `project.assigned_approver === currentUser.id || isAdmin()`

### 3.8 State: DITOLAK
```typescript
{
  id: 'ditolak',
  label: 'Ditolak',
  description: 'Survey ditolak, perlu perbaikan',
  allowedRoles: ['verifikator', 'admin'],
  editableFields: ['rejection_reason', 'rejection_note'],
  actions: ['returnToSurvey', 'close'],
  notifications: ['surveyor'],
  timeout: { days: 30 },
  isFailure: true
}
```

## 4. STATE TRANSITIONS

### 4.1 Transition Matrix

```
                    TO
               dis   per   srv   ana   nil   cek   stj   tol
FROM           ─────────────────────────────────────────────────
disposisi  │    -    ✓    ✗    ✗    ✗    ✗    ✗    ✗
persiapan  │    ✓    -    ✓    ✗    ✗    ✗    ✗    ✗
survey     │    ✗    ✓    -    ✓    ✗    ✗    ✗    ✗
analisis   │    ✗    ✗    ✓    -    ✓    ✗    ✗    ✗
penilaian  │    ✗    ✗    ✓    ✓    -    ✓    ✗    ✗
diperiksa  │    ✗    ✗    ✗    ✗    ✓    -    ✓    ✓
disetujui  │    ✗    ✗    ✗    ✗    ✗    ✗    -    ✗
ditolak    │    ✗    ✗    ✓    ✗    ✗    ✗    ✗    -
```

✓ = Allowed, ✗ = Not Allowed

### 4.2 Transition Definitions

```typescript
interface Transition {
  from: WorkflowStatus;
  to: WorkflowStatus;
  action: string;
  label: string;
  allowedRoles: UserRole[];
  guard: (context: WorkflowContext) => boolean;
  onExecute: (context: WorkflowContext) => void;
  sideEffects: SideEffect[];
}

const transitions: Transition[] = [
  // 1. DISPOSISI → PERSIAPAN
  {
    from: 'disposisi',
    to: 'persiapan',
    action: 'prepare',
    label: 'Siapkan Survey',
    allowedRoles: ['admin', 'surveyor'],
    guard: (ctx) => ctx.user.id === ctx.project.created_by || ctx.user.role === 'admin',
    onExecute: async (ctx) => {
      await logWorkflowTransition(ctx.survey.id, 'disposisi', 'persiapan', ctx.user.id, 'prepare');
      await notifyAssignedSurveyor(ctx.project.assigned_surveyor);
    },
    sideEffects: ['logTransition', 'notifySurveyor', 'updateProjectStatus']
  },

  // 2. PERSIAPAN → DISPOSISI (rollback)
  {
    from: 'persiapan',
    to: 'disposisi',
    action: 'returnToDisposisi',
    label: 'Kembalikan ke Disposisi',
    allowedRoles: ['admin'],
    guard: (ctx) => ctx.user.role === 'admin',
    onExecute: async (ctx) => {
      await logWorkflowTransition(ctx.survey.id, 'persiapan', 'disposisi', ctx.user.id, 'return');
    },
    sideEffects: ['logTransition']
  },

  // 3. PERSIAPAN → SURVEY
  {
    from: 'persiapan',
    to: 'survey',
    action: 'startSurvey',
    label: 'Mulai Survey',
    allowedRoles: ['admin'],
    guard: (ctx) => {
      return ctx.project.assigned_surveyor !== null &&
             ctx.project.assigned_verifikator !== null &&
             ctx.project.assigned_approver !== null;
    },
    onExecute: async (ctx) => {
      await logWorkflowTransition(ctx.survey.id, 'persiapan', 'survey', ctx.user.id, 'start');
      await createSurveyRecord(ctx.project.id, ctx.project.assigned_surveyor);
      await notifySurveyor(ctx.project.assigned_surveyor);
    },
    sideEffects: ['logTransition', 'createSurvey', 'notifySurveyor']
  },

  // 4. SURVEY → PERSIAPAN (rollback)
  {
    from: 'survey',
    to: 'persiapan',
    action: 'returnToPersiapan',
    label: 'Kembalikan ke Persiapan',
    allowedRoles: ['admin'],
    guard: (ctx) => ctx.user.role === 'admin' && ctx.survey.is_draft,
    onExecute: async (ctx) => {
      await logWorkflowTransition(ctx.survey.id, 'survey', 'persiapan', ctx.user.id, 'return');
    },
    sideEffects: ['logTransition']
  },

  // 5. SURVEY → ANALISIS
  {
    from: 'survey',
    to: 'analisis',
    action: 'submitSurvey',
    label: 'Kirim untuk Analisis',
    allowedRoles: ['surveyor', 'admin'],
    guard: (ctx) => {
      const completionRate = calculateCompletionRate(ctx.survey);
      return ctx.survey.surveyor_id === ctx.user.id || ctx.user.role === 'admin' &&
             (completionRate >= 0.5 || ctx.survey.is_critical);
    },
    onExecute: async (ctx) => {
      ctx.survey.is_draft = false;
      ctx.survey.submitted_at = new Date();
      await logWorkflowTransition(ctx.survey.id, 'survey', 'analisis', ctx.user.id, 'submit');
      await triggerCalculation(ctx.survey.id);
      await notifyVerifikator(ctx.project.assigned_verifikator);
    },
    sideEffects: ['logTransition', 'triggerCalculation', 'notifyVerifikator', 'markAsSubmitted']
  },

  // 6. ANALISIS → SURVEY (rollback)
  {
    from: 'analisis',
    to: 'survey',
    action: 'returnToSurvey',
    label: 'Kembalikan ke Survey',
    allowedRoles: ['surveyor', 'admin'],
    guard: (ctx) => ctx.survey.surveyor_id === ctx.user.id || ctx.user.role === 'admin',
    onExecute: async (ctx) => {
      ctx.survey.is_draft = true;
      await logWorkflowTransition(ctx.survey.id, 'analisis', 'survey', ctx.user.id, 'return');
    },
    sideEffects: ['logTransition', 'revertToDraft']
  },

  // 7. ANALISIS → PENILAIAN
  {
    from: 'analisis',
    to: 'penilaian',
    action: 'completeAnalysis',
    label: 'Lanjut ke Penilaian',
    allowedRoles: ['surveyor', 'verifikator', 'admin'],
    guard: (ctx) => ctx.results.calculated_at !== null,
    onExecute: async (ctx) => {
      await logWorkflowTransition(ctx.survey.id, 'analisis', 'penilaian', ctx.user.id, 'complete');
    },
    sideEffects: ['logTransition']
  },

  // 8. PENILAIAN → ANALISIS (rollback)
  {
    from: 'penilaian',
    to: 'analisis',
    action: 'returnToAnalysis',
    label: 'Kembalikan ke Analisis',
    allowedRoles: ['surveyor', 'admin'],
    guard: (ctx) => ctx.survey.surveyor_id === ctx.user.id || ctx.user.role === 'admin',
    onExecute: async (ctx) => {
      await logWorkflowTransition(ctx.survey.id, 'penilaian', 'analisis', ctx.user.id, 'return');
    },
    sideEffects: ['logTransition']
  },

  // 9. PENILAIAN → SURVEY (rollback)
  {
    from: 'penilaian',
    to: 'survey',
    action: 'returnToSurvey',
    label: 'Kembalikan ke Survey',
    allowedRoles: ['surveyor', 'admin'],
    guard: (ctx) => (ctx.survey.surveyor_id === ctx.user.id || ctx.user.role === 'admin') && ctx.survey.is_draft === false,
    onExecute: async (ctx) => {
      ctx.survey.is_draft = true;
      await logWorkflowTransition(ctx.survey.id, 'penilaian', 'survey', ctx.user.id, 'return');
    },
    sideEffects: ['logTransition', 'revertToDraft']
  },

  // 10. PENILAIAN → DIPERIKSA
  {
    from: 'penilaian',
    to: 'diperiksa',
    action: 'submitForApproval',
    label: 'Kirim untuk Pemeriksaan',
    allowedRoles: ['surveyor', 'admin'],
    guard: (ctx) => {
      return (ctx.survey.surveyor_id === ctx.user.id || ctx.user.role === 'admin') &&
             ctx.results.calculated_at !== null;
    },
    onExecute: async (ctx) => {
      await logWorkflowTransition(ctx.survey.id, 'penilaian', 'diperiksa', ctx.user.id, 'submit');
      await notifyVerifikator(ctx.project.assigned_verifikator);
    },
    sideEffects: ['logTransition', 'notifyVerifikator']
  },

  // 11. DIPERIKSA → PENILAIAN (rollback)
  {
    from: 'diperiksa',
    to: 'penilaian',
    action: 'returnToPenilaian',
    label: 'Kembalikan ke Penilaian',
    allowedRoles: ['verifikator', 'admin'],
    guard: (ctx) => ctx.project.assigned_verifikator === ctx.user.id || ctx.user.role === 'admin',
    onExecute: async (ctx) => {
      await logWorkflowTransition(ctx.survey.id, 'diperiksa', 'penilaian', ctx.user.id, 'return');
      await notifySurveyor(ctx.survey.surveyor_id);
    },
    sideEffects: ['logTransition', 'notifySurveyor']
  },

  // 12. DIPERIKSA → DISETUJUI
  {
    from: 'diperiksa',
    to: 'disetujui',
    action: 'approve',
    label: 'Setujui',
    allowedRoles: ['verifikator', 'admin'],
    guard: (ctx) => ctx.project.assigned_verifikator === ctx.user.id || ctx.user.role === 'admin',
    onExecute: async (ctx) => {
      await logWorkflowTransition(ctx.survey.id, 'diperiksa', 'disetujui', ctx.user.id, 'approve');
      await updateResultsVerification(ctx.survey.id, ctx.user.id);
      await notifyApprover(ctx.project.assigned_approver);
      await notifySurveyor(ctx.survey.surveyor_id);
    },
    sideEffects: ['logTransition', 'updateResults', 'notifyApprover', 'notifySurveyor']
  },

  // 13. DIPERIKSA → DITOLAK
  {
    from: 'diperiksa',
    to: 'ditolak',
    action: 'reject',
    label: 'Tolak',
    allowedRoles: ['verifikator', 'admin'],
    guard: (ctx) => ctx.project.assigned_verifikator === ctx.user.id || ctx.user.role === 'admin',
    onExecute: async (ctx) => {
      await logWorkflowTransition(ctx.survey.id, 'diperiksa', 'ditolak', ctx.user.id, 'reject');
      await notifySurveyor(ctx.survey.surveyor_id);
    },
    sideEffects: ['logTransition', 'notifySurveyor', 'createRejectionRecord']
  },

  // 14. DITOLAK → SURVEY (correction)
  {
    from: 'ditolak',
    to: 'survey',
    action: 'returnToSurvey',
    label: 'Perbaiki Survey',
    allowedRoles: ['surveyor', 'admin'],
    guard: (ctx) => ctx.survey.surveyor_id === ctx.user.id || ctx.user.role === 'admin',
    onExecute: async (ctx) => {
      ctx.survey.is_draft = true;
      await logWorkflowTransition(ctx.survey.id, 'ditolak', 'survey', ctx.user.id, 'return');
      await clearRejectionStatus(ctx.survey.id);
    },
    sideEffects: ['logTransition', 'revertToDraft', 'clearRejection']
  },

  // 15. DISETUJUI (final state - no outgoing transitions except export/sign)
  {
    from: 'disetujui',
    to: 'disetujui',
    action: 'sign',
    label: 'Tanda Tangan Digital',
    allowedRoles: ['approver', 'admin'],
    guard: (ctx) => ctx.project.assigned_approver === ctx.user.id || ctx.user.role === 'admin',
    onExecute: async (ctx) => {
      await createSignature(ctx.survey.id, ctx.user.id, 'approver');
      await updateResultsApproval(ctx.survey.id, ctx.user.id);
    },
    sideEffects: ['createSignature', 'updateResults', 'notifyAll']
  }
];
```

## 5. SIDE EFFECTS

### 5.1 Side Effect Registry

```typescript
interface SideEffect {
  name: string;
  execute: (context: WorkflowContext) => Promise<void>;
  rollback?: (context: WorkflowContext) => Promise<void>;
  isAsync: boolean;
}

const sideEffects: Record<string, SideEffect> = {
  logTransition: {
    name: 'logTransition',
    execute: async (ctx) => {
      await supabase.rpc('log_workflow_transition', {
        p_survey_id: ctx.survey.id,
        p_from_status: ctx.fromStatus,
        p_to_status: ctx.toStatus,
        p_actor_id: ctx.user.id,
        p_action: ctx.action,
        p_note: ctx.note
      });
    },
    isAsync: true
  },

  notifySurveyor: {
    name: 'notifySurveyor',
    execute: async (ctx) => {
      await createNotification({
        user_id: ctx.survey.surveyor_id,
        title: 'Update Survey',
        message: `Survey ${ctx.survey.kode_survey} status: ${ctx.toStatus}`,
        entity_type: 'survey',
        entity_id: ctx.survey.id,
        type: 'info'
      });
    },
    isAsync: true
  },

  notifyVerifikator: {
    name: 'notifyVerifikator',
    execute: async (ctx) => {
      await createNotification({
        user_id: ctx.project.assigned_verifikator,
        title: 'Survey Menunggu Verifikasi',
        message: `Survey ${ctx.survey.kode_survey} memerlukan verifikasi`,
        entity_type: 'survey',
        entity_id: ctx.survey.id,
        type: 'warning'
      });
    },
    isAsync: true
  },

  notifyApprover: {
    name: 'notifyApprover',
    execute: async (ctx) => {
      await createNotification({
        user_id: ctx.project.assigned_approver,
        title: 'Survey Disetujui Verifikator',
        message: `Survey ${ctx.survey.kode_survey} siap untuk approval final`,
        entity_type: 'survey',
        entity_id: ctx.survey.id,
        type: 'success'
      });
    },
    isAsync: true
  },

  triggerCalculation: {
    name: 'triggerCalculation',
    execute: async (ctx) => {
      await supabase.rpc('calculate_survey_damage', {
        p_survey_id: ctx.survey.id
      });
    },
    isAsync: true
  },

  createSignature: {
    name: 'createSignature',
    execute: async (ctx) => {
      // Handled by separate TTE module
    },
    isAsync: false
  }
};
```

## 6. WORKFLOW HOOKS

### 6.1 Lifecycle Hooks

```typescript
interface WorkflowHooks {
  // Called before any transition
  onBeforeTransition: (transition: Transition, context: WorkflowContext) => Promise<boolean>;
  
  // Called after successful transition
  onAfterTransition: (transition: Transition, context: WorkflowContext) => Promise<void>;
  
  // Called when transition fails
  onTransitionError: (error: Error, transition: Transition, context: WorkflowContext) => Promise<void>;
  
  // Called when entering a state
  onEnterState: (state: WorkflowState, context: WorkflowContext) => Promise<void>;
  
  // Called when leaving a state
  onLeaveState: (state: WorkflowState, context: WorkflowContext) => Promise<void>;
}

const defaultHooks: WorkflowHooks = {
  onBeforeTransition: async (transition, ctx) => {
    // Validate transition
    const isValid = await validateTransition(transition, ctx);
    if (!isValid) {
      throw new WorkflowError('Invalid transition');
    }
    return true;
  },

  onAfterTransition: async (transition, ctx) => {
    // Emit event
    emitWorkflowEvent('transition:completed', { transition, ctx });
  },

  onTransitionError: async (error, transition, ctx) => {
    // Log error
    console.error('Workflow transition failed:', error);
    emitWorkflowEvent('transition:failed', { error, transition, ctx });
  },

  onEnterState: async (state, ctx) => {
    // State-specific logic
    if (state.id === 'analisis') {
      await autoCalculate(ctx.survey.id);
    }
  },

  onLeaveState: async (state, ctx) => {
    // Cleanup if needed
  }
};
```

## 7. WORKFLOW VALIDATION

### 7.1 Validation Rules

```typescript
const workflowValidationRules = {
  // Prevent duplicate transitions
  noDuplicateTransitions: (ctx) => {
    return ctx.fromStatus !== ctx.toStatus;
  },

  // Check user role
  validRole: (ctx, allowedRoles) => {
    return allowedRoles.includes(ctx.user.role);
  },

  // Check assignment
  validAssignment: (ctx, requiredAssignment) => {
    switch (requiredAssignment) {
      case 'surveyor':
        return ctx.survey.surveyor_id === ctx.user.id;
      case 'verifikator':
        return ctx.project.assigned_verifikator === ctx.user.id;
      case 'approver':
        return ctx.project.assigned_approver === ctx.user.id;
      default:
        return true;
    }
  },

  // Check minimum data completeness
  minDataComplete: (ctx, minRate = 0.5) => {
    const rate = calculateCompletionRate(ctx.survey);
    return rate >= minRate;
  },

  // Check no concurrent transitions
  noConcurrentTransition: async (ctx) => {
    const { data } = await supabase
      .from('surveys')
      .select('status, updated_at')
      .eq('id', ctx.survey.id)
      .single();
    
    return data?.status === ctx.fromStatus;
  }
};
```

## 8. TIMEOUTS & REMINDERS

### 8.1 Timeout Configuration

```typescript
const timeoutConfig: Record<WorkflowStatus, TimeoutConfig | null> = {
  disposisi: null,
  persiapan: null,
  survey: { days: 30, warning: 7, escalateTo: 'admin' },
  analisis: null,
  penilaian: { days: 7, warning: 2, escalateTo: 'verifikator' },
  diperiksa: { days: 14, warning: 3, escalateTo: 'admin' },
  disetujui: null,
  ditolak: { days: 30, warning: 7, escalateTo: 'admin' }
};

// Timeout handler (scheduled job)
const handleTimeout = async (surveyId: string) => {
  const survey = await getSurvey(surveyId);
  const config = timeoutConfig[survey.status];
  
  if (!config) return;
  
  const daysInStatus = calculateDaysSince(survey.updated_at);
  
  if (daysInStatus >= config.days) {
    // Escalate
    await escalateSurvey(surveyId, config.escalateTo);
  } else if (daysInStatus >= config.days - config.warning) {
    // Send warning
    await sendTimeoutWarning(surveyId, config.days - daysInStatus);
  }
};
```

## 9. AUDIT TRAIL

### 9.1 Audit Record Structure

```typescript
interface AuditRecord {
  id: string;
  survey_id: string;
  project_id: string;
  timestamp: string;
  actor: {
    id: string;
    name: string;
    role: UserRole;
    ip: string;
    user_agent: string;
  };
  action: {
    type: string;
    from_state: WorkflowStatus;
    to_state: WorkflowStatus;
    metadata: Record<string, unknown>;
  };
  context: {
    completion_rate: number;
    component_count: number;
    total_damage: number;
  };
}
```

---

**Catatan:** State machine ini WAJIB diimplementasikan secara ketat. Tidak ada transisi yang diperbolehkan di luar yang didefinisikan dalam matrix transisi.
