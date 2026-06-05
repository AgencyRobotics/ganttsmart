-- Per-user Gantt table column configuration.
-- Stores the ordered list of visible optional columns, e.g. ["priority","status","due"].

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS column_config jsonb;
