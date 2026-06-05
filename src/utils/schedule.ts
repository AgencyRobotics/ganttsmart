import type { Task } from '@/types';

export const DEFAULT_DURATION_DAYS = 7;

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseYMD(s: string): Date {
  return new Date(s + 'T00:00:00');
}

function addDays(ymd: string, days: number): string {
  const d = parseYMD(ymd);
  d.setDate(d.getDate() + days);
  return toYMD(d);
}

function todayYMD(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toYMD(d);
}

/**
 * Apply default scheduling rules for the Gantt display. This is pure and
 * display-only — it returns new Task objects and never writes back to Linear.
 *
 *  1. Default every issue to a 1-week duration:
 *     - Has a due date but no start date  -> start = due - 7 days.
 *     - Has no due date at all            -> start = today, due = today + 7 days.
 *  2. Blocking dependency: a blocked issue starts when its blocker is due, i.e.
 *     start = the latest due date among its blockers. The due date is extended
 *     when necessary so the bar keeps at least a 1-week duration. Resolved
 *     iteratively so chains (A blocks B blocks C) cascade.
 *
 * @param scheduledTasks issues that already have a due date (explicit or via project target)
 * @param unscheduledTasks issues with no due date at all
 */
export function applyScheduleDefaults(scheduledTasks: Task[], unscheduledTasks: Task[]): Task[] {
  const today = todayYMD();

  // 1a. Issues with a due date: give them a 1-week lead-in start when missing one.
  const withDue: Task[] = scheduledTasks.map((t) =>
    t.startDate ? { ...t } : { ...t, startDate: addDays(t.due, -DEFAULT_DURATION_DAYS) },
  );

  // 1b. Issues with no due date: default to today -> today + 1 week.
  const noDue: Task[] = unscheduledTasks.map((t) => ({
    ...t,
    startDate: today,
    due: addDays(today, DEFAULT_DURATION_DAYS),
  }));

  const merged = [...withDue, ...noDue];

  // Tasks that already have an explicit start date (a start tag in Linear) are treated as
  // user-controlled: the dependency shift below leaves them alone so manual edits / accepted
  // and reverted dates stick instead of being repeatedly overridden.
  const hasExplicitStart = new Set<string>();
  for (const t of scheduledTasks) {
    if (t.startDate) hasExplicitStart.add(t.id);
  }

  // 2. Dependency-aware shift. Iterate until stable so chains propagate.
  const byId = new Map(merged.map((t) => [t.id, t]));
  const maxIterations = merged.length + 1;

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    for (const task of merged) {
      if (task.blockedBy.length === 0) continue;
      if (hasExplicitStart.has(task.id)) continue;

      // Latest due date among blockers present in the active set.
      let latestBlockerDue: string | null = null;
      for (const blockerId of task.blockedBy) {
        const blocker = byId.get(blockerId);
        if (!blocker) continue;
        if (!latestBlockerDue || parseYMD(blocker.due) > parseYMD(latestBlockerDue)) {
          latestBlockerDue = blocker.due;
        }
      }
      if (!latestBlockerDue) continue;

      const newStart = latestBlockerDue;
      // Keep at least a 1-week duration; never let the start pass the due date.
      const minDue = addDays(newStart, DEFAULT_DURATION_DAYS);
      const newDue = parseYMD(task.due) > parseYMD(minDue) ? task.due : minDue;

      if (task.startDate !== newStart || task.due !== newDue) {
        task.startDate = newStart;
        task.due = newDue;
        changed = true;
      }
    }

    if (!changed) break;
  }

  return merged;
}
