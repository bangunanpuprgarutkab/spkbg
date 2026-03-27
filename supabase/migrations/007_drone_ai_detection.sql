-- ============================================================================
-- DATABASE MIGRATION: DRONE & AI CRACK DETECTION
-- Smart AI Engineering Platform - SPKBG
-- 
-- Tables Added:
-- - drone_surveys (drone mission data)
-- - drone_images (drone captured images)
-- - geo_damages (geolocated damage detections)
-- ============================================================================

-- ============================================================================
-- 1. DRONE SURVEYS
-- ============================================================================

CREATE TABLE IF NOT EXISTS drone_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    drone_operator_id UUID NOT NULL REFERENCES users(id),
    
    -- Drone Info
    drone_model TEXT,
    drone_serial TEXT,
    
    -- Flight Info
    flight_date DATE NOT NULL,
    flight_duration INTEGER, -- minutes
    total_images INTEGER DEFAULT 0,
    processed_images INTEGER DEFAULT 0,
    
    -- Flight Parameters
    flight_altitude NUMERIC(10, 2), -- meters
    overlap_percentage INTEGER, -- e.g., 80 for 80% overlap
    gsd_cm_per_pixel NUMERIC(5, 2), -- Ground Sampling Distance
    
    -- Survey Area (GeoJSON Polygon)
    survey_area GEOGRAPHY(POLYGON, 4326),
    
    -- Weather
    weather_conditions TEXT,
    wind_speed NUMERIC(5, 2), -- m/s
    temperature NUMERIC(5, 2), -- celsius
    
    -- Status
    status TEXT DEFAULT 'planning' 
        CHECK (status IN ('planning', 'flying', 'uploading', 'processing', 'completed', 'failed')),
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE drone_surveys IS 'Drone flight missions for building surveys';

CREATE INDEX idx_drone_surveys_survey ON drone_surveys(survey_id);
CREATE INDEX idx_drone_surveys_project ON drone_surveys(project_id);
CREATE INDEX idx_drone_surveys_status ON drone_surveys(status);
CREATE INDEX idx_drone_surveys_date ON drone_surveys(flight_date);

-- ============================================================================
-- 2. DRONE IMAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS drone_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drone_survey_id UUID NOT NULL REFERENCES drone_surveys(id) ON DELETE CASCADE,
    survey_id UUID REFERENCES surveys(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    
    -- Storage
    original_url TEXT NOT NULL,
    processed_url TEXT,
    thumbnail_url TEXT,
    
    -- GPS Data (from EXIF)
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    altitude NUMERIC(10, 2),
    heading NUMERIC(6, 2), -- degrees (0-360)
    gimbal_pitch NUMERIC(5, 2), -- degrees
    
    -- Image Properties
    width INTEGER,
    height INTEGER,
    file_size INTEGER, -- bytes
    captured_at TIMESTAMP WITH TIME ZONE,
    
    -- GSD (Ground Sampling Distance)
    gsd_cm_per_pixel NUMERIC(5, 3),
    
    -- Processing
    is_processed BOOLEAN DEFAULT false,
    processing_status TEXT DEFAULT 'pending' 
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    processing_error TEXT,
    detected_damages INTEGER DEFAULT 0,
    
    -- EXIF Data (raw JSON)
    exif_data JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE drone_images IS 'Images captured by drone with GPS metadata';

CREATE INDEX idx_drone_images_survey ON drone_images(drone_survey_id);
CREATE INDEX idx_drone_images_project ON drone_images(project_id);
CREATE INDEX idx_drone_images_location ON drone_images USING GIST (
    ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)
);
CREATE INDEX idx_drone_images_status ON drone_images(processing_status);

-- ============================================================================
-- 3. GEO DAMAGES (AI Detected Damages with Location)
-- ============================================================================

CREATE TABLE IF NOT EXISTS geo_damages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drone_image_id UUID REFERENCES drone_images(id) ON DELETE CASCADE,
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    component_id UUID REFERENCES components(id) ON DELETE SET NULL,
    
    -- Location
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    altitude NUMERIC(10, 2),
    
    -- Damage Info
    damage_type TEXT NOT NULL 
        CHECK (damage_type IN ('crack', 'spalling', 'corrosion', 'delamination', 'settlement', 'other')),
    severity TEXT CHECK (severity IN ('ringan', 'sedang', 'berat')),
    classification VARCHAR(1) CHECK (classification IN ('1', '2', '3', '4', '5', '6', '7')),
    
    -- Measurements
    pixel_width NUMERIC(10, 2),
    pixel_length NUMERIC(10, 2),
    real_width_mm NUMERIC(10, 2),
    real_length_mm NUMERIC(10, 2),
    
    -- Bounding Box (relative to image: 0-1 normalized)
    bbox_x NUMERIC(5, 4),
    bbox_y NUMERIC(5, 4),
    bbox_width NUMERIC(5, 4),
    bbox_height NUMERIC(5, 4),
    
    -- AI Result
    ai_confidence NUMERIC(5, 4),
    ai_result JSONB,
    ai_model_version TEXT,
    
    -- Verification
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    engineer_classification VARCHAR(1) CHECK (engineer_classification IN ('1', '2', '3', '4', '5', '6', '7')),
    engineer_notes TEXT,
    
    -- Media
    cropped_image_url TEXT,
    annotated_image_url TEXT,
    full_image_url TEXT NOT NULL,
    
    -- Geometry for spatial queries
    location GEOGRAPHY(POINT, 4326),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE geo_damages IS 'AI-detected damages with precise GPS coordinates';

CREATE INDEX idx_geo_damages_image ON geo_damages(drone_image_id);
CREATE INDEX idx_geo_damages_project ON geo_damages(project_id);
CREATE INDEX idx_geo_damages_survey ON geo_damages(survey_id);
CREATE INDEX idx_geo_damages_location ON geo_damages USING GIST (location);
CREATE INDEX idx_geo_damages_type ON geo_damages(damage_type);
CREATE INDEX idx_geo_damages_severity ON geo_damages(severity);
CREATE INDEX idx_geo_damages_verified ON geo_damages(is_verified);

-- ============================================================================
-- 4. AI MODEL VERSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    model_type TEXT CHECK (model_type IN ('crack_detection', 'classification', 'segmentation')),
    
    -- Training Info
    training_dataset TEXT,
    training_epochs INTEGER,
    training_images INTEGER,
    accuracy NUMERIC(5, 4),
    precision NUMERIC(5, 4),
    recall NUMERIC(5, 4),
    f1_score NUMERIC(5, 4),
    
    -- Model Files
    model_url TEXT,
    config_url TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    UNIQUE(name, version)
);

COMMENT ON TABLE ai_models IS 'AI model versions for crack detection';

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

-- Drone surveys RLS
ALTER TABLE drone_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drone surveys viewable by project access"
    ON drone_surveys FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = drone_surveys.project_id
            AND (
                p.created_by = auth.uid()
                OR p.assigned_surveyor = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.id = auth.uid()
                    AND u.role IN ('admin', 'surveyor')
                )
            )
        )
    );

-- Drone images RLS
ALTER TABLE drone_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drone images viewable by survey access"
    ON drone_images FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM drone_surveys ds
            JOIN projects p ON ds.project_id = p.id
            WHERE ds.id = drone_images.drone_survey_id
            AND (
                p.created_by = auth.uid()
                OR p.assigned_surveyor = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.id = auth.uid()
                    AND u.role IN ('admin', 'surveyor', 'verifikator')
                )
            )
        )
    );

-- Geo damages RLS
ALTER TABLE geo_damages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Geo damages viewable by project access"
    ON geo_damages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = geo_damages.project_id
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

CREATE TRIGGER update_drone_surveys_updated_at BEFORE UPDATE ON drone_surveys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto set geometry point
CREATE OR REPLACE FUNCTION set_geo_damage_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude::float, NEW.latitude::float), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_geo_damage_location_trigger
    BEFORE INSERT OR UPDATE ON geo_damages
    FOR EACH ROW
    EXECUTE FUNCTION set_geo_damage_location();

-- Update drone survey processed count
CREATE OR REPLACE FUNCTION update_drone_survey_processed_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.processing_status = 'completed' AND OLD.processing_status != 'completed' THEN
        UPDATE drone_surveys
        SET processed_images = processed_images + 1
        WHERE id = NEW.drone_survey_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_drone_survey_processed_trigger
    AFTER UPDATE ON drone_images
    FOR EACH ROW
    EXECUTE FUNCTION update_drone_survey_processed_count();

-- ============================================================================
-- 7. VIEWS
-- ============================================================================

-- View: Drone Survey Summary
CREATE OR REPLACE VIEW drone_survey_summary AS
SELECT 
    ds.id,
    ds.survey_id,
    ds.project_id,
    ds.drone_model,
    ds.flight_date,
    ds.flight_duration,
    ds.total_images,
    ds.processed_images,
    ds.status,
    ds.flight_altitude,
    ds.gsd_cm_per_pixel,
    ds.weather_conditions,
    p.nama_bangunan,
    u.name as operator_name,
    (SELECT COUNT(*) FROM drone_images di WHERE di.drone_survey_id = ds.id) as image_count,
    (SELECT COUNT(*) FROM geo_damages gd 
     JOIN drone_images di ON gd.drone_image_id = di.id 
     WHERE di.drone_survey_id = ds.id) as damage_count,
    (SELECT COUNT(*) FROM geo_damages gd 
     JOIN drone_images di ON gd.drone_image_id = di.id 
     WHERE di.drone_survey_id = ds.id AND gd.is_verified = true) as verified_damage_count
FROM drone_surveys ds
JOIN projects p ON ds.project_id = p.id
JOIN users u ON ds.drone_operator_id = u.id;

COMMENT ON VIEW drone_survey_summary IS 'Summary view of drone surveys with statistics';

-- View: Damage Heatmap Data
CREATE OR REPLACE VIEW damage_heatmap AS
SELECT 
    gd.id,
    gd.project_id,
    gd.damage_type,
    gd.severity,
    gd.classification,
    gd.real_width_mm,
    gd.real_length_mm,
    gd.ai_confidence,
    gd.is_verified,
    ST_X(gd.location::geometry) as lng,
    ST_Y(gd.location::geometry) as lat
FROM geo_damages gd
WHERE gd.is_verified = true OR gd.ai_confidence > 0.7;

COMMENT ON VIEW damage_heatmap IS 'Verified/high-confidence damages for heatmap visualization';

-- ============================================================================
-- 8. SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert sample AI model
INSERT INTO ai_models (name, version, model_type, training_dataset, accuracy, is_active, is_default) VALUES
('crack-detector', 'v1.0', 'crack_detection', 'Concrete Crack Dataset + SDNET2018', 0.89, true, true),
('crack-detector', 'v1.1', 'crack_detection', 'Concrete Crack Dataset + Field Data', 0.92, false, false)
ON CONFLICT DO NOTHING;
