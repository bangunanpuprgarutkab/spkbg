-- ============================================================================
-- RLS (ROW LEVEL SECURITY) - TEAM & TASK MANAGEMENT
-- Smart AI Engineering Platform - SPKBG
-- 
-- Security Policies untuk tables:
-- - teams
-- - team_members
-- - team_tasks
-- 
-- Rule Summary:
-- - User: hanya lihat tim & task yang dia ikuti
-- - Ketua Tim: full control atas timnya (anggota, task)
-- - Anggota: update task miliknya saja
-- - Admin: full access semua data
-- ============================================================================

-- ============================================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_activities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. TEAMS TABLE POLICIES
-- ============================================================================

-- DROP EXISTING POLICIES (for clean setup)
DROP POLICY IF EXISTS "teams_select_own_team" ON teams;
DROP POLICY IF EXISTS "teams_insert_admin_or_ketua" ON teams;
DROP POLICY IF EXISTS "teams_update_admin_or_ketua" ON teams;
DROP POLICY IF EXISTS "teams_delete_admin" ON teams;

-- POLICY: SELECT - User hanya lihat tim yang dia ikuti
-- Atau: user adalah ketua tim, atau user adalah admin
CREATE POLICY "teams_select_own_team"
    ON teams
    FOR SELECT
    TO authenticated
    USING (
        -- User adalah anggota aktif tim ini
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = teams.id
            AND tm.user_id = auth.uid()
            AND tm.is_active = true
        )
        -- ATAU user adalah ketua tim (meskipun belum di-add sebagai member)
        OR teams.ketua_id = auth.uid()
        -- ATAU user adalah admin
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

COMMENT ON POLICY "teams_select_own_team" ON teams IS 
'User hanya bisa melihat tim yang dia ikuti sebagai anggota aktif, atau tim yang dia pimpin sebagai ketua, atau jika dia adalah admin';

-- POLICY: INSERT - Hanya admin atau user yang ditunjuk sebagai ketua bisa buat tim
CREATE POLICY "teams_insert_admin_or_ketua"
    ON teams
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- User adalah admin
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
        -- ATAU user membuat tim untuk dirinya sendiri sebagai ketua
        OR (teams.ketua_id = auth.uid() AND teams.created_by = auth.uid())
    );

COMMENT ON POLICY "teams_insert_admin_or_ketua" ON teams IS 
'Hanya admin atau user yang akan menjadi ketua tim yang bisa membuat tim';

-- POLICY: UPDATE - Hanya ketua tim atau admin bisa update tim
CREATE POLICY "teams_update_admin_or_ketua"
    ON teams
    FOR UPDATE
    TO authenticated
    USING (
        -- User adalah ketua tim ini
        teams.ketua_id = auth.uid()
        -- ATAU user adalah admin
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    )
    WITH CHECK (
        -- User adalah ketua tim ini
        teams.ketua_id = auth.uid()
        -- ATAU user adalah admin
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

COMMENT ON POLICY "teams_update_admin_or_ketua" ON teams IS 
'Hanya ketua tim atau admin yang bisa mengupdate data tim';

-- POLICY: DELETE - Hanya admin bisa delete tim
CREATE POLICY "teams_delete_admin"
    ON teams
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

COMMENT ON POLICY "teams_delete_admin" ON teams IS 
'Hanya admin yang bisa menghapus tim';

-- ============================================================================
-- 3. TEAM_MEMBERS TABLE POLICIES
-- ============================================================================

-- DROP EXISTING POLICIES
DROP POLICY IF EXISTS "team_members_select_own_team" ON team_members;
DROP POLICY IF EXISTS "team_members_insert_ketua_or_admin" ON team_members;
DROP POLICY IF EXISTS "team_members_update_ketua_or_admin" ON team_members;
DROP POLICY IF EXISTS "team_members_delete_ketua_or_admin" ON team_members;

-- POLICY: SELECT - User hanya lihat anggota tim yang dia ikuti
CREATE POLICY "team_members_select_own_team"
    ON team_members
    FOR SELECT
    TO authenticated
    USING (
        -- User adalah anggota aktif tim yang sama
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_members.team_id
            AND tm.user_id = auth.uid()
            AND tm.is_active = true
        )
        -- ATAU user adalah ketua tim ini
        OR EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_members.team_id
            AND t.ketua_id = auth.uid()
        )
        -- ATAU user adalah admin
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

COMMENT ON POLICY "team_members_select_own_team" ON team_members IS 
'User hanya bisa melihat anggota dari tim yang dia ikuti, atau tim yang dia pimpin, atau jika admin';

-- POLICY: INSERT - Hanya ketua tim atau admin bisa tambah anggota
CREATE POLICY "team_members_insert_ketua_or_admin"
    ON team_members
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- User adalah ketua tim ini
        EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_members.team_id
            AND t.ketua_id = auth.uid()
        )
        -- ATAU user adalah admin
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

COMMENT ON POLICY "team_members_insert_ketua_or_admin" ON team_members IS 
'Hanya ketua tim atau admin yang bisa menambahkan anggota';

-- POLICY: UPDATE - Hanya ketua tim atau admin bisa update anggota
-- Anggota biasa TIDAK bisa update data anggota lain
CREATE POLICY "team_members_update_ketua_or_admin"
    ON team_members
    FOR UPDATE
    TO authenticated
    USING (
        -- User adalah ketua tim ini
        EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_members.team_id
            AND t.ketua_id = auth.uid()
        )
        -- ATAU user adalah admin
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    )
    WITH CHECK (
        -- User adalah ketua tim ini
        EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_members.team_id
            AND t.ketua_id = auth.uid()
        )
        -- ATAU user adalah admin
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

COMMENT ON POLICY "team_members_update_ketua_or_admin" ON team_members IS 
'Hanya ketua tim atau admin yang bisa mengupdate data anggota. Anggota biasa tidak bisa mengubah data anggota lain.';

-- POLICY: DELETE - Hanya ketua tim atau admin bisa hapus anggota
-- Note: Sebaiknya gunakan soft delete (update is_active = false)
CREATE POLICY "team_members_delete_ketua_or_admin"
    ON team_members
    FOR DELETE
    TO authenticated
    USING (
        -- User adalah ketua tim ini
        EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_members.team_id
            AND t.ketua_id = auth.uid()
        )
        -- ATAU user adalah admin
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

COMMENT ON POLICY "team_members_delete_ketua_or_admin" ON team_members IS 
'Hanya ketua tim atau admin yang bisa menghapus anggota. Direkomendasikan menggunakan soft delete (update is_active).';

-- ============================================================================
-- 4. TEAM_TASKS TABLE POLICIES
-- ============================================================================

-- DROP EXISTING POLICIES
DROP POLICY IF EXISTS "team_tasks_select_own_team" ON team_tasks;
DROP POLICY IF EXISTS "team_tasks_insert_ketua_or_member" ON team_tasks;
DROP POLICY IF EXISTS "team_tasks_update_ketua_or_owner" ON team_tasks;
DROP POLICY IF EXISTS "team_tasks_delete_ketua_or_admin" ON team_tasks;

-- POLICY: SELECT - User hanya lihat task dari tim yang dia ikuti
CREATE POLICY "team_tasks_select_own_team"
    ON team_tasks
    FOR SELECT
    TO authenticated
    USING (
        -- User adalah anggota aktif tim ini
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_tasks.team_id
            AND tm.user_id = auth.uid()
            AND tm.is_active = true
        )
        -- ATAU user adalah pembuat task
        OR team_tasks.created_by = auth.uid()
        -- ATAU user adalah assigned person
        OR team_tasks.assigned_to = auth.uid()
        -- ATAU user adalah ketua tim
        OR EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_tasks.team_id
            AND t.ketua_id = auth.uid()
        )
        -- ATAU user adalah admin
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

COMMENT ON POLICY "team_tasks_select_own_team" ON team_tasks IS 
'User bisa melihat task dari tim yang dia ikuti, task yang dia buat, task yang diassign ke dia, atau jika dia ketua/admin';

-- POLICY: INSERT - Ketua, anggota, atau admin bisa buat task
CREATE POLICY "team_tasks_insert_ketua_or_member"
    ON team_tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- User adalah anggota aktif tim ini
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_tasks.team_id
            AND tm.user_id = auth.uid()
            AND tm.is_active = true
        )
        -- ATAU user adalah ketua tim
        OR EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_tasks.team_id
            AND t.ketua_id = auth.uid()
        )
        -- ATAU user adalah admin
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

COMMENT ON POLICY "team_tasks_insert_ketua_or_member" ON team_tasks IS 
'Anggota tim, ketua tim, atau admin bisa membuat task baru';

-- POLICY: UPDATE - 
-- Ketua tim: bisa update SEMUA task di timnya
-- Anggota: hanya bisa update task yang diassign ke dia ATAU yang dia buat
-- Admin: bisa update semua
CREATE POLICY "team_tasks_update_ketua_or_owner"
    ON team_tasks
    FOR UPDATE
    TO authenticated
    USING (
        -- User adalah ketua tim ini
        EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_tasks.team_id
            AND t.ketua_id = auth.uid()
        )
        -- ATAU user adalah pembuat task
        OR team_tasks.created_by = auth.uid()
        -- ATAU user adalah assigned person
        OR team_tasks.assigned_to = auth.uid()
        -- ATAU user adalah admin
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    )
    WITH CHECK (
        -- User adalah ketua tim ini
        EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_tasks.team_id
            AND t.ketua_id = auth.uid()
        )
        -- ATAU user adalah pembuat task
        OR team_tasks.created_by = auth.uid()
        -- ATAU user adalah assigned person
        OR team_tasks.assigned_to = auth.uid()
        -- ATAU user adalah admin
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

COMMENT ON POLICY "team_tasks_update_ketua_or_owner" ON team_tasks IS 
'Ketua tim bisa update semua task. Anggota hanya bisa update task yang diassign ke dia atau yang dia buat. Admin bisa update semua.';

-- POLICY: DELETE - Hanya ketua tim atau admin bisa delete task
CREATE POLICY "team_tasks_delete_ketua_or_admin"
    ON team_tasks
    FOR DELETE
    TO authenticated
    USING (
        -- User adalah ketua tim ini
        EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_tasks.team_id
            AND t.ketua_id = auth.uid()
        )
        -- ATAU user adalah admin
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

COMMENT ON POLICY "team_tasks_delete_ketua_or_admin" ON team_tasks IS 
'Hanya ketua tim atau admin yang bisa menghapus task. Anggota biasa tidak bisa menghapus task.';

-- ============================================================================
-- 5. TEAM_ACTIVITIES TABLE POLICIES
-- ============================================================================

-- DROP EXISTING POLICIES
DROP POLICY IF EXISTS "team_activities_select_own_team" ON team_activities;
DROP POLICY IF EXISTS "team_activities_insert_system" ON team_activities;
DROP POLICY IF EXISTS "team_activities_no_update" ON team_activities;
DROP POLICY IF EXISTS "team_activities_no_delete" ON team_activities;

-- POLICY: SELECT - User hanya lihat aktivitas tim yang dia ikuti
CREATE POLICY "team_activities_select_own_team"
    ON team_activities
    FOR SELECT
    TO authenticated
    USING (
        -- User adalah anggota tim ini
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_activities.team_id
            AND tm.user_id = auth.uid()
            AND tm.is_active = true
        )
        -- ATAU user adalah ketua tim
        OR EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_activities.team_id
            AND t.ketua_id = auth.uid()
        )
        -- ATAU user adalah admin
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

COMMENT ON POLICY "team_activities_select_own_team" ON team_activities IS 
'User hanya bisa melihat aktivitas dari tim yang dia ikuti';

-- POLICY: INSERT - Hanya system/trigger yang boleh insert (atau admin)
-- Activities sebaiknya di-generate oleh trigger/database
CREATE POLICY "team_activities_insert_system"
    ON team_activities
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- User adalah admin
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
        -- ATAU user adalah anggota tim yang mencatat aktivitas
        OR EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_activities.team_id
            AND tm.user_id = auth.uid()
            AND tm.is_active = true
        )
    );

COMMENT ON POLICY "team_activities_insert_system" ON team_activities IS 
'Activities bisa diinsert oleh admin atau anggota tim yang terkait. Sebaiknya gunakan trigger untuk auto-log.';

-- POLICY: UPDATE - Tidak boleh update activities (immutable)
CREATE POLICY "team_activities_no_update"
    ON team_activities
    FOR UPDATE
    TO authenticated
    USING (false);

COMMENT ON POLICY "team_activities_no_update" ON team_activities IS 
'Activities tidak boleh diupdate (immutable audit log). Hanya admin yang bisa bypass via security definer function.';

-- POLICY: DELETE - Tidak boleh delete activities (immutable)
CREATE POLICY "team_activities_no_delete"
    ON team_activities
    FOR DELETE
    TO authenticated
    USING (false);

COMMENT ON POLICY "team_activities_no_delete" ON team_activities IS 
'Activities tidak boleh dihapus (immutable audit log). Hanya admin yang bisa bypass via security definer function.';

-- ============================================================================
-- 6. HELPER FUNCTIONS FOR RLS
-- ============================================================================

-- Function: Check if user is team leader
CREATE OR REPLACE FUNCTION is_team_leader(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM teams
        WHERE id = p_team_id
        AND ketua_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_team_leader IS 'Check apakah user adalah ketua tim';

-- Function: Check if user is team member
CREATE OR REPLACE FUNCTION is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM team_members
        WHERE team_id = p_team_id
        AND user_id = p_user_id
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_team_member IS 'Check apakah user adalah anggota aktif tim';

-- Function: Check if user can modify task
CREATE OR REPLACE FUNCTION can_modify_task(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_team_id UUID;
    v_assigned_to UUID;
    v_created_by UUID;
BEGIN
    -- Get task info
    SELECT team_id, assigned_to, created_by
    INTO v_team_id, v_assigned_to, v_created_by
    FROM team_tasks
    WHERE id = p_task_id;

    -- Check permissions
    RETURN (
        -- User is team leader
        is_team_leader(v_team_id, p_user_id)
        -- OR user is assigned to task
        OR p_user_id = v_assigned_to
        -- OR user created the task
        OR p_user_id = v_created_by
        -- OR user is admin
        OR EXISTS (
            SELECT 1 FROM users
            WHERE id = p_user_id AND role = 'admin'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_modify_task IS 'Check apakah user bisa mengubah task tertentu';

-- ============================================================================
-- 7. SECURITY BEST PRACTICE - FORCE RLS
-- ============================================================================

-- Force RLS untuk semua users (termasuk table owner)
ALTER TABLE teams FORCE ROW LEVEL SECURITY;
ALTER TABLE team_members FORCE ROW LEVEL SECURITY;
ALTER TABLE team_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE team_activities FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. VERIFICATION QUERIES
-- ============================================================================

-- Verifikasi policies yang aktif
-- Uncomment untuk mengecek:

/*
-- List semua policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('teams', 'team_members', 'team_tasks', 'team_activities')
ORDER BY tablename, policyname;

-- Test SELECT untuk user tertentu
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'user-uuid-here';
SELECT * FROM teams;  -- Should only return teams user belongs to
SELECT * FROM team_tasks;  -- Should only return tasks from user's teams
RESET ROLE;
*/

-- ============================================================================
-- 9. DOCUMENTATION
-- ============================================================================

/*
RLS POLICY SUMMARY - TEAM & TASK MANAGEMENT
===========================================

TEAMS TABLE:
------------
SELECT: User yang adalah anggota aktif, ketua tim, atau admin
INSERT: Admin atau ketua tim (membuat tim untuk dirinya sendiri)
UPDATE: Ketua tim atau admin
DELETE: Admin only

TEAM_MEMBERS TABLE:
-------------------
SELECT: Anggota tim yang sama, ketua tim, atau admin
INSERT: Ketua tim atau admin
UPDATE: Ketua tim atau admin
DELETE: Ketua tim atau admin (gunakan soft delete: update is_active)

TEAM_TASKS TABLE:
-----------------
SELECT: Anggota tim, pembuat task, assigned person, ketua tim, atau admin
INSERT: Anggota tim, ketua tim, atau admin
UPDATE: 
  - Ketua tim: semua task di timnya
  - Anggota: task yang diassign ke dia atau yang dia buat
  - Admin: semua task
DELETE: Ketua tim atau admin

TEAM_ACTIVITIES TABLE:
----------------------
SELECT: Anggota tim, ketua tim, atau admin
INSERT: Admin atau anggota tim (sebaiknya via trigger)
UPDATE: NO ONE (immutable)
DELETE: NO ONE (immutable)

SECURITY NOTES:
--------------
1. FORCE RLS diaktifkan untuk semua tables
2. Activities table immutable (no update/delete)
3. Soft delete direkomendasikan untuk members
4. Semua policies menggunakan auth.uid() dari JWT
5. Helper functions tersedia untuk complex checks

BEST PRACTICES:
--------------
1. Gunakan stored procedures untuk operasi kompleks
2. Enable logging untuk failed RLS attempts
3. Regular audit policies dengan pg_policies view
4. Test RLS dengan SET ROLE sebagai different users
5. Dokumentasikan exceptions (security definer functions)

MULTI-PROJECT SCALABILITY:
-------------------------
- Policies menggunakan subqueries yang efisien
- Indexes tersedia untuk team_id, user_id columns
- No hardcoded IDs atau exceptions
- Semua checks based on relational data

*/

-- ============================================================================
-- END OF RLS POLICIES
-- ============================================================================
