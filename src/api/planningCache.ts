import { supabase } from '@/lib/supabase';
import type { Milestone, ProjectMeta, Task } from '@/types';

const CACHE_VERSION = 1;

export interface CachedScope {
  version: number;
  tasks: Task[];
  unscheduledTasks: Task[];
  doneTasks: Task[];
  projectMetas: ProjectMeta[];
  milestones: Milestone[];
  projectName: string;
  lastSyncedAt: string; // ISO timestamp of the last successful Linear sync
}

export function projectScopeKey(projectId: string): string {
  return `project:${projectId}`;
}

export function initiativeScopeKey(initiativeId: string): string {
  return `initiative:${initiativeId}`;
}

async function getUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/**
 * Read the shared cached scope (workspace-wide, not per user). Returns null on a miss.
 * Reading only the lightweight `last_synced_at` first is possible, but callers also need
 * the data, so we fetch both.
 */
export async function readScopeCache(scopeKey: string): Promise<CachedScope | null> {
  const { data, error } = await supabase
    .from('planning_cache')
    .select('data')
    .eq('scope_key', scopeKey)
    .maybeSingle();

  if (error) throw new Error(`Failed to read cache: ${error.message}`);
  if (!data?.data) return null;

  const cached = data.data as CachedScope;
  if (cached.version !== CACHE_VERSION) return null; // schema changed — ignore old cache
  return cached;
}

/** Write (upsert) the shared cached scope. */
export async function writeScopeCache(scopeKey: string, scope: Omit<CachedScope, 'version'>): Promise<void> {
  const userId = await getUserId();
  const payload: CachedScope = { version: CACHE_VERSION, ...scope };
  const { error } = await supabase.from('planning_cache').upsert({
    scope_key: scopeKey,
    data: payload,
    last_synced_at: scope.lastSyncedAt,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(`Failed to write cache: ${error.message}`);
}
