-- ============================================================================
-- DATABASE MIGRATION: SMART AI ENGINEERING PLATFORM
-- Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
-- 
-- Tables Added:
-- - organizations (multi-tenancy)
-- - organization_members
-- - cost_standards (Perbup SHS)
-- - cost_estimations
-- - perbup_documents
-- - damage_images (AI detection)
-- - project_summaries (view materialized)
-- ============================================================================

-- ============================================================================
-- 1. ORGANIZATIONS (Multi-tenancy)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('pemerintah', 'swasta', 'bumn', 'universitas', 'lainnya')),
    alamat TEXT,
    provinsi VARCHAR(100),
    kabupaten VARCHAR(100),
    telepon VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE organizations IS 'Master data organisasi untuk multi-tenancy';

-- Organization members
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('org_admin', 'project_manager', 'member')),
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- ============================================================================
-- 2. COST STANDARDS (Perbup SHS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_standards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode_item VARCHAR(100) NOT NULL,
    nama_item TEXT NOT NULL,
    satuan VARCHAR(50) NOT NULL,
    harga_satuan DECIMAL(15, 2) NOT NULL,
    sumber TEXT NOT NULL, -- Perbup No. X Tahun Y
    tahun INTEGER NOT NULL,
    kategori VARCHAR(50) CHECK (kategori IN ('material', 'upah', 'alat')),
    sub_kategori VARCHAR(100),
    provinsi VARCHAR(100),
    kabupaten VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE cost_standards IS 'Standar harga satuan dari Perbup Kabupaten Garut';

CREATE INDEX idx_cost_standards_kabupaten ON cost_standards(kabupaten);
CREATE INDEX idx_cost_standards_nama ON cost_standards USING gin(to_tsvector('indonesian', nama_item));

-- Perbup documents
CREATE TABLE IF NOT EXISTS perbup_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama VARCHAR(255) NOT NULL,
    nomor VARCHAR(100) NOT NULL,
    tahun INTEGER NOT NULL,
    kabupaten VARCHAR(100) NOT NULL,
    file_url TEXT NOT NULL,
    is_parsed BOOLEAN DEFAULT false,
    parsed_at TIMESTAMP WITH TIME ZONE,
    total_items INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- 3. COST ESTIMATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_estimations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    component_id UUID REFERENCES components(id) ON DELETE SET NULL,
    item_pekerjaan TEXT NOT NULL,
    volume DECIMAL(15, 4) NOT NULL,
    satuan VARCHAR(50) NOT NULL,
    harga_satuan DECIMAL(15, 2) NOT NULL,
    total_biaya DECIMAL(15, 2) NOT NULL,
    cost_standard_id UUID REFERENCES cost_standards(id),
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_cost_estimations_survey ON cost_estimations(survey_id);
CREATE INDEX idx_cost_estimations_project ON cost_estimations(project_id);

-- ============================================================================
-- 4. DAMAGE IMAGES (AI Detection)
-- ============================================================================

CREATE TABLE IF NOT EXISTS damage_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    ai_result JSONB, -- Store AI detection result
    confidence DECIMAL(5, 4), -- 0.0000 to 1.0000
    damage_type VARCHAR(50) CHECK (damage_type IN ('retak', 'spalling', 'korosi_tulangan', 'kerusakan_finishing', 'pondasi_bergeser', 'kolom_patah', 'tidak_terdeteksi')),
    suggested_classification VARCHAR(1) CHECK (suggested_classification IN ('1', '2', '3', '4', '5', '6', '7')),
    user_verified BOOLEAN DEFAULT false,
    user_override VARCHAR(1) CHECK (user_override IN ('1', '2', '3', '4', '5', '6', '7')),
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_damage_images_survey ON damage_images(survey_id);
CREATE INDEX idx_damage_images_component ON damage_images(component_id);

COMMENT ON TABLE damage_images IS 'Foto kerusakan dengan hasil analisis AI';

-- ============================================================================
-- 5. UPDATE EXISTING TABLES
-- ============================================================================

-- Add organization_id to existing tables
ALTER TABLE projects 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id),
    ADD COLUMN IF NOT EXISTS provinsi VARCHAR(100),
    ADD COLUMN IF NOT EXISTS kabupaten VARCHAR(100),
    ADD COLUMN IF NOT EXISTS kecamatan VARCHAR(100),
    ADD COLUMN IF NOT EXISTS kode_pos VARCHAR(10),
    ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
    ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

ALTER TABLE surveys
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

ALTER TABLE components
    ADD COLUMN IF NOT EXISTS ai_suggested_classification VARCHAR(1) CHECK (ai_suggested_classification IN ('1', '2', '3', '4', '5', '6', '7')),
    ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(5, 4);

-- ============================================================================
-- 6. VIEWS FOR DASHBOARD
-- ============================================================================

CREATE OR REPLACE VIEW project_summaries AS
SELECT 
    p.id,
    p.kode_project,
    p.nama_bangunan,
    p.alamat,
    p.provinsi,
    p.kabupaten,
    p.status_workflow,
    p.organization_id,
    o.name as organization_name,
    p.created_by,
    p.created_at,
    p.updated_at,
    (
        SELECT jsonb_build_object(
            'total_kerusakan', r.total_kerusakan,
            'kategori_kerusakan', r.kategori_kerusakan,
            'is_critical', r.is_critical
        )
        FROM results r
        WHERE r.survey_id = (
            SELECT s.id FROM surveys s 
            WHERE s.project_id = p.id 
            ORDER BY s.created_at DESC 
            LIMIT 1
        )
        LIMIT 1
    ) as latest_survey,
    (
        SELECT COALESCE(SUM(ce.total_biaya), 0)
        FROM cost_estimations ce
        WHERE ce.project_id = p.id
    ) as total_estimasi
FROM projects p
LEFT JOIN organizations o ON p.organization_id = o.id
WHERE p.status_workflow != 'dihapus';

CREATE OR REPLACE VIEW survey_summaries AS
SELECT 
    s.id as survey_id,
    s.project_id,
    p.organization_id,
    s.kode_survey,
    s.tanggal_survey,
    s.surveyor_id,
    s.status,
    s.is_draft,
    s.is_critical,
    r.total_kerusakan,
    r.kategori_kerusakan,
    p.nama_bangunan,
    p.alamat,
    p.provinsi,
    p.kabupaten,
    s.created_at
FROM surveys s
JOIN projects p ON s.project_id = p.id
LEFT JOIN results r ON r.survey_id = s.id;

-- ============================================================================
-- 7. RLS POLICIES
-- ============================================================================

-- Organizations RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizations viewable by members"
    ON organizations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = organizations.id
            AND om.user_id = auth.uid()
            AND om.is_active = true
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

CREATE POLICY "Organizations editable by org_admin"
    ON organizations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = organizations.id
            AND om.user_id = auth.uid()
            AND om.role = 'org_admin'
            AND om.is_active = true
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

-- Cost standards RLS
ALTER TABLE cost_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cost standards viewable by all authenticated"
    ON cost_standards FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Cost standards editable by admin only"
    ON cost_standards FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

-- Damage images RLS
ALTER TABLE damage_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Damage images viewable by survey access"
    ON damage_images FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM surveys s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = damage_images.survey_id
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

CREATE POLICY "Damage images insertable by surveyor"
    ON damage_images FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM surveys s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = damage_images.survey_id
            AND (
                p.created_by = auth.uid()
                OR p.assigned_surveyor = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.id = auth.uid()
                    AND u.role = 'admin'
                )
            )
        )
    );

-- Cost estimations RLS
ALTER TABLE cost_estimations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cost estimations viewable by survey access"
    ON cost_estimations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM surveys s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = cost_estimations.survey_id
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
-- 8. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cost_standards_updated_at BEFORE UPDATE ON cost_standards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cost_estimations_updated_at BEFORE UPDATE ON cost_estimations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate total estimasi for survey
CREATE OR REPLACE FUNCTION calculate_survey_estimasi(p_survey_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_total DECIMAL;
BEGIN
    SELECT COALESCE(SUM(total_biaya), 0)
    INTO v_total
    FROM cost_estimations
    WHERE survey_id = p_survey_id;
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. INITIAL DATA
-- ============================================================================

-- Insert sample cost standards (Perbup SHS Garut - contoh)
INSERT INTO cost_standards (kode_item, nama_item, satuan, harga_satuan, sumber, tahun, kategori, kabupaten) VALUES
('A.1.1.1', 'Pembersihan lapangan', 'm2', 15000, 'Perbup Garut No. 45 Tahun 2024', 2024, 'upah', 'Garut'),
('A.2.1.1', 'Urugan pasir urug', 'm3', 185000, 'Perbup Garut No. 45 Tahun 2024', 2024, 'material', 'Garut'),
('A.3.1.1', 'Pasangan batu kali 1 pc : 5 ps', 'm3', 1250000, 'Perbup Garut No. 45 Tahun 2024', 2024, 'upah', 'Garut'),
('A.4.1.1', 'Beton mutu K-225', 'm3', 1150000, 'Perbup Garut No. 45 Tahun 2024', 2024, 'material', 'Garut'),
('A.5.1.1', 'Plesteran 1 pc : 4 ps', 'm2', 85000, 'Perbup Garut No. 45 Tahun 2024', 2024, 'upah', 'Garut'),
('A.6.1.1', 'Cat tembok', 'm2', 35000, 'Perbup Garut No. 45 Tahun 2024', 2024, 'upah', 'Garut'),
('B.1.1.1', 'Beton kolom K-250', 'm3', 1250000, 'Perbup Garut No. 45 Tahun 2024', 2024, 'material', 'Garut'),
('B.2.1.1', 'Bekisting kolom', 'm2', 95000, 'Perbup Garut No. 45 Tahun 2024', 2024, 'alat', 'Garut'),
('C.1.1.1', 'Perbaikan retak dinding', 'm', 75000, 'Perbup Garut No. 45 Tahun 2024', 2024, 'upah', 'Garut'),
('C.2.1.1', 'Injeksi epoxy', 'm', 125000, 'Perbup Garut No. 45 Tahun 2024', 2024, 'material', 'Garut')
ON CONFLICT DO NOTHING;
