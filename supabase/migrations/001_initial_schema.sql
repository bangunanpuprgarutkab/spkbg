-- ============================================================
-- SUPABASE DATABASE SCHEMA - COMPLETE
-- Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
-- Version: 1.0.0
-- Ready for: Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 0. ENABLE EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. CUSTOM TYPES (ENUMS)
-- ============================================================

-- User roles
CREATE TYPE user_role AS ENUM ('admin', 'surveyor', 'verifikator', 'approver');

-- Workflow status
CREATE TYPE workflow_status AS ENUM (
    'disposisi',
    'persiapan', 
    'survey',
    'analisis',
    'penilaian',
    'diperiksa',
    'disetujui',
    'ditolak'
);

-- Component categories
CREATE TYPE component_category AS ENUM (
    'struktur',
    'arsitektur', 
    'utilitas',
    'finishing'
);

-- Damage classification (1-7 scale)
CREATE TYPE damage_classification AS ENUM ('1', '2', '3', '4', '5', '6', '7');

-- Damage category result
CREATE TYPE damage_category AS ENUM ('ringan', 'sedang', 'berat');

-- Template types
CREATE TYPE template_type AS ENUM ('excel', 'pdf', 'docx');

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- 2.1 users - Extends auth.users from Supabase Auth
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'surveyor',
    phone TEXT,
    nip TEXT,
    jabatan TEXT,
    instansi TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE users IS 'User profiles extending Supabase Auth';
COMMENT ON COLUMN users.nip IS 'Nomor Induk Pegawai untuk pemerintahan';
COMMENT ON COLUMN users.role IS 'admin: full access, surveyor: own data, verifikator: verify only, approver: approve only';

-- 2.2 templates - Excel templates
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0',
    template_type template_type DEFAULT 'excel',
    max_lantai INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE templates IS 'Excel templates for damage assessment forms';

-- 2.3 template_mappings - Field mapping Excel to DB
CREATE TABLE template_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
    excel_column TEXT NOT NULL,
    json_field TEXT NOT NULL,
    db_field TEXT NOT NULL,
    data_type TEXT NOT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    validation_rules JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE template_mappings IS 'Mapping between Excel columns and database fields';

-- 2.4 projects - Building projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kode_project TEXT UNIQUE NOT NULL,
    nama_bangunan TEXT NOT NULL,
    alamat TEXT NOT NULL,
    kelurahan TEXT,
    kecamatan TEXT,
    kota TEXT,
    provinsi TEXT,
    kode_pos TEXT,
    jumlah_lantai INTEGER NOT NULL,
    luas_tanah DECIMAL(10,2),
    luas_bangunan DECIMAL(10,2),
    tahun_pembangunan INTEGER,
    jenis_bangunan TEXT,
    pemilik_bangunan TEXT,
    pengguna_bangunan TEXT,
    status_bangunan TEXT,
    koordinat_lat DECIMAL(10,8),
    koordinat_lng DECIMAL(11,8),
    template_id UUID REFERENCES templates(id),
    status_workflow workflow_status DEFAULT 'disposisi',
    created_by UUID REFERENCES users(id),
    assigned_surveyor UUID REFERENCES users(id),
    assigned_verifikator UUID REFERENCES users(id),
    assigned_approver UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

COMMENT ON TABLE projects IS 'Building projects/assessments';
COMMENT ON COLUMN projects.kode_project IS 'Format: PRJ-YYYY-XXXX';

-- 2.5 surveys - Individual surveys
CREATE TABLE surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    template_id UUID REFERENCES templates(id),
    kode_survey TEXT UNIQUE NOT NULL,
    tanggal_survey DATE NOT NULL,
    surveyor_id UUID REFERENCES users(id),
    verifikator_id UUID REFERENCES users(id),
    approver_id UUID REFERENCES users(id),
    
    -- Tahap 1: Safety Check (Critical)
    has_kolom_patah BOOLEAN DEFAULT FALSE,
    has_pondasi_bergeser BOOLEAN DEFAULT FALSE,
    has_struktur_runtuh BOOLEAN DEFAULT FALSE,
    is_critical BOOLEAN DEFAULT FALSE,
    
    -- General condition
    kondisi_umum TEXT,
    catatan_umum TEXT,
    rekomendasi TEXT,
    
    -- Status
    status workflow_status DEFAULT 'survey',
    is_draft BOOLEAN DEFAULT TRUE,
    
    -- Environmental metadata
    weather_condition TEXT,
    temperature DECIMAL(4,1),
    humidity INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

COMMENT ON TABLE surveys IS 'Individual survey records';
COMMENT ON COLUMN surveys.kode_survey IS 'Format: SRV-YYYY-XXXX';
COMMENT ON COLUMN surveys.is_critical IS 'TRUE if any critical safety issue detected';

-- 2.6 components - Building components
CREATE TABLE components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    
    -- Component identification
    kode_komponen TEXT NOT NULL,
    nama_komponen TEXT NOT NULL,
    kategori component_category NOT NULL,
    sub_kategori TEXT,
    
    -- Volume and dimensions
    volume_total DECIMAL(10,3) NOT NULL DEFAULT 0,
    volume_rusak DECIMAL(10,3) NOT NULL DEFAULT 0,
    satuan TEXT NOT NULL DEFAULT 'm3',
    dimensi JSONB,
    
    -- Damage classification
    klasifikasi damage_classification,
    nilai_kerusakan DECIMAL(3,2),
    
    -- Weight
    bobot_komponen DECIMAL(5,4) NOT NULL DEFAULT 0,
    
    -- Description
    deskripsi_kerusakan TEXT,
    lokasi_spesifik TEXT,
    foto_urls TEXT[],
    
    -- Calculation result
    nilai_hasil DECIMAL(10,6),
    
    -- Status
    is_draft BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE components IS 'Individual building components with damage data';
COMMENT ON COLUMN components.nilai_kerusakan IS 'Converted from klasifikasi: 1=0.00, 2=0.20, 3=0.35, 4=0.50, 5=0.70, 6=0.85, 7=1.00';
COMMENT ON COLUMN components.nilai_hasil IS 'Auto-calculated: (volume_rusak/volume_total) * nilai_kerusakan * bobot_komponen';

-- 2.7 component_definitions - Master component list
CREATE TABLE component_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
    kode_komponen TEXT NOT NULL,
    nama_komponen TEXT NOT NULL,
    kategori component_category NOT NULL,
    sub_kategori TEXT,
    bobot_komponen DECIMAL(5,4) NOT NULL,
    satuan TEXT NOT NULL,
    urutan INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE component_definitions IS 'Master list of building components with weights';

-- 2.8 results - Calculation results
CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    
    -- Stage 1 result
    is_critical BOOLEAN DEFAULT FALSE,
    critical_reasons TEXT[],
    
    -- Stage 2 results by category
    total_kerusakan_struktur DECIMAL(6,2) DEFAULT 0,
    total_kerusakan_arsitektur DECIMAL(6,2) DEFAULT 0,
    total_kerusakan_utilitas DECIMAL(6,2) DEFAULT 0,
    total_kerusakan_finishing DECIMAL(6,2) DEFAULT 0,
    
    -- Overall total
    total_kerusakan DECIMAL(6,2) DEFAULT 0,
    kategori_kerusakan damage_category,
    
    -- Detailed breakdown
    detail_perhitungan JSONB,
    
    -- Approval tracking
    calculated_at TIMESTAMPTZ,
    calculated_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE results IS 'Calculation results for surveys';
COMMENT ON COLUMN results.total_kerusakan IS 'Sum of all category damages, auto-calculated';
COMMENT ON COLUMN results.kategori_kerusakan IS 'ringan: <=30%, sedang: 30-45%, berat: >45%';

-- 2.9 workflow_logs - Audit trail
CREATE TABLE workflow_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Transition info
    from_status workflow_status,
    to_status workflow_status NOT NULL,
    actor_id UUID REFERENCES users(id),
    actor_role user_role,
    
    -- Details
    action TEXT NOT NULL,
    note TEXT,
    ip_address INET,
    user_agent TEXT,
    
    -- Metadata
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE workflow_logs IS 'Immutable audit trail for all workflow transitions';

-- 2.10 signatures - Digital signatures (TTE)
CREATE TABLE signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    
    -- Signer info
    signed_by UUID REFERENCES users(id),
    signer_name TEXT NOT NULL,
    signer_nip TEXT,
    signer_jabatan TEXT,
    signer_role user_role NOT NULL,
    
    -- Signature data
    signature_url TEXT NOT NULL,
    signature_hash TEXT,
    
    -- Context
    signature_type TEXT NOT NULL,
    page_number INTEGER,
    position_x DECIMAL(6,2),
    position_y DECIMAL(6,2),
    
    -- Timestamp
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Verification
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id)
);

COMMENT ON TABLE signatures IS 'Digital signatures for TTE (Tanda Tangan Elektronik)';

-- 2.11 exports - Export records
CREATE TABLE exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    
    export_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT,
    file_size INTEGER,
    
    google_file_id TEXT,
    google_drive_url TEXT,
    
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    
    exported_by UUID REFERENCES users(id),
    exported_at TIMESTAMPTZ DEFAULT NOW(),
    downloaded_at TIMESTAMPTZ,
    download_count INTEGER DEFAULT 0
);

-- 2.12 notifications - User notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    
    entity_type TEXT,
    entity_id UUID,
    link TEXT,
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================

-- Users indexes
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

-- Projects indexes
CREATE INDEX idx_projects_status ON projects(status_workflow);
CREATE INDEX idx_projects_surveyor ON projects(assigned_surveyor);
CREATE INDEX idx_projects_verifikator ON projects(assigned_verifikator);
CREATE INDEX idx_projects_approver ON projects(assigned_approver);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_kode ON projects(kode_project);
CREATE INDEX idx_projects_template ON projects(template_id);

-- Surveys indexes
CREATE INDEX idx_surveys_project ON surveys(project_id);
CREATE INDEX idx_surveys_template ON surveys(template_id);
CREATE INDEX idx_surveys_status ON surveys(status);
CREATE INDEX idx_surveys_surveyor ON surveys(surveyor_id);
CREATE INDEX idx_surveys_critical ON surveys(is_critical);
CREATE INDEX idx_surveys_tanggal ON surveys(tanggal_survey);
CREATE INDEX idx_surveys_kode ON surveys(kode_survey);

-- Components indexes
CREATE INDEX idx_components_survey ON components(survey_id);
CREATE INDEX idx_components_kategori ON components(kategori);
CREATE INDEX idx_components_kode ON components(kode_komponen);
CREATE INDEX idx_components_sub_kategori ON components(sub_kategori);

-- Results indexes
CREATE INDEX idx_results_survey ON results(survey_id);
CREATE INDEX idx_results_kategori ON results(kategori_kerusakan);
CREATE INDEX idx_results_critical ON results(is_critical);

-- Workflow logs indexes
CREATE INDEX idx_workflow_logs_survey ON workflow_logs(survey_id);
CREATE INDEX idx_workflow_logs_project ON workflow_logs(project_id);
CREATE INDEX idx_workflow_logs_created ON workflow_logs(created_at);
CREATE INDEX idx_workflow_logs_actor ON workflow_logs(actor_id);

-- Signatures indexes
CREATE INDEX idx_signatures_survey ON signatures(survey_id);
CREATE INDEX idx_signatures_signer ON signatures(signed_by);
CREATE INDEX idx_signatures_type ON signatures(signature_type);

-- Notifications indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================================
-- 4. VIEWS
-- ============================================================

-- 4.1 survey_summary - Overview of surveys
CREATE VIEW survey_summary AS
SELECT 
    s.id AS survey_id,
    s.kode_survey,
    s.tanggal_survey,
    s.status,
    s.is_critical,
    s.is_draft,
    p.id AS project_id,
    p.kode_project,
    p.nama_bangunan,
    p.jumlah_lantai,
    p.alamat,
    p.kota,
    p.status_workflow AS project_status,
    u_surveyor.name AS surveyor_name,
    u_verifikator.name AS verifikator_name,
    u_approver.name AS approver_name,
    r.total_kerusakan,
    r.kategori_kerusakan,
    COUNT(c.id) AS jumlah_komponen,
    COUNT(CASE WHEN c.is_draft = FALSE THEN 1 END) AS komponen_lengkap,
    s.created_at,
    s.updated_at
FROM surveys s
JOIN projects p ON s.project_id = p.id
LEFT JOIN users u_surveyor ON s.surveyor_id = u_surveyor.id
LEFT JOIN users u_verifikator ON s.verifikator_id = u_verifikator.id
LEFT JOIN users u_approver ON s.approver_id = u_approver.id
LEFT JOIN results r ON s.id = r.survey_id
LEFT JOIN components c ON s.id = c.survey_id
GROUP BY s.id, p.id, u_surveyor.name, u_verifikator.name, u_approver.name, r.total_kerusakan, r.kategori_kerusakan;

COMMENT ON VIEW survey_summary IS 'Comprehensive view of survey status with component counts';

-- 4.2 project_progress - Project completion tracking
CREATE VIEW project_progress AS
SELECT 
    p.id AS project_id,
    p.kode_project,
    p.nama_bangunan,
    p.status_workflow,
    p.jumlah_lantai,
    COUNT(s.id) AS total_surveys,
    COUNT(CASE WHEN s.status = 'disetujui' THEN 1 END) AS approved_surveys,
    COUNT(CASE WHEN s.status = 'survey' AND s.is_draft = FALSE THEN 1 END) AS submitted_surveys,
    MAX(s.completed_at) AS last_completed,
    CASE 
        WHEN p.status_workflow = 'disetujui' THEN 100
        WHEN p.status_workflow = 'diperiksa' THEN 85
        WHEN p.status_workflow = 'penilaian' THEN 70
        WHEN p.status_workflow = 'analisis' THEN 55
        WHEN p.status_workflow = 'survey' THEN 40
        WHEN p.status_workflow = 'persiapan' THEN 25
        ELSE 10
    END AS progress_percentage,
    u_surveyor.name AS surveyor_name,
    u_verifikator.name AS verifikator_name,
    u_approver.name AS approver_name
FROM projects p
LEFT JOIN surveys s ON p.id = s.project_id
LEFT JOIN users u_surveyor ON p.assigned_surveyor = u_surveyor.id
LEFT JOIN users u_verifikator ON p.assigned_verifikator = u_verifikator.id
LEFT JOIN users u_approver ON p.assigned_approver = u_approver.id
GROUP BY p.id, u_surveyor.name, u_verifikator.name, u_approver.name;

COMMENT ON VIEW project_progress IS 'Project progress tracking with completion percentage';

-- 4.3 workflow_timeline - Audit trail with duration
CREATE VIEW workflow_timeline AS
SELECT 
    wl.id,
    wl.survey_id,
    s.kode_survey,
    p.nama_bangunan,
    wl.from_status,
    wl.to_status,
    wl.action,
    u.name AS actor_name,
    u.role AS actor_role,
    wl.note,
    wl.ip_address,
    wl.created_at,
    LAG(wl.created_at) OVER (PARTITION BY wl.survey_id ORDER BY wl.created_at) AS prev_timestamp,
    EXTRACT(EPOCH FROM (wl.created_at - LAG(wl.created_at) OVER (PARTITION BY wl.survey_id ORDER BY wl.created_at)))/3600 AS duration_hours
FROM workflow_logs wl
JOIN surveys s ON wl.survey_id = s.id
JOIN projects p ON s.project_id = p.id
LEFT JOIN users u ON wl.actor_id = u.id
ORDER BY wl.created_at DESC;

COMMENT ON VIEW workflow_timeline IS 'Workflow audit trail with time duration between steps';

-- 4.4 component_damage_summary - Component damage statistics
CREATE VIEW component_damage_summary AS
SELECT 
    c.kode_komponen,
    c.nama_komponen,
    c.kategori,
    c.sub_kategori,
    COUNT(*) AS total_surveys,
    AVG(c.volume_rusak) AS avg_volume_rusak,
    AVG(c.nilai_hasil) AS avg_nilai_hasil,
    MODE() WITHIN GROUP (ORDER BY c.klasifikasi) AS modus_klasifikasi,
    COUNT(CASE WHEN c.klasifikasi IN ('6', '7') THEN 1 END) AS count_severe_damage
FROM components c
JOIN surveys s ON c.survey_id = s.id
WHERE s.status = 'disetujui'
GROUP BY c.kode_komponen, c.nama_komponen, c.kategori, c.sub_kategori;

COMMENT ON VIEW component_damage_summary IS 'Statistical summary of component damage across all surveys';

-- ============================================================
-- 5. INITIAL DATA - Component Definitions
-- ============================================================

-- 5.1 STRUKTUR - Pondasi
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('P001', 'Pondasi Tapak Beton', 'struktur', 'pondasi', 0.075, 'm3', 1),
('P002', 'Pondasi Telapak Beton', 'struktur', 'pondasi', 0.075, 'm3', 2),
('P003', 'Sloof Beton', 'struktur', 'pondasi', 0.075, 'm3', 3);

-- 5.2 STRUKTUR - Kolom
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('K001', 'Kolom K1 (Kolom Utama)', 'struktur', 'kolom', 0.120, 'm3', 4),
('K002', 'Kolom K2 (Kolom Primer)', 'struktur', 'kolom', 0.100, 'm3', 5);

-- 5.3 STRUKTUR - Balok
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('B001', 'Balok B1 (Balok Utama)', 'struktur', 'balok', 0.100, 'm3', 6),
('B002', 'Balok B2 (Balok Sekunder)', 'struktur', 'balok', 0.080, 'm3', 7);

-- 5.4 STRUKTUR - Tangga & Plat
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('T001', 'Tangga Beton', 'struktur', 'tangga', 0.050, 'm3', 8),
('PL01', 'Plat Lantai Beton', 'struktur', 'plat', 0.150, 'm3', 9),
('PL02', 'Plat Atap Beton', 'struktur', 'plat', 0.100, 'm3', 10);

-- 5.5 STRUKTUR - Atap
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('A001', 'Rangka Atap Baja', 'struktur', 'atap', 0.075, 'm2', 11),
('A002', 'Rangka Atap Kayu', 'struktur', 'atap', 0.075, 'm2', 12);

-- 5.6 ARSITEKTUR - Dinding
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('D001', 'Dinding Bata Merah', 'arsitektur', 'dinding', 0.080, 'm2', 13),
('D002', 'Dinding Bata Ringan', 'arsitektur', 'dinding', 0.080, 'm2', 14),
('D003', 'Dinding Partisi Gypsum', 'arsitektur', 'dinding', 0.040, 'm2', 15);

-- 5.7 ARSITEKTUR - Lantai
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('L001', 'Lantai Keramik', 'arsitektur', 'lantai', 0.050, 'm2', 16),
('L002', 'Lantai Granit', 'arsitektur', 'lantai', 0.050, 'm2', 17),
('L003', 'Lantai Vinyl', 'arsitektur', 'lantai', 0.040, 'm2', 18);

-- 5.8 ARSITEKTUR - Kusen, Pintu, Jendela
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('KF01', 'Kusen Pintu Kayu', 'arsitektur', 'kusen', 0.030, 'unit', 19),
('KF02', 'Kusen Jendela Kayu', 'arsitektur', 'kusen', 0.025, 'unit', 20),
('KF03', 'Kusen Pintu Aluminium', 'arsitektur', 'kusen', 0.030, 'unit', 21),
('KF04', 'Kusen Jendela Aluminium', 'arsitektur', 'kusen', 0.025, 'unit', 22),
('PT01', 'Pintu Panel Kayu', 'arsitektur', 'pintu', 0.020, 'unit', 23),
('PT02', 'Pintu Flush Door', 'arsitektur', 'pintu', 0.020, 'unit', 24),
('JN01', 'Jendela Kaca', 'arsitektur', 'jendela', 0.015, 'unit', 25),
('JN02', 'Jendela Nako', 'arsitektur', 'jendela', 0.015, 'unit', 26);

-- 5.9 FINISHING - Plafond
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('FP01', 'Plafond Gypsum', 'finishing', 'plafond', 0.040, 'm2', 27),
('FP02', 'Plafond Akustik', 'finishing', 'plafond', 0.040, 'm2', 28),
('FP03', 'Plafond PVC', 'finishing', 'plafond', 0.035, 'm2', 29);

-- 5.10 FINISHING - Dinding
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('FD01', 'Finishing Cat Dinding', 'finishing', 'dinding', 0.030, 'm2', 30),
('FD02', 'Finishing Wallpaper', 'finishing', 'dinding', 0.025, 'm2', 31),
('FD03', 'Finishing Pelapis Dinding', 'finishing', 'dinding', 0.030, 'm2', 32);

-- 5.11 FINISHING - Kusen & Jendela
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('FK01', 'Finishing Cat Kusen', 'finishing', 'kusen', 0.015, 'm2', 33),
('FK02', 'Finishing Cat Pintu', 'finishing', 'pintu', 0.015, 'm2', 34),
('FJ01', 'Finishing Cat Jendela', 'finishing', 'jendela', 0.010, 'm2', 35);

-- 5.12 UTILITAS - Listrik
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('IL01', 'Instalasi Listrik LV', 'utilitas', 'listrik', 0.030, 'm2', 36),
('IL02', 'Instalasi Stop Kontak', 'utilitas', 'listrik', 0.010, 'titik', 37),
('IL03', 'Instalasi Lampu', 'utilitas', 'listrik', 0.015, 'titik', 38);

-- 5.13 UTILITAS - Air
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('IA01', 'Instalasi Air Bersih', 'utilitas', 'air', 0.025, 'm2', 39),
('IA02', 'Instalasi Keran Air', 'utilitas', 'air', 0.010, 'titik', 40),
('IA03', 'Instalasi Sanitair', 'utilitas', 'air', 0.020, 'unit', 41);

-- 5.14 UTILITAS - Drainase
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('DR01', 'Drainase Limbah', 'utilitas', 'drainase', 0.020, 'm', 42),
('DR02', 'Septic Tank', 'utilitas', 'drainase', 0.015, 'unit', 43),
('DR03', 'Grease Trap', 'utilitas', 'drainase', 0.010, 'unit', 44);

-- ============================================================
-- 6. CONSTRAINTS & CHECKS
-- ============================================================

-- Ensure volume_rusak <= volume_total
ALTER TABLE components ADD CONSTRAINT chk_volume_valid 
    CHECK (volume_rusak <= volume_total);

-- Ensure workflow transition is valid
ALTER TABLE workflow_logs ADD CONSTRAINT chk_workflow_transition_valid
    CHECK (from_status IS NULL OR from_status != to_status);

-- Ensure survey dates are valid
ALTER TABLE surveys ADD CONSTRAINT chk_survey_dates_valid
    CHECK (submitted_at IS NULL OR submitted_at >= created_at);

-- Ensure completion tracking
ALTER TABLE surveys ADD CONSTRAINT chk_completion_valid
    CHECK (completed_at IS NULL OR (status = 'disetujui' AND completed_at >= submitted_at));

-- ============================================================
-- 7. SCHEMA VERSION TRACKING
-- ============================================================

CREATE TABLE schema_migrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version TEXT NOT NULL,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    applied_by TEXT
);

INSERT INTO schema_migrations (version, name) VALUES ('1.0.0', 'Initial Schema');

-- ============================================================
-- 8. RLS POLICIES (ROW LEVEL SECURITY)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE components ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_definitions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" 
  ON users FOR SELECT TO authenticated 
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" 
  ON users FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can update their own profile" 
  ON users FOR UPDATE TO authenticated 
  USING (auth.uid() = id);

-- Projects policies
CREATE POLICY "All authenticated can view projects" 
  ON projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Surveyor can create projects" 
  ON projects FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'surveyor')));

CREATE POLICY "Project owner or admin can update projects" 
  ON projects FOR UPDATE TO authenticated 
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Surveys policies
CREATE POLICY "Surveyor can view their own surveys" 
  ON surveys FOR SELECT TO authenticated 
  USING (surveyor_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'verifikator', 'approver')));

CREATE POLICY "Surveyor can create surveys" 
  ON surveys FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'surveyor')));

CREATE POLICY "Surveyor can update their own surveys" 
  ON surveys FOR UPDATE TO authenticated 
  USING (surveyor_id = auth.uid() OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'verifikator')));

-- Components policies
CREATE POLICY "Authenticated can view components" 
  ON components FOR SELECT TO authenticated USING (true);

CREATE POLICY "Surveyor can manage components" 
  ON components FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'surveyor', 'verifikator')));

-- Results policies
CREATE POLICY "Authenticated can view results" 
  ON results FOR SELECT TO authenticated USING (true);

CREATE POLICY "Approver can approve results" 
  ON results FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'approver')));

-- Workflow logs policies
CREATE POLICY "Authenticated can view workflow logs" 
  ON workflow_logs FOR SELECT TO authenticated USING (true);

-- Notifications policies
CREATE POLICY "Users can view their own notifications" 
  ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" 
  ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Templates policies (admin only for modifications)
CREATE POLICY "Authenticated can view templates" 
  ON templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage templates" 
  ON templates FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 9. FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_surveys_updated_at BEFORE UPDATE ON surveys 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON components 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_results_updated_at BEFORE UPDATE ON results 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Calculate damage value from classification
CREATE OR REPLACE FUNCTION get_damage_value(p_classification damage_classification)
RETURNS DECIMAL AS $$
BEGIN
  RETURN CASE p_classification
    WHEN '1' THEN 0.00
    WHEN '2' THEN 0.20
    WHEN '3' THEN 0.35
    WHEN '4' THEN 0.50
    WHEN '5' THEN 0.70
    WHEN '6' THEN 0.85
    WHEN '7' THEN 1.00
  END;
END;
$$ language 'plpgsql';

-- Auto-calculate component damage
CREATE OR REPLACE FUNCTION calculate_component_damage()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate nilai_kerusakan from klasifikasi
  IF NEW.klasifikasi IS NOT NULL THEN
    NEW.nilai_kerusakan = get_damage_value(NEW.klasifikasi);
  END IF;
  
  -- Calculate nilai_hasil
  IF NEW.volume_total > 0 AND NEW.nilai_kerusakan IS NOT NULL THEN
    NEW.nilai_hasil = (NEW.volume_rusak / NEW.volume_total) * NEW.nilai_kerusakan * NEW.bobot_komponen;
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_component_before_insert 
  BEFORE INSERT OR UPDATE ON components
  FOR EACH ROW EXECUTE FUNCTION calculate_component_damage();

-- Log workflow changes
CREATE OR REPLACE FUNCTION log_workflow_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status_workflow IS DISTINCT FROM NEW.status_workflow THEN
    INSERT INTO workflow_logs (
      project_id, from_status, to_status, actor_id, actor_role, action, created_at
    ) VALUES (
      NEW.id, OLD.status_workflow, NEW.status_workflow, auth.uid(), 
      (SELECT role FROM users WHERE id = auth.uid()),
      'status_change', now()
    );
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql' security definer;

CREATE TRIGGER on_project_status_change
  AFTER UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION log_workflow_change();

-- Calculate total project damage
CREATE OR REPLACE FUNCTION calculate_project_damage(p_project_id UUID)
RETURNS TABLE (
  total_damage DECIMAL(6,2),
  category damage_category,
  is_critical BOOLEAN
) AS $$
DECLARE
  v_total DECIMAL(6,2);
  v_category damage_category;
  v_is_critical BOOLEAN;
BEGIN
  -- Calculate total
  SELECT COALESCE(SUM(c.nilai_hasil), 0) * 100
  INTO v_total
  FROM components c
  JOIN surveys s ON c.survey_id = s.id
  WHERE s.project_id = p_project_id;
  
  -- Determine category
  v_category := CASE
    WHEN v_total <= 30 THEN 'ringan'::damage_category
    WHEN v_total <= 45 THEN 'sedang'::damage_category
    ELSE 'berat'::damage_category
  END;
  
  -- Check critical
  SELECT EXISTS(
    SELECT 1 FROM components c
    JOIN surveys s ON c.survey_id = s.id
    WHERE s.project_id = p_project_id
    AND (c.klasifikasi IN ('6', '7') OR c.is_critical = true)
  ) INTO v_is_critical;
  
  RETURN QUERY SELECT v_total, v_category, v_is_critical;
END;
$$ language 'plpgsql';

-- Check for critical damage (safety check)
CREATE OR REPLACE FUNCTION check_critical_damage(p_survey_id UUID)
RETURNS TABLE (is_critical BOOLEAN, reasons TEXT[]) AS $$
DECLARE
  v_is_critical BOOLEAN := false;
  v_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF EXISTS (
    SELECT 1 FROM components 
    WHERE survey_id = p_survey_id 
    AND (
      (nama_komponen ILIKE '%kolom%' AND deskripsi_kerusakan ILIKE '%patah%') OR
      (nama_komponen ILIKE '%pondasi%' AND deskripsi_kerusakan ILIKE '%geser%') OR
      (klasifikasi = '7')
    )
  ) THEN
    v_is_critical := true;
    
    SELECT array_agg(DISTINCT 
      CASE 
        WHEN nama_komponen ILIKE '%kolom%' AND deskripsi_kerusakan ILIKE '%patah%' THEN 'Kolom patah terdeteksi'
        WHEN nama_komponen ILIKE '%pondasi%' AND deskripsi_kerusakan ILIKE '%geser%' THEN 'Pondasi bergeser terdeteksi'
        WHEN klasifikasi = '7' THEN 'Struktur runtuh terdeteksi'
      END
    )
    INTO v_reasons
    FROM components 
    WHERE survey_id = p_survey_id 
    AND (
      (nama_komponen ILIKE '%kolom%' AND deskripsi_kerusakan ILIKE '%patah%') OR
      (nama_komponen ILIKE '%pondasi%' AND deskripsi_kerusakan ILIKE '%geser%') OR
      (klasifikasi = '7')
    );
  END IF;
  
  RETURN QUERY SELECT v_is_critical, v_reasons;
END;
$$ language 'plpgsql';

-- ============================================================
-- END OF SCHEMA
-- ============================================================
