// Configurable table columns for the Gantt grid.
// The "Task" column is always shown; everything below is optional and toggleable
// via the Configure button. The user's choice is persisted per account.

export type ColumnKey = 'priority' | 'status' | 'assignee' | 'start' | 'due';

export interface ColumnDef {
  key: ColumnKey;
  label: string;
}

// Order here defines the on-screen order of the optional columns (Task is always first).
export const COLUMN_DEFS: ColumnDef[] = [
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'start', label: 'Start' },
  { key: 'due', label: 'Due' },
];

export const COLUMN_KEYS: ColumnKey[] = COLUMN_DEFS.map((c) => c.key);

// Columns shown by default (matches the historical layout: Priority + Due).
export const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = ['priority', 'due'];

// Widths are keyed by 'task' plus every ColumnKey.
export type ColumnWidths = Record<string, number>;

export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  task: 300,
  priority: 90,
  status: 120,
  assignee: 150,
  start: 84,
  due: 84,
};

export const MIN_COLUMN_WIDTHS: ColumnWidths = {
  task: 220,
  priority: 80,
  status: 90,
  assignee: 100,
  start: 70,
  due: 70,
};

// Normalize a stored value (which may be null/garbage) into a valid, canonically-ordered list.
export function sanitizeVisibleColumns(input: unknown): ColumnKey[] {
  if (!Array.isArray(input)) return [...DEFAULT_VISIBLE_COLUMNS];
  const set = new Set(input.filter((k): k is ColumnKey => COLUMN_KEYS.includes(k as ColumnKey)));
  return COLUMN_KEYS.filter((k) => set.has(k));
}
