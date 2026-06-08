import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DebounceCancelled,
  clearIssueStartDate,
  createIssue,
  createIssueRelation,
  removeIssueRelation,
  fetchIssues,
  fetchIssueManifest,
  fetchIssuesByIds,
  fetchProjects,
  fetchInitiatives,
  fetchProjectRelations,
  fetchUsers,
  fetchTeams,
  fetchWorkflowStates,
  updateIssueAssignee,
  updateIssueDescription,
  updateIssueDueDate,
  updateIssuePriority,
  updateIssueStartDate,
  updateIssueState,
  updateIssueTitle,
  updateProjectDates,
} from '@/api/linear';
import { toast, toastError, toastSuccess } from '@/components/Toast';
import { DEFAULT_DAY_WIDTH, MAX_DAY_WIDTH, MIN_DAY_WIDTH, PRIORITY_MAP } from '@/types';
import type { Filters, GroupBy, Initiative, Milestone, Project, ProjectMeta, Task, Team, User, WorkflowState } from '@/types';
import { applyScheduleDefaults } from '@/utils/schedule';
import { extractStartTag, combineDescription } from '@/utils/description';
import {
  readScopeCache,
  writeScopeCache,
  projectScopeKey,
  initiativeScopeKey,
  type CachedScope,
} from '@/api/planningCache';

const DEFAULT_PRIORITIES = new Set([0, 1, 2, 3, 4]);
const POLL_INTERVAL_MS = 30_000; // 30 seconds
// Shared cache is considered fresh for this long: if another client synced within this
// window, we adopt their result instead of hitting Linear ourselves.
const CACHE_FRESH_MS = 25_000;
const EMPTY_TASKS: Task[] = []; // stable empty reference

const isCacheFresh = (lastSyncedAt: string): boolean =>
  Date.now() - Date.parse(lastSyncedAt) < CACHE_FRESH_MS;

// --- Small YYYY-MM-DD date helpers (lexicographic comparison is valid for ISO dates) ---
const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDay = (s: string): Date => new Date(s + 'T00:00:00');
const shiftDays = (s: string, days: number): string => {
  const d = parseDay(s);
  d.setDate(d.getDate() + days);
  return ymd(d);
};
const dayDiff = (a: string, b: string): number =>
  Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);

// Keep the same ordering the API loaders use, so cache-merged lists look stable.
const sortActive = (arr: Task[]): Task[] =>
  [...arr].sort((a, b) => a.priorityVal - b.priorityVal || new Date(a.due).getTime() - new Date(b.due).getTime());
const sortUnscheduled = (arr: Task[]): Task[] =>
  [...arr].sort((a, b) => a.priorityVal - b.priorityVal || a.id.localeCompare(b.id));
const sortDone = (arr: Task[]): Task[] =>
  [...arr].sort((a, b) => {
    const at = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bt - at;
  });

// Order projects in an initiative by start date (earliest first; undated last), then name.
const compareProjectMetaByStart = (a: ProjectMeta, b: ProjectMeta): number => {
  if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name);
  if (a.startDate) return -1;
  if (b.startDate) return 1;
  return a.name.localeCompare(b.name);
};

/** Ensure blocks/blockedBy stay in sync across all issues (needed when only one side of a dep was re-hydrated). */
function propagateRelations(tasks: Task[], unscheduled: Task[], done: Task[]): void {
  const byId = new Map<string, Task>();
  for (const t of [...tasks, ...unscheduled, ...done]) byId.set(t.id, t);

  for (const task of byId.values()) {
    for (const blockedId of task.blocks) {
      const blocked = byId.get(blockedId);
      if (blocked && !blocked.blockedBy.includes(task.id)) {
        blocked.blockedBy = [...blocked.blockedBy, task.id];
      }
    }
    for (const blockerId of task.blockedBy) {
      const blocker = byId.get(blockerId);
      if (blocker && !blocker.blocks.includes(task.id)) {
        blocker.blocks = [...blocker.blocks, task.id];
      }
    }
  }
}

/** True when live state has dependency edges that a cache snapshot does not. */
function localHasRelationsNotInCache(cached: CachedScope, live: Task[]): boolean {
  const cachedById = new Map(
    [...cached.tasks, ...cached.unscheduledTasks, ...cached.doneTasks].map((t) => [t.id, t]),
  );
  for (const t of live) {
    if (t.blocks.length === 0 && t.blockedBy.length === 0) continue;
    const c = cachedById.get(t.id);
    if (!c) continue;
    if (t.blocks.some((id) => !c.blocks.includes(id))) return true;
    if (t.blockedBy.some((id) => !c.blockedBy.includes(id))) return true;
  }
  return false;
}

export function useLinearData(linearToken: string, onAuthError?: () => void) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => localStorage.getItem('linear_selected_project') || '',
  );
  // When set, the chart is in initiative (multi-project) mode.
  const [selectedInitiativeId, setSelectedInitiativeId] = useState(
    () => localStorage.getItem('linear_selected_initiative') || '',
  );
  // Projects in the active initiative that are currently shown (subset toggle).
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  // Per-project summary metadata (dates + project-to-project deps) for initiative mode.
  const [projectMetas, setProjectMetas] = useState<ProjectMeta[]>([]);
  // Whether completed projects (and their issues) are shown in initiative mode.
  const [showCompletedProjects, setShowCompletedProjects] = useState(
    () => localStorage.getItem('gantt_show_completed_projects') !== 'false',
  );
  const [projectName, setProjectName] = useState('');

  // Latest initiatives, readable inside callbacks without stale closures.
  const initiativesRef = useRef<Initiative[]>([]);
  useEffect(() => {
    initiativesRef.current = initiatives;
  }, [initiatives]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [doneTasks, setDoneTasks] = useState<Task[]>([]);
  const [unscheduledTasks, setUnscheduledTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  // Workflow states are per-team. In initiative mode issues span multiple teams, so we
  // keep a map keyed by teamId (plus a ref for synchronous access inside callbacks).
  const [workflowStatesByTeam, setWorkflowStatesByTeam] = useState<Record<string, WorkflowState[]>>({});
  const workflowStatesByTeamRef = useRef<Record<string, WorkflowState[]>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState('');
  const [dayWidth, setDayWidth] = useState(DEFAULT_DAY_WIDTH);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [filters, setFilters] = useState<Filters>({
    assignee: '',
    status: '',
    priorities: new Set(DEFAULT_PRIORITIES),
    search: '',
    dateFrom: '',
    dateTo: '',
  });

  const initialLoadDone = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingMutations = useRef(0); // guards polling from overwriting optimistic state

  // Latest raw state, readable inside sync callbacks without stale closures.
  const tasksRef = useRef<Task[]>([]);
  const unscheduledRef = useRef<Task[]>([]);
  const doneRef = useRef<Task[]>([]);
  const projectMetasRef = useRef<ProjectMeta[]>([]);
  const milestonesRef = useRef<Milestone[]>([]);
  const projectNameRef = useRef('');
  // The cache lastSyncedAt we last applied to local state — used to detect when a peer
  // refreshed the shared cache so we can adopt it without re-querying Linear.
  const appliedSyncedAtRef = useRef('');
  const selectedProjectIdRef = useRef(selectedProjectId);
  const selectedInitiativeIdRef = useRef(selectedInitiativeId);
  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);
  useEffect(() => {
    selectedInitiativeIdRef.current = selectedInitiativeId;
  }, [selectedInitiativeId]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  useEffect(() => {
    unscheduledRef.current = unscheduledTasks;
  }, [unscheduledTasks]);
  useEffect(() => {
    doneRef.current = doneTasks;
  }, [doneTasks]);
  useEffect(() => {
    projectMetasRef.current = projectMetas;
  }, [projectMetas]);
  useEffect(() => {
    milestonesRef.current = milestones;
  }, [milestones]);
  useEffect(() => {
    projectNameRef.current = projectName;
  }, [projectName]);

  // Undo stack: stores previous task snapshots
  const undoStackRef = useRef<Array<{ tasks: Task[]; label: string }>>([]);

  // Apply default scheduling rules (1-week durations + dependency-aware starts).
  // This folds the previously "unscheduled" (no due date) issues into the chart
  // with default dates, so `scheduledTasks` is the single source of truth for the view.
  const scheduledTasks = useMemo(
    () => applyScheduleDefaults(tasks, unscheduledTasks),
    [tasks, unscheduledTasks],
  );

  const assignees = useMemo(() => [...new Set(scheduledTasks.map((t) => t.assignee))].sort(), [scheduledTasks]);
  const statuses = useMemo(() => [...new Set(scheduledTasks.map((t) => t.status))].sort(), [scheduledTasks]);

  // Project ids hidden because they're completed and the completed toggle is off.
  const hiddenCompletedProjectIds = useMemo(() => {
    if (!selectedInitiativeId || showCompletedProjects) return null;
    return new Set(projectMetas.filter((p) => p.state === 'completed').map((p) => p.id));
  }, [selectedInitiativeId, showCompletedProjects, projectMetas]);

  const filteredTasks = useMemo(() => {
    // In initiative mode, only show issues from the projects the user has toggled on.
    const visibleProjects = selectedInitiativeId ? new Set(selectedProjectIds) : null;
    return scheduledTasks.filter((t) => {
      if (visibleProjects && t.projectId && !visibleProjects.has(t.projectId)) return false;
      if (hiddenCompletedProjectIds && t.projectId && hiddenCompletedProjectIds.has(t.projectId)) return false;
      if (!filters.priorities.has(t.priorityVal)) return false;
      if (filters.assignee && t.assignee !== filters.assignee) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.search) {
        const hay = `${t.id} ${t.title} ${t.assignee} ${t.status}`.toLowerCase();
        if (!hay.includes(filters.search.toLowerCase())) return false;
      }
      return true;
    });
  }, [scheduledTasks, filters, selectedInitiativeId, selectedProjectIds, hiddenCompletedProjectIds]);

  // Project summary bars to render in initiative mode, limited to the toggled-on projects
  // (and excluding completed projects when the completed toggle is off).
  const visibleProjectMetas = useMemo(() => {
    if (!selectedInitiativeId) return [];
    const shown = new Set(selectedProjectIds);
    return projectMetas.filter(
      (p) => shown.has(p.id) && (showCompletedProjects || p.state !== 'completed'),
    );
  }, [selectedInitiativeId, selectedProjectIds, projectMetas, showCompletedProjects]);

  // Push to undo stack and show toast with Undo action
  const pushUndo = useCallback((prevTasks: Task[], label: string) => {
    undoStackRef.current.push({ tasks: prevTasks, label });
    // Keep max 20 undo entries
    if (undoStackRef.current.length > 20) undoStackRef.current.shift();
  }, []);

  const undo = useCallback(() => {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    setTasks(entry.tasks);
    toastSuccess(`Undone: ${entry.label}`);
  }, []);

  const loadProjects = useCallback(async () => {
    if (!linearToken) return;
    try {
      const p = await fetchProjects(linearToken);
      setProjects(p);
      return p;
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('authentication expired')) {
        toastError('Linear session expired. Reconnecting...');
        onAuthError?.();
        return [];
      }
      toastError(`Failed to load projects: ${msg}`);
      throw e;
    }
  }, [linearToken]);

  // Fetch and cache workflow states for the given teams (cheap; needed for status editing).
  // Only fetches teams we haven't already cached, so it's safe to call on every load/poll.
  const ensureWorkflowStates = useCallback(
    async (teamIds: Array<string | undefined>) => {
      if (!linearToken) return;
      const unique = [...new Set(teamIds.filter((id): id is string => !!id))].filter(
        (id) => !workflowStatesByTeamRef.current[id],
      );
      if (unique.length === 0) return;
      const fetched = await Promise.all(
        unique.map(async (id) => {
          try {
            return [id, await fetchWorkflowStates(linearToken, id)] as const;
          } catch {
            return [id, [] as WorkflowState[]] as const;
          }
        }),
      );
      const next = { ...workflowStatesByTeamRef.current };
      for (const [id, states] of fetched) next[id] = states;
      workflowStatesByTeamRef.current = next;
      setWorkflowStatesByTeam(next);
    },
    [linearToken],
  );

  const loadIssues = useCallback(
    async (projectId: string) => {
      if (!linearToken || !projectId) return;
      setLoading(true);
      setError('');
      try {
        const result = await fetchIssues(linearToken, projectId);
        setTasks(result.tasks);
        setDoneTasks(result.doneTasks);
        setUnscheduledTasks(result.unscheduledTasks);
        setProjectName(result.projectName);
        setMilestones(result.milestones);
        setLastSynced(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));

        // Persist the freshly loaded scope so future visits render instantly from cache.
        const syncedAt = new Date().toISOString();
        appliedSyncedAtRef.current = syncedAt;
        writeScopeCache(projectScopeKey(projectId), {
          tasks: result.tasks,
          unscheduledTasks: result.unscheduledTasks,
          doneTasks: result.doneTasks,
          projectMetas: [],
          milestones: result.milestones,
          projectName: result.projectName,
          lastSyncedAt: syncedAt,
        }).catch((e) => console.warn('Cache write failed:', (e as Error).message));

        ensureWorkflowStates([...result.tasks, ...result.unscheduledTasks].map((t) => t.teamId));
      } catch (e) {
        const msg = (e as Error).message;
        setError(msg);
        setTasks([]);
        setDoneTasks([]);
        setUnscheduledTasks([]);
        setMilestones([]);
        if (msg.includes('authentication expired')) {
          toastError('Linear session expired. Reconnecting...');
          onAuthError?.();
          return;
        }
        toastError(`Failed to load issues: ${msg}`, () => loadIssues(projectId));
      } finally {
        setLoading(false);
      }
    },
    [linearToken, ensureWorkflowStates],
  );

  // Load every project in an initiative and merge their issues onto one timeline.
  // `restrictTo` optionally limits which projects are shown (defaults to all).
  const loadInitiative = useCallback(
    async (initiativeId: string, restrictTo?: string[], silent = false) => {
      if (!linearToken) return;
      const init = initiativesRef.current.find((i) => i.id === initiativeId);
      if (!init) {
        if (!silent) setError('Initiative not found');
        return;
      }
      if (init.projects.length === 0) {
        setTasks([]);
        setDoneTasks([]);
        setUnscheduledTasks([]);
        setProjectMetas([]);
        setSelectedProjectIds([]);
        setProjectName(init.name);
        return;
      }
      if (silent && pendingMutations.current > 0) return;
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const ids = init.projects.map((p) => p.id);
        // Initiative view spans many projects, so keep each fetch light to stay well under
        // Linear's hourly complexity budget: skip completed issues and the sub-issue
        // (progress) sub-query — neither is needed for the multi-project roadmap overview.
        const results = await Promise.all(
          ids.map((id) => fetchIssues(linearToken, id, { includeDone: false, includeChildren: false })),
        );

        const allTasks: Task[] = [];
        const allDone: Task[] = [];
        const allUnscheduled: Task[] = [];
        for (const r of results) {
          allTasks.push(...r.tasks);
          allDone.push(...r.doneTasks);
          allUnscheduled.push(...r.unscheduledTasks);
        }

        const rels = await fetchProjectRelations(linearToken, ids).catch(() => ({}) as Record<string, { blocks: string[]; blockedBy: string[] }>);
        const stateById = new Map(init.projects.map((p) => [p.id, p.state ?? null]));
        const urlById = new Map(init.projects.map((p) => [p.id, p.url ?? null]));
        const metas: ProjectMeta[] = results
          .map((r) => ({
            id: r.projectId,
            name: r.projectName,
            startDate: r.projectStartDate,
            targetDate: r.projectTargetDate,
            state: stateById.get(r.projectId) ?? null,
            url: urlById.get(r.projectId) ?? null,
            blocks: rels[r.projectId]?.blocks || [],
            blockedBy: rels[r.projectId]?.blockedBy || [],
          }))
          .sort(compareProjectMetaByStart);

        setTasks(allTasks);
        setDoneTasks(allDone);
        setUnscheduledTasks(allUnscheduled);
        setProjectMetas(metas);
        setProjectName(init.name);
        setMilestones([]); // milestones are per-project; omitted in the merged view for now
        setSelectedProjectIds(restrictTo && restrictTo.length ? restrictTo.filter((id) => ids.includes(id)) : ids);
        setLastSynced(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));

        // Cache the merged initiative so subsequent visits render from cache + sync deltas.
        const syncedAt = new Date().toISOString();
        appliedSyncedAtRef.current = syncedAt;
        writeScopeCache(initiativeScopeKey(initiativeId), {
          tasks: allTasks,
          unscheduledTasks: allUnscheduled,
          doneTasks: allDone,
          projectMetas: metas,
          milestones: [],
          projectName: init.name,
          lastSyncedAt: syncedAt,
        }).catch((e) => console.warn('Cache write failed:', (e as Error).message));

        ensureWorkflowStates(allTasks.map((t) => t.teamId));
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes('authentication expired')) {
          toastError('Linear session expired. Reconnecting...');
          onAuthError?.();
          return;
        }
        if (!silent) {
          setError(msg);
          toastError(`Failed to load initiative: ${msg}`, () => loadInitiative(initiativeId, restrictTo));
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [linearToken, onAuthError, ensureWorkflowStates],
  );

  // Apply a cached scope to state for instant render.
  const applyCachedScope = useCallback((cached: CachedScope) => {
    setTasks(cached.tasks);
    setUnscheduledTasks(cached.unscheduledTasks);
    setDoneTasks(cached.doneTasks);
    setProjectMetas(cached.projectMetas);
    setMilestones(cached.milestones);
    setProjectName(cached.projectName);
    setLastSynced(new Date(cached.lastSyncedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
  }, []);

  // Persist the current in-memory scope to the shared cache (e.g. after a local relation edit).
  const persistCurrentScopeCache = useCallback(() => {
    const initiativeId = selectedInitiativeIdRef.current;
    const projectId = selectedProjectIdRef.current;
    const scopeKey = initiativeId ? initiativeScopeKey(initiativeId) : projectId ? projectScopeKey(projectId) : null;
    if (!scopeKey) return;

    const syncedAt = new Date().toISOString();
    appliedSyncedAtRef.current = syncedAt;
    setLastSynced(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));

    writeScopeCache(scopeKey, {
      tasks: tasksRef.current,
      unscheduledTasks: unscheduledRef.current,
      doneTasks: doneRef.current,
      projectMetas: projectMetasRef.current,
      milestones: milestonesRef.current,
      projectName: projectNameRef.current,
      lastSyncedAt: syncedAt,
    }).catch((e) => console.warn('Cache write failed:', (e as Error).message));
  }, []);

  // Incremental sync: diff a cheap manifest against current state, hydrate only the issues
  // that changed/were added, drop removed ones, then persist the merged result to the cache.
  // `baseline` lets callers diff against a just-loaded cache snapshot (the state refs lag a
  // render behind), avoiding a needless full hydrate right after a cache hit.
  const syncScope = useCallback(
    async (
      scopeKey: string,
      projectIds: string[],
      includeDone: boolean,
      baseline?: { tasks: Task[]; unscheduledTasks: Task[]; doneTasks: Task[] },
    ) => {
      if (!linearToken || projectIds.length === 0) return;
      if (pendingMutations.current > 0) return; // don't clobber optimistic edits

      const baseTasks = baseline?.tasks ?? tasksRef.current;
      const baseUnscheduled = baseline?.unscheduledTasks ?? unscheduledRef.current;
      const baseDone = baseline?.doneTasks ?? doneRef.current;

      const manifest = await fetchIssueManifest(linearToken, projectIds, includeDone);
      const manifestUpdatedAt = new Map(manifest.map((m) => [m.uuid, m.updatedAt]));

      const current = [...baseTasks, ...baseUnscheduled, ...baseDone];
      const currentByUuid = new Map(current.map((t) => [t.uuid, t]));

      const toHydrate: string[] = [];
      for (const [uuid, updatedAt] of manifestUpdatedAt) {
        const existing = currentByUuid.get(uuid);
        if (!existing || !existing.updatedAt || existing.updatedAt < updatedAt) toHydrate.push(uuid);
      }
      const removed = new Set<string>();
      for (const uuid of currentByUuid.keys()) {
        if (!manifestUpdatedAt.has(uuid)) removed.add(uuid);
      }

      const syncedAt = new Date().toISOString();

      if (toHydrate.length === 0 && removed.size === 0) {
        appliedSyncedAtRef.current = syncedAt;
        setLastSynced(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        return; // nothing changed
      }

      const hydrated =
        toHydrate.length > 0
          ? await fetchIssuesByIds(linearToken, toHydrate, { includeChildren: includeDone })
          : { tasks: [], unscheduledTasks: [], doneTasks: [] };

      // Re-check for optimistic edits that may have started while we were fetching.
      if (pendingMutations.current > 0) return;

      const drop = new Set<string>([...toHydrate, ...removed]);
      const keep = (arr: Task[]) => arr.filter((t) => !drop.has(t.uuid));

      const newTasks = sortActive([...keep(baseTasks), ...hydrated.tasks]);
      const newUnscheduled = sortUnscheduled([...keep(baseUnscheduled), ...hydrated.unscheduledTasks]);
      // Initiative mode doesn't track completed issues, so drop the done bucket there.
      const newDone = includeDone ? sortDone([...keep(baseDone), ...hydrated.doneTasks]) : baseDone;

      // Linear may only bump updatedAt on one issue when a relation is created, so the other
      // side of the edge can be left from a stale cache snapshot — mirror relations across both.
      propagateRelations(newTasks, newUnscheduled, newDone);

      setTasks(newTasks);
      setUnscheduledTasks(newUnscheduled);
      if (includeDone) setDoneTasks(newDone);
      appliedSyncedAtRef.current = syncedAt;
      setLastSynced(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));

      // Load workflow states for any teams introduced by newly hydrated issues.
      ensureWorkflowStates([...hydrated.tasks, ...hydrated.unscheduledTasks].map((t) => t.teamId));

      writeScopeCache(scopeKey, {
        tasks: newTasks,
        unscheduledTasks: newUnscheduled,
        doneTasks: newDone,
        projectMetas: projectMetasRef.current,
        milestones: milestonesRef.current,
        projectName: projectNameRef.current,
        lastSyncedAt: syncedAt,
      }).catch((e) => console.warn('Cache write failed:', (e as Error).message));
    },
    [linearToken, ensureWorkflowStates],
  );

  // Cache-first project load: render cache instantly (if any), then sync deltas; otherwise full load.
  const loadProjectScope = useCallback(
    async (projectId: string) => {
      if (!linearToken || !projectId) return;
      const key = projectScopeKey(projectId);
      let cached: CachedScope | null = null;
      try {
        cached = await readScopeCache(key);
      } catch (e) {
        console.warn('Cache read failed:', (e as Error).message);
      }

      if (cached) {
        applyCachedScope(cached);
        appliedSyncedAtRef.current = cached.lastSyncedAt;
        ensureWorkflowStates([...cached.tasks, ...cached.unscheduledTasks].map((t) => t.teamId));
        // Skip the Linear sync entirely if another client refreshed the shared cache recently.
        if (!isCacheFresh(cached.lastSyncedAt)) {
          try {
            await syncScope(key, [projectId], true, {
              tasks: cached.tasks,
              unscheduledTasks: cached.unscheduledTasks,
              doneTasks: cached.doneTasks,
            });
          } catch (e) {
            const msg = (e as Error).message;
            if (msg.includes('authentication expired')) {
              onAuthError?.();
            } else {
              toastError(`Sync failed: ${msg}`);
            }
          }
        }
      } else {
        await loadIssues(projectId);
        appliedSyncedAtRef.current = new Date().toISOString();
      }
    },
    [linearToken, applyCachedScope, ensureWorkflowStates, syncScope, loadIssues, onAuthError],
  );

  // Cache-first initiative load.
  const loadInitiativeScope = useCallback(
    async (initiativeId: string) => {
      if (!linearToken) return;
      const init = initiativesRef.current.find((i) => i.id === initiativeId);
      if (!init) return;
      const key = initiativeScopeKey(initiativeId);
      let cached: CachedScope | null = null;
      try {
        cached = await readScopeCache(key);
      } catch (e) {
        console.warn('Cache read failed:', (e as Error).message);
      }

      if (cached) {
        applyCachedScope(cached);
        // Enrich cached metas with the project state/url/order from the initiative (older
        // caches predate these fields), so the completed toggle and project links work.
        const stateById = new Map(init.projects.map((p) => [p.id, p.state ?? null]));
        const urlById = new Map(init.projects.map((p) => [p.id, p.url ?? null]));
        setProjectMetas(
          cached.projectMetas
            .map((m) => ({
              ...m,
              state: stateById.get(m.id) ?? m.state ?? null,
              url: urlById.get(m.id) ?? m.url ?? null,
            }))
            .sort(compareProjectMetaByStart),
        );
        appliedSyncedAtRef.current = cached.lastSyncedAt;
        setSelectedProjectIds(init.projects.map((p) => p.id));
        ensureWorkflowStates([...cached.tasks, ...cached.unscheduledTasks].map((t) => t.teamId));
        if (!isCacheFresh(cached.lastSyncedAt)) {
          try {
            await syncScope(key, init.projects.map((p) => p.id), false, {
              tasks: cached.tasks,
              unscheduledTasks: cached.unscheduledTasks,
              doneTasks: cached.doneTasks,
            });
          } catch (e) {
            const msg = (e as Error).message;
            if (msg.includes('authentication expired')) {
              onAuthError?.();
            } else {
              toastError(`Sync failed: ${msg}`);
            }
          }
        }
      } else {
        await loadInitiative(initiativeId);
        appliedSyncedAtRef.current = new Date().toISOString();
      }
    },
    [linearToken, applyCachedScope, ensureWorkflowStates, syncScope, loadInitiative, onAuthError],
  );

  // Poll step for a scope: adopt a peer's fresh cache without hitting Linear when possible,
  // otherwise run an incremental sync. This keeps total Linear load near one sync per
  // interval across all concurrent users.
  const pollSync = useCallback(
    async (scopeKey: string, projectIds: string[], includeDone: boolean) => {
      if (pendingMutations.current > 0) return;

      let cached: CachedScope | null = null;
      try {
        cached = await readScopeCache(scopeKey);
      } catch (e) {
        console.warn('Cache read failed:', (e as Error).message);
      }

      // A peer refreshed the shared cache since we last applied it — adopt it for free,
      // unless our live state has dependency edits the cache doesn't know about yet.
      const liveTasks = [...tasksRef.current, ...unscheduledRef.current, ...doneRef.current];
      if (
        cached &&
        cached.lastSyncedAt > appliedSyncedAtRef.current &&
        !localHasRelationsNotInCache(cached, liveTasks)
      ) {
        applyCachedScope(cached);
        appliedSyncedAtRef.current = cached.lastSyncedAt;
        return;
      }

      // Cache is ours/stale — refresh from Linear (cheap manifest + targeted hydrate).
      if (!cached || !isCacheFresh(cached.lastSyncedAt)) {
        await syncScope(
          scopeKey,
          projectIds,
          includeDone,
          cached
            ? { tasks: cached.tasks, unscheduledTasks: cached.unscheduledTasks, doneTasks: cached.doneTasks }
            : undefined,
        );
      }
    },
    [applyCachedScope, syncScope],
  );

  const selectProject = useCallback(
    (id: string) => {
      setSelectedInitiativeId('');
      localStorage.removeItem('linear_selected_initiative');
      setProjectMetas([]);
      setSelectedProjectIds([]);
      setSelectedProjectId(id);
      localStorage.setItem('linear_selected_project', id);
      setFilters({ assignee: '', status: '', priorities: new Set(DEFAULT_PRIORITIES), search: '', dateFrom: '', dateTo: '' });
      undoStackRef.current = []; // Clear undo on project switch
      loadProjectScope(id);
    },
    [loadProjectScope],
  );

  const selectInitiative = useCallback(
    (id: string) => {
      setSelectedInitiativeId(id);
      localStorage.setItem('linear_selected_initiative', id);
      setFilters({ assignee: '', status: '', priorities: new Set(DEFAULT_PRIORITIES), search: '', dateFrom: '', dateTo: '' });
      undoStackRef.current = [];
      loadInitiativeScope(id);
    },
    [loadInitiativeScope],
  );

  // Toggle which projects within the active initiative are shown (client-side filter).
  const setVisibleProjectIds = useCallback((ids: string[]) => {
    setSelectedProjectIds(ids);
  }, []);

  const refresh = useCallback(() => {
    if (selectedInitiativeId) loadInitiative(selectedInitiativeId, selectedProjectIds);
    else if (selectedProjectId) loadIssues(selectedProjectId);
  }, [selectedInitiativeId, selectedProjectIds, loadInitiative, selectedProjectId, loadIssues]);

  const zoomIn = useCallback(() => {
    setDayWidth((w) => Math.min(w + 7, MAX_DAY_WIDTH));
  }, []);

  const zoomOut = useCallback(() => {
    setDayWidth((w) => Math.max(w - 7, MIN_DAY_WIDTH));
  }, []);

  // Optimistic reschedule (due date) with rollback + undo.
  // Also handles "promoting" an unscheduled task: if the uuid lives in unscheduledTasks,
  // we move it into tasks with the new explicit due date.
  const reschedule = useCallback(
    async (taskUuid: string, newDueDate: string) => {
      if (!linearToken) return;

      const prevTasks = tasks;
      const prevUnscheduled = unscheduledTasks;
      const fromUnscheduled = unscheduledTasks.find((t) => t.uuid === taskUuid);
      const task = tasks.find((t) => t.uuid === taskUuid) || fromUnscheduled;

      if (fromUnscheduled) {
        // Promote: remove from unscheduled, add to scheduled with explicit due date
        setUnscheduledTasks((prev) => prev.filter((t) => t.uuid !== taskUuid));
        setTasks((prev) => [...prev, { ...fromUnscheduled, due: newDueDate, isDueImplicit: undefined }]);
      } else {
        setTasks((prev) =>
          prev.map((t) => (t.uuid === taskUuid ? { ...t, due: newDueDate, isDueImplicit: undefined } : t)),
        );
      }

      pendingMutations.current++;
      try {
        await updateIssueDueDate(linearToken, taskUuid, newDueDate);
        pushUndo(prevTasks, `${task?.id || ''} due date`);
        toast(`Due date updated`, 'success', {
          label: 'Undo',
          onClick: () => {
            setTasks(prevTasks);
            setUnscheduledTasks(prevUnscheduled);
            if (task && task.due && !task.isDueImplicit) {
              updateIssueDueDate(linearToken, taskUuid, task.due).catch(() => {});
            }
          },
        });
      } catch (e) {
        if (e instanceof DebounceCancelled) return; // superseded by a newer drag — don't rollback
        setTasks(prevTasks);
        setUnscheduledTasks(prevUnscheduled);
        toastError(`Failed to update due date: ${(e as Error).message}`, () => reschedule(taskUuid, newDueDate));
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, tasks, unscheduledTasks, pushUndo],
  );

  // Optimistic reschedule (start date) with rollback + undo
  const rescheduleStart = useCallback(
    async (taskUuid: string, newStartDate: string) => {
      if (!linearToken) return;

      const prevTasks = tasks;
      const task = tasks.find((t) => t.uuid === taskUuid);
      setTasks((prev) => prev.map((t) => (t.uuid === taskUuid ? { ...t, startDate: newStartDate } : t)));

      pendingMutations.current++;
      try {
        await updateIssueStartDate(linearToken, taskUuid, newStartDate);
        pushUndo(prevTasks, `${task?.id || ''} start date`);
        toast(`Start date updated`, 'success', {
          label: 'Undo',
          onClick: () => {
            setTasks(prevTasks);
            if (task?.startDate) updateIssueStartDate(linearToken, taskUuid, task.startDate).catch(() => {});
          },
        });
      } catch (e) {
        if (e instanceof DebounceCancelled) return; // superseded by a newer drag
        setTasks(prevTasks);
        toastError(`Failed to update start date: ${(e as Error).message}`, () =>
          rescheduleStart(taskUuid, newStartDate),
        );
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, tasks, pushUndo],
  );

  // Optimistic status cycle with rollback + undo
  const cycleStatus = useCallback(
    async (taskUuid: string) => {
      if (!linearToken) return;
      const task = tasks.find((t) => t.uuid === taskUuid);
      if (!task) return;
      // Workflow states are per-team; make sure this task's team is loaded.
      if (!workflowStatesByTeamRef.current[task.teamId]) await ensureWorkflowStates([task.teamId]);
      const teamStates = workflowStatesByTeamRef.current[task.teamId] || [];
      if (teamStates.length === 0) return;

      const typeOrder = ['unstarted', 'started', 'completed'];
      const currentTypeIdx = typeOrder.indexOf(task.statusType);
      const nextType = typeOrder[Math.min(currentTypeIdx + 1, typeOrder.length - 1)];

      const nextState = teamStates.find((s) => s.type === nextType);
      if (!nextState || nextState.name === task.status) return;

      const prevTasks = tasks;
      const prevState = teamStates.find((s) => s.name === task.status);
      setTasks((prev) =>
        prev.map((t) => (t.uuid === taskUuid ? { ...t, status: nextState.name, statusType: nextState.type } : t)),
      );

      pendingMutations.current++;
      try {
        await updateIssueState(linearToken, taskUuid, nextState.id);
        pushUndo(prevTasks, `${task.id} status`);
        toast(`Status → ${nextState.name}`, 'success', {
          label: 'Undo',
          onClick: () => {
            setTasks(prevTasks);
            if (prevState) updateIssueState(linearToken, taskUuid, prevState.id).catch(() => {});
          },
        });
      } catch (e) {
        setTasks(prevTasks);
        toastError(`Failed to update status: ${(e as Error).message}`, () => cycleStatus(taskUuid));
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, tasks, pushUndo, ensureWorkflowStates],
  );

  const patchRelationInBuckets = useCallback((sourceTaskId: string, targetTaskId: string, add: boolean) => {
    const apply = (prev: Task[]) =>
      prev.map((t) => {
        if (t.id === sourceTaskId) {
          return add
            ? { ...t, blocks: [...t.blocks, targetTaskId] }
            : { ...t, blocks: t.blocks.filter((id) => id !== targetTaskId) };
        }
        if (t.id === targetTaskId) {
          return add
            ? { ...t, blockedBy: [...t.blockedBy, sourceTaskId] }
            : { ...t, blockedBy: t.blockedBy.filter((id) => id !== sourceTaskId) };
        }
        return t;
      });
    const newTasks = apply(tasksRef.current);
    const newUnscheduled = apply(unscheduledRef.current);
    const newDone = apply(doneRef.current);
    tasksRef.current = newTasks;
    unscheduledRef.current = newUnscheduled;
    doneRef.current = newDone;
    setTasks(newTasks);
    setUnscheduledTasks(newUnscheduled);
    setDoneTasks(newDone);
  }, []);

  // Create a "blocks" relation between two tasks
  const createRelation = useCallback(
    async (sourceTaskId: string, targetTaskId: string) => {
      if (!linearToken) return;

      const allTasks = [...tasks, ...unscheduledTasks, ...doneTasks];
      const sourceTask = allTasks.find((t) => t.id === sourceTaskId);
      const targetTask = allTasks.find((t) => t.id === targetTaskId);
      if (!sourceTask || !targetTask) return;

      // Prevent duplicate
      if (sourceTask.blocks.includes(targetTaskId)) {
        toast(`${sourceTaskId} already blocks ${targetTaskId}`, 'info');
        return;
      }

      // Prevent circular
      if (targetTask.blocks.includes(sourceTaskId)) {
        toastError(`Cannot create circular dependency: ${targetTaskId} already blocks ${sourceTaskId}`);
        return;
      }

      const prevTasks = tasks;
      const prevUnscheduled = unscheduledTasks;
      const prevDone = doneTasks;
      patchRelationInBuckets(sourceTaskId, targetTaskId, true);

      pendingMutations.current++;
      try {
        await createIssueRelation(linearToken, sourceTask.uuid, targetTask.uuid);
        pushUndo(prevTasks, `${sourceTaskId} blocks ${targetTaskId}`);
        toastSuccess(`${sourceTaskId} now blocks ${targetTaskId}`);
        persistCurrentScopeCache();
      } catch (e) {
        tasksRef.current = prevTasks;
        unscheduledRef.current = prevUnscheduled;
        doneRef.current = prevDone;
        setTasks(prevTasks);
        setUnscheduledTasks(prevUnscheduled);
        setDoneTasks(prevDone);
        toastError(`Failed to create relation: ${(e as Error).message}`);
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, tasks, unscheduledTasks, doneTasks, pushUndo, patchRelationInBuckets, persistCurrentScopeCache],
  );

  // Remove a "blocks" relation between two tasks
  // sourceTaskId = blocker identifier, targetTaskId = blocked identifier
  const removeRelation = useCallback(
    async (sourceTaskId: string, targetTaskId: string) => {
      if (!linearToken) return;

      const allTasks = [...tasks, ...unscheduledTasks, ...doneTasks];
      const sourceTask = allTasks.find((t) => t.id === sourceTaskId);
      const targetTask = allTasks.find((t) => t.id === targetTaskId);
      if (!sourceTask || !targetTask) return;

      const prevTasks = tasks;
      const prevUnscheduled = unscheduledTasks;
      const prevDone = doneTasks;
      patchRelationInBuckets(sourceTaskId, targetTaskId, false);

      pendingMutations.current++;
      try {
        await removeIssueRelation(linearToken, sourceTask.uuid, targetTask.uuid);
        pushUndo(prevTasks, `${sourceTaskId} no longer blocks ${targetTaskId}`);
        toastSuccess(`Removed: ${sourceTaskId} → ${targetTaskId}`);
        persistCurrentScopeCache();
      } catch (e) {
        tasksRef.current = prevTasks;
        unscheduledRef.current = prevUnscheduled;
        doneRef.current = prevDone;
        setTasks(prevTasks);
        setUnscheduledTasks(prevUnscheduled);
        setDoneTasks(prevDone);
        toastError(`Failed to remove relation: ${(e as Error).message}`);
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, tasks, unscheduledTasks, doneTasks, pushUndo, patchRelationInBuckets, persistCurrentScopeCache],
  );

  // Patch a single task across whichever bucket it lives in (scheduled/unscheduled/done).
  const patchTaskState = useCallback((taskUuid: string, patch: Partial<Task>) => {
    const apply = (prev: Task[]) => prev.map((t) => (t.uuid === taskUuid ? { ...t, ...patch } : t));
    setTasks(apply);
    setUnscheduledTasks(apply);
    setDoneTasks(apply);
  }, []);

  // Generic optimistic field editor: apply local patch, call the mutation, roll back on error.
  const runFieldEdit = useCallback(
    async (taskUuid: string, patch: Partial<Task>, mutate: () => Promise<void>, errorLabel: string) => {
      if (!linearToken) return;
      const prevTasks = tasks;
      const prevUnscheduled = unscheduledTasks;
      const prevDone = doneTasks;

      patchTaskState(taskUuid, patch);
      pendingMutations.current++;
      try {
        await mutate();
      } catch (e) {
        setTasks(prevTasks);
        setUnscheduledTasks(prevUnscheduled);
        setDoneTasks(prevDone);
        toastError(`Failed to update ${errorLabel}: ${(e as Error).message}`);
        throw e;
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, tasks, unscheduledTasks, doneTasks, patchTaskState],
  );

  const editTitle = useCallback(
    async (taskUuid: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) {
        toastError('Title cannot be empty.');
        return;
      }
      await runFieldEdit(taskUuid, { title: trimmed }, () => updateIssueTitle(linearToken, taskUuid, trimmed), 'title');
    },
    [linearToken, runFieldEdit],
  );

  const editPriority = useCallback(
    async (taskUuid: string, priorityVal: number) => {
      await runFieldEdit(
        taskUuid,
        { priorityVal, priority: PRIORITY_MAP[priorityVal] || 'None' },
        () => updateIssuePriority(linearToken, taskUuid, priorityVal),
        'priority',
      );
    },
    [linearToken, runFieldEdit],
  );

  const editStatus = useCallback(
    async (taskUuid: string, stateId: string) => {
      // The dropdown was built from the task's team states, so search across all loaded teams.
      const state = Object.values(workflowStatesByTeamRef.current)
        .flat()
        .find((s) => s.id === stateId);
      if (!state) {
        toastError('Unknown status selected.');
        return;
      }
      await runFieldEdit(
        taskUuid,
        { status: state.name, statusType: state.type },
        () => updateIssueState(linearToken, taskUuid, stateId),
        'status',
      );
    },
    [linearToken, runFieldEdit],
  );

  const editAssignee = useCallback(
    async (taskUuid: string, assigneeId: string | null) => {
      const user = assigneeId ? users.find((u) => u.id === assigneeId) : null;
      await runFieldEdit(
        taskUuid,
        { assignee: user ? user.name : 'Unassigned', assigneeId: assigneeId || undefined },
        () => updateIssueAssignee(linearToken, taskUuid, assigneeId),
        'assignee',
      );
    },
    [linearToken, users, runFieldEdit],
  );

  const editDescription = useCallback(
    async (taskUuid: string, body: string) => {
      const current = [...tasks, ...unscheduledTasks, ...doneTasks].find((t) => t.uuid === taskUuid);
      const tag = current ? extractStartTag(current.description).tag : null;
      const newDesc = combineDescription(body, tag);
      await runFieldEdit(
        taskUuid,
        { description: newDesc },
        () => updateIssueDescription(linearToken, taskUuid, body),
        'description',
      );
    },
    [linearToken, tasks, unscheduledTasks, doneTasks, runFieldEdit],
  );

  // Persist explicit start + due dates to Linear (used by "Accept changes" to lock in the
  // auto-scheduled dates). Promotes the issue out of the unscheduled bucket if needed.
  const persistDates = useCallback(
    async (taskUuid: string, startDate: string | null, due: string) => {
      if (!linearToken) return;
      const prevTasks = tasks;
      const prevUnscheduled = unscheduledTasks;
      const prevDone = doneTasks;

      const fromUnscheduled = unscheduledTasks.find((t) => t.uuid === taskUuid);
      if (fromUnscheduled) {
        setUnscheduledTasks((prev) => prev.filter((t) => t.uuid !== taskUuid));
        setTasks((prev) => [...prev, { ...fromUnscheduled, startDate, due, isDueImplicit: undefined }]);
      } else {
        patchTaskState(taskUuid, { startDate, due, isDueImplicit: undefined });
      }

      pendingMutations.current++;
      try {
        await updateIssueDueDate(linearToken, taskUuid, due);
        if (startDate) await updateIssueStartDate(linearToken, taskUuid, startDate);
      } catch (e) {
        setTasks(prevTasks);
        setUnscheduledTasks(prevUnscheduled);
        setDoneTasks(prevDone);
        toastError(`Failed to save dates: ${(e as Error).message}`);
        throw e;
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, tasks, unscheduledTasks, doneTasks, patchTaskState],
  );

  // When an issue is dragged so its end (due) lands past a dependent's start, slide the
  // dependents along too — preserving each dependent's duration and cascading through the
  // chain of issues it blocks. Used by the Gantt drag/move handlers (not by programmatic
  // reschedules like baseline revert).
  const rescheduleWithDependents = useCallback(
    async (taskUuid: string, newDueDate: string) => {
      // Snapshot the visible schedule *before* applying the drag.
      const derived = scheduledTasks;
      const byId = new Map(derived.map((t) => [t.id, t]));
      const dragged = derived.find((t) => t.uuid === taskUuid);

      // Move the dragged issue itself first.
      await reschedule(taskUuid, newDueDate);
      if (!dragged) return;

      // Breadth-first walk over issues this one blocks, pushing any that would start
      // before their blocker's new end date.
      const updates = new Map<string, { uuid: string; start: string; due: string }>();
      const endOf = new Map<string, string>([[dragged.id, newDueDate]]);
      const queue: string[] = [dragged.id];

      while (queue.length > 0) {
        const curId = queue.shift() as string;
        const curEnd = endOf.get(curId) as string;
        const node = byId.get(curId);
        if (!node) continue;

        for (const depId of node.blocks) {
          const dep = byId.get(depId);
          if (!dep || !dep.startDate) continue;

          const prior = updates.get(dep.id);
          const depStart = prior ? prior.start : dep.startDate;
          if (depStart >= curEnd) continue; // already starts on/after the blocker's end

          const depDue = prior ? prior.due : dep.due;
          const duration = Math.max(dayDiff(depStart, depDue), 0);
          const newStart = curEnd;
          const newDue = shiftDays(newStart, duration);

          updates.set(dep.id, { uuid: dep.uuid, start: newStart, due: newDue });
          endOf.set(dep.id, newDue);
          queue.push(dep.id);
        }
      }

      for (const u of updates.values()) {
        await persistDates(u.uuid, u.start, u.due);
      }
    },
    [scheduledTasks, reschedule, persistDates],
  );

  // Clear an issue's start date (removes the start-date tag from its description).
  const clearStartDate = useCallback(
    async (taskUuid: string) => {
      if (!linearToken) return;
      const prevTasks = tasks;
      const prevUnscheduled = unscheduledTasks;
      const prevDone = doneTasks;

      patchTaskState(taskUuid, { startDate: null });
      pendingMutations.current++;
      try {
        await clearIssueStartDate(linearToken, taskUuid);
      } catch (e) {
        if (e instanceof DebounceCancelled) return;
        setTasks(prevTasks);
        setUnscheduledTasks(prevUnscheduled);
        setDoneTasks(prevDone);
        toastError(`Failed to clear start date: ${(e as Error).message}`);
        throw e;
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, tasks, unscheduledTasks, doneTasks, patchTaskState],
  );

  // Create a brand-new issue in the current project and link it to an existing issue.
  // direction 'blocking' => the new issue blocks the current one (current is blocked by it).
  // direction 'blocked'  => the current issue blocks the new one.
  const createDependentIssue = useCallback(
    async (
      currentTaskUuid: string,
      direction: 'blocking' | 'blocked',
      title: string,
      description: string,
      teamId: string,
    ) => {
      if (!linearToken) return;
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        toastError('Title is required.');
        return;
      }
      if (!teamId) {
        toastError('A team is required to create the issue.');
        return;
      }

      const current = [...tasks, ...unscheduledTasks, ...doneTasks].find((t) => t.uuid === currentTaskUuid);
      if (!current) {
        toastError('Could not find the source issue.');
        return;
      }

      // Create the new issue in the source issue's project (initiative mode spans many
      // projects, so we can't rely on a single selectedProjectId).
      const targetProjectId = current.projectId || selectedProjectId;
      if (!targetProjectId) {
        toastError('Could not determine which project to create the issue in.');
        return;
      }

      pendingMutations.current++;
      try {
        const newIssue = await createIssue(linearToken, {
          teamId,
          projectId: targetProjectId,
          title: trimmedTitle,
          description: description.trim() || undefined,
        });

        if (direction === 'blocking') {
          // New issue blocks the current one
          await createIssueRelation(linearToken, newIssue.id, current.uuid);
        } else {
          // Current issue blocks the new one
          await createIssueRelation(linearToken, current.uuid, newIssue.id);
        }

        toastSuccess(
          direction === 'blocking'
            ? `Created ${newIssue.identifier} — blocks ${current.id}`
            : `Created ${newIssue.identifier} — blocked by ${current.id}`,
        );

        // Reload so the new issue and its relation appear on the chart
        if (selectedInitiativeId) await loadInitiative(selectedInitiativeId, selectedProjectIds);
        else await loadIssues(targetProjectId);
      } catch (e) {
        toastError(`Failed to create issue: ${(e as Error).message}`);
        throw e;
      } finally {
        pendingMutations.current--;
      }
    },
    [
      linearToken,
      selectedProjectId,
      selectedInitiativeId,
      selectedProjectIds,
      tasks,
      unscheduledTasks,
      doneTasks,
      loadIssues,
      loadInitiative,
    ],
  );

  // Create a standalone issue directly in a project (initiative-mode "+" button).
  const createIssueInProject = useCallback(
    async (projectId: string, teamId: string, title: string, description: string) => {
      if (!linearToken) return;
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        toastError('Title is required.');
        return;
      }
      if (!teamId) {
        toastError('A team is required to create the issue.');
        return;
      }
      if (!projectId) {
        toastError('Could not determine which project to create the issue in.');
        return;
      }

      pendingMutations.current++;
      try {
        const newIssue = await createIssue(linearToken, {
          teamId,
          projectId,
          title: trimmedTitle,
          description: description.trim() || undefined,
        });
        toastSuccess(`Created ${newIssue.identifier}`);

        if (selectedInitiativeId) await loadInitiative(selectedInitiativeId, selectedProjectIds);
        else await loadIssues(projectId);
      } catch (e) {
        toastError(`Failed to create issue: ${(e as Error).message}`);
        throw e;
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, selectedInitiativeId, selectedProjectIds, loadIssues, loadInitiative],
  );

  // Edit a project's start/target dates (initiative mode). Optimistic with rollback.
  const editProjectDates = useCallback(
    async (projectId: string, startDate: string | null, targetDate: string | null) => {
      if (!linearToken || !selectedInitiativeId) return;
      const prev = projectMetasRef.current;
      const next = prev
        .map((m) => (m.id === projectId ? { ...m, startDate, targetDate } : m))
        .sort(compareProjectMetaByStart);
      setProjectMetas(next);

      pendingMutations.current++;
      try {
        await updateProjectDates(linearToken, projectId, startDate, targetDate);
        // Persist to the shared cache so peers and refreshes keep the new dates.
        const syncedAt = new Date().toISOString();
        appliedSyncedAtRef.current = syncedAt;
        writeScopeCache(initiativeScopeKey(selectedInitiativeId), {
          tasks: tasksRef.current,
          unscheduledTasks: unscheduledRef.current,
          doneTasks: doneRef.current,
          projectMetas: next,
          milestones: milestonesRef.current,
          projectName: projectNameRef.current,
          lastSyncedAt: syncedAt,
        }).catch((e) => console.warn('Cache write failed:', (e as Error).message));
        toastSuccess('Project dates updated');
      } catch (e) {
        setProjectMetas(prev);
        toastError(`Failed to update project dates: ${(e as Error).message}`);
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, selectedInitiativeId],
  );

  // Initial load when token is available
  useEffect(() => {
    if (!linearToken || initialLoadDone.current) return;
    initialLoadDone.current = true;

    (async () => {
      try {
        // Workspace members for the assignee editor (non-blocking for the rest of the load).
        fetchUsers(linearToken)
          .then(setUsers)
          .catch((e) => toastError(`Failed to load workspace members: ${(e as Error).message}`));

        // Teams for the create-issue team picker (also non-blocking).
        fetchTeams(linearToken)
          .then(setTeams)
          .catch((e) => toastError(`Failed to load teams: ${(e as Error).message}`));

        // Initiatives (awaited so we can restore initiative scope on startup).
        const inits = await fetchInitiatives(linearToken).catch((e) => {
          toastError(`Failed to load initiatives: ${(e as Error).message}`);
          return [] as Initiative[];
        });
        setInitiatives(inits);
        initiativesRef.current = inits;

        const p = await loadProjects();

        // Restore a previously selected initiative if it still exists.
        const savedInitiative = localStorage.getItem('linear_selected_initiative') || '';
        if (savedInitiative && inits.find((i) => i.id === savedInitiative)) {
          setSelectedInitiativeId(savedInitiative);
          await loadInitiativeScope(savedInitiative);
          return;
        }

        if (!p?.length) return;
        const target = selectedProjectId && p.find((x) => x.id === selectedProjectId) ? selectedProjectId : p[0].id;
        setSelectedProjectId(target);
        localStorage.setItem('linear_selected_project', target);
        await loadProjectScope(target);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [linearToken, selectedProjectId, loadProjects, loadProjectScope, loadInitiativeScope]);

  // Polling: auto-refresh every 30s (only when tab is visible)
  useEffect(() => {
    if (!linearToken || (!selectedProjectId && !selectedInitiativeId)) return;

    // Polling is now a cheap incremental sync (manifest diff + hydrate only changes),
    // so it's safe to run for both single-project and initiative views.
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      if (pendingMutations.current > 0) return;
      const run = selectedInitiativeId
        ? (() => {
            const init = initiativesRef.current.find((i) => i.id === selectedInitiativeId);
            if (!init) return Promise.resolve();
            return pollSync(initiativeScopeKey(selectedInitiativeId), init.projects.map((p) => p.id), false);
          })()
        : pollSync(projectScopeKey(selectedProjectId), [selectedProjectId], true);
      run.catch((e) => {
        if ((e as Error).message?.includes('authentication expired')) onAuthError?.();
      });
    };

    const startPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(tick, POLL_INTERVAL_MS);
    };

    startPolling();

    // Restart polling when tab becomes visible (in case interval drifted while hidden)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick();
        startPolling();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [linearToken, selectedProjectId, selectedInitiativeId, pollSync, onAuthError]);

  // Ctrl+Z / Cmd+Z undo handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        undo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo]);

  const toggleShowCompletedProjects = useCallback((show: boolean) => {
    setShowCompletedProjects(show);
    localStorage.setItem('gantt_show_completed_projects', show ? 'true' : 'false');
  }, []);

  return {
    projects,
    initiatives,
    selectedProjectId,
    selectedInitiativeId,
    selectedProjectIds,
    showCompletedProjects,
    setShowCompletedProjects: toggleShowCompletedProjects,
    projectMetas: visibleProjectMetas,
    projectName,
    tasks: scheduledTasks,
    doneTasks,
    // All issues now receive default dates, so nothing remains unscheduled.
    unscheduledTasks: EMPTY_TASKS,
    filteredTasks,
    milestones,
    workflowStatesByTeam,
    assignees,
    statuses,
    loading,
    error,
    lastSynced,
    dayWidth,
    groupBy,
    filters,
    setFilters,
    setGroupBy,
    selectProject,
    selectInitiative,
    setVisibleProjectIds,
    refresh,
    zoomIn,
    zoomOut,
    reschedule,
    rescheduleStart,
    cycleStatus,
    createRelation,
    removeRelation,
    createDependentIssue,
    createIssueInProject,
    editProjectDates,
    editTitle,
    editPriority,
    editStatus,
    editAssignee,
    editDescription,
    persistDates,
    rescheduleWithDependents,
    clearStartDate,
    users,
    teams,
    undo,
  };
}
