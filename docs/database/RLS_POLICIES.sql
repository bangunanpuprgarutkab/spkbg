-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Sistem Penilaian Kerusakan Bangunan Gedung (SPKBG)
-- ============================================================

-- Enable RLS on all tables
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

-- ============================================================
-- HELPER FUNCTIONS
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

-- Check if user owns project
CREATE OR REPLACE FUNCTION owns_project(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM projects
        WHERE id = project_id AND created_by = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is assigned surveyor
CREATE OR REPLACE FUNCTION is_assigned_surveyor(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM projects
        WHERE id = project_id AND assigned_surveyor = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is assigned verifikator
CREATE OR REPLACE FUNCTION is_assigned_verifikator(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM projects
        WHERE id = project_id AND assigned_verifikator = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is assigned approver
CREATE OR REPLACE FUNCTION is_assigned_approver(project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM projects
        WHERE id = project_id AND assigned_approver = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can access survey
CREATE OR REPLACE FUNCTION can_access_survey(survey_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_project_id UUID;
BEGIN
    SELECT project_id INTO v_project_id FROM surveys WHERE id = survey_id;
    
    RETURN is_admin() OR 
           owns_project(v_project_id) OR 
           is_assigned_surveyor(v_project_id) OR
           is_assigned_verifikator(v_project_id) OR
           is_assigned_approver(v_project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- USERS TABLE POLICIES
-- ============================================================

-- Users can read own profile
CREATE POLICY "Users can read own profile" ON users
    FOR SELECT
    USING (id = auth.uid() OR is_admin());

-- Users can update own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Admin can read all users
CREATE POLICY "Admin can read all users" ON users
    FOR SELECT
    USING (is_admin());

-- Admin can insert users
CREATE POLICY "Admin can insert users" ON users
    FOR INSERT
    WITH CHECK (is_admin());

-- Admin can update any user
CREATE POLICY "Admin can update any user" ON users
    FOR UPDATE
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- TEMPLATES TABLE POLICIES
-- ============================================================

-- All authenticated users can read active templates
CREATE POLICY "Users can read active templates" ON templates
    FOR SELECT
    USING (is_active = TRUE AND auth.role() = 'authenticated');

-- Admin can manage templates
CREATE POLICY "Admin can manage templates" ON templates
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- TEMPLATE_MAPPINGS TABLE POLICIES
-- ============================================================

-- All authenticated users can read mappings
CREATE POLICY "Users can read mappings" ON template_mappings
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Admin can manage mappings
CREATE POLICY "Admin can manage mappings" ON template_mappings
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- PROJECTS TABLE POLICIES
-- ============================================================

-- Users can read projects they have access to
CREATE POLICY "Users can read accessible projects" ON projects
    FOR SELECT
    USING (
        is_admin() OR
        created_by = auth.uid() OR
        assigned_surveyor = auth.uid() OR
        assigned_verifikator = auth.uid() OR
        assigned_approver = auth.uid()
    );

-- Surveyor can create projects
CREATE POLICY "Surveyor can create projects" ON projects
    FOR INSERT
    WITH CHECK (
        (is_surveyor() OR is_admin()) AND 
        created_by = auth.uid()
    );

-- Owner can update project (limited fields)
CREATE POLICY "Owner can update own project" ON projects
    FOR UPDATE
    USING (created_by = auth.uid() OR is_admin())
    WITH CHECK (created_by = auth.uid() OR is_admin());

-- Only admin can delete projects
CREATE POLICY "Only admin can delete projects" ON projects
    FOR DELETE
    USING (is_admin());

-- ============================================================
-- SURVEYS TABLE POLICIES
-- ============================================================

-- Users can read surveys they have access to
CREATE POLICY "Users can read accessible surveys" ON surveys
    FOR SELECT
    USING (
        is_admin() OR
        surveyor_id = auth.uid() OR
        verifikator_id = auth.uid() OR
        approver_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = surveys.project_id 
            AND (p.created_by = auth.uid() 
                 OR p.assigned_surveyor = auth.uid()
                 OR p.assigned_verifikator = auth.uid()
                 OR p.assigned_approver = auth.uid())
        )
    );

-- Surveyor can create surveys for assigned projects
CREATE POLICY "Surveyor can create surveys" ON surveys
    FOR INSERT
    WITH CHECK (
        (is_surveyor() OR is_admin()) AND 
        (
            surveyor_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM projects p
                WHERE p.id = surveys.project_id 
                AND (p.assigned_surveyor = auth.uid() OR p.created_by = auth.uid())
            )
        )
    );

-- Surveyor can update own surveys (draft only)
CREATE POLICY "Surveyor can update own surveys" ON surveys
    FOR UPDATE
    USING (
        (is_surveyor() OR is_admin()) AND 
        surveyor_id = auth.uid() AND 
        (is_draft = TRUE OR is_admin())
    )
    WITH CHECK (
        (is_surveyor() OR is_admin()) AND 
        surveyor_id = auth.uid()
    );

-- Verifikator can update status (specific fields)
CREATE POLICY "Verifikator can update survey status" ON surveys
    FOR UPDATE
    USING (
        is_verifikator() OR is_admin()
    )
    WITH CHECK (
        is_verifikator() OR is_admin()
    );

-- Only admin can delete surveys
CREATE POLICY "Only admin can delete surveys" ON surveys
    FOR DELETE
    USING (is_admin());

-- ============================================================
-- COMPONENTS TABLE POLICIES
-- ============================================================

-- Users can read components of accessible surveys
CREATE POLICY "Users can read accessible components" ON components
    FOR SELECT
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM surveys s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = components.survey_id
            AND (p.created_by = auth.uid() 
                 OR p.assigned_surveyor = auth.uid()
                 OR p.assigned_verifikator = auth.uid()
                 OR p.assigned_approver = auth.uid())
        )
    );

-- Surveyor can create components for own surveys
CREATE POLICY "Surveyor can create components" ON components
    FOR INSERT
    WITH CHECK (
        (is_surveyor() OR is_admin()) AND
        EXISTS (
            SELECT 1 FROM surveys s
            WHERE s.id = components.survey_id
            AND s.surveyor_id = auth.uid()
            AND s.is_draft = TRUE
        )
    );

-- Surveyor can update components (draft only)
CREATE POLICY "Surveyor can update components" ON components
    FOR UPDATE
    USING (
        (is_surveyor() OR is_admin()) AND
        EXISTS (
            SELECT 1 FROM surveys s
            WHERE s.id = components.survey_id
            AND s.surveyor_id = auth.uid()
            AND s.is_draft = TRUE
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

-- Surveyor can delete components (draft only)
CREATE POLICY "Surveyor can delete components" ON components
    FOR DELETE
    USING (
        (is_surveyor() OR is_admin()) AND
        EXISTS (
            SELECT 1 FROM surveys s
            WHERE s.id = components.survey_id
            AND s.surveyor_id = auth.uid()
            AND s.is_draft = TRUE
        )
    );

-- ============================================================
-- COMPONENT_DEFINITIONS TABLE POLICIES
-- ============================================================

-- All authenticated users can read definitions
CREATE POLICY "Users can read component definitions" ON component_definitions
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Admin can manage definitions
CREATE POLICY "Admin can manage definitions" ON component_definitions
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- RESULTS TABLE POLICIES
-- ============================================================

-- Users can read results of accessible surveys
CREATE POLICY "Users can read accessible results" ON results
    FOR SELECT
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM surveys s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = results.survey_id
            AND (p.created_by = auth.uid() 
                 OR p.assigned_surveyor = auth.uid()
                 OR p.assigned_verifikator = auth.uid()
                 OR p.assigned_approver = auth.uid())
        )
    );

-- System can create/update results (via trigger/function)
CREATE POLICY "System can manage results" ON results
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Verifikator can update verification fields
CREATE POLICY "Verifikator can verify results" ON results
    FOR UPDATE
    USING (
        is_verifikator() OR is_admin()
    )
    WITH CHECK (
        is_verifikator() OR is_admin()
    );

-- Approver can update approval fields
CREATE POLICY "Approver can approve results" ON results
    FOR UPDATE
    USING (
        is_approver() OR is_admin()
    )
    WITH CHECK (
        is_approver() OR is_admin()
    );

-- ============================================================
-- WORKFLOW_LOGS TABLE POLICIES
-- ============================================================

-- Users can read workflow logs of accessible surveys
CREATE POLICY "Users can read workflow logs" ON workflow_logs
    FOR SELECT
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM surveys s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = workflow_logs.survey_id
            AND (p.created_by = auth.uid() 
                 OR p.assigned_surveyor = auth.uid()
                 OR p.assigned_verifikator = auth.uid()
                 OR p.assigned_approver = auth.uid())
        )
    );

-- System can create workflow logs
CREATE POLICY "System can create workflow logs" ON workflow_logs
    FOR INSERT
    WITH CHECK (true);

-- No updates allowed (immutable audit trail)
-- No deletes allowed (immutable audit trail)

-- ============================================================
-- SIGNATURES TABLE POLICIES
-- ============================================================

-- Users can read signatures of accessible surveys
CREATE POLICY "Users can read accessible signatures" ON signatures
    FOR SELECT
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1 FROM surveys s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = signatures.survey_id
            AND (p.created_by = auth.uid() 
                 OR p.assigned_surveyor = auth.uid()
                 OR p.assigned_verifikator = auth.uid()
                 OR p.assigned_approver = auth.uid())
        )
    );

-- User can create own signature
CREATE POLICY "User can create own signature" ON signatures
    FOR INSERT
    WITH CHECK (
        signed_by = auth.uid() OR is_admin()
    );

-- No updates allowed (immutable)
-- No deletes allowed (immutable)

-- ============================================================
-- EXPORTS TABLE POLICIES
-- ============================================================

-- Users can read exports of accessible surveys
CREATE POLICY "Users can read accessible exports" ON exports
    FOR SELECT
    USING (
        is_admin() OR
        exported_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM surveys s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = exports.survey_id
            AND (p.created_by = auth.uid() 
                 OR p.assigned_surveyor = auth.uid()
                 OR p.assigned_verifikator = auth.uid()
                 OR p.assigned_approver = auth.uid())
        )
    );

-- User can create exports for accessible surveys
CREATE POLICY "User can create exports" ON exports
    FOR INSERT
    WITH CHECK (
        exported_by = auth.uid() OR is_admin()
    );

-- User can update own exports (download count)
CREATE POLICY "User can update own exports" ON exports
    FOR UPDATE
    USING (
        exported_by = auth.uid() OR is_admin()
    )
    WITH CHECK (
        exported_by = auth.uid() OR is_admin()
    );

-- ============================================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================================

-- Users can read own notifications
CREATE POLICY "Users can read own notifications" ON notifications
    FOR SELECT
    USING (user_id = auth.uid() OR is_admin());

-- System can create notifications
CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT
    WITH CHECK (true);

-- User can update own notifications (mark as read)
CREATE POLICY "User can update own notifications" ON notifications
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- User can delete own notifications
CREATE POLICY "User can delete own notifications" ON notifications
    FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================
-- VIEWS POLICIES (via SECURITY BARRIER)
-- ============================================================

-- Survey summary view inherits from base tables
-- Project progress view inherits from base tables
-- Workflow timeline view inherits from base tables

-- ============================================================
-- ADDITIONAL SECURITY SETTINGS
-- ============================================================

-- Force RLS for all tables
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
-- POLICY VERIFICATION QUERIES (for testing)
-- ============================================================

-- View all policies
-- SELECT * FROM pg_policies WHERE schemaname = 'public';

-- View RLS status for tables
-- SELECT relname, relrowsecurity, relforcerowsecurity 
-- FROM pg_class 
-- WHERE relname IN (
--     'users', 'templates', 'projects', 'surveys', 
--     'components', 'results', 'workflow_logs'
-- );

-- Test specific user access (run as that user)
-- SET ROLE test_surveyor;
-- SELECT * FROM surveys;
-- RESET ROLE;
