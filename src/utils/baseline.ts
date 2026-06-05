import type { Task } from '@/types';
import type { TaskBaseline } from '@/hooks/usePlanningHistory';

/**
 * Whether a task's current start/due differs from its recorded baseline.
 * Mirrors the amber "ghost bar" logic in GanttRow so the bulk actions and the
 * per-task drift indicator stay in sync.
 */
export function isTaskDrifted(task: Task, baseline: TaskBaseline | undefined): boolean {
  if (!baseline) return false;
  const baseStart = baseline.planned_start ? new Date(baseline.planned_start + 'T00:00:00').getTime() : null;
  const baseDue = new Date(baseline.planned_due + 'T00:00:00').getTime();
  const actualStart = task.startDate ? new Date(task.startDate + 'T00:00:00').getTime() : null;
  const actualDue = new Date(task.due + 'T00:00:00').getTime();
  return baseStart !== actualStart || baseDue !== actualDue;
}
