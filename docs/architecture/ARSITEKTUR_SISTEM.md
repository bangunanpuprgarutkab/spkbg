# Arsitektur Sistem - Sistem Penilaian Kerusakan Bangunan Gedung

## 1. OVERVIEW SISTEM

### 1.1 Nama Sistem
**Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)**

### 1.2 Tujuan
Sistem berbasis web untuk melakukan penilaian kerusakan bangunan gedung sesuai standar KemenPU, mendukung workflow digital dan generate laporan Excel identik dengan template resmi.

### 1.3 Paradigma Arsitektur
**Template-Driven Architecture (TDA)** - Template Excel sebagai Single Source of Truth untuk struktur data, perhitungan, dan format laporan.

---

## 2. TECH STACK

### 2.1 Frontend
| Komponen | Teknologi | Version |
|----------|-----------|---------|
| Framework | React | ^18.2.0 |
| Language | TypeScript | ^5.0.0 |
| Styling | TailwindCSS | ^3.4.0 |
| State Management | Zustand | ^4.5.0 |
| Form Handling | React Hook Form | ^7.51.0 |
| Validation | Zod | ^3.22.0 |
| Icons | Lucide React | ^0.356.0 |
| Excel Processing | SheetJS (xlsx) | ^0.18.5 |
| Date Handling | Day.js | ^1.11.10 |
| UUID | uuid | ^9.0.0 |
| HTTP Client | Axios | ^1.6.7 |

### 2.2 Backend
| Komponen | Teknologi | Keterangan |
|----------|-----------|------------|
| Platform | Supabase | PostgreSQL + Auth + Storage |
| Auth | Supabase Auth | JWT-based, Role-based |
| Database | PostgreSQL 15 | Row Level Security (RLS) |
| Storage | Supabase Storage | File uploads, signatures |
| Realtime | Supabase Realtime | Live updates |

### 2.3 Deployment
| Komponen | Teknologi |
|----------|-----------|
| Build Tool | Vite |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |

---

## 3. ARSITEKTUR LAYER

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │
│  │   Pages     │ │ Components  │ │    UI System        │  │
│  │  (Routes)   │ │  (Reusable) │ │  (Tailwind + Theme) │  │
│  └─────────────┘ └─────────────┘ └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    STATE MANAGEMENT                          │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │    Zustand      │  │    React Hook Form + Zod        │  │
│  │  (Global State) │  │    (Form State & Validation)    │  │
│  └─────────────────┘  └─────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    BUSINESS LOGIC LAYER                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │
│  │   Engine    │ │   Workflow  │ │    Template         │  │
│  │ Calculation │ │   Engine    │ │    Parser           │  │
│  └─────────────┘ └─────────────┘ └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    SERVICE LAYER                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │
│  │  Supabase   │ │   Excel     │ │    Google           │  │
│  │   Client    │ │   Engine    │ │    Integration      │  │
│  └─────────────┘ └─────────────┘ └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    DATA LAYER                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │
│  │  Supabase   │ │   Local     │ │    Supabase         │  │
│  │ PostgreSQL  │ │   Storage   │ │    Storage          │  │
│  └─────────────┘ └─────────────┘ └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. MODUL SISTEM

### 4.1 Core Modules

```
/src
├── modules/
│   ├── auth/                 # Authentication & Authorization
│   ├── assessment/           # Core Assessment Engine
│   │   ├── calculation/      # Perhitungan kerusakan
│   │   ├── classification/   # Klasifikasi 1-7
│   │   └── validation/       # Validasi input
│   ├── workflow/             # Workflow Engine
│   │   ├── state-machine/    # State transitions
│   │   ├── validation/       # Transition validation
│   │   └── audit/            # Audit logging
│   ├── template/             # Template System
│   │   ├── parser/             # Excel → JSON
│   │   ├── generator/          # JSON → Excel
│   │   └── mapper/             # Field mapping
│   ├── export/               # Export System
│   │   ├── excel/              # Excel export
│   │   ├── pdf/                # PDF export
│   │   └── google/             # Google integration
│   └── tte/                  # Digital Signature
│       ├── signature-pad/      # Signature capture
│       ├── storage/            # Storage management
│       └── validation/         # Signature validation
```

### 4.2 Feature Modules

| Modul | Fungsi | Dependencies |
|-------|--------|--------------|
| `dashboard` | Overview & analytics | assessment, workflow |
| `survey` | Input data survei | template, assessment |
| `analysis` | Analisis kerusakan | assessment, calculation |
| `approval` | Workflow approval | workflow, tte |
| `report` | Laporan & export | export, template |
| `admin` | Manajemen sistem | auth, workflow |

---

## 5. DATA FLOW

### 5.1 Survey Input Flow

```
┌─────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  User   │───▶│  Template   │───▶│  Dynamic     │───▶│  Validation │
│  Input  │    │  Parser     │    │  Form        │    │  (Zod)      │
└─────────┘    └─────────────┘    └──────────────┘    └─────────────┘
                                                              │
                                                              ▼
┌─────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  Excel  │◄───│  Export     │◄───│  Assessment  │◄───│  Supabase   │
│  Output │    │  Engine     │    │  Engine      │    │  Database   │
└─────────┘    └─────────────┘    └──────────────┘    └─────────────┘
```

### 5.2 Workflow Flow

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Disposisi│──▶│ Persiapan│──▶│  Survey  │──▶│ Analisis │──▶│Penilaian│
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
                                                                   │
                    ┌──────────┐   ┌──────────┐                    │
                    │ Disetujui│◄──│ Diperiksa│◄───────────────────┘
                    └──────────┘   └──────────┘
```

---

## 6. SECURITY ARCHITECTURE

### 6.1 Authentication Flow

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────┐
│  Login  │────▶│  Supabase   │────▶│    JWT      │────▶│  Store  │
│  Page   │     │    Auth     │     │   Token     │     │  Token  │
└─────────┘     └─────────────┘     └─────────────┘     └─────────┘
                                                              │
                                                              ▼
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────┐
│  Access │◄────│     RLS     │◄────│   Zustand   │◄────│  Parse  │
│  Data   │     │   Policy    │     │   Store     │     │  Role   │
└─────────┘     └─────────────┘     └─────────────┘     └─────────┘
```

### 6.2 Role-Based Access Control (RBAC)

| Role | Read | Create | Update | Delete | Approve | Sign |
|------|------|--------|--------|--------|---------|------|
| Admin | All | All | All | All | All | All |
| Surveyor | Own | Own | Own | - | - | - |
| Verifikator | All | - | Status | - | - | - |
| Approver | All | - | - | - | Own | Own |

---

## 7. PERFORMANCE STRATEGY

### 7.1 Optimization Techniques

| Area | Strategy | Implementation |
|------|----------|----------------|
| Data Fetching | React Query / SWR | Caching & background refetch |
| Bundle Size | Code Splitting | Lazy loading routes |
| Form Performance | Virtualization | react-window for large lists |
| State Updates | Selective updates | Zustand shallow selectors |
| Excel Processing | Web Workers | Offload heavy computations |

### 7.2 Caching Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                     CACHE LAYERS                              │
├─────────────────────────────────────────────────────────────┤
│ L1: Zustand Store     - In-memory app state                  │
│ L2: React Query Cache - Server state with TTL                │
│ L3: LocalStorage      - Draft surveys, user preferences        │
│ L4: IndexedDB       - Large datasets, offline support      │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. ERROR HANDLING STRATEGY

### 8.1 Error Categories

| Level | Type | Handler | User Feedback |
|-------|------|---------|---------------|
| Network | API Error | Retry + Toast | "Koneksi bermasalah, mencoba ulang..." |
| Validation | Form Error | Field-level | Inline error message |
| Business | Workflow | Modal | "Tidak dapat melanjutkan: [reason]" |
| System | Crash | Error Boundary | "Terjadi kesalahan sistem" |

### 8.2 Error Boundary Structure

```
<AppErrorBoundary>
  <AuthProvider>
    <Router>
      <RouteErrorBoundary>
        <Page />
      </RouteErrorBoundary>
    </Router>
  </AuthProvider>
</AppErrorBoundary>
```

---

## 9. TESTING STRATEGY

### 9.1 Testing Pyramid

```
        ┌─────────┐
        │   E2E   │  ▲ Playwright (Critical flows)
       ┌┴─────────┴┐
       │ Integration│  ▲ React Testing Library + MSW
      ┌┴────────────┴┐
      │    Unit       │  ▲ Jest (Utils, Engine, Validation)
     └────────────────┘
```

### 9.2 Critical Test Cases

| Module | Test Type | Coverage |
|--------|-----------|----------|
| Calculation Engine | Unit | All formulas, edge cases |
| Workflow Engine | Unit + Integration | All state transitions |
| Template Parser | Integration | Excel ↔ JSON roundtrip |
| Form Validation | Unit | All validation rules |
| Export Engine | E2E | Generated Excel matches template |

---

## 10. DEPLOYMENT ARCHITECTURE

### 10.1 Build Configuration

```javascript
// vite.config.ts
export default defineConfig({
  base: '/aplikasi-penilaian-kerusakan/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          xlsx: ['xlsx'],
        }
      }
    }
  }
})
```

### 10.2 Environment Variables

```
# .env.production
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_GOOGLE_CLIENT_ID=...
VITE_APP_VERSION=1.0.0
```

---

## 11. INTEGRATION ARCHITECTURE

### 11.1 Google Integration

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│  Export │────▶│  Google     │────▶│   Drive     │
│  Excel  │     │  OAuth 2.0  │     │   Upload    │
└─────────┘     └─────────────┘     └─────────────┘

┌─────────┐     ┌─────────────┐     ┌─────────────┐
│  Data   │────▶│  Google     │────▶│   Sheets    │
│  Sync   │     │  Sheets API │     │   Append    │
└─────────┘     └─────────────┘     └─────────────┘
```

### 11.2 TTE (Digital Signature) Flow

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│ Sign    │────▶│ Signature   │────▶│  Canvas     │
│ Action  │     │   Pad       │     │  Capture    │
└─────────┘     └─────────────┘     └─────────────┘
                                            │
                                            ▼
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│ Verify  │◄────│  Timestamp  │◄────│  Supabase   │
│   TTE   │     │   + Hash    │     │  Storage    │
└─────────┘     └─────────────┘     └─────────────┘
```

---

## 12. MONITORING & LOGGING

### 12.1 Logging Strategy

| Level | Destination | Content |
|-------|-------------|---------|
| Error | Sentry / Logflare | Stack traces, user context |
| Warn | Console | Deprecations, recoverable errors |
| Info | Console | User actions, navigation |
| Debug | Console (dev only) | State changes, API calls |

### 12.2 Performance Monitoring

- Core Web Vitals tracking
- API response time monitoring
- Excel processing time tracking
- Bundle size monitoring (CI)

---

## 13. SCALABILITY CONSIDERATIONS

### 13.1 Horizontal Scalability

- Stateless frontend (GitHub Pages CDN)
- Supabase auto-scaling
- File storage with CDN (Supabase Storage)

### 13.2 Data Growth Strategy

| Data Type | Retention | Archive Strategy |
|-----------|-----------|------------------|
| Active Surveys | 2 years | - |
| Completed Surveys | 5 years | Move to archive table |
| Signatures | 7 years | Glacier storage |
| Audit Logs | 3 years | Compress & archive |

---

## 14. DISASTER RECOVERY

### 14.1 Backup Strategy

| Component | Frequency | Method |
|-----------|-----------|--------|
| Database | Daily | Supabase automated backups |
| Storage | Real-time | Supabase replication |
| Code | Every push | Git version control |

### 14.2 Recovery Procedures

1. Database: Point-in-time recovery via Supabase
2. Storage: Cross-region replication
3. Application: Rollback via Git revert + redeploy

---

## 15. DEVELOPMENT WORKFLOW

### 15.1 Git Branching Strategy

```
main (production)
  └── develop (integration)
        ├── feature/assessment-engine
        ├── feature/workflow-system
        ├── feature/excel-export
        └── bugfix/calculation-error
```

### 15.2 Code Quality Gates

1. TypeScript strict mode - No errors
2. ESLint - All rules pass
3. Unit tests - >80% coverage
4. Build - No warnings
5. Bundle size - <500KB initial

---

**Dokumen ini merupakan panduan arsitektur utama sistem. Setiap perubahan arsitektur harus didokumentasikan dan disetujui sebelum implementasi.**
