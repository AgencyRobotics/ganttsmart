// Serialize/deserialize the current view (scope + filters) to URL query params so a link
// can be shared and reopened with the same projects/initiative and filters applied.

import type { Filters, GroupBy } from '@/types';

const ALL_PRIORITIES = [0, 1, 2, 3, 4];
const GROUP_BY_VALUES: GroupBy[] = ['none', 'assignee', 'priority', 'status'];

export interface UrlViewState {
  projectId?: string;
  initiativeId?: string;
  /** Initiative-mode visible-project subset. */
  pids?: string[];
  groupBy?: GroupBy;
  showCompleted?: boolean;
  filters: Partial<Filters>;
}

/** Parse a `location.search` string into the view state it encodes. */
export function parseViewState(search: string): UrlViewState {
  const p = new URLSearchParams(search);
  const filters: Partial<Filters> = {};

  const q = p.get('q');
  if (q) filters.search = q;
  const assignee = p.get('assignee');
  if (assignee) filters.assignee = assignee;
  const status = p.get('status');
  if (status) filters.status = status;
  const from = p.get('from');
  if (from) filters.dateFrom = from;
  const to = p.get('to');
  if (to) filters.dateTo = to;
  const pri = p.get('pri');
  if (pri) {
    const set = new Set(
      pri
        .split(',')
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && ALL_PRIORITIES.includes(n)),
    );
    if (set.size > 0) filters.priorities = set;
  }

  const res: UrlViewState = { filters };

  const initiative = p.get('initiative');
  if (initiative) res.initiativeId = initiative;
  const project = p.get('project');
  if (project) res.projectId = project;

  const pids = p.get('pids');
  if (pids) res.pids = pids.split(',').filter(Boolean);

  const group = p.get('group');
  if (group && GROUP_BY_VALUES.includes(group as GroupBy)) res.groupBy = group as GroupBy;

  const completed = p.get('completed');
  if (completed !== null) res.showCompleted = completed === '1';

  return res;
}

export interface BuildViewInput {
  projectId: string;
  initiativeId: string;
  selectedProjectIds: string[];
  /** All project ids in the active initiative (used to omit `pids` when all are shown). */
  allProjectIds?: string[];
  groupBy: GroupBy;
  showCompletedProjects: boolean;
  filters: Filters;
}

/** Build a `location.search` string (without the leading "?") from the live view state. */
export function buildViewSearch(v: BuildViewInput): string {
  const p = new URLSearchParams();

  if (v.initiativeId) {
    p.set('initiative', v.initiativeId);
    // Only encode the subset when the user has hidden some projects.
    if (
      v.allProjectIds &&
      v.selectedProjectIds.length > 0 &&
      v.selectedProjectIds.length < v.allProjectIds.length
    ) {
      p.set('pids', v.selectedProjectIds.join(','));
    }
    if (!v.showCompletedProjects) p.set('completed', '0');
  } else if (v.projectId) {
    p.set('project', v.projectId);
    if (v.groupBy && v.groupBy !== 'none') p.set('group', v.groupBy);
  }

  const f = v.filters;
  if (f.search) p.set('q', f.search);
  if (f.assignee) p.set('assignee', f.assignee);
  if (f.status) p.set('status', f.status);
  if (f.dateFrom) p.set('from', f.dateFrom);
  if (f.dateTo) p.set('to', f.dateTo);
  if (f.priorities && f.priorities.size > 0 && f.priorities.size < ALL_PRIORITIES.length) {
    p.set('pri', [...f.priorities].sort((a, b) => a - b).join(','));
  }

  return p.toString();
}
