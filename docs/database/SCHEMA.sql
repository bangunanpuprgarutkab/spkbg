-- ============================================================
-- DATABASE SCHEMA
-- Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
-- Supabase PostgreSQL
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ENUMS
-- ============================================================

-- Role pengguna
CREATE TYPE user_role AS ENUM ('admin', 'surveyor', 'verifikator', 'approver');

-- Status workflow
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

-- Kategori komponen bangunan
CREATE TYPE component_category AS ENUM (
    'struktur',
    'arsitektur',
    'utilitas',
    'finishing'
);

-- Klasifikasi kerusakan (1-7)
CREATE TYPE damage_classification AS ENUM ('1', '2', '3', '4', '5', '6', '7');

-- Kategori hasil kerusakan
CREATE TYPE damage_category AS ENUM ('ringan', 'sedang', 'berat');

-- Tipe template
CREATE TYPE template_type AS ENUM ('excel', 'pdf', 'docx');

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- Table: users (extends supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'surveyor',
    phone TEXT,
    nip TEXT, -- Nomor Induk Pegawai (untuk pemerintahan)
    jabatan TEXT,
    instansi TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: templates
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL, -- path di Supabase Storage
    file_name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0',
    template_type template_type DEFAULT 'excel',
    max_lantai INTEGER, -- null = all, 1, 2, 3+
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB, -- struktur template dalam JSON
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: template_mappings
CREATE TABLE template_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
    excel_column TEXT NOT NULL,
    json_field TEXT NOT NULL,
    db_field TEXT NOT NULL,
    data_type TEXT NOT NULL, -- 'string', 'number', 'boolean', 'date'
    is_required BOOLEAN DEFAULT FALSE,
    validation_rules JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kode_project TEXT UNIQUE NOT NULL, -- format: PRJ-YYYY-XXXX
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
    jenis_bangunan TEXT, -- sekolah, rumah, kantor, dll
    pemilik_bangunan TEXT,
    pengguna_bangunan TEXT,
    status_bangunan TEXT, -- aktif, tidak aktif, dll
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

-- Table: surveys
CREATE TABLE surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    kode_survey TEXT UNIQUE NOT NULL, -- format: SRV-YYYY-XXXX
    tanggal_survey DATE NOT NULL,
    surveyor_id UUID REFERENCES users(id),
    verifikator_id UUID REFERENCES users(id),
    approver_id UUID REFERENCES users(id),
    
    -- Tahap 1: Safety Check
    has_kolom_patah BOOLEAN DEFAULT FALSE,
    has_pondasi_bergeser BOOLEAN DEFAULT FALSE,
    has_struktur_runtuh BOOLEAN DEFAULT FALSE,
    is_critical BOOLEAN DEFAULT FALSE,
    
    -- Kondisi umum
    kondisi_umum TEXT,
    catatan_umum TEXT,
    rekomendasi TEXT,
    
    -- Status
    status workflow_status DEFAULT 'survey',
    is_draft BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    weather_condition TEXT,
    temperature DECIMAL(4,1),
    humidity INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Table: components (komponen bangunan)
CREATE TABLE components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    
    -- Identifikasi komponen
    kode_komponen TEXT NOT NULL, -- format sesuai template
    nama_komponen TEXT NOT NULL,
    kategori component_category NOT NULL,
    sub_kategori TEXT, -- pondasi_tapak, kolom_k1, dll
    
    -- Volume dan dimensi
    volume_total DECIMAL(10,3) NOT NULL DEFAULT 0, -- dalam m³ atau unit
    volume_rusak DECIMAL(10,3) NOT NULL DEFAULT 0,
    satuan TEXT NOT NULL DEFAULT 'm³',
    
    -- Dimensi detail (JSON untuk fleksibilitas)
    dimensi JSONB, -- {panjang, lebar, tinggi, jumlah, dll}
    
    -- Klasifikasi kerusakan
    klasifikasi damage_classification,
    nilai_kerusakan DECIMAL(3,2), -- 0.00 - 1.00
    
    -- Bobot komponen (dari template)
    bobot_komponen DECIMAL(5,4) NOT NULL DEFAULT 0,
    
    -- Keterangan
    deskripsi_kerusakan TEXT,
    lokasi_spesifik TEXT,
    foto_urls TEXT[], -- array of Supabase Storage paths
    
    -- Perhitungan
    nilai_hasil DECIMAL(10,6), -- (volume_rusak/volume_total) * nilai_kerusakan * bobot
    
    -- Metadata
    is_draft BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: component_definitions (master data komponen dari template)
CREATE TABLE component_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
    kode_komponen TEXT NOT NULL,
    nama_komponen TEXT NOT NULL,
    kategori component_category NOT NULL,
    sub_kategori TEXT,
    bobot_komponen DECIMAL(5,4) NOT NULL,
    satuan TEXT NOT NULL,
    urutan INTEGER NOT NULL, -- urutan di form/template
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB, -- aturan khusus, validasi, dll
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: results (hasil perhitungan)
CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    
    -- Tahap 1 result
    is_critical BOOLEAN DEFAULT FALSE,
    critical_reasons TEXT[],
    
    -- Tahap 2 result
    total_kerusakan_struktur DECIMAL(6,2) DEFAULT 0,
    total_kerusakan_arsitektur DECIMAL(6,2) DEFAULT 0,
    total_kerusakan_utilitas DECIMAL(6,2) DEFAULT 0,
    total_kerusakan_finishing DECIMAL(6,2) DEFAULT 0,
    
    -- Total keseluruhan
    total_kerusakan DECIMAL(6,2) DEFAULT 0,
    kategori_kerusakan damage_category,
    
    -- Breakdown per komponen (JSON untuk fleksibilitas)
    detail_perhitungan JSONB,
    
    -- Approval
    calculated_at TIMESTAMPTZ,
    calculated_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: workflow_logs (audit trail)
CREATE TABLE workflow_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Transition info
    from_status workflow_status,
    to_status workflow_status NOT NULL,
    actor_id UUID REFERENCES users(id),
    actor_role user_role,
    
    -- Detail
    action TEXT NOT NULL, -- 'submit', 'approve', 'reject', 'return'
    note TEXT,
    ip_address INET,
    user_agent TEXT,
    
    -- Metadata
    metadata JSONB, -- additional context
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: signatures (TTE - Tanda Tangan Elektronik)
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
    signature_url TEXT NOT NULL, -- Supabase Storage path
    signature_hash TEXT, -- hash untuk verifikasi
    
    -- Context
    signature_type TEXT NOT NULL, -- 'surveyor', 'verifikator', 'approver'
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

-- Table: exports
CREATE TABLE exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    
    -- Export info
    export_type TEXT NOT NULL, -- 'excel', 'pdf', 'google_sheets', 'google_docs'
    file_name TEXT NOT NULL,
    file_url TEXT, -- Supabase Storage path or external URL
    file_size INTEGER,
    
    -- Google integration
    google_file_id TEXT,
    google_drive_url TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    error_message TEXT,
    
    -- Metadata
    exported_by UUID REFERENCES users(id),
    exported_at TIMESTAMPTZ DEFAULT NOW(),
    downloaded_at TIMESTAMPTZ,
    download_count INTEGER DEFAULT 0
);

-- Table: notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'info', 'warning', 'success', 'error'
    
    -- Link
    entity_type TEXT, -- 'survey', 'project', 'workflow'
    entity_id UUID,
    link TEXT,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

-- Users
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- Projects
CREATE INDEX idx_projects_status ON projects(status_workflow);
CREATE INDEX idx_projects_surveyor ON projects(assigned_surveyor);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_kode ON projects(kode_project);

-- Surveys
CREATE INDEX idx_surveys_project ON surveys(project_id);
CREATE INDEX idx_surveys_status ON surveys(status);
CREATE INDEX idx_surveys_surveyor ON surveys(surveyor_id);
CREATE INDEX idx_surveys_tanggal ON surveys(tanggal_survey);
CREATE INDEX idx_surveys_kode ON surveys(kode_survey);

-- Components
CREATE INDEX idx_components_survey ON components(survey_id);
CREATE INDEX idx_components_kategori ON components(kategori);
CREATE INDEX idx_components_kode ON components(kode_komponen);

-- Results
CREATE INDEX idx_results_survey ON results(survey_id);
CREATE INDEX idx_results_kategori ON results(kategori_kerusakan);

-- Workflow Logs
CREATE INDEX idx_workflow_logs_survey ON workflow_logs(survey_id);
CREATE INDEX idx_workflow_logs_created ON workflow_logs(created_at);
CREATE INDEX idx_workflow_logs_actor ON workflow_logs(actor_id);

-- Signatures
CREATE INDEX idx_signatures_survey ON signatures(survey_id);
CREATE INDEX idx_signatures_signer ON signatures(signed_by);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

-- ============================================================
-- 4. TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_surveys_updated_at BEFORE UPDATE ON surveys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_results_updated_at BEFORE UPDATE ON results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-calculate nilai_hasil on component insert/update
CREATE OR REPLACE FUNCTION calculate_component_value()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.volume_total > 0 AND NEW.nilai_kerusakan IS NOT NULL THEN
        NEW.nilai_hasil := (NEW.volume_rusak / NEW.volume_total) * NEW.nilai_kerusakan * NEW.bobot_komponen;
    ELSE
        NEW.nilai_hasil := 0;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_component_value_trigger 
    BEFORE INSERT OR UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION calculate_component_value();

-- Auto-set is_critical on survey if critical damage detected
CREATE OR REPLACE FUNCTION check_critical_damage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.has_kolom_patah OR NEW.has_pondasi_bergeser OR NEW.has_struktur_runtuh THEN
        NEW.is_critical := TRUE;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER check_critical_damage_trigger
    BEFORE INSERT OR UPDATE ON surveys
    FOR EACH ROW EXECUTE FUNCTION check_critical_damage();

-- ============================================================
-- 5. VIEWS
-- ============================================================

-- View: survey_summary
CREATE VIEW survey_summary AS
SELECT 
    s.id AS survey_id,
    s.kode_survey,
    s.tanggal_survey,
    s.status,
    s.is_critical,
    p.id AS project_id,
    p.kode_project,
    p.nama_bangunan,
    p.jumlah_lantai,
    p.alamat,
    p.kota,
    u_surveyor.name AS surveyor_name,
    u_verifikator.name AS verifikator_name,
    u_approver.name AS approver_name,
    r.total_kerusakan,
    r.kategori_kerusakan,
    COUNT(c.id) AS jumlah_komponen,
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

-- View: project_progress
CREATE VIEW project_progress AS
SELECT 
    p.id AS project_id,
    p.kode_project,
    p.nama_bangunan,
    p.status_workflow,
    COUNT(s.id) AS jumlah_survey,
    COUNT(CASE WHEN s.status = 'disetujui' THEN 1 END) AS survey_selesai,
    MAX(s.completed_at) AS last_completed,
    CASE 
        WHEN p.status_workflow = 'disetujui' THEN 100
        WHEN p.status_workflow = 'diperiksa' THEN 85
        WHEN p.status_workflow = 'penilaian' THEN 70
        WHEN p.status_workflow = 'analisis' THEN 55
        WHEN p.status_workflow = 'survey' THEN 40
        WHEN p.status_workflow = 'persiapan' THEN 25
        ELSE 10
    END AS progress_percentage
FROM projects p
LEFT JOIN surveys s ON p.id = s.project_id
GROUP BY p.id;

-- View: workflow_timeline
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
    wl.created_at,
    LAG(wl.created_at) OVER (PARTITION BY wl.survey_id ORDER BY wl.created_at) AS prev_timestamp,
    wl.created_at - LAG(wl.created_at) OVER (PARTITION BY wl.survey_id ORDER BY wl.created_at) AS duration
FROM workflow_logs wl
JOIN surveys s ON wl.survey_id = s.id
JOIN projects p ON s.project_id = p.id
LEFT JOIN users u ON wl.actor_id = u.id
ORDER BY wl.created_at DESC;

-- ============================================================
-- 6. FUNCTIONS
-- ============================================================

-- Function: Generate project code
CREATE OR REPLACE FUNCTION generate_project_code()
RETURNS TEXT AS $$
DECLARE
    year TEXT;
    sequence_num INTEGER;
    new_code TEXT;
BEGIN
    year := TO_CHAR(NOW(), 'YYYY');
    
    SELECT COUNT(*) + 1 INTO sequence_num
    FROM projects
    WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    
    new_code := 'PRJ-' || year || '-' || LPAD(sequence_num::TEXT, 4, '0');
    RETURN new_code;
END;
$$ language 'plpgsql';

-- Function: Generate survey code
CREATE OR REPLACE FUNCTION generate_survey_code()
RETURNS TEXT AS $$
DECLARE
    year TEXT;
    sequence_num INTEGER;
    new_code TEXT;
BEGIN
    year := TO_CHAR(NOW(), 'YYYY');
    
    SELECT COUNT(*) + 1 INTO sequence_num
    FROM surveys
    WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    
    new_code := 'SRV-' || year || '-' || LPAD(sequence_num::TEXT, 4, '0');
    RETURN new_code;
END;
$$ language 'plpgsql';

-- Function: Calculate total damage for survey
CREATE OR REPLACE FUNCTION calculate_survey_damage(p_survey_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_is_critical BOOLEAN;
    v_total_struktur DECIMAL(10,6);
    v_total_arsitektur DECIMAL(10,6);
    v_total_utilitas DECIMAL(10,6);
    v_total_finishing DECIMAL(10,6);
    v_total DECIMAL(10,6);
    v_kategori damage_category;
BEGIN
    -- Check if critical
    SELECT is_critical INTO v_is_critical
    FROM surveys WHERE id = p_survey_id;
    
    IF v_is_critical THEN
        v_total := 100;
        v_kategori := 'berat';
    ELSE
        -- Calculate by category
        SELECT COALESCE(SUM(nilai_hasil), 0) INTO v_total_struktur
        FROM components WHERE survey_id = p_survey_id AND kategori = 'struktur';
        
        SELECT COALESCE(SUM(nilai_hasil), 0) INTO v_total_arsitektur
        FROM components WHERE survey_id = p_survey_id AND kategori = 'arsitektur';
        
        SELECT COALESCE(SUM(nilai_hasil), 0) INTO v_total_utilitas
        FROM components WHERE survey_id = p_survey_id AND kategori = 'utilitas';
        
        SELECT COALESCE(SUM(nilai_hasil), 0) INTO v_total_finishing
        FROM components WHERE survey_id = p_survey_id AND kategori = 'finishing';
        
        v_total := v_total_struktur + v_total_arsitektur + v_total_utilitas + v_total_finishing;
        
        -- Determine category
        IF v_total <= 30 THEN
            v_kategori := 'ringan';
        ELSIF v_total <= 45 THEN
            v_kategori := 'sedang';
        ELSE
            v_kategori := 'berat';
        END IF;
    END IF;
    
    v_result := jsonb_build_object(
        'is_critical', v_is_critical,
        'total_struktur', v_total_struktur,
        'total_arsitektur', v_total_arsitektur,
        'total_utilitas', v_total_utilitas,
        'total_finishing', v_total_finishing,
        'total', v_total,
        'kategori', v_kategori
    );
    
    -- Update results table
    INSERT INTO results (
        survey_id, is_critical, total_kerusakan_struktur, 
        total_kerusakan_arsitektur, total_kerusakan_utilitas,
        total_kerusakan_finishing, total_kerusakan, kategori_kerusakan,
        calculated_at
    ) VALUES (
        p_survey_id, v_is_critical, v_total_struktur,
        v_total_arsitektur, v_total_utilitas,
        v_total_finishing, v_total, v_kategori,
        NOW()
    )
    ON CONFLICT (survey_id) DO UPDATE SET
        is_critical = EXCLUDED.is_critical,
        total_kerusakan_struktur = EXCLUDED.total_kerusakan_struktur,
        total_kerusakan_arsitektur = EXCLUDED.total_kerusakan_arsitektur,
        total_kerusakan_utilitas = EXCLUDED.total_kerusakan_utilitas,
        total_kerusakan_finishing = EXCLUDED.total_kerusakan_finishing,
        total_kerusakan = EXCLUDED.total_kerusakan,
        kategori_kerusakan = EXCLUDED.kategori_kerusakan,
        calculated_at = EXCLUDED.calculated_at,
        updated_at = NOW();
    
    RETURN v_result;
END;
$$ language 'plpgsql';

-- Function: Log workflow transition
CREATE OR REPLACE FUNCTION log_workflow_transition(
    p_survey_id UUID,
    p_from_status workflow_status,
    p_to_status workflow_status,
    p_actor_id UUID,
    p_action TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
    v_project_id UUID;
    v_actor_role user_role;
BEGIN
    -- Get project_id
    SELECT project_id INTO v_project_id FROM surveys WHERE id = p_survey_id;
    
    -- Get actor role
    SELECT role INTO v_actor_role FROM users WHERE id = p_actor_id;
    
    -- Insert log
    INSERT INTO workflow_logs (
        survey_id, project_id, from_status, to_status,
        actor_id, actor_role, action, note
    ) VALUES (
        p_survey_id, v_project_id, p_from_status, p_to_status,
        p_actor_id, v_actor_role, p_action, p_note
    )
    RETURNING id INTO v_log_id;
    
    -- Update survey status
    UPDATE surveys SET 
        status = p_to_status,
        updated_at = NOW()
    WHERE id = p_survey_id;
    
    -- Update project status
    UPDATE projects SET 
        status_workflow = p_to_status,
        updated_at = NOW()
    WHERE id = v_project_id;
    
    RETURN v_log_id;
END;
$$ language 'plpgsql';

-- ============================================================
-- 7. INITIAL DATA
-- ============================================================

-- Insert default component definitions (struktur)
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('P001', 'Pondasi Tapak Beton', 'struktur', 'pondasi', 0.075, 'm³', 1),
('P002', 'Pondasi Telapak Beton', 'struktur', 'pondasi', 0.075, 'm³', 2),
('P003', 'Sloof Beton', 'struktur', 'pondasi', 0.075, 'm³', 3),
('K001', 'Kolom K1 (Kolom Utama)', 'struktur', 'kolom', 0.120, 'm³', 4),
('K002', 'Kolom K2 (Kolom Primer)', 'struktur', 'kolom', 0.100, 'm³', 5),
('B001', 'Balok B1 (Balok Utama)', 'struktur', 'balok', 0.100, 'm³', 6),
('B002', 'Balok B2 (Balok Sekunder)', 'struktur', 'balok', 0.080, 'm³', 7),
('T001', 'Tangga Beton', 'struktur', 'tangga', 0.050, 'm³', 8),
('PL01', 'Plat Lantai Beton', 'struktur', 'plat', 0.150, 'm³', 9),
('PL02', 'Plat Atap Beton', 'struktur', 'plat', 0.100, 'm³', 10),
('A001', 'Rangka Atap Baja', 'struktur', 'atap', 0.075, 'm²', 11),
('A002', 'Rangka Atap Kayu', 'struktur', 'atap', 0.075, 'm²', 12);

-- Insert default component definitions (arsitektur)
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('D001', 'Dinding Bata Merah', 'arsitektur', 'dinding', 0.080, 'm²', 13),
('D002', 'Dinding Bata Ringan', 'arsitektur', 'dinding', 0.080, 'm²', 14),
('D003', 'Dinding Partisi Gypsum', 'arsitektur', 'dinding', 0.040, 'm²', 15),
('L001', 'Lantai Keramik', 'arsitektur', 'lantai', 0.050, 'm²', 16),
('L002', 'Lantai Granit', 'arsitektur', 'lantai', 0.050, 'm²', 17),
('L003', 'Lantai Vinyl', 'arsitektur', 'lantai', 0.040, 'm²', 18),
('KF01', 'Kusen Pintu Kayu', 'arsitektur', 'kusen', 0.030, 'unit', 19),
('KF02', 'Kusen Jendela Kayu', 'arsitektur', 'kusen', 0.025, 'unit', 20),
('KF03', 'Kusen Pintu Aluminium', 'arsitektur', 'kusen', 0.030, 'unit', 21),
('KF04', 'Kusen Jendela Aluminium', 'arsitektur', 'kusen', 0.025, 'unit', 22),
('PT01', 'Pintu Panel Kayu', 'arsitektur', 'pintu', 0.020, 'unit', 23),
('PT02', 'Pintu Flush Door', 'arsitektur', 'pintu', 0.020, 'unit', 24),
('JN01', 'Jendela Kaca', 'arsitektur', 'jendela', 0.015, 'unit', 25),
('JN02', 'Jendela Nako', 'arsitektur', 'jendela', 0.015, 'unit', 26);

-- Insert default component definitions (finishing)
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('FP01', 'Plafond Gypsum', 'finishing', 'plafond', 0.040, 'm²', 27),
('FP02', 'Plafond Akustik', 'finishing', 'plafond', 0.040, 'm²', 28),
('FP03', 'Plafond PVC', 'finishing', 'plafond', 0.035, 'm²', 29),
('FD01', 'Finishing Cat Dinding', 'finishing', 'dinding', 0.030, 'm²', 30),
('FD02', 'Finishing Wallpaper', 'finishing', 'dinding', 0.025, 'm²', 31),
('FD03', 'Finishing Pelapis Dinding', 'finishing', 'dinding', 0.030, 'm²', 32),
('FK01', 'Finishing Cat Kusen', 'finishing', 'kusen', 0.015, 'm²', 33),
('FK02', 'Finishing Cat Pintu', 'finishing', 'pintu', 0.015, 'm²', 34),
('FJ01', 'Finishing Cat Jendela', 'finishing', 'jendela', 0.010, 'm²', 35);

-- Insert default component definitions (utilitas)
INSERT INTO component_definitions (kode_komponen, nama_komponen, kategori, sub_kategori, bobot_komponen, satuan, urutan) VALUES
('IL01', 'Instalasi Listrik LV', 'utilitas', 'listrik', 0.030, 'm²', 36),
('IL02', 'Instalasi Stop Kontak', 'utilitas', 'listrik', 0.010, 'titik', 37),
('IL03', 'Instalasi Lampu', 'utilitas', 'listrik', 0.015, 'titik', 38),
('IA01', 'Instalasi Air Bersih', 'utilitas', 'air', 0.025, 'm²', 39),
('IA02', 'Instalasi Keran Air', 'utilitas', 'air', 0.010, 'titik', 40),
('IA03', 'Instalasi Sanitair', 'utilitas', 'air', 0.020, 'unit', 41),
('DR01', 'Drainase Limbah', 'utilitas', 'drainase', 0.020, 'm', 42),
('DR02', 'Septic Tank', 'utilitas', 'drainase', 0.015, 'unit', 43),
('DR03', 'Grease Trap', 'utilitas', 'drainase', 0.010, 'unit', 44);

-- ============================================================
-- SCHEMA VERSION
-- ============================================================

COMMENT ON DATABASE current_database() IS 'SPKBG Database Schema v1.0.0';
