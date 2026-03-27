# Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)

Aplikasi web profesional untuk penilaian kerusakan bangunan gedung sesuai standar KemenPU.

## 🎯 Fitur Utama

- **Template-Driven Assessment**: Menggunakan template Excel resmi KemenPU
- **Workflow Management**: Alur kerja lengkap dari disposisi hingga approval
- **Perhitungan Otomatis**: Sistem perhitungan kerusakan sesuai regulasi
- **TTE (Tanda Tangan Elektronik)**: Digital signature untuk approval
- **Google Integration**: Upload ke Drive, sync ke Sheets, generate Docs
- **Real-time Notifications**: Notifikasi status dan approval

## 🏗️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **State Management**: Zustand dengan persistensi
- **Forms**: React Hook Form + Zod validation
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Excel Engine**: SheetJS (xlsx) dengan template mapping
- **Google API**: OAuth 2.0, Drive API, Sheets API, Docs API

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-username/spkbg.git
cd spkbg
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Copy `.env.example` ke `.env` dan isi:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_API_KEY=your_google_api_key
```

### 4. Setup Supabase

1. Buat project di [Supabase](https://supabase.com)
2. Jalankan SQL migrations di folder `supabase/migrations/`
3. Enable RLS policies
4. Setup Storage buckets: `templates`, `exports`, `signatures`

### 5. Setup Google Cloud

1. Buat project di [Google Cloud Console](https://console.cloud.google.com)
2. Enable APIs: Drive API, Sheets API, Docs API
3. Create OAuth 2.0 credentials
4. Add authorized domains

### 6. Run Development Server

```bash
npm run dev
```

### 7. Build for Production

```bash
npm run build
```

## 📁 Project Structure

```
/src
  /components      # UI Components
  /pages           # Page components
  /layouts         # Layout components
  /services        # API services (Supabase, Google)
  /stores          # Zustand stores
  /modules         # Excel Engine & Template Mapping
  /utils           # Utility functions
  /types           # TypeScript types
  /styles          # Global styles
/supabase
  /migrations      # Database migrations
  /functions       # Edge functions
/docs              # Documentation
/public
  /templates       # Excel templates
/.github
  /workflows       # CI/CD workflows
```

## ⚙️ Konfigurasi

### Supabase Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Google API Configuration

```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-api-key
```

### Vite Base Path (untuk GitHub Pages)

Edit `vite.config.ts`:

```ts
export default defineConfig({
  base: '/your-repo-name/', // untuk GitHub Pages
  // ...
})
```

## 📊 Database Schema

### Core Tables

- `users`: Data pengguna
- `projects`: Data proyek/bangunan
- `surveys`: Data survey
- `components`: Data komponen bangunan
- `results`: Hasil perhitungan kerusakan
- `workflow_logs`: Log perubahan status
- `signatures`: Data tanda tangan
- `notifications`: Notifikasi real-time

### Enums

- `user_role`: admin, surveyor, verifikator, approver
- `workflow_status`: disposisi → persiapan → survey → analisis → penilaian → diperiksa → disetujui
- `damage_category`: ringan (≤30%), sedang (30-45%), berat (>45%)

## 🔐 Security

### Row Level Security (RLS)

Semua tabel menggunakan RLS:

- Surveyor: hanya lihat/edit survey sendiri
- Verifikator: lihat semua, edit status
- Approver: lihat semua, approve + sign
- Admin: full access

### Authentication

- Supabase Auth dengan JWT
- Session management otomatis
- Protected routes dengan role-based access

## 📈 Workflow

```
Disposisi → Persiapan → Survey → Analisis → Penilaian → Diperiksa → Disetujui
   ↑                                                           ↓
   └────────────────────── Ditolak ←──────────────────────────┘
```

## 📤 Excel Export

Sistem menggunakan template-driven approach:

1. **Template Parser**: Membaca struktur Excel template
2. **Cell Mapping**: Mapping JSON path → Cell address
3. **Export Engine**: Isi data ke template asli
4. **Output**: File Excel IDENTIK dengan template

## ☁️ Google Integration

### Fitur

- **Drive**: Upload export ke Google Drive
- **Sheets**: Convert Excel → Google Sheets
- **Docs**: Generate laporan otomatis

### Setup

1. Enable Google APIs di Cloud Console
2. Configure OAuth consent screen
3. Add JavaScript origins
4. Set environment variables

## 🧪 Testing

### Manual Testing Checklist

- [ ] Login/logout berfungsi
- [ ] CRUD project & survey
- [ ] Input komponen & perhitungan
- [ ] Workflow transitions
- [ ] Approval dengan TTE
- [ ] Export Excel format IDENTIK
- [ ] Upload ke Google Drive
- [ ] Sync ke Google Sheets
- [ ] Real-time notifications

## 🧠 AI Service Setup (Crack Detection)

### Prerequisites

- Python 3.9+
- CUDA (optional, for GPU acceleration)

### Installation

```bash
# Navigate to AI service
cd ai-service

# Create virtual environment
python -m venv venv

# Activate (Linux/Mac)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download or place your YOLO model
mkdir -p model
cp /path/to/best.pt model/best.pt

# Configure environment
cp .env.example .env

# Run AI service
python main.py
```

### AI Service Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Health check |
| `POST /detect` | Detect cracks in image |
| `POST /detect-batch` | Batch detection |
| `GET /model-info` | Model information |

### Training Custom Model

See [ai-service/MODEL_TRAINING.md](ai-service/MODEL_TRAINING.md) for training instructions.

## 🚀 Deployment

### GitHub Pages

1. Fork repository
2. Enable GitHub Pages di Settings
3. Set source: GitHub Actions
4. Push ke main branch
5. Workflow otomatis deploy

### Manual Deployment

```bash
npm run build
# Upload dist/ ke hosting
```

## 📝 Changelog

### v1.0.0
- Initial release
- Full workflow support
- Excel export IDENTIK template
- Google integration
- TTE support

## 👥 Contributors

- Developer Team SPKBG

## 📄 License

MIT License - 2024 SPKBG Team

## 📞 Support

Untuk bantuan dan pertanyaan:
- Email: support@spkbg.id
- GitHub Issues: [Issues Page](https://github.com/your-username/spkbg/issues)

---

**SPKBG - Sistem Penilaian Kerusakan Bangunan Gedung**
*Enterprise Engineering Application (GovTech Ready)*
