-- GanttSmart: combined database setup
-- Paste this entire file into the Supabase SQL Editor and run it once.
-- (Combines supabase/migrations/001..006 in order.)
-- This file is only a local convenience for setup; safe to delete afterward.

-- ============================================================
-- 001_create_user_settings.sql
-- ============================================================
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  linear_access_token text,
  linear_token_type text DEFAULT 'Bearer',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_settings" ON public.user_settings
  FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_settings (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 002_create_shared_roadmaps.sql
-- ============================================================
CREATE TABLE public.shared_roadmaps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  project_name text NOT NULL,
  share_token text UNIQUE NOT NULL,
  password_hash text,
  expires_at timestamptz NOT NULL,
  cached_data jsonb,
  cached_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 003_create_planning_intelligence.sql
-- ============================================================
CREATE TABLE public.issue_change_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_id text NOT NULL,
  project_id text NOT NULL,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  changed_by text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.issue_change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_changes" ON public.issue_change_history
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.status_transition_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_id text NOT NULL,
  project_id text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  transitioned_at timestamptz NOT NULL DEFAULT now(),
  duration_in_status interval
);

ALTER TABLE public.status_transition_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_transitions" ON public.status_transition_log
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 004_enable_rls_shared_roadmaps.sql
-- ============================================================
ALTER TABLE public.shared_roadmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all" ON public.shared_roadmaps
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "anon_read" ON public.shared_roadmaps
  FOR SELECT TO anon
  USING (true);

-- ============================================================
-- 005_create_share_access_attempts.sql
-- ============================================================
CREATE TABLE public.share_access_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  share_token text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  first_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_share_attempts_token ON public.share_access_attempts(share_token);

ALTER TABLE public.share_access_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 006_create_task_baselines.sql
-- ============================================================
CREATE TABLE public.task_baselines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_id text NOT NULL,
  project_id text NOT NULL,
  planned_start text,
  planned_due text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, issue_id)
);

ALTER TABLE public.task_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_baselines" ON public.task_baselines
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_task_baselines_project ON public.task_baselines (user_id, project_id);

CREATE INDEX idx_issue_change_history_issue ON public.issue_change_history (user_id, issue_id);
CREATE INDEX idx_issue_change_history_project ON public.issue_change_history (user_id, project_id);

-- ============================================================
-- 007_add_column_config.sql
-- ============================================================
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS column_config jsonb;
