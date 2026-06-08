-- Shared, workspace-wide cache of mapped scope data (a project or an initiative).
-- Keyed by scope only (NOT per user) so a single sync serves every user and the app
-- can render instantly from cache + sync only what changed from Linear.
-- scope_key is 'project:<id>' or 'initiative:<id>'.
--
-- NOTE: this cache is shared across all authenticated users of the deployment. Anyone
-- signed in can read any cached scope, regardless of their individual Linear access.
-- Suitable for a single trusted org; revisit if private teams/projects must stay hidden.

-- Safe to re-run: drops a prior (e.g. per-user) version of this cache table.
DROP TABLE IF EXISTS public.planning_cache;

CREATE TABLE public.planning_cache (
  scope_key text PRIMARY KEY,
  data jsonb NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planning_cache ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may read and write the shared cache.
CREATE POLICY "authenticated_read_planning_cache" ON public.planning_cache
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated_write_planning_cache" ON public.planning_cache
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
