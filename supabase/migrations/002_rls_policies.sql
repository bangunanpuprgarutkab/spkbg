-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - COMPLETE
-- Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
-- ============================================================

-- ============================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE components ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Force RLS (even for table owner)
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE templates FORCE ROW LEVEL SECURITY;
ALTER TABLE template_mappings FORCE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
ALTER TABLE surveys FORCE ROW LEVEL SECURITY;
ALTER TABLE components FORCE ROW LEVEL SECURITY;
ALTER TABLE component_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE results FORCE ROW LEVEL SECURITY;
ALTER TABLE workflow_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE signatures FORCE ROW LEVEL SECURITY;
ALTER TABLE exports FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 2. HELPER FUNCTIONS
-- ============================================================

-- Get current user role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
DECLARE
    v_role user_role;
BEGIN
    SELECT role INTO v_role
    FROM users
    WHERE id = auth.uid();
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is surveyor
CREATE OR REPLACE FUNCTION is_surveyor()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = 'surveyor';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is verifikator
CREATE OR REPLACE FUNCTION is_verifikator()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = 'verifikator';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is approver
CREATE OR REPLACE FUNCTION is_approver()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = 'approver';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user created project
CREATE OR REPLACE FUNCTION is_project_owner(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM projects
        WHERE id = project_id AND created_by = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is assigned surveyor for project
CREATE OR REPLACE FUNCTION is_project_surveyor(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM projects
        WHERE id = project_id AND assigned_surveyor = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is assigned verifikator for project
CREATE OR REPLACE FUNCTION is_project_verifikator(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM projects
        WHERE id = project_id AND assigned_verifikator = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is assigned approver for project
CREATE OR REPLACE FUNCTION is_project_approver(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM projects
        WHERE id = project_id AND assigned_approver = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has any access to project
CREATE OR REPLACE FUNCTION can_access_project(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN is_admin() OR 
           is_project_owner(project_id) OR 
           is_project_surveyor(project_id) OR
           is_project_verifikator(project_id) OR
           is_project_approver(project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user created survey
CREATE OR REPLACE FUNCTION is_survey_owner(survey_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM surveys
        WHERE id = survey_id AND surveyor_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if survey is accessible to user
CREATE OR REPLACE FUNCTION can_access_survey(survey_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_project_id UUID;
BEGIN
    SELECT project_id INTO v_project_id FROM surveys WHERE id = survey_id;
    RETURN can_access_project(v_project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if survey is still draft (editable)
CREATE OR REPLACE FUNCTION is_survey_draft(survey_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_draft BOOLEAN;
    v_status workflow_status;
BEGIN
    SELECT is_draft, status INTO v_is_draft, v_status
    FROM surveys WHERE id = survey_id;
    RETURN v_is_draft = TRUE OR v_status IN ('survey', 'ditolak');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if survey is before verification (editable by surveyor)
CREATE OR REPLACE FUNCTION is_before_verification(survey_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_status workflow_status;
BEGIN
    SELECT status INTO v_status FROM surveys WHERE id = survey_id;
    RETURN v_status IN ('survey', 'analisis', 'penilaian', 'ditolak');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. USERS TABLE POLICIES
-- ============================================================

-- Policy: Users can read own profile
CREATE POLICY "users_select_own" ON users
    FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR is_admin());

-- Policy: Users can update own profile (limited fields)
CREATE POLICY "users_update_own" ON users
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND role = (SELECT role FROM users WHERE id = auth.uid()));

-- Policy: Admin can read all users
CREATE POLICY "users_select_admin" ON users
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- Policy: Admin can insert users
CREATE POLICY "users_insert_admin" ON users
    FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

-- Policy: Admin can update any user
CREATE POLICY "users_update_admin" ON users
    FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- 4. TEMPLATES TABLE POLICIES
-- ============================================================

-- Policy: All authenticated users can read active templates
CREATE POLICY "templates_select_all" ON templates
    FOR SELECT
    TO authenticated
    USING (is_active = TRUE);

-- Policy: Admin can manage all templates
CREATE POLICY "templates_all_admin" ON templates
    FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- 5. TEMPLATE_MAPPINGS TABLE POLICIES
-- ============================================================

-- Policy: All authenticated users can read mappings
CREATE POLICY "mappings_select_all" ON template_mappings
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Admin can manage mappings
CREATE POLICY "mappings_all_admin" ON template_mappings
    FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- 6. PROJECTS TABLE POLICIES
-- ============================================================

-- Policy: Select - Users can read projects they have access to
CREATE POLICY "projects_select_accessible" ON projects
    FOR SELECT
    TO authenticated
    USING (
        is_admin() OR
        created_by = auth.uid() OR
        assigned_surveyor = auth.uid() OR
        assigned_verifikator = auth.uid() OR
        assigned_approver = auth.uid()
    );

-- Policy: Insert - Surveyor can create projects
CREATE POLICY "projects_insert_surveyor" ON projects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (is_surveyor() OR is_admin()) AND 
        created_by = auth.uid()
    );

-- Policy: Update - Owner can update project (limited status)
CREATE POLICY "projects_update_owner" ON projects
    FOR UPDATE
    TO authenticated
    USING (
        created_by = auth.uid() OR is_admin()
    )
    WITH CHECK (
        created_by = auth.uid() OR is_admin()
    );

-- Policy: Delete - Only admin can delete
CREATE POLICY "projects_delete_admin" ON projects
    FOR DELETE
    TO authenticated
    USING (is_admin());

-- ============================================================
-- 7. SURVEYS TABLE POLICIES
-- ============================================================

-- Policy: Select - Users can read accessible surveys
CREATE POLICY "surveys_select_accessible" ON surveys
    FOR SELECT
    TO authenticated
    USING (
        is_admin() OR
        surveyor_id = auth.uid() OR
        verifikator_id = auth.uid() OR
        approver_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = surveys.project_id 
            AND can_access_project(p.id)
        )
    );

-- Policy: Insert - Surveyor can create surveys for assigned projects
CREATE POLICY "surveys_insert_surveyor" ON surveys
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (is_surveyor() OR is_admin()) AND 
        (
            surveyor_id = auth.uid() OR
            is_project_surveyor(project_id)
        )
    );

-- Policy: Update - Surveyor can update own surveys (before verification)
CREATE POLICY "surveys_update_surveyor" ON surveys
    FOR UPDATE
    TO authenticated
    USING (
        (is_surveyor() OR is_admin()) AND 
        surveyor_id = auth.uid() AND 
        is_before_verification(id)
    )
    WITH CHECK (
        (is_surveyor() OR is_admin()) AND 
        surveyor_id = auth.uid()
    );

-- Policy: Update - Verifikator can update status field only
CREATE POLICY "surveys_update_verifikator" ON surveys
    FOR UPDATE
    TO authenticated
    USING (
        is_verifikator() OR is_admin()
    )
    WITH CHECK (
        is_verifikator() OR is_admin()
    );

-- Policy: Delete - Only admin can delete
CREATE POLICY "surveys_delete_admin" ON surveys
    FOR DELETE
    TO authenticated
    USING (is_admin());

-- ============================================================
-- 8. COMPONENTS TABLE POLICIES
-- ============================================================

-- Policy: Select - Users can read components of accessible surveys
CREATE POLICY "components_select_accessible" ON components
    FOR SELECT
    TO authenticated
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM surveys s
            WHERE s.id = components.survey_id
            AND can_access_survey(s.id)
        )
    );

-- Policy: Insert - Surveyor can create components for own draft surveys
CREATE POLICY "components_insert_surveyor" ON components
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (is_surveyor() OR is_admin()) AND
        EXISTS (
            SELECT 1 FROM surveys s
            WHERE s.id = components.survey_id
            AND s.surveyor_id = auth.uid()
            AND is_survey_draft(s.id)
        )
    );

-- Policy: Update - Surveyor can update components (draft only)
CREATE POLICY "components_update_surveyor" ON components
    FOR UPDATE
    TO authenticated
    USING (
        (is_surveyor() OR is_admin()) AND
        EXISTS (
            SELECT 1 FROM surveys s
            WHERE s.id = components.survey_id
            AND s.surveyor_id = auth.uid()
            AND is_survey_draft(s.id)
        )
    )
    WITH CHECK (
        (is_surveyor() OR is_admin()) AND
        EXISTS (
            SELECT 1 FROM surveys s
            WHERE s.id = components.survey_id
            AND s.surveyor_id = auth.uid()
        )
    );

-- Policy: Delete - Surveyor can delete components (draft only)
CREATE POLICY "components_delete_surveyor" ON components
    FOR DELETE
    TO authenticated
    USING (
        (is_surveyor() OR is_admin()) AND
        EXISTS (
            SELECT 1 FROM surveys s
            WHERE s.id = components.survey_id
            AND s.surveyor_id = auth.uid()
            AND is_survey_draft(s.id)
        )
    );

-- ============================================================
-- 9. COMPONENT_DEFINITIONS TABLE POLICIES
-- ============================================================

-- Policy: All authenticated users can read definitions
CREATE POLICY "definitions_select_all" ON component_definitions
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Admin can manage definitions
CREATE POLICY "definitions_all_admin" ON component_definitions
    FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- 10. RESULTS TABLE POLICIES
-- ============================================================

-- Policy: Select - Users can read results of accessible surveys
CREATE POLICY "results_select_accessible" ON results
    FOR SELECT
    TO authenticated
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM surveys s
            WHERE s.id = results.survey_id
            AND can_access_survey(s.id)
        )
    );

-- Policy: System can create/update results (via trigger/function)
CREATE POLICY "results_system" ON results
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy: Verifikator can update verification fields
CREATE POLICY "results_verify_verifikator" ON results
    FOR UPDATE
    TO authenticated
    USING (
        is_verifikator() OR is_admin()
    )
    WITH CHECK (
        is_verifikator() OR is_admin()
    );

-- Policy: Approver can update approval fields
CREATE POLICY "results_approve_approver" ON results
    FOR UPDATE
    TO authenticated
    USING (
        is_approver() OR is_admin()
    )
    WITH CHECK (
        is_approver() OR is_admin()
    );

-- ============================================================
-- 11. WORKFLOW_LOGS TABLE POLICIES
-- ============================================================

-- Policy: Select - Users can read workflow logs of accessible surveys
CREATE POLICY "logs_select_accessible" ON workflow_logs
    FOR SELECT
    TO authenticated
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM surveys s
            WHERE s.id = workflow_logs.survey_id
            AND can_access_survey(s.id)
        )
    );

-- Policy: System can create workflow logs
CREATE POLICY "logs_insert_system" ON workflow_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- No update/delete - Immutable audit trail

-- ============================================================
-- 12. SIGNATURES TABLE POLICIES
-- ============================================================

-- Policy: Select - Users can read signatures of accessible surveys
CREATE POLICY "signatures_select_accessible" ON signatures
    FOR SELECT
    TO authenticated
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM surveys s
            WHERE s.id = signatures.survey_id
            AND can_access_survey(s.id)
        )
    );

-- Policy: User can create own signature
CREATE POLICY "signatures_insert_own" ON signatures
    FOR INSERT
    TO authenticated
    WITH CHECK (
        signed_by = auth.uid() OR is_admin()
    );

-- No update/delete - Immutable

-- ============================================================
-- 13. EXPORTS TABLE POLICIES
-- ============================================================

-- Policy: Select - Users can read exports they created or have access to
CREATE POLICY "exports_select_accessible" ON exports
    FOR SELECT
    TO authenticated
    USING (
        is_admin() OR
        exported_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM surveys s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = exports.survey_id
            AND can_access_project(p.id)
        )
    );

-- Policy: User can create exports for accessible surveys
CREATE POLICY "exports_insert_own" ON exports
    FOR INSERT
    TO authenticated
    WITH CHECK (
        exported_by = auth.uid() OR is_admin()
    );

-- Policy: User can update own exports (download tracking)
CREATE POLICY "exports_update_own" ON exports
    FOR UPDATE
    TO authenticated
    USING (
        exported_by = auth.uid() OR is_admin()
    )
    WITH CHECK (
        exported_by = auth.uid() OR is_admin()
    );

-- ============================================================
-- 14. NOTIFICATIONS TABLE POLICIES
-- ============================================================

-- Policy: Select - Users can read own notifications
CREATE POLICY "notifications_select_own" ON notifications
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR is_admin());

-- Policy: System can create notifications
CREATE POLICY "notifications_insert_system" ON notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: User can update own notifications (mark as read)
CREATE POLICY "notifications_update_own" ON notifications
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: User can delete own notifications
CREATE POLICY "notifications_delete_own" ON notifications
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================
-- 15. VERIFICATION QUERIES (FOR TESTING)
-- ============================================================

-- View all policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;

-- View RLS status
-- SELECT relname, relrowsecurity, relforcerowsecurity 
-- FROM pg_class 
-- WHERE relname IN (
--     'users', 'templates', 'projects', 'surveys', 
--     'components', 'results', 'workflow_logs', 'signatures'
-- );
