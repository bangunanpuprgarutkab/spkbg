# Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)

[![Deploy to GitHub Pages](https://github.com/bangunanpuprgarutkab/spkbg/actions/workflows/deploy.yml/badge.svg)](https://github.com/bangunanpuprgarutkab/spkbg/actions/workflows/deploy.yml)

Aplikasi web profesional untuk penilaian kerusakan bangunan gedung sesuai standar KemenPU (Kementerian Pekerjaan Umum dan Perumahan Rakyat).

🌐 **Live Demo**: https://bangunanpuprgarutkab.github.io/spkbg/

---

## 🎯 Fitur Utama

- **📋 Template-Driven Assessment**: Menggunakan template Excel resmi KemenPU sebagai single source of truth
- **🔄 Workflow Management**: Alur kerja lengkap 7 tahap (disposisi → persiapan → survey → analisis → penilaian → diperiksa → disetujui)
- **🧮 Perhitungan Otomatis**: Sistem perhitungan kerusakan sesuai regulasi KemenPU dengan klasifikasi 1-7
- **✍️ TTE (Tanda Tangan Elektronik)**: Digital signature untuk approval final
- **☁️ Google Integration**: Upload ke Drive, sync ke Sheets, generate Docs laporan
- **🔔 Real-time Notifications**: Notifikasi status dan approval via Supabase Realtime
- **🤖 AI Crack Detection**: Deteksi retak otomatis menggunakan TensorFlow.js / Python YOLO
- **🗺️ GIS & Drone Survey**: Pemetaan kerusakan dengan integrasi peta dan drone

---

## 🏗️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | TailwindCSS + Lucide Icons |
| **State Management** | Zustand dengan persistensi |
| **Forms** | React Hook Form + Zod validation |
| **Backend** | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| **Excel Engine** | SheetJS (xlsx) dengan template mapping |
| **AI/ML** | TensorFlow.js + Python FastAPI (YOLO) |
| **GIS** | Leaflet + React-Leaflet |
| **Charts** | Recharts |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm atau yarn
- Akun Supabase (gratis)
- Akun Google Cloud (untuk Google integration, opsional)

### 1. Clone Repository

```bash
git clone https://github.com/bangunanpuprgarutkab/spkbg.git
cd spkbg
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Copy `.env.example` ke `.env`:

```bash
cp .env.example .env
```

Isi dengan konfigurasi Anda:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Google Integration (Opsional)
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-api-key

# AI Services (Opsional)
VITE_AI_API_URL=http://localhost:8000

# App Configuration
VITE_APP_NAME=SPKBG
VITE_APP_VERSION=1.0.0
```

### 4. Setup Supabase Database

1. Buat project di [Supabase](https://supabase.com)
2. Buka **SQL Editor** di dashboard Supabase
3. Copy seluruh isi file `supabase/migrations/001_initial_schema.sql`
4. Paste dan jalankan (Run)
5. Setup **Storage buckets**: `survey-attachments`, `signatures`
6. Enable **Email provider** di Authentication → Providers

📖 [Panduan lengkap setup Supabase](supabase/SETUP.md)

### 5. Run Development Server

```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:5173`

### 6. Build for Production

```bash
npm run build
```

---

## 📁 Project Structure

```
spkbg/
├── src/
│   ├── components/          # UI Components (React)
│   │   ├── common/         # Shared components
│   │   ├── dashboard/      # Dashboard components
│   │   ├── survey/         # Survey form components
│   │   └── workflow/       # Workflow components
│   ├── pages/              # Page components (routes)
│   ├── layouts/            # Layout wrappers
│   ├── services/           # API services
│   │   ├── supabase/       # Supabase client & auth
│   │   ├── google/         # Google API integration
│   │   └── ai/             # AI service client
│   ├── stores/             # Zustand state stores
│   ├── modules/            # Business logic engines
│   │   ├── excel/          # Excel export engine
│   │   ├── ai/             # AI detection logic
│   │   ├── rab/            # RAB calculation engine
│   │   └── template/       # Template mapping engine
│   ├── utils/              # Utility functions
│   ├── types/              # TypeScript type definitions
│   └── styles/             # Global styles
├── supabase/
│   ├── migrations/           # Database SQL migrations
│   └── SETUP.md             # Setup instructions
├── .github/
│   └── workflows/            # GitHub Actions CI/CD
├── public/                   # Static assets
├── .env.example             # Environment template
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # TailwindCSS config
└── package.json             # Dependencies
```

---

## ⚙️ Konfigurasi Lengkap

### Supabase Setup

**Environment Variables:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

**Database Features:**
- ✅ Row Level Security (RLS) enabled
- ✅ Auto-calculation triggers
- ✅ Workflow audit logging
- ✅ Real-time subscriptions

### Google Cloud Setup (Opsional)

**Enable APIs:**
- Google Drive API
- Google Sheets API
- Google Docs API

**Environment Variables:**
```env
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=AIzaSy...
```

### Vite Configuration untuk GitHub Pages

File `vite.config.ts` sudah dikonfigurasi untuk GitHub Pages:

```typescript
export default defineConfig({
  base: '/spkbg/',  // Sesuai nama repository
  // ...
})
```

---

## 📊 Database Schema

### Core Tables

| Table | Deskripsi |
|-------|-----------|
| `users` | Profil pengguna (extends auth.users) |
| `projects` | Data proyek/bangunan yang dinilai |
| `surveys` | Data survey lapangan |
| `components` | Komponen bangunan dan nilai kerusakan |
| `results` | Hasil perhitungan akhir |
| `workflow_logs` | Audit trail perubahan status |
| `signatures` | Data tanda tangan digital (TTE) |
| `templates` | Template Excel yang digunakan |
| `notifications` | Notifikasi real-time |

### Enums

```sql
user_role:          admin | surveyor | verifikator | approver
workflow_status:    disposisi | persiapan | survey | analisis | penilaian | diperiksa | disetujui
damage_category:    ringan (≤30%) | sedang (30-45%) | berat (>45%)
component_category: struktur | arsitektur | utilitas | finishing
```

### Functions

- `calculate_component_damage()` - Auto-calculate nilai hasil
- `calculate_project_damage()` - Total kerusakan project
- `check_critical_damage()` - Safety check (tahap 1)
- `get_damage_value()` - Convert klasifikasi 1-7 ke nilai

---

## 🔐 Security

### Row Level Security (RLS)

| Role | Permissions |
|------|-------------|
| **Surveyor** | CRUD survey sendiri, view components |
| **Verifikator** | View all, update status, edit analysis |
| **Approver** | View all, approve results, TTE |
| **Admin** | Full access |

### Authentication
- Supabase Auth dengan JWT tokens
- Auto session refresh
- Role-based route protection

---

## 🔄 Workflow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Disposisi  │────▶│ Persiapan   │────▶│   Survey    │
└─────────────┘     └─────────────┘     └──────┬──────┘
      ▲                                          │
      │         ┌─────────────┐                  │
      └─────────│  Ditolak    │◀─────────────────┤
                └─────────────┘                  ▼
                                          ┌─────────────┐
                                          │  Analisis   │
                                          └──────┬──────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │  Penilaian  │
                                          └──────┬──────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │  Diperiksa  │
                                          └──────┬──────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │  Disetujui  │
                                          └─────────────┘
```

---

## 📤 Excel Export System

### Template-Driven Architecture

1. **Template Parser** (`modules/template/parser.ts`)
   - Membaca struktur Excel template asli
   - Extract metadata dan formulas

2. **Cell Mapping** (`modules/template/mapping.ts`)
   - JSON path → Cell address mapping
   - Dynamic field generation

3. **Export Engine** (`modules/excel/export.ts`)
   - Isi data ke template asli
   - Preserve formulas & formatting
   - Identik dengan template KemenPU

### Export Format

- **Input**: Template Excel KemenPU + Data JSON
- **Process**: Mapping → Fill → Calculate
- **Output**: File Excel IDENTIK template (100% compatible)

---

## ☁️ Google Integration

### Fitur yang Tersedia

| Fitur | Deskripsi |
|-------|-----------|
| **Drive Upload** | Export hasil ke Google Drive |
| **Sheets Sync** | Convert Excel → Google Sheets |
| **Docs Generate** | Generate laporan otomatis |
| **OAuth Login** | Login dengan Google account |

### Setup

1. Buat project di [Google Cloud Console](https://console.cloud.google.com)
2. Enable APIs: Drive, Sheets, Docs
3. Configure OAuth consent screen
4. Add authorized JavaScript origins:
   - `http://localhost:5173` (dev)
   - `https://bangunanpuprgarutkab.github.io` (prod)
5. Copy Client ID dan API Key ke environment variables

---

## 🤖 AI Crack Detection

### Cara Kerja

**Tahap 1 - Safety Check (Rules-based):**
- Deteksi: kolom patah, pondasi bergeser, struktur runtuh
- Result: Auto-flag critical damage

**Tahap 2 - AI Detection (Machine Learning):**
- Input: Foto kerusakan
- Model: TensorFlow.js / Python YOLO
- Output: Bounding box + confidence score
- Klasifikasi: Retak, spalling, korosi, dll

### Setup AI Service (Opsional)

```bash
# Python backend (opsional untuk GPU acceleration)
cd ai-service
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python main.py  # Runs on http://localhost:8000
```

---

## 🚀 Deployment

### GitHub Pages (Auto-deploy)

✅ **Sudah dikonfigurasi!**

Workflow: `.github/workflows/deploy.yml`

**Trigger deploy:**
```bash
git push origin main
```

Atau manual trigger di tab **Actions** → **Run workflow**

**URL:** https://bangunanpuprgarutkab.github.io/spkbg/

### GitHub Secrets yang Harus Di-set

Buka: Repository → Settings → Secrets and variables → Actions

| Secret | Value |
|--------|-------|
| `VITE_SUPABASE_URL` | URL Supabase project |
| `VITE_SUPABASE_ANON_KEY` | Anon key Supabase |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `VITE_GOOGLE_API_KEY` | Google API Key |

### Manual Deployment

```bash
npm run build
# Upload folder dist/ ke hosting static (Netlify, Vercel, dll)
```

---

## 🧪 Testing Checklist

### Manual Testing

- [ ] Login/logout dengan Supabase Auth
- [ ] CRUD Project dan Survey
- [ ] Input komponen dengan berbagai klasifikasi
- [ ] Perhitungan otomatis kerusakan
- [ ] Transisi workflow (semua status)
- [ ] Approval dengan TTE
- [ ] Export Excel format IDENTIK template
- [ ] Upload ke Google Drive
- [ ] Notifikasi real-time
- [ ] AI crack detection (jika setup)

### TypeScript Check

```bash
npm run type-check
```

### Build Check

```bash
npm run build
```

---

## 🐛 Troubleshooting

### Error: "Missing Supabase environment variables"
**Solusi:** Pastikan `.env` file ada dan sudah diisi

### Error: "Failed to load resource"
**Solusi:** Check `base` path di `vite.config.ts` sesuai dengan repo name

### Error: "RLS policy violation"
**Solusi:** Pastikan user sudah login dan RLS policies sudah di-setup

### Excel Export Error
**Solusi:** Pastikan template file ada di `public/templates/`

---

## 📝 Changelog

### v1.0.0 (Latest)
- ✅ Production ready
- ✅ Full workflow support (7 tahap)
- ✅ Excel export IDENTIK template KemenPU
- ✅ Google Drive/Sheets/Docs integration
- ✅ TTE (Tanda Tangan Elektronik)
- ✅ AI crack detection
- ✅ Real-time notifications
- ✅ GitHub Pages auto-deploy

---

## 👥 Tim Pengembang

- **PUPR Kabupaten Garut** - Product Owner
- **Development Team** - Engineering & Implementation

---

## 📄 License

MIT License - 2024 PUPR Kabupaten Garut

---

## 📞 Support & Kontribusi

- 🐛 **Bug Report**: [GitHub Issues](https://github.com/bangunanpuprgarutkab/spkbg/issues)
- 💡 **Feature Request**: Buat issue dengan label `enhancement`
- 📧 **Email**: pupr@garutkab.go.id

---

**SPKBG - Sistem Penilaian Kerusakan Bangunan Gedung**

*Enterprise Engineering Application (GovTech Ready)*

🇮🇩 Dikembangkan untuk Kementerian PUPR - Standar Penilaian Kerusakan Bangunan Gedung
