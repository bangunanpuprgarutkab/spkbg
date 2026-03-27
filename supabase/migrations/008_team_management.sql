-- ============================================================================
-- DATABASE MIGRATION: TEAM MANAGEMENT SYSTEM
-- Smart AI Engineering Platform - SPKBG
-- 
-- Tables:
-- - teams (tim teknis)
-- - team_members (anggota tim dengan role)
-- - team_tasks (tugas tim)
-- - team_activities (audit log aktivitas)
-- ============================================================================

-- ============================================================================
-- 1. TEAMS (Tim Teknis)
-- ============================================================================

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Ketua Tim (WAJIB)
    ketua_id UUID NOT NULL REFERENCES users(id),
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(project_id) -- 1 project = 1 team
);

COMMENT ON TABLE teams IS 'Tim teknis untuk penilaian kerusakan bangunan';

CREATE INDEX idx_teams_project ON teams(project_id);
CREATE INDEX idx_teams_ketua ON teams(ketua_id);
CREATE INDEX idx_teams_status ON teams(status);

-- ============================================================================
-- 2. TEAM MEMBERS (Anggota Tim)
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Role dalam tim
    role TEXT NOT NULL CHECK (role IN (
        'ketua_tim',      -- Ketua Tim (hanya 1 per tim)
        'surveyor',       -- Surveyor lapangan
        'analis',         -- Analis data & perhitungan
        'verifikator',    -- Verifikator hasil
        'dokumentator'    -- Dokumentasi & reporting
    )),
    
    -- Status anggota
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    left_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    assigned_by UUID REFERENCES users(id),
    notes TEXT,
    
    UNIQUE(team_id, user_id) -- 1 user hanya 1x per tim
);

COMMENT ON TABLE team_members IS 'Anggota tim dengan peran masing-masing';

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_members_role ON team_members(role);
CREATE INDEX idx_team_members_active ON team_members(is_active) WHERE is_active = true;

-- ============================================================================
-- 3. TEAM TASKS (Tugas Tim)
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Detail tugas
    title TEXT NOT NULL,
    description TEXT,
    task_type TEXT CHECK (task_type IN (
        'survey',
        'analisis',
        'verifikasi',
        'dokumentasi',
        'rapat',
        'lainnya'
    )),
    
    -- Assignment
    assigned_to UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    
    -- Status workflow
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Menunggu
        'in_progress',  -- Sedang dikerjakan
        'review',       -- Dalam review
        'done',         -- Selesai
        'blocked',      -- Terhambat
        'cancelled'     -- Dibatalkan
    )),
    
    -- Priority
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    
    -- Timeline
    due_date DATE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Progress tracking
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    estimated_hours INTEGER,
    actual_hours INTEGER,
    
    -- Related data
    survey_id UUID REFERENCES surveys(id),
    component_id UUID REFERENCES components(id),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE team_tasks IS 'Tugas yang diberikan ke anggota tim';

CREATE INDEX idx_team_tasks_team ON team_tasks(team_id);
CREATE INDEX idx_team_tasks_assigned ON team_tasks(assigned_to);
CREATE INDEX idx_team_tasks_status ON team_tasks(status);
CREATE INDEX idx_team_tasks_priority ON team_tasks(priority);
CREATE INDEX idx_team_tasks_due ON team_tasks(due_date);
CREATE INDEX idx_team_tasks_survey ON team_tasks(survey_id);

-- ============================================================================
-- 4. TEAM ACTIVITIES (Audit Log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Aktivitas
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'member_added',
        'member_removed',
        'task_created',
        'task_assigned',
        'task_updated',
        'task_completed',
        'survey_started',
        'survey_completed',
        'status_changed'
    )),
    
    -- Detail
    description TEXT NOT NULL,
    metadata JSONB,
    
    -- Target (optional)
    target_user_id UUID REFERENCES users(id),
    target_task_id UUID REFERENCES team_tasks(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE team_activities IS 'Log aktivitas tim untuk audit';

CREATE INDEX idx_team_activities_team ON team_activities(team_id);
CREATE INDEX idx_team_activities_user ON team_activities(user_id);
CREATE INDEX idx_team_activities_type ON team_activities(activity_type);
CREATE INDEX idx_team_activities_created ON team_activities(created_at);

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

-- Teams RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams viewable by members"
    ON teams FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = teams.id
            AND tm.user_id = auth.uid()
            AND tm.is_active = true
        )
        OR teams.ketua_id = auth.uid()
        OR teams.created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

CREATE POLICY "Teams manageable by ketua or admin"
    ON teams FOR ALL
    TO authenticated
    USING (
        teams.ketua_id = auth.uid()
        OR teams.created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

-- Team Members RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members viewable by team members"
    ON team_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_members.team_id
            AND tm.user_id = auth.uid()
            AND tm.is_active = true
        )
        OR EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_members.team_id
            AND t.ketua_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

CREATE POLICY "Team members manageable by ketua or admin"
    ON team_members FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_members.team_id
            AND t.ketua_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

-- Team Tasks RLS
ALTER TABLE team_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks viewable by team members"
    ON team_tasks FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_tasks.team_id
            AND tm.user_id = auth.uid()
            AND tm.is_active = true
        )
        OR team_tasks.assigned_to = auth.uid()
        OR team_tasks.created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_tasks.team_id
            AND t.ketua_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

CREATE POLICY "Tasks manageable by ketua or assigned user"
    ON team_tasks FOR ALL
    TO authenticated
    USING (
        team_tasks.assigned_to = auth.uid()
        OR team_tasks.created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM teams t
            JOIN team_members tm ON t.id = tm.team_id
            WHERE t.id = team_tasks.team_id
            AND tm.user_id = auth.uid()
            AND tm.role = 'ketua_tim'
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    );

-- Team Activities RLS
ALTER TABLE team_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activities viewable by team members"
    ON team_activities FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = team_activities.team_id
            AND tm.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_activities.team_id
            AND t.ketua_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
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

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_tasks_updated_at BEFORE UPDATE ON team_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Log team activities
CREATE OR REPLACE FUNCTION log_team_activity(
    p_team_id UUID,
    p_user_id UUID,
    p_activity_type TEXT,
    p_description TEXT,
    p_metadata JSONB DEFAULT NULL,
    p_target_user_id UUID DEFAULT NULL,
    p_target_task_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO team_activities (
        team_id,
        user_id,
        activity_type,
        description,
        metadata,
        target_user_id,
        target_task_id
    ) VALUES (
        p_team_id,
        p_user_id,
        p_activity_type,
        p_description,
        p_metadata,
        p_target_user_id,
        p_target_task_id
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger: Log when member added
CREATE OR REPLACE FUNCTION log_member_added()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_team_activity(
        NEW.team_id,
        COALESCE(NEW.assigned_by, NEW.user_id),
        'member_added',
        format('Menambahkan %s sebagai %s', 
            (SELECT name FROM users WHERE id = NEW.user_id),
            NEW.role
        ),
        jsonb_build_object('role', NEW.role),
        NEW.user_id,
        NULL
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_member_added_trigger
    AFTER INSERT ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION log_member_added();

-- Trigger: Log when task created
CREATE OR REPLACE FUNCTION log_task_created()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_team_activity(
        NEW.team_id,
        NEW.created_by,
        'task_created',
        format('Membuat tugas: %s', NEW.title),
        jsonb_build_object(
            'task_id', NEW.id,
            'assigned_to', NEW.assigned_to,
            'due_date', NEW.due_date
        ),
        NEW.assigned_to,
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_task_created_trigger
    AFTER INSERT ON team_tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_created();

-- Trigger: Log when task status changed
CREATE OR REPLACE FUNCTION log_task_status_changed()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM log_team_activity(
            NEW.team_id,
            COALESCE(auth.uid(), NEW.assigned_to),
            'task_updated',
            format('Status tugas "%s" berubah dari %s ke %s', 
                NEW.title, OLD.status, NEW.status
            ),
            jsonb_build_object(
                'task_id', NEW.id,
                'old_status', OLD.status,
                'new_status', NEW.status
            ),
            NULL,
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_task_status_trigger
    AFTER UPDATE ON team_tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_status_changed();

-- ============================================================================
-- 7. VIEWS
-- ============================================================================

-- Team summary view
CREATE OR REPLACE VIEW team_summary AS
SELECT 
    t.id,
    t.name,
    t.description,
    t.status as team_status,
    p.id as project_id,
    p.nama_bangunan,
    k.name as ketua_name,
    (SELECT COUNT(*) FROM team_members tm 
     WHERE tm.team_id = t.id AND tm.is_active = true) as member_count,
    (SELECT COUNT(*) FROM team_tasks tt 
     WHERE tt.team_id = t.id) as total_tasks,
    (SELECT COUNT(*) FROM team_tasks tt 
     WHERE tt.team_id = t.id AND tt.status = 'done') as completed_tasks,
    (SELECT COUNT(*) FROM team_tasks tt 
     WHERE tt.team_id = t.id AND tt.status = 'in_progress') as in_progress_tasks,
    (SELECT COUNT(*) FROM team_tasks tt 
     WHERE tt.team_id = t.id AND tt.status = 'pending') as pending_tasks,
    (SELECT COUNT(*) FROM team_tasks tt 
     WHERE tt.team_id = t.id AND tt.due_date < CURRENT_DATE 
     AND tt.status NOT IN ('done', 'cancelled')) as overdue_tasks,
    CASE 
        WHEN (SELECT COUNT(*) FROM team_tasks tt WHERE tt.team_id = t.id) > 0
        THEN ROUND(
            (SELECT COUNT(*) FROM team_tasks tt 
             WHERE tt.team_id = t.id AND tt.status = 'done')::numeric / 
            (SELECT COUNT(*) FROM team_tasks tt WHERE tt.team_id = t.id)::numeric * 100, 
            1
        )
        ELSE 0
    END as progress_percentage,
    t.created_at,
    t.updated_at
FROM teams t
JOIN projects p ON t.project_id = p.id
JOIN users k ON t.ketua_id = k.id;

COMMENT ON VIEW team_summary IS 'Ringkasan tim dengan statistik';

-- Team member detail view
CREATE OR REPLACE VIEW team_member_detail AS
SELECT 
    tm.id,
    tm.team_id,
    tm.user_id,
    u.name as user_name,
    u.email as user_email,
    tm.role,
    tm.is_active,
    tm.joined_at,
    tm.left_at,
    (SELECT COUNT(*) FROM team_tasks tt 
     WHERE tt.assigned_to = tm.user_id 
     AND tt.team_id = tm.team_id
     AND tt.status NOT IN ('done', 'cancelled')) as active_tasks,
    (SELECT COUNT(*) FROM team_tasks tt 
     WHERE tt.assigned_to = tm.user_id 
     AND tt.team_id = tm.team_id
     AND tt.status = 'done') as completed_tasks
FROM team_members tm
JOIN users u ON tm.user_id = u.id;

COMMENT ON VIEW team_member_detail IS 'Detail anggota tim dengan statistik tugas';

-- Task board view (for Kanban)
CREATE OR REPLACE VIEW task_board AS
SELECT 
    tt.*,
    u.name as assigned_to_name,
    t.name as team_name,
    p.nama_bangunan as project_name,
    CASE 
        WHEN tt.due_date < CURRENT_DATE AND tt.status NOT IN ('done', 'cancelled')
        THEN true
        ELSE false
    END as is_overdue,
    CASE 
        WHEN tt.due_date = CURRENT_DATE AND tt.status NOT IN ('done', 'cancelled')
        THEN true
        ELSE false
    END as is_due_today,
    CASE 
        WHEN tt.due_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 3 
        AND tt.status NOT IN ('done', 'cancelled')
        THEN true
        ELSE false
    END as is_due_soon
FROM team_tasks tt
LEFT JOIN users u ON tt.assigned_to = u.id
JOIN teams t ON tt.team_id = t.id
JOIN projects p ON t.project_id = p.id;

COMMENT ON VIEW task_board IS 'View untuk Kanban board';

-- ============================================================================
-- 8. SAMPLE DATA (Optional)
-- ============================================================================

-- Note: Sample data should be inserted after users and projects exist
-- This is just for documentation purposes

/*
-- Example team
INSERT INTO teams (project_id, name, description, ketua_id, created_by) VALUES
('project-uuid', 'Tim Survey Gedung A', 'Tim penilaian kerusakan gedung utama', 'ketua-uuid', 'admin-uuid');

-- Example members
INSERT INTO team_members (team_id, user_id, role, assigned_by) VALUES
('team-uuid', 'ketua-uuid', 'ketua_tim', 'admin-uuid'),
('team-uuid', 'surveyor1-uuid', 'surveyor', 'ketua-uuid'),
('team-uuid', 'analis1-uuid', 'analis', 'ketua-uuid'),
('team-uuid', 'verifikator1-uuid', 'verifikator', 'ketua-uuid');

-- Example tasks
INSERT INTO team_tasks (team_id, title, description, task_type, assigned_to, created_by, status, priority, due_date) VALUES
('team-uuid', 'Survey Komponen Struktur', 'Melakukan survey dinding, kolom, dan balok', 'survey', 'surveyor1-uuid', 'ketua-uuid', 'pending', 'high', CURRENT_DATE + 7),
('team-uuid', 'Analisis Data Kerusakan', 'Menghitung klasifikasi kerusakan', 'analisis', 'analis1-uuid', 'ketua-uuid', 'pending', 'medium', CURRENT_DATE + 14);
*/
