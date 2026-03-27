-- ============================================================================
-- NOTIFICATIONS SYSTEM - REAL-TIME NOTIFICATIONS
-- Smart AI Engineering Platform - SPKBG
-- 
-- Sistem notifikasi real-time untuk team management dengan triggers
-- dan Supabase Realtime integration
-- ============================================================================

-- ============================================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB,
    priority VARCHAR(20) DEFAULT 'normal',
    is_read BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_team_id ON notifications(team_id);
CREATE INDEX idx_notifications_type ON notifications(type);

-- Comment
COMMENT ON TABLE notifications IS 'Sistem notifikasi real-time untuk user';

-- ============================================================================
-- 2. ENABLE RLS
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

-- Policy: User hanya bisa lihat notifikasi miliknya
CREATE POLICY "notifications_select_own"
    ON notifications
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Policy: User bisa update notifikasi miliknya (mark as read)
CREATE POLICY "notifications_update_own"
    ON notifications
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: System bisa insert notifikasi (via trigger/trusted functions)
CREATE POLICY "notifications_insert_system"
    ON notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: User bisa delete notifikasi miliknya (soft delete via archived)
CREATE POLICY "notifications_delete_own"
    ON notifications
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- 4. TRIGGER FUNCTIONS FOR NOTIFICATIONS
-- ============================================================================

-- Function: Notify saat task di-assign
CREATE OR REPLACE FUNCTION notify_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_team_name TEXT;
    v_ketua_id UUID;
BEGIN
    -- Hanya notify jika ada assigned_to dan assigned_to bukan pembuat task
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.created_by THEN
        -- Get team name
        SELECT name, ketua_id INTO v_team_name, v_ketua_id
        FROM teams WHERE id = NEW.team_id;

        -- Insert notifikasi untuk assigned user
        INSERT INTO notifications (
            user_id,
            team_id,
            type,
            title,
            message,
            priority,
            data,
            action_url
        ) VALUES (
            NEW.assigned_to,
            NEW.team_id,
            'task_assigned',
            'Tugas Baru Ditugaskan',
            format('Anda mendapatkan tugas "%s" di tim %s', NEW.title, v_team_name),
            CASE 
                WHEN NEW.priority = 'urgent' THEN 'high'
                WHEN NEW.priority = 'high' THEN 'high'
                ELSE 'normal'
            END,
            jsonb_build_object(
                'task_id', NEW.id,
                'task_title', NEW.title,
                'team_id', NEW.team_id,
                'team_name', v_team_name,
                'priority', NEW.priority,
                'due_date', NEW.due_date
            ),
            format('/teams/%s/tasks/%s', NEW.team_id, NEW.id)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Notify saat status task berubah
CREATE OR REPLACE FUNCTION notify_task_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_team_name TEXT;
    v_assigned_name TEXT;
    v_creator_id UUID;
    v_old_status TEXT;
    v_new_status TEXT;
BEGIN
    -- Only proceed if status actually changed
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Get team info
    SELECT name INTO v_team_name FROM teams WHERE id = NEW.team_id;

    -- Get assigned user name
    SELECT user_name INTO v_assigned_name 
    FROM team_member_detail 
    WHERE user_id = NEW.assigned_to AND team_id = NEW.team_id;

    -- Store creator ID
    v_creator_id := NEW.created_by;
    v_old_status := OLD.status;
    v_new_status := NEW.status;

    -- 1. Notify creator jika bukan yang update
    IF v_creator_id IS NOT NULL AND v_creator_id != auth.uid() THEN
        INSERT INTO notifications (
            user_id, team_id, type, title, message, priority, data, action_url
        ) VALUES (
            v_creator_id,
            NEW.team_id,
            'task_status_changed',
            format('Status Tugas Diperbarui: %s', NEW.title),
            format('Status "%s" berubah dari %s ke %s', NEW.title, v_old_status, v_new_status),
            'normal',
            jsonb_build_object(
                'task_id', NEW.id,
                'task_title', NEW.title,
                'old_status', v_old_status,
                'new_status', v_new_status,
                'changed_by', auth.uid(),
                'team_name', v_team_name
            ),
            format('/teams/%s/tasks/%s', NEW.team_id, NEW.id)
        );
    END IF;

    -- 2. Notify ketua tim jika bukan yang update
    SELECT ketua_id INTO v_creator_id FROM teams WHERE id = NEW.team_id;
    IF v_creator_id IS NOT NULL AND v_creator_id != auth.uid() AND v_creator_id != NEW.created_by THEN
        INSERT INTO notifications (
            user_id, team_id, type, title, message, priority, data, action_url
        ) VALUES (
            v_creator_id,
            NEW.team_id,
            'task_status_changed',
            format('Status Tugas Tim: %s', NEW.title),
            format('Status tugas "%s" diperbarui menjadi %s', NEW.title, v_new_status),
            'low',
            jsonb_build_object(
                'task_id', NEW.id,
                'task_title', NEW.title,
                'new_status', v_new_status,
                'team_name', v_team_name
            ),
            format('/teams/%s/tasks/%s', NEW.team_id, NEW.id)
        );
    END IF;

    -- 3. Special notifications untuk completed tasks
    IF NEW.status = 'done' AND OLD.status != 'done' THEN
        -- Notify all team members about completion
        INSERT INTO notifications (
            user_id, team_id, type, title, message, priority, data, action_url
        )
        SELECT 
            tm.user_id,
            NEW.team_id,
            'task_completed',
            format('Tugas Selesai: %s', NEW.title),
            format('Tugas "%s" telah diselesaikan oleh %s', NEW.title, COALESCE(v_assigned_name, 'anggota tim')),
            'low',
            jsonb_build_object(
                'task_id', NEW.id,
                'task_title', NEW.title,
                'completed_by', NEW.assigned_to,
                'completed_by_name', v_assigned_name,
                'team_name', v_team_name
            ),
            format('/teams/%s/tasks/%s', NEW.team_id, NEW.id)
        FROM team_members tm
        WHERE tm.team_id = NEW.team_id 
        AND tm.is_active = true
        AND tm.user_id NOT IN (NEW.assigned_to, auth.uid())
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Notify saat member ditambahkan ke tim
CREATE OR REPLACE FUNCTION notify_member_added()
RETURNS TRIGGER AS $$
DECLARE
    v_team_name TEXT;
    v_added_by_name TEXT;
BEGIN
    -- Get team name
    SELECT name INTO v_team_name FROM teams WHERE id = NEW.team_id;

    -- Get who added
    SELECT name INTO v_added_by_name FROM users WHERE id = NEW.assigned_by;

    -- Insert notifikasi untuk member baru
    INSERT INTO notifications (
        user_id,
        team_id,
        type,
        title,
        message,
        priority,
        data,
        action_url
    ) VALUES (
        NEW.user_id,
        NEW.team_id,
        'member_added',
        format('Anda Ditambahkan ke Tim %s', v_team_name),
        format('Anda telah ditambahkan sebagai %s di tim %s oleh %s', NEW.role, v_team_name, COALESCE(v_added_by_name, 'Admin')),
        'normal',
        jsonb_build_object(
            'team_id', NEW.team_id,
            'team_name', v_team_name,
            'role', NEW.role,
            'added_by', NEW.assigned_by,
            'added_by_name', v_added_by_name,
            'joined_at', NEW.joined_at
        ),
        format('/teams/%s', NEW.team_id)
    );

    -- Also notify team leader
    SELECT ketua_id INTO v_added_by_name FROM teams WHERE id = NEW.team_id;
    IF v_added_by_name IS NOT NULL AND v_added_by_name != NEW.user_id THEN
        INSERT INTO notifications (
            user_id,
            team_id,
            type,
            title,
            message,
            priority,
            data,
            action_url
        ) VALUES (
            v_added_by_name,
            NEW.team_id,
            'member_joined',
            'Anggota Baru Bergabung',
            format('Anggota baru bergabung di tim %s dengan peran %s', v_team_name, NEW.role),
            'low',
            jsonb_build_object(
                'team_id', NEW.team_id,
                'team_name', v_team_name,
                'new_member_id', NEW.user_id,
                'role', NEW.role
            ),
            format('/teams/%s/members', NEW.team_id)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Notify deadline approaching
CREATE OR REPLACE FUNCTION notify_deadline_approaching()
RETURNS TRIGGER AS $$
DECLARE
    v_days_until INTEGER;
    v_team_name TEXT;
BEGIN
    -- Only check if due_date exists and task not done/cancelled
    IF NEW.due_date IS NULL OR NEW.status IN ('done', 'cancelled') THEN
        RETURN NEW;
    END IF;

    -- Calculate days until deadline
    v_days_until := EXTRACT(DAY FROM (NEW.due_date - CURRENT_DATE));

    -- Get team name
    SELECT name INTO v_team_name FROM teams WHERE id = NEW.team_id;

    -- Notify if deadline is tomorrow
    IF v_days_until = 1 THEN
        -- Notify assigned user
        IF NEW.assigned_to IS NOT NULL THEN
            INSERT INTO notifications (
                user_id, team_id, type, title, message, priority, data, action_url
            ) VALUES (
                NEW.assigned_to,
                NEW.team_id,
                'deadline_approaching',
                format('⚠️ Deadline Besok: %s', NEW.title),
                format('Tugas "%s" deadline besok (%s). Segera selesaikan!', NEW.title, NEW.due_date),
                'high',
                jsonb_build_object(
                    'task_id', NEW.id,
                    'task_title', NEW.title,
                    'due_date', NEW.due_date,
                    'days_remaining', 1,
                    'team_name', v_team_name
                ),
                format('/teams/%s/tasks/%s', NEW.team_id, NEW.id)
            );
        END IF;

        -- Notify ketua
        SELECT ketua_id INTO v_team_name FROM teams WHERE id = NEW.team_id;
        IF v_team_name IS NOT NULL THEN
            INSERT INTO notifications (
                user_id, team_id, type, title, message, priority, data, action_url
            ) VALUES (
                v_team_name,
                NEW.team_id,
                'deadline_approaching',
                format('Deadline Besok Tim: %s', NEW.title),
                format('Ada tugas deadline besok di tim Anda: %s', NEW.title),
                'normal',
                jsonb_build_object(
                    'task_id', NEW.id,
                    'task_title', NEW.title,
                    'due_date', NEW.due_date,
                    'assigned_to', NEW.assigned_to
                ),
                format('/teams/%s/tasks/%s', NEW.team_id, NEW.id)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. CREATE TRIGGERS
-- ============================================================================

-- Trigger: Task assignment notification
DROP TRIGGER IF EXISTS task_assign_notification ON team_tasks;
CREATE TRIGGER task_assign_notification
    AFTER INSERT ON team_tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_task_assignment();

-- Trigger: Task status change notification
DROP TRIGGER IF EXISTS task_status_notification ON team_tasks;
CREATE TRIGGER task_status_notification
    AFTER UPDATE OF status ON team_tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_task_status_change();

-- Trigger: Member added notification
DROP TRIGGER IF EXISTS member_added_notification ON team_members;
CREATE TRIGGER member_added_notification
    AFTER INSERT ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION notify_member_added();

-- Trigger: Deadline approaching (run daily via cron job)
DROP TRIGGER IF EXISTS task_deadline_notification ON team_tasks;
CREATE TRIGGER task_deadline_notification
    AFTER UPDATE OF due_date ON team_tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_deadline_approaching();

-- ============================================================================
-- 6. SCHEDULED JOB FOR DEADLINE CHECK
-- ============================================================================

-- Function to check all approaching deadlines (to be called by cron/job scheduler)
CREATE OR REPLACE FUNCTION check_all_approaching_deadlines()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_task RECORD;
    v_team_name TEXT;
    v_ketua_id UUID;
BEGIN
    -- Find tasks with deadline tomorrow or today that are not done
    FOR v_task IN
        SELECT 
            tt.id,
            tt.title,
            tt.due_date,
            tt.assigned_to,
            tt.team_id,
            t.name as team_name,
            t.ketua_id
        FROM team_tasks tt
        JOIN teams t ON tt.team_id = t.id
        WHERE tt.due_date IS NOT NULL
        AND tt.status NOT IN ('done', 'cancelled')
        AND (tt.due_date - CURRENT_DATE) IN (0, 1)
        AND NOT EXISTS (
            SELECT 1 FROM notifications n
            WHERE n.data->>'task_id' = tt.id::text
            AND n.type = 'deadline_approaching'
            AND n.created_at > CURRENT_DATE - INTERVAL '1 day'
        )
    LOOP
        -- Notify assigned user
        IF v_task.assigned_to IS NOT NULL THEN
            INSERT INTO notifications (
                user_id, team_id, type, title, message, priority, data, action_url
            ) VALUES (
                v_task.assigned_to,
                v_task.team_id,
                'deadline_approaching',
                CASE 
                    WHEN v_task.due_date = CURRENT_DATE THEN format('🔴 Deadline Hari Ini: %s', v_task.title)
                    ELSE format('⚠️ Deadline Besok: %s', v_task.title)
                END,
                CASE 
                    WHEN v_task.due_date = CURRENT_DATE THEN format('Tugas "%s" deadline HARI INI! Segera selesaikan!', v_task.title)
                    ELSE format('Tugas "%s" deadline besok (%s). Segera selesaikan!', v_task.title, v_task.due_date)
                END,
                CASE WHEN v_task.due_date = CURRENT_DATE THEN 'urgent' ELSE 'high' END,
                jsonb_build_object(
                    'task_id', v_task.id,
                    'task_title', v_task.title,
                    'due_date', v_task.due_date,
                    'days_remaining', CASE WHEN v_task.due_date = CURRENT_DATE THEN 0 ELSE 1 END,
                    'team_name', v_task.team_name
                ),
                format('/teams/%s/tasks/%s', v_task.team_id, v_task.id)
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function: Mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE notifications
    SET is_read = TRUE, read_at = NOW()
    WHERE user_id = p_user_id AND is_read = FALSE;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM notifications
    WHERE user_id = p_user_id AND is_read = FALSE AND is_archived = FALSE;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. VIEWS
-- ============================================================================

-- View: User notifications with additional info
CREATE OR REPLACE VIEW user_notifications AS
SELECT 
    n.*,
    CASE 
        WHEN n.created_at > NOW() - INTERVAL '1 minute' THEN 'baru saja'
        WHEN n.created_at > NOW() - INTERVAL '1 hour' THEN EXTRACT(MINUTE FROM (NOW() - n.created_at))::text || ' menit'
        WHEN n.created_at > NOW() - INTERVAL '1 day' THEN EXTRACT(HOUR FROM (NOW() - n.created_at))::text || ' jam'
        ELSE EXTRACT(DAY FROM (NOW() - n.created_at))::text || ' hari'
    END as time_ago
FROM notifications n
WHERE n.is_archived = FALSE
ORDER BY n.created_at DESC;

-- ============================================================================
-- 9. SAMPLE DATA (Optional - for testing)
-- ============================================================================

/*
-- Uncomment to insert sample notifications for testing
INSERT INTO notifications (user_id, type, title, message, priority, is_read)
VALUES 
    ('user-uuid', 'task_assigned', 'Tugas Baru', 'Anda mendapatkan tugas Survey Pondasi', 'normal', false),
    ('user-uuid', 'deadline_approaching', 'Deadline Besok', 'Tugas Analisis Struktur deadline besok', 'high', false),
    ('user-uuid', 'task_completed', 'Tugas Selesai', 'Tugas Dokumentasi selesai dikerjakan', 'low', true);
*/

-- ============================================================================
-- END OF NOTIFICATIONS SYSTEM
-- ============================================================================
