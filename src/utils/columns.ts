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
export const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = ['priority', 'status', 'due'];

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

// Cumulative left offsets (px) used to freeze the fixed columns while the timeline scrolls.
// Task is always pinned at left:0; each subsequent visible column is offset by the running
// total of the widths before it. Order must match the rendered column order.
export function stickyLeftOffsets(
  colWidths: ColumnWidths,
  visibleColumns: ColumnKey[],
): { task: number; cols: Record<string, number> } {
  let offset = colWidths.task ?? 0;
  const cols: Record<string, number> = {};
  for (const key of visibleColumns) {
    cols[key] = offset;
    offset += colWidths[key] ?? 0;
  }
  return { task: 0, cols };
}

// Normalize a stored value (which may be null/garbage) into a valid, canonically-ordered list.
export function sanitizeVisibleColumns(input: unknown): ColumnKey[] {
  if (!Array.isArray(input)) return [...DEFAULT_VISIBLE_COLUMNS];
  const set = new Set(input.filter((k): k is ColumnKey => COLUMN_KEYS.includes(k as ColumnKey)));
  return COLUMN_KEYS.filter((k) => set.has(k));
}
