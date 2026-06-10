import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ChangeEvent {
  issue_id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

/** Get the current user ID from the local session (no network call). */
async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/**
 * Logs planning change events for audit: due/start date changes and status transitions.
 */
export function usePlanningHistory(projectId: string) {
  // Log a field change to issue_change_history
  const logChange = useCallback(
    async (issueId: string, field: string, oldValue: string | null, newValue: string | null) => {
      if (!projectId) return;
      const userId = await getUserId();
      if (!userId) return;

      const { error } = await supabase.from('issue_change_history').insert({
        user_id: userId,
        issue_id: issueId,
        project_id: projectId,
        field_changed: field,
        old_value: oldValue,
        new_value: newValue,
      });

      if (error) {
        console.warn('Failed to log change:', error.message);
      }
    },
    [projectId],
  );

  // Log a status transition
  const logStatusTransition = useCallback(
    async (issueId: string, fromStatus: string | null, toStatus: string) => {
      if (!projectId) return;
      const userId = await getUserId();
      if (!userId) return;

      const { error } = await supabase.from('status_transition_log').insert({
        user_id: userId,
        issue_id: issueId,
        project_id: projectId,
        from_status: fromStatus,
        to_status: toStatus,
      });

      if (error) {
        console.warn('Failed to log status transition:', error.message);
      }
    },
    [projectId],
  );

  // Fetch change history for a specific task
  const getTaskHistory = useCallback(
    async (issueId: string): Promise<ChangeEvent[]> => {
      if (!projectId) return [];
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('issue_change_history')
        .select('issue_id, field_changed, old_value, new_value, changed_at')
        .eq('user_id', userId)
        .eq('issue_id', issueId)
        .order('changed_at', { ascending: false })
        .limit(50);

      if (error) {
        console.warn('Failed to fetch task history:', error.message);
        return [];
      }
      return data || [];
    },
    [projectId],
  );

  return {
    logChange,
    logStatusTransition,
    getTaskHistory,
  };
}
