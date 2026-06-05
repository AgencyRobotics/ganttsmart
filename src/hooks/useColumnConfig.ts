import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toastError } from '@/components/Toast';
import {
  DEFAULT_VISIBLE_COLUMNS,
  sanitizeVisibleColumns,
  type ColumnKey,
} from '@/utils/columns';

/** Get the current user ID from the local session (no network call). */
async function getUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/**
 * Loads and persists the user's visible-column selection on `user_settings.column_config`.
 * The selection is per account, so it follows the user across devices.
 */
export function useColumnConfig() {
  const [visibleColumns, setVisibleColumnsState] = useState<ColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const userId = await getUserId();
      if (!userId) return;

      const { data, error } = await supabase
        .from('user_settings')
        .select('column_config')
        .eq('id', userId)
        .single();

      if (cancelled) return;

      if (error) {
        toastError(`Failed to load column settings: ${error.message}`);
        return;
      }

      // A null config means the user hasn't customized columns yet — start from defaults.
      if (data?.column_config != null) {
        setVisibleColumnsState(sanitizeVisibleColumns(data.column_config));
      }
      loadedRef.current = true;
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setVisibleColumns = useCallback(async (next: ColumnKey[]) => {
    const sanitized = sanitizeVisibleColumns(next);
    setVisibleColumnsState(sanitized);

    const userId = await getUserId();
    if (!userId) return;

    const { error } = await supabase
      .from('user_settings')
      .upsert({ id: userId, column_config: sanitized, updated_at: new Date().toISOString() });

    if (error) {
      toastError(`Failed to save column settings: ${error.message}`);
      throw new Error(error.message);
    }
  }, []);

  return { visibleColumns, setVisibleColumns, loaded };
}
