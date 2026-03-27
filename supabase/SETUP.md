# Setup Database Supabase SPKBG

## Langkah 1: Buat Project di Supabase
1. Buka https://supabase.com/dashboard
2. Login dengan akun Anda
3. Klik "New Project"
4. Isi:
   - Organization: Pilih atau buat baru
   - Project Name: SPKBG atau nama lain
   - Database Password: Buat password kuat
   - Region: Pilih yang terdekat (Singapore untuk Indonesia)
5. Klik "Create New Project"

## Langkah 2: Jalankan Migration SQL
1. Di dashboard Supabase, buka menu **SQL Editor**
2. Klik **New Query**
3. Copy seluruh isi file `supabase/migrations/001_initial_schema.sql`
4. Paste ke SQL Editor
5. Klik **Run** untuk mengeksekusi

## Langkah 3: Setup Environment Variables
Setelah project dibuat, dapatkan URL dan Anon Key:

1. Di dashboard, buka **Project Settings** > **API**
2. Copy **URL** dan **anon public** key
3. Update file `.env` di project Anda:

```env
VITE_SUPABASE_URL=https://[your-project].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
```

## Langkah 4: Setup Auth (Opsional)
1. Di dashboard, buka **Authentication** > **Providers**
2. Aktifkan **Email** provider
3. Atur konfigurasi sesuai kebutuhan (email confirmation, etc.)

## Langkah 5: Storage Setup (Untuk Upload File)
1. Buka **Storage** di dashboard
2. Buat bucket baru: `survey-attachments` untuk foto survey
3. Buat bucket baru: `signatures` untuk tanda tangan digital
4. Set RLS policies untuk bucket (contoh):

```sql
-- Allow authenticated users to upload
CREATE POLICY "Allow uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('survey-attachments', 'signatures'));

-- Allow users to view their own files
CREATE POLICY "Allow view own files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id IN ('survey-attachments', 'signatures'));
```

## Langkah 6: Test Koneksi
Jalankan aplikasi dan test login:
```bash
npm run dev
```

## Struktur Database

### Tabel Utama:
- **users** - Profil user (extends auth.users)
- **projects** - Data proyek/bangunan
- **surveys** - Survey lapangan
- **components** - Komponen bangunan dan kerusakan
- **results** - Hasil perhitungan
- **workflow_logs** - Audit trail
- **signatures** - Tanda tangan digital
- **templates** - Template Excel
- **notifications** - Notifikasi user

### Enum Types:
- `user_role`: admin, surveyor, verifikator, approver
- `workflow_status`: disposisi → persiapan → survey → analisis → penilaian → diperiksa → disetujui
- `damage_classification`: 1-7
- `component_category`: struktur, arsitektur, utilitas, finishing
- `damage_category`: ringan, sedang, berat

### Functions:
- `calculate_component_damage()` - Auto-calculate nilai hasil
- `calculate_project_damage()` - Total kerusakan project
- `check_critical_damage()` - Safety check tahap 1
- `get_damage_value()` - Convert klasifikasi ke nilai

### Views:
- `survey_summary` - Ringkasan survey
- `project_progress` - Progress project
- `workflow_timeline` - Timeline workflow
- `component_damage_summary` - Statistik kerusakan

## Troubleshooting

### Error: "relation does not exist"
- Pastikan migration dijalankan di schema `public`
- Cek apakah tabel sudah terbuat di Table Editor

### Error: "permission denied"
- Cek RLS policies sudah dibuat
- Pastikan user sudah login (authenticated role)

### Error: "duplicate key"
- Hapus data lama jika ingin reset: `TRUNCATE TABLE table_name CASCADE;`
- Atau gunakan `IF NOT EXISTS` saat create

## Backup & Restore

### Backup:
```bash
pg_dump -h [host] -U postgres -d postgres -f backup.sql
```

### Restore:
```bash
psql -h [host] -U postgres -d postgres -f backup.sql
```

## Notes Penting

1. **RLS Enabled** - Semua tabel sudah aktifkan RLS, pastikan policies benar
2. **Auto-calculation** - Komponen otomatis hitung nilai_hasil saat insert/update
3. **Workflow Logging** - Perubahan status project otomatis tercatat
4. **Critical Detection** - Safety check otomatis deteksi kerusakan kritis
5. **Seed Data** - Component definitions sudah terisi (pondasi, kolom, balok, dll)

## Production Checklist

- [ ] Ganti password database
- [ ] Setup email provider (SendGrid/Resend)
- [ ] Configure CORS di API settings
- [ ] Enable rate limiting
- [ ] Setup backup otomatis
- [ ] Configure custom domain (opsional)
