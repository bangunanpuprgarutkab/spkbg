-- ============================================================
-- SUPABASE STORAGE CONFIGURATION
-- Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
-- ============================================================

-- ============================================================
-- 1. CREATE BUCKETS (Run in Supabase Dashboard SQL Editor)
-- ============================================================

-- Note: Buckets must be created via API or Dashboard
-- These are the SQL-equivalent configurations for documentation

-- Bucket: signatures
-- Purpose: Store digital signatures for TTE
-- Configuration:
--   - Public: false (private)
--   - File size limit: 5MB
--   - Allowed MIME types: image/png, image/jpeg
--   - Compression: none (signatures must be exact)

-- Bucket: templates
-- Purpose: Store Excel template files
-- Configuration:
--   - Public: true (read-only)
--   - File size limit: 10MB
--   - Allowed MIME types: 
--     - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (.xlsx)
--     - application/vnd.ms-excel (.xls)
--   - Compression: none

-- Bucket: exports
-- Purpose: Store generated Excel/PDF exports
-- Configuration:
--   - Public: false (private, user-specific)
--   - File size limit: 20MB
--   - Allowed MIME types:
--     - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
--     - application/pdf
--   - Compression: none
--   - Auto-deletion: 90 days (configurable)

-- Bucket: component-photos
-- Purpose: Store survey photos of damaged components
-- Configuration:
--   - Public: false (private)
--   - File size limit: 10MB
--   - Allowed MIME types:
--     - image/jpeg
--     - image/png
--   - Image transformation: enabled (resize for thumbnails)
--   - Compression: auto (reduce file size)

-- Bucket: temp-uploads
-- Purpose: Temporary storage during upload process
-- Configuration:
--   - Public: false
--   - File size limit: 10MB
--   - Auto-deletion: 24 hours
--   - Allowed MIME types: image/*, application/*

-- ============================================================
-- 2. STORAGE RLS POLICIES
-- ============================================================

-- 2.1 signatures bucket policies
-- Users can only access signatures of surveys they have access to

CREATE POLICY "signatures_select_policy" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'signatures' AND
        (
            is_admin() OR
            EXISTS (
                SELECT 1 FROM surveys s
                JOIN projects p ON s.project_id = p.id
                WHERE s.id = split_part(storage.objects.name, '/', 2)::uuid
                AND can_access_project(p.id)
            )
        )
    );

CREATE POLICY "signatures_insert_policy" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'signatures' AND
        (
            is_admin() OR
            EXISTS (
                SELECT 1 FROM surveys s
                WHERE s.id = split_part(storage.objects.name, '/', 2)::uuid
                AND s.surveyor_id = auth.uid()
            )
        )
    );

CREATE POLICY "signatures_delete_policy" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'signatures' AND
        (
            is_admin() OR
            EXISTS (
                SELECT 1 FROM surveys s
                WHERE s.id = split_part(storage.objects.name, '/', 2)::uuid
                AND s.surveyor_id = auth.uid()
                AND s.is_draft = true
            )
        )
    );

-- 2.2 templates bucket policies
-- Public read for all authenticated users
-- Write only for admin

CREATE POLICY "templates_select_policy" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'templates');

CREATE POLICY "templates_insert_policy" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'templates' AND
        is_admin()
    );

CREATE POLICY "templates_delete_policy" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'templates' AND
        is_admin()
    );

-- 2.3 exports bucket policies
-- Users can only access their own exports

CREATE POLICY "exports_select_policy" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'exports' AND
        (
            is_admin() OR
            EXISTS (
                SELECT 1 FROM exports e
                WHERE e.file_url LIKE '%' || storage.objects.name
                AND e.exported_by = auth.uid()
            )
        )
    );

CREATE POLICY "exports_insert_policy" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'exports'
        -- Permission checked via exports table RLS
    );

CREATE POLICY "exports_delete_policy" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'exports' AND
        is_admin()
    );

-- 2.4 component-photos bucket policies
-- Users can access photos of surveys they have access to

CREATE POLICY "photos_select_policy" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'component-photos' AND
        (
            is_admin() OR
            EXISTS (
                SELECT 1 FROM components c
                JOIN surveys s ON c.survey_id = s.id
                JOIN projects p ON s.project_id = p.id
                WHERE c.id = split_part(storage.objects.name, '/', 3)::uuid
                AND can_access_project(p.id)
            )
        )
    );

CREATE POLICY "photos_insert_policy" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'component-photos' AND
        (
            is_admin() OR
            EXISTS (
                SELECT 1 FROM components c
                JOIN surveys s ON c.survey_id = s.id
                WHERE c.id = split_part(storage.objects.name, '/', 3)::uuid
                AND s.surveyor_id = auth.uid()
                AND s.is_draft = true
            )
        )
    );

CREATE POLICY "photos_delete_policy" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'component-photos' AND
        (
            is_admin() OR
            EXISTS (
                SELECT 1 FROM components c
                JOIN surveys s ON c.survey_id = s.id
                WHERE c.id = split_part(storage.objects.name, '/', 3)::uuid
                AND s.surveyor_id = auth.uid()
                AND s.is_draft = true
            )
        )
    );

-- ============================================================
-- 3. STORAGE HELPER FUNCTIONS
-- ============================================================

-- Function to get file URL with expiration (signed URL)
CREATE OR REPLACE FUNCTION get_signed_url(
    p_bucket TEXT,
    p_path TEXT,
    p_expires_in INTEGER DEFAULT 3600
)
RETURNS TEXT AS $$
DECLARE
    v_url TEXT;
BEGIN
    -- This is a placeholder - actual signed URLs are generated via Supabase Storage API
    -- In practice, this would be done via supabase-js storage.createSignedUrl()
    v_url := format(
        'https://%s.supabase.co/storage/v1/object/sign/%s/%s?token=%s',
        current_setting('app.settings.supabase_project_ref'),
        p_bucket,
        p_path,
        'signed_token_placeholder'
    );
    RETURN v_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old exports
CREATE OR REPLACE FUNCTION cleanup_old_exports(
    p_days_old INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_record RECORD;
BEGIN
    FOR v_record IN 
        SELECT file_url 
        FROM exports 
        WHERE exported_at < NOW() - INTERVAL '1 day' * p_days_old
        AND file_url IS NOT NULL
    LOOP
        -- Delete from storage (this would be done via API)
        -- DELETE FROM storage.objects WHERE name = extract_path(v_record.file_url);
        
        -- Mark as cleaned
        UPDATE exports 
        SET file_url = NULL, status = 'expired'
        WHERE file_url = v_record.file_url;
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check storage quota
CREATE OR REPLACE FUNCTION check_storage_quota(
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_total_size BIGINT;
    v_quota BIGINT := 1073741824; -- 1GB default quota
BEGIN
    -- Calculate total storage used by user
    SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
    INTO v_total_size
    FROM storage.objects
    WHERE owner = p_user_id;
    
    v_result := jsonb_build_object(
        'user_id', p_user_id,
        'used_bytes', v_total_size,
        'quota_bytes', v_quota,
        'remaining_bytes', v_quota - v_total_size,
        'used_percentage', ROUND((v_total_size::numeric / v_quota) * 100, 2),
        'is_quota_exceeded', v_total_size > v_quota
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. FILE NAMING CONVENTIONS
-- ============================================================

/*

signatures/{survey_id}/{user_id}_{timestamp}.png
templates/{template_name}_{version}.xlsx
exports/{survey_id}/{filename}_{timestamp}.xlsx
component-photos/{survey_id}/{component_id}_{timestamp}_{index}.jpg

Example paths:
- signatures/550e8400-e29b-41d4-a716-446655440000/user_123_20240326120000.png
- templates/form-kerusakan-sekolah_1.0.0.xlsx
- exports/550e8400-e29b-41d4-a716-446655440000/hasil-survey_20240326120000.xlsx
- component-photos/550e8400-e29b-41d4-a716-446655440000/comp_456_20240326120000_1.jpg

*/

-- ============================================================
-- 5. STORAGE MIGRATION GUIDE
-- ============================================================

/*

To set up storage in Supabase:

1. Go to Supabase Dashboard → Storage

2. Create buckets:
   - Click "New Bucket"
   - Enter bucket name
   - Set public/private
   - Configure file size limits
   - Set allowed MIME types

3. Set up RLS policies:
   - Go to SQL Editor
   - Run the RLS policies above (adapted for your project)

4. Configure CORS (if needed):
   - Dashboard → Settings → API → CORS
   - Add your domain

5. For local development:
   - Use Supabase CLI: supabase start
   - Storage will be available at localhost

*/

-- ============================================================
-- 6. FILE TYPE VALIDATION
-- ============================================================

-- Function to validate file type
CREATE OR REPLACE FUNCTION validate_file_type(
    p_filename TEXT,
    p_bucket TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_extension TEXT;
    v_allowed_extensions TEXT[];
BEGIN
    v_extension := lower(split_part(p_filename, '.', -1));
    
    v_allowed_extensions := CASE p_bucket
        WHEN 'signatures' THEN ARRAY['png', 'jpg', 'jpeg']
        WHEN 'templates' THEN ARRAY['xlsx', 'xls']
        WHEN 'exports' THEN ARRAY['xlsx', 'pdf']
        WHEN 'component-photos' THEN ARRAY['jpg', 'jpeg', 'png']
        ELSE ARRAY[]::TEXT[]
    END;
    
    RETURN v_extension = ANY(v_allowed_extensions);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to validate file uploads
CREATE OR REPLACE FUNCTION trigger_validate_file_upload()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT validate_file_type(NEW.name, NEW.bucket_id) THEN
        RAISE EXCEPTION 'File type not allowed for bucket %: %', NEW.bucket_id, NEW.name;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply validation trigger (optional)
-- CREATE TRIGGER trg_validate_file_upload
--     BEFORE INSERT ON storage.objects
--     FOR EACH ROW EXECUTE FUNCTION trigger_validate_file_upload();

-- ============================================================
-- 7. STORAGE MONITORING
-- ============================================================

-- View storage usage statistics
CREATE VIEW storage_usage_stats AS
SELECT 
    bucket_id,
    COUNT(*) as file_count,
    SUM(COALESCE((metadata->>'size')::bigint, 0)) as total_size,
    MIN(created_at) as oldest_file,
    MAX(created_at) as newest_file,
    COUNT(DISTINCT owner) as unique_users
FROM storage.objects
GROUP BY bucket_id;

-- View user storage usage
CREATE VIEW user_storage_usage AS
SELECT 
    owner as user_id,
    bucket_id,
    COUNT(*) as file_count,
    SUM(COALESCE((metadata->>'size')::bigint, 0)) as total_size
FROM storage.objects
WHERE owner IS NOT NULL
GROUP BY owner, bucket_id;

-- ============================================================
-- END OF STORAGE CONFIGURATION
-- ============================================================
