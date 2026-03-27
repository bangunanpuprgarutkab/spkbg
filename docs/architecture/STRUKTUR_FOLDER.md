# Struktur Folder Project

## Root Structure

```
aplikasi-penilaian-kerusakan-bangunan/
├── .github/                    # GitHub configuration
│   ├── workflows/              # CI/CD workflows
│   │   └── deploy.yml
│   └── ISSUE_TEMPLATE/
├── docs/                       # Documentation
│   ├── architecture/           # System architecture docs
│   │   ├── ARSITEKTUR_SISTEM.md
│   │   └── COMPONENT_DIAGRAM.md
│   ├── database/               # Database documentation
│   │   ├── SCHEMA.md
│   │   ├── RLS_POLICIES.md
│   │   └── MIGRATIONS.md
│   ├── workflow/               # Workflow documentation
│   │   └── STATE_MACHINE.md
│   ├── api/                    # API documentation
│   │   └── ENDPOINTS.md
│   └── user/                   # User guides
│       └── MANUAL.md
├── public/                     # Static assets
│   ├── templates/              # Excel templates
│   │   ├── form-1-lantai.xlsx
│   │   ├── form-2-lantai.xlsx
│   │   └── form-3-lantai.xlsx
│   ├── fonts/
│   └── icons/
├── src/
│   ├── components/             # UI Components
│   │   ├── ui/                 # Base UI components
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Select/
│   │   │   ├── Table/
│   │   │   ├── Card/
│   │   │   ├── Badge/
│   │   │   ├── Modal/
│   │   │   ├── Toast/
│   │   │   └── index.ts
│   │   ├── layout/             # Layout components
│   │   │   ├── Sidebar/
│   │   │   ├── Header/
│   │   │   ├── Footer/
│   │   │   └── MainLayout/
│   │   ├── forms/              # Form components
│   │   │   ├── SurveyForm/
│   │   │   ├── ComponentForm/
│   │   │   └── ValidationForm/
│   │   └── feedback/           # Feedback components
│   │       ├── Loading/
│   │       ├── Error/
│   │       └── Empty/
│   ├── modules/                # Feature modules
│   │   ├── auth/               # Authentication module
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── types/
│   │   ├── dashboard/          # Dashboard module
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── utils/
│   │   ├── survey/             # Survey module
│   │   │   ├── components/
│   │   │   ├── forms/
│   │   │   ├── hooks/
│   │   │   └── services/
│   │   ├── assessment/         # Assessment engine
│   │   │   ├── calculation/
│   │   │   │   ├── engine.ts
│   │   │   │   ├── formulas.ts
│   │   │   │   └── validators.ts
│   │   │   ├── classification/
│   │   │   │   ├── levels.ts
│   │   │   │   └── mapper.ts
│   │   │   └── validation/
│   │   │       ├── rules.ts
│   │   │       └── ai-check.ts
│   │   ├── workflow/           # Workflow engine
│   │   │   ├── components/
│   │   │   │   ├── WorkflowStepper/
│   │   │   │   └── WorkflowActions/
│   │   │   ├── state-machine/
│   │   │   │   ├── states.ts
│   │   │   │   ├── transitions.ts
│   │   │   │   └── guards.ts
│   │   │   ├── hooks/
│   │   │   │   └── useWorkflow.ts
│   │   │   └── services/
│   │   │       └── workflowService.ts
│   │   ├── template/           # Template engine
│   │   │   ├── parser/
│   │   │   │   ├── excelParser.ts
│   │   │   │   └── jsonMapper.ts
│   │   │   ├── generator/
│   │   │   │   └── excelGenerator.ts
│   │   │   ├── mapper/
│   │   │   │   ├── fieldMapping.ts
│   │   │   │   └── componentMapping.ts
│   │   │   └── loader/
│   │   │       └── templateLoader.ts
│   │   ├── export/             # Export module
│   │   │   ├── excel/
│   │   │   │   ├── exportService.ts
│   │   │   │   └── formatters/
│   │   │   ├── pdf/
│   │   │   └── google/
│   │   │       ├── driveService.ts
│   │   │       ├── sheetsService.ts
│   │   │       └── authService.ts
│   │   ├── tte/                  # Digital signature
│   │   │   ├── components/
│   │   │   │   └── SignaturePad/
│   │   │   ├── services/
│   │   │   │   └── signatureService.ts
│   │   │   └── utils/
│   │   │       └── signatureValidator.ts
│   │   ├── admin/                # Admin module
│   │   │   ├── components/
│   │   │   └── services/
│   │   └── report/               # Report module
│   │       ├── components/
│   │       └── services/
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useSurvey.ts
│   │   ├── useAssessment.ts
│   │   ├── useWorkflow.ts
│   │   ├── useTemplate.ts
│   │   ├── useExport.ts
│   │   └── useNotification.ts
│   ├── services/                 # Service layer
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   ├── database.ts
│   │   │   ├── storage.ts
│   │   │   └── realtime.ts
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   └── interceptors.ts
│   │   └── cache/
│   │       ├── localStorage.ts
│   │       └── indexedDB.ts
│   ├── stores/                   # Zustand stores
│   │   ├── authStore.ts
│   │   ├── surveyStore.ts
│   │   ├── assessmentStore.ts
│   │   ├── workflowStore.ts
│   │   ├── uiStore.ts
│   │   └── index.ts
│   ├── types/                    # TypeScript types
│   │   ├── auth.ts
│   │   ├── survey.ts
│   │   ├── assessment.ts
│   │   ├── workflow.ts
│   │   ├── template.ts
│   │   ├── component.ts
│   │   ├── export.ts
│   │   └── api.ts
│   ├── utils/                    # Utility functions
│   │   ├── calculations/
│   │   │   ├── damage.ts
│   │   │   ├── percentage.ts
│   │   │   └── weight.ts
│   │   ├── validators/
│   │   │   ├── field.ts
│   │   │   ├── survey.ts
│   │   │   └── component.ts
│   │   ├── formatters/
│   │   │   ├── date.ts
│   │   │   ├── number.ts
│   │   │   └── currency.ts
│   │   ├── helpers/
│   │   │   ├── array.ts
│   │   │   ├── object.ts
│   │   │   └── string.ts
│   │   └── constants/
│   │       ├── components.ts
│   │       ├── classifications.ts
│   │       ├── workflow.ts
│   │       └── roles.ts
│   ├── pages/                    # Page components (routes)
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── ForgotPasswordPage.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   ├── survey/
│   │   │   ├── SurveyListPage.tsx
│   │   │   ├── SurveyDetailPage.tsx
│   │   │   ├── SurveyCreatePage.tsx
│   │   │   └── SurveyEditPage.tsx
│   │   ├── analysis/
│   │   │   ├── AnalysisPage.tsx
│   │   │   └── AnalysisDetailPage.tsx
│   │   ├── workflow/
│   │   │   ├── WorkflowPage.tsx
│   │   │   └── ApprovalPage.tsx
│   │   ├── report/
│   │   │   ├── ReportPage.tsx
│   │   │   └── ExportPage.tsx
│   │   ├── admin/
│   │   │   ├── UserManagementPage.tsx
│   │   │   ├── TemplateManagementPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   └── error/
│   │       ├── NotFoundPage.tsx
│   │       └── ErrorPage.tsx
│   ├── config/                   # Configuration
│   │   ├── supabase.ts
│   │   ├── routes.ts
│   │   ├── navigation.ts
│   │   ├── theme.ts
│   │   └── constants.ts
│   ├── styles/                   # Global styles
│   │   ├── globals.css
│   │   ├── variables.css
│   │   └── animations.css
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── tests/                        # Test files
│   ├── unit/
│   │   ├── calculation/
│   │   ├── validation/
│   │   └── workflow/
│   ├── integration/
│   │   ├── api/
│   │   └── template/
│   └── e2e/
│       └── survey-flow.spec.ts
├── scripts/                      # Build & utility scripts
│   ├── setup.sh
│   └── deploy.sh
├── supabase/                     # Supabase configuration
│   ├── migrations/
│   ├── functions/
│   └── seeds/
├── .env.example
├── .env.production
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Naming Conventions

### Files
- **Components**: PascalCase (e.g., `SurveyForm.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useSurvey.ts`)
- **Utils**: camelCase (e.g., `damageCalculator.ts`)
- **Types**: PascalCase with type suffix (e.g., `Survey.types.ts`)
- **Styles**: camelCase with style suffix (e.g., `surveyStyles.ts`)

### Directories
- **Modules**: kebab-case (e.g., `assessment-engine/`)
- **Components**: PascalCase (e.g., `SurveyForm/`)
- **All others**: camelCase or kebab-case

### Exports
- **Components**: Named exports for complex components
- **Utils**: Named exports
- **Types**: Named exports
- **Constants**: Named exports
- **Default export**: Only for page components

## Import Organization

```typescript
// 1. External libraries
import React from 'react';
import { useState } from 'react';
import { z } from 'zod';

// 2. Internal absolute imports
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { supabaseClient } from '@/services/supabase/client';

// 3. Relative imports (same module)
import { SurveyForm } from './components/SurveyForm';
import { useSurveyValidation } from './hooks/useSurveyValidation';

// 4. Types
import type { Survey, SurveyInput } from '@/types/survey';
```

## Module Boundaries

### Rule: Cross-Module Dependencies
- ✅ Import from `/components/ui` anywhere
- ✅ Import from `/utils` anywhere
- ✅ Import from `/types` anywhere
- ❌ Import from `/modules/X` in `/modules/Y` (use service layer instead)
- ❌ Import from `/pages` in `/modules`

### Service Layer Pattern
```
Module A (survey) ──▶ Service Layer ──▶ Module B (workflow)
                         │
                         ▼
                    /services/api/
```

## Testing File Locations

| Type | Location | Pattern |
|------|----------|---------|
| Unit | Co-located | `Component.test.tsx` |
| Unit | Tests folder | `tests/unit/module/file.test.ts` |
| Integration | Tests folder | `tests/integration/feature.spec.ts` |
| E2E | Tests folder | `tests/e2e/flow.spec.ts` |
