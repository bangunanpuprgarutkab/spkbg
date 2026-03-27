-- ============================================================================
-- DATABASE MIGRATION: ADVANCED FEATURES
-- Smart AI Engineering Platform - SPKBG
-- 
-- Tables Added:
-- - item_mappings (auto mapping Perbup → komponen)
-- - repair_recommendations (sistem rekomendasi perbaikan)
-- - rab_documents (estimasi RAB lengkap)
-- ============================================================================

-- ============================================================================
-- 1. ITEM MAPPINGS (Auto Mapping Perbup → Komponen)
-- ============================================================================

CREATE TABLE IF NOT EXISTS item_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_name TEXT NOT NULL,
    component_category TEXT,
    item_name TEXT NOT NULL,
    kode_item TEXT NOT NULL,
    cost_standard_id UUID REFERENCES cost_standards(id),
    confidence NUMERIC(5, 4) NOT NULL DEFAULT 0,
    method TEXT CHECK (method IN ('rule', 'fuzzy', 'ai', 'manual')),
    verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(component_name, item_name)
);

COMMENT ON TABLE item_mappings IS 'Mapping antara komponen bangunan dan item Perbup SHS';

CREATE INDEX idx_item_mappings_component ON item_mappings(component_name);
CREATE INDEX idx_item_mappings_verified ON item_mappings(verified);
CREATE INDEX idx_item_mappings_confidence ON item_mappings(confidence);

-- ============================================================================
-- 2. REPAIR RECOMMENDATIONS (Sistem Rekomendasi Perbaikan)
-- ============================================================================

CREATE TABLE IF NOT EXISTS repair_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_type TEXT NOT NULL,
    classification VARCHAR(1) NOT NULL CHECK (classification IN ('1', '2', '3', '4', '5', '6', '7')),
    severity TEXT CHECK (severity IN ('ringan', 'sedang', 'berat')),
    rekomendasi_teknis TEXT NOT NULL,
    metode_perbaikan TEXT NOT NULL,
    materials TEXT[] DEFAULT '{}',
    peralatan TEXT[] DEFAULT '{}',
    estimasi_waktu TEXT,
    catatan_safety TEXT[] DEFAULT '{}',
    ai_generated BOOLEAN DEFAULT false,
    verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(component_type, classification)
);

COMMENT ON TABLE repair_recommendations IS 'Rekomendasi perbaikan berbasis komponen dan klasifikasi';

CREATE INDEX idx_repair_recommendations_component ON repair_recommendations(component_type);
CREATE INDEX idx_repair_recommendations_classification ON repair_recommendations(classification);

-- Survey-specific recommendations
CREATE TABLE IF NOT EXISTS survey_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    recommendation_id UUID REFERENCES repair_recommendations(id),
    custom_rekomendasi TEXT,
    is_applied BOOLEAN DEFAULT false,
    applied_at TIMESTAMP WITH TIME ZONE,
    applied_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_survey_recommendations_survey ON survey_recommendations(survey_id);
CREATE INDEX idx_survey_recommendations_component ON survey_recommendations(component_id);

-- ============================================================================
-- 3. RAB DOCUMENTS (Estimasi RAB Lengkap)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rab_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    kode_rab TEXT NOT NULL UNIQUE,
    nama_pekerjaan TEXT NOT NULL,
    lokasi TEXT,
    tahun_anggaran INTEGER NOT NULL,
    
    -- RAB Structure (JSONB for flexibility)
    sections JSONB NOT NULL DEFAULT '[]',
    
    -- Financial Summary
    jumlah_harga NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ppn NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_harga NUMERIC(15, 2) NOT NULL DEFAULT 0,
    dibulatkan NUMERIC(15, 2) NOT NULL DEFAULT 0,
    
    -- Terbilang
    terbilang TEXT,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'approved')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE rab_documents IS 'Dokumen Rencana Anggaran Biaya (RAB)';

CREATE INDEX idx_rab_documents_survey ON rab_documents(survey_id);
CREATE INDEX idx_rab_documents_project ON rab_documents(project_id);
CREATE INDEX idx_rab_documents_kode ON rab_documents(kode_rab);
CREATE INDEX idx_rab_documents_status ON rab_documents(status);

-- RAB Versions for audit trail
CREATE TABLE IF NOT EXISTS rab_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rab_id UUID NOT NULL REFERENCES rab_documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    sections JSONB NOT NULL,
    jumlah_harga NUMERIC(15, 2) NOT NULL,
    total_harga NUMERIC(15, 2) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    change_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_rab_versions_rab ON rab_versions(rab_id);

-- ============================================================================
-- 4. UPDATE EXISTING TABLES
-- ============================================================================

-- Add AI fields to components
ALTER TABLE components
    ADD COLUMN IF NOT EXISTS ai_suggested_classification VARCHAR(1) CHECK (ai_suggested_classification IN ('1', '2', '3', '4', '5', '6', '7')),
    ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(5, 4),
    ADD COLUMN IF NOT EXISTS ai_damage_type TEXT CHECK (ai_damage_type IN ('retak', 'spalling', 'korosi_tulangan', 'kerusakan_finishing', 'pondasi_bergeser', 'kolom_patah', 'tidak_terdeteksi')),
    ADD COLUMN IF NOT EXISTS matched_cost_standard_id UUID REFERENCES cost_standards(id),
    ADD COLUMN IF NOT EXISTS mapping_confidence NUMERIC(5, 4),
    ADD COLUMN IF NOT EXISTS mapping_method TEXT CHECK (mapping_method IN ('rule', 'fuzzy', 'ai', 'manual'));

-- Add RAB reference to cost_estimations
ALTER TABLE cost_estimations
    ADD COLUMN IF NOT EXISTS rab_id UUID REFERENCES rab_documents(id),
    ADD COLUMN IF NOT EXISTS rab_item_no INTEGER;

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

-- Item mappings RLS
ALTER TABLE item_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Item mappings viewable by all authenticated"
    ON item_mappings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Item mappings editable by admin"
    ON item_mappings FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

-- Repair recommendations RLS
ALTER TABLE repair_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Repair recommendations viewable by all authenticated"
    ON repair_recommendations FOR SELECT
    TO authenticated
    USING (true);

-- Survey recommendations RLS
ALTER TABLE survey_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Survey recommendations viewable by survey access"
    ON survey_recommendations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM surveys s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = survey_recommendations.survey_id
            AND (
                p.created_by = auth.uid()
                OR p.assigned_surveyor = auth.uid()
                OR p.assigned_verifikator = auth.uid()
                OR p.assigned_approver = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.id = auth.uid()
                    AND u.role = 'admin'
                )
            )
        )
    );

-- RAB documents RLS
ALTER TABLE rab_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RAB documents viewable by survey access"
    ON rab_documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM surveys s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = rab_documents.survey_id
            AND (
                p.created_by = auth.uid()
                OR p.assigned_surveyor = auth.uid()
                OR p.assigned_verifikator = auth.uid()
                OR p.assigned_approver = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.id = auth.uid()
                    AND u.role = 'admin'
                )
            )
        )
    );

-- ============================================================================
-- 6. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_item_mappings_updated_at BEFORE UPDATE ON item_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_repair_recommendations_updated_at BEFORE UPDATE ON repair_recommendations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rab_documents_updated_at BEFORE UPDATE ON rab_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_mapping_usage(p_component_name TEXT)
RETURNS void AS $$
BEGIN
    UPDATE item_mappings
    SET usage_count = usage_count + 1,
        updated_at = now()
    WHERE component_name = p_component_name;
END;
$$ LANGUAGE plpgsql;

-- Function to create RAB version on update
CREATE OR REPLACE FUNCTION create_rab_version()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.sections IS DISTINCT FROM NEW.sections THEN
        INSERT INTO rab_versions (
            rab_id,
            version_number,
            sections,
            jumlah_harga,
            total_harga,
            created_by,
            change_notes
        )
        SELECT
            NEW.id,
            COALESCE((SELECT MAX(version_number) FROM rab_versions WHERE rab_id = NEW.id), 0) + 1,
            OLD.sections,
            OLD.jumlah_harga,
            OLD.total_harga,
            NEW.updated_at,
            'Auto version on update'
        FROM rab_documents
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_rab_version_trigger
    AFTER UPDATE ON rab_documents
    FOR EACH ROW
    EXECUTE FUNCTION create_rab_version();

-- ============================================================================
-- 7. INITIAL DATA (Repair Recommendations)
-- ============================================================================

INSERT INTO repair_recommendations (component_type, classification, severity, rekomendasi_teknis, metode_perbaikan, materials, peralatan, estimasi_waktu, catatan_safety) VALUES
-- Dinding
('dinding', '1', 'ringan', 'Tidak perlu perbaikan struktural, hanya perawatan rutin', 'Pembersihan dan pengecekan berkala', ARRAY['Deterjen', 'Sikat', 'Air'], ARRAY['Sikat keras', 'Kain lap'], '1 hari', ARRAY['Gunakan APD standar']),
('dinding', '2', 'ringan', 'Perbaikan retak ringan dengan plester ulang', 'Injeksi retak + plesteran lokal', ARRAY['Semen PC', 'Pasir halus', 'Epoxy resin', 'Injeksi port'], ARRAY['Mesin injeksi', 'Trowel', 'Sikat besi'], '2-3 hari', ARRAY['Kenakan masker debu', 'Gunakan sarung tangan']),
('dinding', '3', 'sedang', 'Perbaikan retak sedang dengan penguatan', 'Injeksi epoxy + wire mesh + plester ulang', ARRAY['Epoxy resin', 'Wire mesh', 'Semen PC', 'Pasir halus', 'Bonding agent'], ARRAY['Mesin injeksi', 'Gerinda', 'Trowel', 'Wire cutter'], '3-5 hari', ARRAY['Ventilasi baik saat menggunakan epoxy', 'APD lengkap']),
('dinding', '4', 'sedang', 'Perbaikan kerusakan lokal dengan pembetonan ulang', 'Bongkar bagian rusak → tulangan tambahan → bekisting → cor ulang', ARRAY['Beton K-225', 'Bekisting', 'Tulangan tambahan', 'Sika additive'], ARRAY['Concrete mixer', 'Vibrator', 'Trowel', 'Cetok'], '5-7 hari', ARRAY['Pengamanan area kerja', 'Tanda bahaya', 'APD lengkap']),
('dinding', '5', 'berat', 'Penggantian dinding sebagian dengan struktur baru', 'Bongkar 50-70% dinding → pasang tulangan baru → cor ulang', ARRAY['Beton K-250', 'Bekisting', 'Tulangan D13', 'Sika additive', 'Batu bata'], ARRAY['Concrete mixer', 'Vibrator', 'Pompa cor', 'Gerinda'], '7-14 hari', ARRAY['Pengamanan struktur sementara', 'Pantau struktur tetangga', 'Ahli struktur on-site']),
('dinding', '6', 'berat', 'Rekonstruksi dinding besar-besaran', 'Bongkar total dinding → fondasi baru → dinding baru', ARRAY['Beton K-300', 'Bekisting berkualitas tinggi', 'Tulangan D16', 'Waterstop'], ARRAY['Heavy equipment', 'Concrete pump', 'Vibrator', 'Rebar cutter'], '14-21 hari', ARRAY['Izin khusus', 'Engineer struktur wajib', 'Pantau bangunan sekitar']),
('dinding', '7', 'berat', 'DEMOLISH DAN BANGUN ULANG TOTAL', 'Bongkar total → desain ulang → konstruksi baru', ARRAY['Beton K-350+', 'Baja tulangan berkualitas tinggi', 'Waterproofing'], ARRAY['Heavy demolition equipment', 'Engineering survey tools'], '30+ hari', ARRAY['WAJIB konsultasi ahli struktur', 'Izin bongkar', 'Evakuasi area']),

-- Kolom
('kolom', '1', 'ringan', 'Perawatan permukaan', 'Cat ulang / coating pelindung', ARRAY['Cat epoxy', 'Thinner', 'Kanvas'], ARRAY['Kuas', 'Roller', 'Compressor'], '1 hari', ARRAY['Ventilasi baik']),
('kolom', '2', 'ringan', 'Repair spalling ringan', 'Bersihkan → bonding → mortar repair', ARRAY['Mortar repair', 'Bonding agent', 'Semen PC'], ARRAY['Trowel', 'Sikat besi', 'Compressor'], '2 hari', ARRAY['APD standar']),
('kolom', '3', 'sedang', 'Injeksi retak + patching', 'Injeksi epoxy → repair mortar → cat ulang', ARRAY['Epoxy injeksi', 'Repair mortar', 'Wire mesh'], ARRAY['Mesin injeksi', 'Trowel', 'Wire cutter'], '3-4 hari', ARRAY['Ventilasi epoxy', 'APD lengkap']),
('kolom', '4', 'sedang', 'Jacketing kolom setempat', 'Tambahan bekisting → tulangan tambahan → cor tambahan', ARRAY['Beton K-250', 'Bekisting', 'Tulangan D13', 'Coupler'], ARRAY['Concrete mixer', 'Vibrator', 'Rebar tools'], '5-7 hari', ARRAY['Support sementara', 'Pantau defleksi']),
('kolom', '5', 'berat', 'Full jacketing kolom', 'Selubung beton baru di sekeliling kolom existing', ARRAY['Beton K-300', 'Bekisting', 'Tulangan D16', 'Shear connector'], ARRAY['Concrete pump', 'Vibrator', 'Rebar bender'], '7-10 hari', ARRAY['Engineer on-site', 'Support sementara wajib']),
('kolom', '6', 'berat', 'Perkuatan kolom dengan CFRP/Steel plate', 'Wrapping CFRP atau steel plate bonding', ARRAY['CFRP sheet / Steel plate', 'Structural adhesive', 'Primer'], ARRAY['Rollers', 'Heating equipment', 'Clamps'], '7-14 hari', ARRAY['Ahli komposit wajib', 'Quality control strict']),
('kolom', '7', 'berat', 'GANTI KOLOM BARU / REKONSTRUKSI', 'Support struktur → bongkar kolom → kolom baru', ARRAY['Beton K-350', 'Tulangan D19', 'High-strength materials'], ARRAY['Heavy equipment', 'Temporary supports'], '14-30 hari', ARRAY['WAJIB ahli struktur', 'Izin khusus', 'Monitoring real-time']),

-- Pondasi
('pondasi', '1', 'ringan', 'Pengecekan dan dokumentasi', 'Survey kondisi → dokumentasi', ARRAY['Alat survey', 'Kamera'], ARRAY['Waterpass', 'Theodolite'], '1 hari', ARRAY['APD standar']),
('pondasi', '2', 'ringan', 'Perbaikan retak pondasi ringan', 'Injeksi epoxy pada retak', ARRAY['Epoxy injeksi', 'Port injeksi'], ARRAY['Mesin injeksi', 'Bor'], '2-3 hari', ARRAY['Kenakan masker']),
('pondasi', '3', 'sedang', 'Grouting pondasi', 'Injeksi grouting untuk perkuatan', ARRAY['Grouting material', 'Admixture'], ARRAY['Grouting pump', 'Mixer'], '3-5 hari', ARRAY['Ventilasi']),
('pondasi', '4', 'sedang', 'Underpinning setempat', 'Tambahan pondasi mikropile atau jet grouting', ARRAY['Mikropile', 'Beton grout', 'Baja'], ARRAY['Drilling rig', 'Grouting equipment'], '7-14 hari', ARRAY['Ahli fondasi wajib', 'Monitoring settlement']),
('pondasi', '5', 'berat', 'Perkuatan pondasi dengan tiang pancang tambahan', 'Tiang pancang baru + pile cap baru', ARRAY['Tiang pancang', 'Pile cap beton', 'Tulangan'], ARRAY['Piling rig', 'Concrete equipment'], '14-21 hari', ARRAY['Engineer geoteknik wajib', 'Noise control']),
('pondasi', '6', 'berat', 'Rekonstruksi pondasi parsial', 'Bongkar pondasi rusak → pondasi baru', ARRAY['Beton K-300', 'Tiang pancang', 'Waterproofing'], ARRAY['Heavy equipment', 'Dewatering system'], '21-30 hari', ARRAY['Ahli struktur + geoteknik', 'Izin khusus']),
('pondasi', '7', 'berat', 'REKONSTRUKSI PONDASI TOTAL', 'Lift building / underpinning total', ARRAY['High-capacity piles', 'Grade beam baru', 'Void formers'], ARRAY['Jacking system', 'Heavy equipment'], '30-60 hari', ARRAY['WAJIB ahli struktur senior', 'Engineering peer review', 'Evakuasi'])

ON CONFLICT (component_type, classification) DO NOTHING;

-- ============================================================================
-- 8. VIEWS
-- ============================================================================

-- View for RAB summary
CREATE OR REPLACE VIEW rab_summary AS
SELECT 
    r.id,
    r.kode_rab,
    r.nama_pekerjaan,
    r.lokasi,
    r.tahun_anggaran,
    r.jumlah_harga,
    r.ppn,
    r.total_harga,
    r.dibulatkan,
    r.terbilang,
    r.status,
    r.created_at,
    p.nama_bangunan,
    p.alamat,
    s.kode_survey,
    jsonb_array_length(r.sections) as jumlah_section,
    (SELECT SUM(jsonb_array_length(s.items)) FROM jsonb_array_elements(r.sections) as s) as jumlah_item
FROM rab_documents r
JOIN projects p ON r.project_id = p.id
JOIN surveys s ON r.survey_id = s.id;

COMMENT ON VIEW rab_summary IS 'Ringkasan dokumen RAB untuk dashboard';
