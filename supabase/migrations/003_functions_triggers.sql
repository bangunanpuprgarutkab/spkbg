-- ============================================================
-- FUNCTIONS & TRIGGERS - COMPLETE
-- Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
-- ============================================================

-- ============================================================
-- 1. UTILITY FUNCTIONS
-- ============================================================

-- Get classification value (1-7 to decimal)
CREATE OR REPLACE FUNCTION get_classification_value(p_klasifikasi damage_classification)
RETURNS DECIMAL(3,2) AS $$
BEGIN
    RETURN CASE p_klasifikasi
        WHEN '1' THEN 0.00
        WHEN '2' THEN 0.20
        WHEN '3' THEN 0.35
        WHEN '4' THEN 0.50
        WHEN '5' THEN 0.70
        WHEN '6' THEN 0.85
        WHEN '7' THEN 1.00
        ELSE 0.00
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get damage category from percentage
CREATE OR REPLACE FUNCTION get_damage_category(p_total DECIMAL(6,2))
RETURNS damage_category AS $$
BEGIN
    IF p_total <= 30 THEN
        RETURN 'ringan';
    ELSIF p_total <= 45 THEN
        RETURN 'sedang';
    ELSE
        RETURN 'berat';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if workflow transition is valid (sequential only)
CREATE OR REPLACE FUNCTION is_valid_workflow_transition(
    p_from workflow_status,
    p_to workflow_status
)
RETURNS BOOLEAN AS $$
DECLARE
    v_from_idx INTEGER;
    v_to_idx INTEGER;
    v_statuses workflow_status[] := ARRAY[
        'disposisi',
        'persiapan',
        'survey',
        'analisis',
        'penilaian',
        'diperiksa',
        'disetujui'
    ];
BEGIN
    -- Find indices
    v_from_idx := array_position(v_statuses, p_from);
    v_to_idx := array_position(v_statuses, p_to);
    
    -- Special case: rejection can happen from diperiksa to ditolak
    IF p_from = 'diperiksa' AND p_to = 'ditolak' THEN
        RETURN TRUE;
    END IF;
    
    -- Special case: return to survey from ditolak
    IF p_from = 'ditolak' AND p_to = 'survey' THEN
        RETURN TRUE;
    END IF;
    
    -- Normal case: must advance by 1 step only
    IF v_from_idx IS NOT NULL AND v_to_idx IS NOT NULL THEN
        RETURN v_to_idx = v_from_idx + 1;
    END IF;
    
    -- From null (initial) to first status
    IF p_from IS NULL AND p_to = 'disposisi' THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Generate project code
CREATE OR REPLACE FUNCTION generate_project_code()
RETURNS TEXT AS $$
DECLARE
    v_year TEXT;
    v_sequence INTEGER;
    v_code TEXT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(kode_project FROM 'PRJ-\d{4}-(\d{4})$') AS INTEGER)), 0) + 1
    INTO v_sequence
    FROM projects
    WHERE kode_project LIKE 'PRJ-' || v_year || '-%';
    
    v_code := 'PRJ-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Generate survey code
CREATE OR REPLACE FUNCTION generate_survey_code()
RETURNS TEXT AS $$
DECLARE
    v_year TEXT;
    v_sequence INTEGER;
    v_code TEXT;
BEGIN
    v_year := TO_CHAR(NOW(), 'YYYY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(kode_survey FROM 'SRV-\d{4}-(\d{4})$') AS INTEGER)), 0) + 1
    INTO v_sequence
    FROM surveys
    WHERE kode_survey LIKE 'SRV-' || v_year || '-%';
    
    v_code := 'SRV-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. CALCULATION FUNCTIONS
-- ============================================================

-- Calculate component value (nilai_hasil)
CREATE OR REPLACE FUNCTION calculate_component_value(
    p_volume_total DECIMAL(10,3),
    p_volume_rusak DECIMAL(10,3),
    p_klasifikasi damage_classification,
    p_bobot DECIMAL(5,4)
)
RETURNS DECIMAL(10,6) AS $$
DECLARE
    v_nilai DECIMAL(3,2);
BEGIN
    IF p_volume_total <= 0 OR p_klasifikasi IS NULL THEN
        RETURN 0;
    END IF;
    
    v_nilai := get_classification_value(p_klasifikasi);
    
    RETURN (p_volume_rusak / p_volume_total) * v_nilai * p_bobot;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate survey damage totals
CREATE OR REPLACE FUNCTION calculate_survey_damage(p_survey_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_is_critical BOOLEAN;
    v_has_critical_components BOOLEAN;
    v_total_struktur DECIMAL(10,6) := 0;
    v_total_arsitektur DECIMAL(10,6) := 0;
    v_total_utilitas DECIMAL(10,6) := 0;
    v_total_finishing DECIMAL(10,6) := 0;
    v_total DECIMAL(10,6) := 0;
    v_kategori damage_category;
    v_details JSONB := '[]'::JSONB;
    v_component RECORD;
BEGIN
    -- Check if survey has critical safety issues
    SELECT is_critical INTO v_is_critical
    FROM surveys WHERE id = p_survey_id;
    
    -- Check if any component has critical classification (7)
    SELECT EXISTS (
        SELECT 1 FROM components 
        WHERE survey_id = p_survey_id AND klasifikasi = '7'
    ) INTO v_has_critical_components;
    
    -- If critical, set total to 100 and category to BERAT
    IF v_is_critical OR v_has_critical_components THEN
        v_total := 100;
        v_kategori := 'berat';
        v_is_critical := TRUE;
    ELSE
        -- Calculate by category
        SELECT COALESCE(SUM(nilai_hasil), 0) INTO v_total_struktur
        FROM components 
        WHERE survey_id = p_survey_id AND kategori = 'struktur';
        
        SELECT COALESCE(SUM(nilai_hasil), 0) INTO v_total_arsitektur
        FROM components 
        WHERE survey_id = p_survey_id AND kategori = 'arsitektur';
        
        SELECT COALESCE(SUM(nilai_hasil), 0) INTO v_total_utilitas
        FROM components 
        WHERE survey_id = p_survey_id AND kategori = 'utilitas';
        
        SELECT COALESCE(SUM(nilai_hasil), 0) INTO v_total_finishing
        FROM components 
        WHERE survey_id = p_survey_id AND kategori = 'finishing';
        
        v_total := v_total_struktur + v_total_arsitektur + v_total_utilitas + v_total_finishing;
        
        -- Determine category
        v_kategori := get_damage_category(v_total);
        
        -- Build details array
        FOR v_component IN 
            SELECT 
                c.id AS komponen_id,
                c.kode_komponen,
                c.nama_komponen,
                c.kategori,
                c.volume_total,
                c.volume_rusak,
                c.klasifikasi,
                c.nilai_kerusakan,
                c.bobot_komponen,
                c.nilai_hasil
            FROM components c
            WHERE c.survey_id = p_survey_id
            ORDER BY c.kategori, c.kode_komponen
        LOOP
            v_details := v_details || jsonb_build_object(
                'komponen_id', v_component.komponen_id,
                'kode_komponen', v_component.kode_komponen,
                'nama_komponen', v_component.nama_komponen,
                'kategori', v_component.kategori,
                'volume_total', v_component.volume_total,
                'volume_rusak', v_component.volume_rusak,
                'klasifikasi', v_component.klasifikasi,
                'nilai_kerusakan', v_component.nilai_kerusakan,
                'bobot_komponen', v_component.bobot_komponen,
                'nilai_hasil', v_component.nilai_hasil
            );
        END LOOP;
    END IF;
    
    -- Build result JSON
    v_result := jsonb_build_object(
        'is_critical', v_is_critical,
        'has_critical_components', v_has_critical_components,
        'total_struktur', ROUND(v_total_struktur::numeric, 2),
        'total_arsitektur', ROUND(v_total_arsitektur::numeric, 2),
        'total_utilitas', ROUND(v_total_utilitas::numeric, 2),
        'total_finishing', ROUND(v_total_finishing::numeric, 2),
        'total', ROUND(v_total::numeric, 2),
        'kategori', v_kategori,
        'details', v_details
    );
    
    -- Update or insert results record
    INSERT INTO results (
        survey_id,
        is_critical,
        critical_reasons,
        total_kerusakan_struktur,
        total_kerusakan_arsitektur,
        total_kerusakan_utilitas,
        total_kerusakan_finishing,
        total_kerusakan,
        kategori_kerusakan,
        detail_perhitungan,
        calculated_at
    ) VALUES (
        p_survey_id,
        v_is_critical,
        CASE WHEN v_is_critical THEN 
            ARRAY[
                CASE WHEN v_has_critical_components THEN 'Komponen dengan klasifikasi 7 (hancur total)' END,
                CASE WHEN (SELECT has_kolom_patah FROM surveys WHERE id = p_survey_id) THEN 'Kolom patah' END,
                CASE WHEN (SELECT has_pondasi_bergeser FROM surveys WHERE id = p_survey_id) THEN 'Pondasi bergeser' END,
                CASE WHEN (SELECT has_struktur_runtuh FROM surveys WHERE id = p_survey_id) THEN 'Struktur runtuh' END
            ] FILTER (WHERE x IS NOT NULL)
        END,
        ROUND(v_total_struktur::numeric, 2),
        ROUND(v_total_arsitektur::numeric, 2),
        ROUND(v_total_utilitas::numeric, 2),
        ROUND(v_total_finishing::numeric, 2),
        ROUND(v_total::numeric, 2),
        v_kategori,
        v_details,
        NOW()
    )
    ON CONFLICT (survey_id) DO UPDATE SET
        is_critical = EXCLUDED.is_critical,
        critical_reasons = EXCLUDED.critical_reasons,
        total_kerusakan_struktur = EXCLUDED.total_kerusakan_struktur,
        total_kerusakan_arsitektur = EXCLUDED.total_kerusakan_arsitektur,
        total_kerusakan_utilitas = EXCLUDED.total_kerusakan_utilitas,
        total_kerusakan_finishing = EXCLUDED.total_kerusakan_finishing,
        total_kerusakan = EXCLUDED.total_kerusakan,
        kategori_kerusakan = EXCLUDED.kategori_kerusakan,
        detail_perhitungan = EXCLUDED.detail_perhitungan,
        calculated_at = EXCLUDED.calculated_at,
        updated_at = NOW();
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Validate workflow transition
CREATE OR REPLACE FUNCTION validate_workflow_transition(
    p_survey_id UUID,
    p_from workflow_status,
    p_to workflow_status
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_status workflow_status;
BEGIN
    -- Get current status
    SELECT status INTO v_current_status
    FROM surveys WHERE id = p_survey_id;
    
    -- Verify p_from matches current status
    IF p_from IS NOT NULL AND p_from != v_current_status THEN
        RAISE EXCEPTION 'Invalid from_status: %, current status is %', p_from, v_current_status;
    END IF;
    
    -- Validate transition
    IF NOT is_valid_workflow_transition(p_from, p_to) THEN
        RAISE EXCEPTION 'Invalid workflow transition from % to %', p_from, p_to;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. WORKFLOW FUNCTIONS
-- ============================================================

-- Log workflow transition
CREATE OR REPLACE FUNCTION log_workflow_transition(
    p_survey_id UUID,
    p_from_status workflow_status,
    p_to_status workflow_status,
    p_actor_id UUID,
    p_action TEXT,
    p_note TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
    v_project_id UUID;
    v_actor_role user_role;
    v_ip_address INET;
    v_user_agent TEXT;
BEGIN
    -- Get project_id
    SELECT project_id INTO v_project_id 
    FROM surveys WHERE id = p_survey_id;
    
    -- Get actor role
    SELECT role INTO v_actor_role FROM users WHERE id = p_actor_id;
    
    -- Get connection info (if available)
    v_ip_address := inet_client_addr();
    v_user_agent := current_setting('request.headers', true)::json->>'user-agent';
    
    -- Insert log
    INSERT INTO workflow_logs (
        survey_id,
        project_id,
        from_status,
        to_status,
        actor_id,
        actor_role,
        action,
        note,
        ip_address,
        user_agent,
        metadata
    ) VALUES (
        p_survey_id,
        v_project_id,
        p_from_status,
        p_to_status,
        p_actor_id,
        v_actor_role,
        p_action,
        p_note,
        v_ip_address,
        v_user_agent,
        p_metadata
    )
    RETURNING id INTO v_log_id;
    
    -- Update survey status
    UPDATE surveys SET 
        status = p_to_status,
        updated_at = NOW(),
        completed_at = CASE WHEN p_to_status = 'disetujui' THEN NOW() ELSE completed_at END
    WHERE id = p_survey_id;
    
    -- Update project status to match survey status
    UPDATE projects SET 
        status_workflow = p_to_status,
        updated_at = NOW()
    WHERE id = v_project_id;
    
    -- Trigger recalculation if moving to/from analysis
    IF p_to_status = 'analisis' OR p_from_status = 'survey' THEN
        PERFORM calculate_survey_damage(p_survey_id);
    END IF;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Execute workflow transition
CREATE OR REPLACE FUNCTION execute_workflow_transition(
    p_survey_id UUID,
    p_to_status workflow_status,
    p_note TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_status workflow_status;
    v_actor_id UUID := auth.uid();
    v_log_id UUID;
    v_result JSONB;
BEGIN
    -- Get current status
    SELECT status INTO v_current_status FROM surveys WHERE id = p_survey_id;
    
    -- Validate transition
    PERFORM validate_workflow_transition(p_survey_id, v_current_status, p_to_status);
    
    -- Determine action based on transition
    DECLARE
        v_action TEXT;
    BEGIN
        v_action := CASE
            WHEN p_to_status = 'persiapan' THEN 'prepare'
            WHEN p_to_status = 'survey' AND v_current_status = 'persiapan' THEN 'start'
            WHEN p_to_status = 'analisis' THEN 'submit'
            WHEN p_to_status = 'penilaian' THEN 'complete'
            WHEN p_to_status = 'diperiksa' THEN 'submit_for_approval'
            WHEN p_to_status = 'disetujui' THEN 'approve'
            WHEN p_to_status = 'ditolak' THEN 'reject'
            WHEN p_to_status = 'survey' AND v_current_status = 'ditolak' THEN 'return'
            WHEN p_to_status = 'disposisi' THEN 'return'
            ELSE 'transition'
        END;
        
        -- Log transition
        v_log_id := log_workflow_transition(
            p_survey_id,
            v_current_status,
            p_to_status,
            v_actor_id,
            v_action,
            p_note,
            p_metadata
        );
    END;
    
    -- Build result
    v_result := jsonb_build_object(
        'success', TRUE,
        'log_id', v_log_id,
        'from_status', v_current_status,
        'to_status', p_to_status,
        'survey_id', p_survey_id
    );
    
    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', SQLERRM,
            'survey_id', p_survey_id
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. NOTIFICATION FUNCTIONS
-- ============================================================

-- Create notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_link TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        entity_type,
        entity_id,
        link
    ) VALUES (
        p_user_id,
        p_title,
        p_message,
        p_type,
        p_entity_type,
        p_entity_id,
        p_link
    )
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Notify surveyor on assignment
CREATE OR REPLACE FUNCTION notify_surveyor_assigned(
    p_project_id UUID,
    p_surveyor_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_project_name TEXT;
    v_kode_project TEXT;
BEGIN
    SELECT nama_bangunan, kode_project INTO v_project_name, v_kode_project
    FROM projects WHERE id = p_project_id;
    
    PERFORM create_notification(
        p_surveyor_id,
        'Penugasan Survey Baru',
        'Anda ditugaskan sebagai surveyor untuk project: ' || v_project_name || ' (' || v_kode_project || ')',
        'info',
        'project',
        p_project_id,
        '/projects/' || p_project_id
    );
END;
$$ LANGUAGE plpgsql;

-- Notify verifikator on submission
CREATE OR REPLACE FUNCTION notify_verifikator_submission(
    p_survey_id UUID,
    p_verifikator_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_kode_survey TEXT;
    v_project_name TEXT;
BEGIN
    SELECT s.kode_survey, p.nama_bangunan
    INTO v_kode_survey, v_project_name
    FROM surveys s
    JOIN projects p ON s.project_id = p.id
    WHERE s.id = p_survey_id;
    
    PERFORM create_notification(
        p_verifikator_id,
        'Survey Menunggu Verifikasi',
        'Survey ' || v_kode_survey || ' untuk ' || v_project_name || ' memerlukan verifikasi',
        'warning',
        'survey',
        p_survey_id,
        '/surveys/' || p_survey_id
    );
END;
$$ LANGUAGE plpgsql;

-- Notify approver on verification
CREATE OR REPLACE FUNCTION notify_approver_verification(
    p_survey_id UUID,
    p_approver_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_kode_survey TEXT;
    v_project_name TEXT;
BEGIN
    SELECT s.kode_survey, p.nama_bangunan
    INTO v_kode_survey, v_project_name
    FROM surveys s
    JOIN projects p ON s.project_id = p.id
    WHERE s.id = p_survey_id;
    
    PERFORM create_notification(
        p_approver_id,
        'Survey Disetujui Verifikator',
        'Survey ' || v_kode_survey || ' untuk ' || v_project_name || ' siap untuk approval final',
        'success',
        'survey',
        p_survey_id,
        '/surveys/' || p_survey_id
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. TRIGGERS
-- ============================================================

-- 5.1 Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_update_updated_at();

CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION trigger_update_updated_at();

CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION trigger_update_updated_at();

CREATE TRIGGER trg_surveys_updated_at BEFORE UPDATE ON surveys
    FOR EACH ROW EXECUTE FUNCTION trigger_update_updated_at();

CREATE TRIGGER trg_components_updated_at BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION trigger_update_updated_at();

CREATE TRIGGER trg_results_updated_at BEFORE UPDATE ON results
    FOR EACH ROW EXECUTE FUNCTION trigger_update_updated_at();

-- 5.2 Auto-calculate component nilai_hasil on insert/update
CREATE OR REPLACE FUNCTION trigger_calculate_component_value()
RETURNS TRIGGER AS $$
BEGIN
    -- Convert klasifikasi to nilai_kerusakan
    IF NEW.klasifikasi IS NOT NULL THEN
        NEW.nilai_kerusakan := get_classification_value(NEW.klasifikasi);
    END IF;
    
    -- Calculate nilai_hasil
    IF NEW.volume_total > 0 AND NEW.nilai_kerusakan IS NOT NULL THEN
        NEW.nilai_hasil := calculate_component_value(
            NEW.volume_total,
            NEW.volume_rusak,
            NEW.klasifikasi,
            NEW.bobot_komponen
        );
    ELSE
        NEW.nilai_hasil := 0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_components_calculate_value 
    BEFORE INSERT OR UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION trigger_calculate_component_value();

-- 5.3 Auto-detect critical survey conditions
CREATE OR REPLACE FUNCTION trigger_detect_critical_survey()
RETURNS TRIGGER AS $$
BEGIN
    -- Check safety conditions
    IF NEW.has_kolom_patah OR NEW.has_pondasi_bergeser OR NEW.has_struktur_runtuh THEN
        NEW.is_critical := TRUE;
    END IF;
    
    -- Check for critical components (klasifikasi 7)
    IF EXISTS (
        SELECT 1 FROM components 
        WHERE survey_id = NEW.id AND klasifikasi = '7'
    ) THEN
        NEW.is_critical := TRUE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_surveys_detect_critical
    BEFORE INSERT OR UPDATE ON surveys
    FOR EACH ROW EXECUTE FUNCTION trigger_detect_critical_survey();

-- 5.4 Auto-generate codes on insert
CREATE OR REPLACE FUNCTION trigger_generate_project_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.kode_project IS NULL THEN
        NEW.kode_project := generate_project_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_generate_code
    BEFORE INSERT ON projects
    FOR EACH ROW EXECUTE FUNCTION trigger_generate_project_code();

CREATE OR REPLACE FUNCTION trigger_generate_survey_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.kode_survey IS NULL THEN
        NEW.kode_survey := generate_survey_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_surveys_generate_code
    BEFORE INSERT ON surveys
    FOR EACH ROW EXECUTE FUNCTION trigger_generate_survey_code();

-- 5.5 Log workflow status changes
CREATE OR REPLACE FUNCTION trigger_log_workflow_change()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_actor_role user_role;
BEGIN
    -- Only log if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        SELECT role INTO v_actor_role FROM users WHERE id = v_actor_id;
        
        INSERT INTO workflow_logs (
            survey_id,
            project_id,
            from_status,
            to_status,
            actor_id,
            actor_role,
            action,
            note
        ) VALUES (
            NEW.id,
            NEW.project_id,
            OLD.status,
            NEW.status,
            v_actor_id,
            v_actor_role,
            'status_change',
            'Status updated via trigger'
        );
        
        -- Recalculate if entering analysis
        IF NEW.status = 'analisis' THEN
            PERFORM calculate_survey_damage(NEW.id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_surveys_log_workflow
    AFTER UPDATE OF status ON surveys
    FOR EACH ROW EXECUTE FUNCTION trigger_log_workflow_change();

-- 5.6 Auto-calculate survey damage on component changes
CREATE OR REPLACE FUNCTION trigger_recalculate_survey_damage()
RETURNS TRIGGER AS $$
DECLARE
    v_survey_id UUID;
BEGIN
    -- Get survey_id
    IF TG_OP = 'DELETE' THEN
        v_survey_id := OLD.survey_id;
    ELSE
        v_survey_id := NEW.survey_id;
    END IF;
    
    -- Recalculate if survey is in analysis or later
    IF EXISTS (
        SELECT 1 FROM surveys 
        WHERE id = v_survey_id 
        AND status IN ('analisis', 'penilaian', 'diperiksa', 'disetujui')
    ) THEN
        PERFORM calculate_survey_damage(v_survey_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_components_recalculate
    AFTER INSERT OR UPDATE OR DELETE ON components
    FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_survey_damage();

-- 5.7 Auto-create results record on survey insert
CREATE OR REPLACE FUNCTION trigger_create_results_record()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO results (survey_id, created_at)
    VALUES (NEW.id, NOW())
    ON CONFLICT (survey_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_surveys_create_results
    AFTER INSERT ON surveys
    FOR EACH ROW EXECUTE FUNCTION trigger_create_results_record();

-- 5.8 Notify on surveyor assignment
CREATE OR REPLACE FUNCTION trigger_notify_surveyor_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.assigned_surveyor IS DISTINCT FROM NEW.assigned_surveyor 
       AND NEW.assigned_surveyor IS NOT NULL THEN
        PERFORM notify_surveyor_assigned(NEW.id, NEW.assigned_surveyor);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_notify_surveyor
    AFTER UPDATE OF assigned_surveyor ON projects
    FOR EACH ROW EXECUTE FUNCTION trigger_notify_surveyor_assignment();

-- ============================================================
-- 6. ANALYTICS FUNCTIONS
-- ============================================================

-- Get dashboard statistics
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_projects', COUNT(DISTINCT p.id),
        'total_surveys', COUNT(DISTINCT s.id),
        'pending_surveys', COUNT(DISTINCT CASE WHEN s.status = 'survey' THEN s.id END),
        'approved_surveys', COUNT(DISTINCT CASE WHEN s.status = 'disetujui' THEN s.id END),
        'critical_surveys', COUNT(DISTINCT CASE WHEN s.is_critical THEN s.id END),
        'by_category', jsonb_build_object(
            'ringan', COUNT(DISTINCT CASE WHEN r.kategori_kerusakan = 'ringan' THEN s.id END),
            'sedang', COUNT(DISTINCT CASE WHEN r.kategori_kerusakan = 'sedang' THEN s.id END),
            'berat', COUNT(DISTINCT CASE WHEN r.kategori_kerusakan = 'berat' THEN s.id END)
        ),
        'by_status', jsonb_build_object(
            'disposisi', COUNT(DISTINCT CASE WHEN s.status = 'disposisi' THEN s.id END),
            'persiapan', COUNT(DISTINCT CASE WHEN s.status = 'persiapan' THEN s.id END),
            'survey', COUNT(DISTINCT CASE WHEN s.status = 'survey' THEN s.id END),
            'analisis', COUNT(DISTINCT CASE WHEN s.status = 'analisis' THEN s.id END),
            'penilaian', COUNT(DISTINCT CASE WHEN s.status = 'penilaian' THEN s.id END),
            'diperiksa', COUNT(DISTINCT CASE WHEN s.status = 'diperiksa' THEN s.id END),
            'disetujui', COUNT(DISTINCT CASE WHEN s.status = 'disetujui' THEN s.id END),
            'ditolak', COUNT(DISTINCT CASE WHEN s.status = 'ditolak' THEN s.id END)
        )
    )
    INTO v_result
    FROM projects p
    LEFT JOIN surveys s ON p.id = s.project_id
    LEFT JOIN results r ON s.id = r.survey_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. STORAGE SETUP
-- ============================================================

-- Note: Storage buckets must be created via Supabase Dashboard or API
-- These are the recommended bucket configurations:

-- Bucket: signatures
--   - public: false
--   - allowed mime types: image/png, image/jpeg
--   - file size limit: 5MB
--   - RLS policy: Users can only access signatures of surveys they have access to

-- Bucket: templates
--   - public: true (for reading)
--   - allowed mime types: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
--   - file size limit: 10MB
--   - RLS policy: Public read, admin-only write

-- Bucket: exports
--   - public: false
--   - allowed mime types: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf
--   - file size limit: 20MB
--   - RLS policy: Users can only access their own exports

-- Bucket: component-photos
--   - public: false
--   - allowed mime types: image/png, image/jpeg
--   - file size limit: 10MB
--   - RLS policy: Users can access photos of surveys they have access to

-- ============================================================
-- END OF FUNCTIONS & TRIGGERS
-- ============================================================
