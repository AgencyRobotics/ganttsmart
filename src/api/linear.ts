import { PRIORITY_MAP, type Initiative, type Milestone, type Project, type Task, type Team, type User, type WorkflowState } from '@/types';
import { extractStartTag, combineDescription } from '@/utils/description';

const LINEAR_API = 'https://api.linear.app/graphql';

// ---- Rate limiter: debounce + queue ----
let pendingRequests = 0;
const MAX_CONCURRENT = 4;
const requestQueue: Array<() => void> = [];

function waitForSlot(): Promise<void> {
  if (pendingRequests < MAX_CONCURRENT) {
    pendingRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    requestQueue.push(() => {
      pendingRequests++;
      resolve();
    });
  });
}

function releaseSlot() {
  pendingRequests--;
  const next = requestQueue.shift();
  if (next) next();
}

// ---- Core GraphQL with retry + rate limit awareness ----
async function gql(apiKey: string, query: string, variables?: Record<string, unknown>, retries = 2): Promise<Record<string, unknown>> {
  await waitForSlot();
  try {
    const res = await fetch(LINEAR_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({ query, variables }),
    });

    // Rate limited — retry after delay
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '2', 10);
      if (retries > 0) {
        releaseSlot();
        await delay(retryAfter * 1000);
        return gql(apiKey, query, variables, retries - 1);
      }
      throw new Error('Rate limited by Linear API. Please wait a moment and try again.');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401) throw new Error('Linear authentication expired. Please reconnect.');
      if (res.status >= 500 && retries > 0) {
        releaseSlot();
        await delay(1000);
        return gql(apiKey, query, variables, retries - 1);
      }
      throw new Error(`Linear API error (${res.status}): ${text || res.statusText}`);
    }

    const data = await res.json();
    if (data.errors) {
      const msg = data.errors[0]?.message || 'Unknown GraphQL error';
      // Retry on transient errors
      if (retries > 0 && (msg.includes('timeout') || msg.includes('unavailable'))) {
        releaseSlot();
        await delay(1000);
        return gql(apiKey, query, variables, retries - 1);
      }
      throw new Error(msg);
    }
    return data.data as Record<string, unknown>;
  } catch (e) {
    // Network errors — retry once
    if (retries > 0 && (e as Error).message?.includes('fetch')) {
      releaseSlot();
      await delay(1000);
      return gql(apiKey, query, variables, retries - 1);
    }
    throw e;
  } finally {
    releaseSlot();
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Debounce helper for drag operations ----
const debounceTimers = new Map<string, { timer: ReturnType<typeof setTimeout>; reject: (reason: unknown) => void }>();

class DebounceCancelled extends Error {
  constructor() {
    super('Debounced call was superseded');
    this.name = 'DebounceCancelled';
  }
}

export { DebounceCancelled };

export function debouncedApiCall<T>(key: string, fn: () => Promise<T>, delayMs = 300): Promise<T> {
  return new Promise((resolve, reject) => {
    const existing = debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      existing.reject(new DebounceCancelled()); // resolve the orphaned promise
    }

    debounceTimers.set(key, {
      timer: setTimeout(async () => {
        debounceTimers.delete(key);
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        }
      }, delayMs),
      reject,
    });
  });
}

// ---- API functions ----

export async function testAuth(apiKey: string): Promise<{ id: string; name: string }> {
  const data = await gql(apiKey, '{ viewer { id name } }');
  const viewer = data?.viewer as { id: string; name: string } | undefined;
  if (!viewer) throw new Error('Invalid API key');
  return viewer;
}

export async function fetchProjects(apiKey: string): Promise<Project[]> {
  const data = await gql(
    apiKey,
    `query {
      projects(first: 100) {
        nodes { id name }
      }
    }`,
  );
  const projects = data.projects as { nodes: Project[] };
  return projects.nodes.sort((a, b) => a.name.localeCompare(b.name));
}

/** Fetch all initiatives in the workspace, each with the projects it contains. */
export async function fetchInitiatives(apiKey: string): Promise<Initiative[]> {
  // Keep this light: Linear caps query complexity (~10k), and nesting many projects
  // under many initiatives blows past it. Project dates come from fetchIssues instead.
  const data = await gql(
    apiKey,
    `query {
      initiatives(first: 50) {
        nodes {
          id
          name
          projects(first: 50) {
            nodes { id name state url }
          }
        }
      }
    }`,
  );
  const initiatives = data.initiatives as {
    nodes: Array<{ id: string; name: string; projects: { nodes: Project[] } }>;
  };
  return initiatives.nodes
    .map((i) => ({
      id: i.id,
      name: i.name,
      projects: (i.projects?.nodes || []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetch project-to-project "blocks" relations for the given projects, returning a map
 * keyed by project id. Mirrors the issue-relation convention: `blocks` are the projects
 * this one blocks; `blockedBy` are the projects that block it. Reads both `relations`
 * (this project is the source) and `inverseRelations` (this project is the target).
 */
export async function fetchProjectRelations(
  apiKey: string,
  projectIds: string[],
): Promise<Record<string, { blocks: string[]; blockedBy: string[] }>> {
  const result: Record<string, { blocks: string[]; blockedBy: string[] }> = {};
  for (const id of projectIds) result[id] = { blocks: [], blockedBy: [] };
  if (projectIds.length === 0) return result;

  const data = await gql(
    apiKey,
    `query($ids: [ID!]!) {
      projects(filter: { id: { in: $ids } }) {
        nodes {
          id
          relations { nodes { type relatedProject { id } } }
          inverseRelations { nodes { type project { id } } }
        }
      }
    }`,
    { ids: projectIds },
  );

  const projects = data.projects as {
    nodes: Array<{
      id: string;
      relations?: { nodes: Array<{ type: string; relatedProject: { id: string } }> };
      inverseRelations?: { nodes: Array<{ type: string; project: { id: string } }> };
    }>;
  };

  // Linear models project dependencies with a single directional type, "dependency":
  // `project --dependency--> relatedProject` means `project` blocks `relatedProject`
  // (the related one comes later). Treat legacy "blocks"/"blocked_by" the same way.
  const isBlocks = (t: string) => t === 'dependency' || t === 'blocks';
  const inScope = new Set(projectIds);
  for (const p of projects.nodes) {
    if (!result[p.id]) result[p.id] = { blocks: [], blockedBy: [] };
    for (const rel of p.relations?.nodes || []) {
      const other = rel.relatedProject?.id;
      if (!other || !inScope.has(other)) continue;
      if (isBlocks(rel.type)) result[p.id].blocks.push(other);
      else if (rel.type === 'blocked_by') result[p.id].blockedBy.push(other);
    }
    for (const inv of p.inverseRelations?.nodes || []) {
      const other = inv.project?.id;
      if (!other || !inScope.has(other)) continue;
      if (isBlocks(inv.type)) result[p.id].blockedBy.push(other);
      else if (inv.type === 'blocked_by') result[p.id].blocks.push(other);
    }
  }
  return result;
}

/** Parse the start-date tag from an issue description.
 *  Current format: `Start Date: YYYY-MM-DD`. Legacy format `start: DD-MM-YY` is still read. */
function parseStartDate(description: string): string | null {
  // Current format: "Start Date: YYYY-MM-DD"
  const iso = description.match(/start date:\s*(\d{4})-(\d{2})-(\d{2})/i);
  if (iso) {
    const [, yyyy, mm, dd] = iso;
    const month = parseInt(mm);
    const day = parseInt(dd);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${yyyy}-${mm}-${dd}`;
  }

  // Legacy format: "start: DD-MM-YY"
  const legacy = description.match(/start:\s*(\d{2})-(\d{2})-(\d{2})/i);
  if (legacy) {
    const [, dd, mm, yy] = legacy;
    const year = 2000 + parseInt(yy);
    const month = parseInt(mm);
    const day = parseInt(dd);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return null;
}

export interface FetchIssuesOptions {
  /** Skip completed issues (saves a whole connection). Defaults to true (fetch them). */
  includeDone?: boolean;
  /** Skip the sub-issue/progress fetch (the heaviest part). Defaults to true (fetch them). */
  includeChildren?: boolean;
}

export async function fetchIssues(
  apiKey: string,
  projectId: string,
  opts: FetchIssuesOptions = {},
): Promise<{
  projectId: string;
  projectName: string;
  projectStartDate: string | null;
  projectTargetDate: string | null;
  tasks: Task[];
  doneTasks: Task[];
  unscheduledTasks: Task[];
  milestones: Milestone[];
}> {
  const { includeDone = true, includeChildren = true } = opts;

  const issueFields = `
    id
    identifier
    title
    description
    dueDate
    url
    priority
    state { name type }
    createdAt
    completedAt
    updatedAt
    assignee { id name }
    team { id }`;

  const doneIssuesBlock = includeDone
    ? `doneIssues: issues(first: 100, filter: { completedAt: { null: false } }) {
          nodes { ${issueFields} }
        }`
    : '';

  const data = await gql(
    apiKey,
    `query($id: String!) {
      project(id: $id) {
        name
        startDate
        targetDate
        projectMilestones {
          nodes {
            id
            name
            targetDate
          }
        }
        issues(first: 250, filter: { completedAt: { null: true } }) {
          nodes { ${issueFields} }
        }
        ${doneIssuesBlock}
      }
    }`,
    { id: projectId },
  );

  interface IssueNode {
    id: string;
    identifier: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    url: string;
    priority: number;
    state: { name: string; type: string } | null;
    createdAt: string;
    completedAt: string | null;
    updatedAt?: string | null;
    assignee: { id: string; name: string } | null;
    team: { id: string } | null;
  }

  const project = data.project as {
    name: string;
    startDate: string | null;
    targetDate: string | null;
    projectMilestones: { nodes: Array<{ id: string; name: string; targetDate: string | null }> };
    issues: { nodes: IssueNode[] };
    doneIssues: { nodes: IssueNode[] };
  };

  if (!project) throw new Error('Project not found');

  const issueNodes = project.issues.nodes;
  const doneIssueNodes = project.doneIssues?.nodes || [];
  const projectTargetDate = project.targetDate;

  // Effective due date: explicit dueDate, falling back to project's targetDate.
  // Returns { date, isImplicit } or null if no date can be derived at all.
  function effectiveDue(n: IssueNode): { date: string; isImplicit: boolean } | null {
    if (n.dueDate) return { date: n.dueDate, isImplicit: false };
    if (projectTargetDate) return { date: projectTargetDate, isImplicit: true };
    return null;
  }

  // Query 2: fetch relations and children for ALL active issues (scheduled + unscheduled).
  // We want relation/child counts on every issue so the unscheduled list shows them too.
  const issueIds = issueNodes.map((n) => n.id);

  const relationsMap: Record<string, { blocks: string[]; blockedBy: string[] }> = {};
  const childrenMap: Record<string, { total: number; completed: number }> = {};

  if (issueIds.length > 0) {
    try {
      const childrenBlock = includeChildren
        ? `children {
                nodes {
                  id
                  completedAt
                }
              }`
        : '';

      const detailData = await gql(
        apiKey,
        `query($ids: [ID!]!) {
          issues(filter: { id: { in: $ids } }) {
            nodes {
              id
              identifier
              relations(first: 25) {
                nodes {
                  type
                  relatedIssue { identifier }
                }
              }
              ${childrenBlock}
            }
          }
        }`,
        { ids: issueIds },
      );

      interface RelNode {
        type: string;
        relatedIssue: { identifier: string };
      }
      interface ChildNode {
        id: string;
        completedAt: string | null;
      }

      const issues = detailData.issues as {
        nodes: Array<{
          id: string;
          identifier: string;
          relations?: { nodes: RelNode[] };
          children?: { nodes: ChildNode[] };
        }>;
      };

      for (const node of issues.nodes) {
        const identifier = node.identifier;
        const relations = node.relations?.nodes || [];
        const blocks: string[] = [];
        const blockedBy: string[] = [];
        for (const rel of relations) {
          if (rel.type === 'blocks') blocks.push(rel.relatedIssue.identifier);
          else if (rel.type === 'blocked_by') blockedBy.push(rel.relatedIssue.identifier);
        }
        relationsMap[identifier] = { blocks, blockedBy };

        const children = node.children?.nodes || [];
        childrenMap[identifier] = {
          total: children.length,
          completed: children.filter((c) => c.completedAt !== null).length,
        };
      }
    } catch {
      console.warn('Failed to fetch relations/children — continuing without them');
    }
  }

  function mapNode(n: IssueNode, due: string, isDueImplicit: boolean): Task {
    const rel = relationsMap[n.identifier] || { blocks: [], blockedBy: [] };
    const ch = childrenMap[n.identifier] || { total: 0, completed: 0 };
    const progress = ch.total > 0 ? Math.round((ch.completed / ch.total) * 100) : 0;

    return {
      id: n.identifier,
      uuid: n.id,
      title: n.title,
      description: n.description || '',
      due,
      startDate: parseStartDate(n.description || ''),
      url: n.url,
      priorityVal: n.priority,
      priority: PRIORITY_MAP[n.priority] || 'None',
      status: n.state?.name || '',
      statusType: n.state?.type || '',
      assignee: n.assignee?.name || 'Unassigned',
      assigneeId: n.assignee?.id,
      teamId: n.team?.id || '',
      projectId,
      projectName: project.name,
      blocks: rel.blocks,
      blockedBy: rel.blockedBy,
      progress,
      totalChildren: ch.total,
      completedChildren: ch.completed,
      completedAt: n.completedAt || undefined,
      updatedAt: n.updatedAt || undefined,
      isDueImplicit: isDueImplicit || undefined,
    };
  }

  // Active issues: split into scheduled (have a due date or fallback) and unscheduled (no date at all).
  const tasks: Task[] = [];
  const unscheduledTasks: Task[] = [];
  for (const n of issueNodes) {
    const eff = effectiveDue(n);
    if (eff) {
      tasks.push(mapNode(n, eff.date, eff.isImplicit));
    } else {
      // No date — show as unscheduled with a placeholder due date (today) so consumers
      // that need `due` can render. UI treats these specially via isDueImplicit.
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      unscheduledTasks.push(mapNode(n, todayStr, true));
    }
  }
  tasks.sort(
    (a, b) => a.priorityVal - b.priorityVal || new Date(a.due).getTime() - new Date(b.due).getTime(),
  );
  unscheduledTasks.sort(
    (a, b) => a.priorityVal - b.priorityVal || a.id.localeCompare(b.id),
  );

  const doneTasks: Task[] = doneIssueNodes
    .filter((n) => n.dueDate || projectTargetDate)
    .map((n) => {
      const eff = effectiveDue(n)!;
      return mapNode(n, eff.date, eff.isImplicit);
    })
    .sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime; // newest completed first
    });

  const milestones: Milestone[] = (project.projectMilestones?.nodes || []).map((m) => ({
    id: m.id,
    name: m.name,
    targetDate: m.targetDate,
  }));

  return {
    projectId,
    projectName: project.name,
    projectStartDate: project.startDate,
    projectTargetDate: project.targetDate,
    tasks,
    doneTasks,
    unscheduledTasks,
    milestones,
  };
}

export interface ManifestEntry {
  uuid: string;
  updatedAt: string;
}

/**
 * Cheap "what exists / what changed" query: fetches only id + updatedAt for the issues
 * in the given projects (paginated). Used to diff against the cache so we only hydrate
 * the issues that actually changed — a fraction of the complexity of a full reload.
 */
export async function fetchIssueManifest(
  apiKey: string,
  projectIds: string[],
  includeDone = true,
): Promise<ManifestEntry[]> {
  if (projectIds.length === 0) return [];

  const completedFilter = includeDone ? '' : ', completedAt: { null: true }';
  const entries: ManifestEntry[] = [];
  let cursor: string | null = null;

  // Paginate to be safe on large scopes; each page is tiny (2 fields/issue).
  for (let page = 0; page < 50; page++) {
    const data: Record<string, unknown> = await gql(
      apiKey,
      `query($ids: [ID!]!, $after: String) {
        issues(
          first: 250
          after: $after
          filter: { project: { id: { in: $ids } }${completedFilter} }
        ) {
          pageInfo { hasNextPage endCursor }
          nodes { id updatedAt }
        }
      }`,
      { ids: projectIds, after: cursor },
    );

    const issues = data.issues as {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: Array<{ id: string; updatedAt: string }>;
    };
    for (const n of issues.nodes) entries.push({ uuid: n.id, updatedAt: n.updatedAt });

    if (!issues.pageInfo.hasNextPage) break;
    cursor = issues.pageInfo.endCursor;
  }

  return entries;
}

/**
 * Hydrate full data (fields + relations, optionally children) for a specific set of issue
 * UUIDs, bucketed like fetchIssues. Used to fetch only the issues that changed during a
 * sync. Each issue carries its own project info so effective-due and tagging are correct.
 */
export async function fetchIssuesByIds(
  apiKey: string,
  uuids: string[],
  opts: FetchIssuesOptions = {},
): Promise<{ tasks: Task[]; unscheduledTasks: Task[]; doneTasks: Task[] }> {
  if (uuids.length === 0) return { tasks: [], unscheduledTasks: [], doneTasks: [] };
  const { includeChildren = true } = opts;

  const childrenBlock = includeChildren
    ? `children { nodes { id completedAt } }`
    : '';

  const data = await gql(
    apiKey,
    `query($ids: [ID!]!) {
      issues(filter: { id: { in: $ids } }) {
        nodes {
          id
          identifier
          title
          description
          dueDate
          url
          priority
          state { name type }
          createdAt
          completedAt
          updatedAt
          assignee { id name }
          team { id }
          project { id name startDate targetDate }
          relations(first: 25) { nodes { type relatedIssue { identifier } } }
          ${childrenBlock}
        }
      }
    }`,
    { ids: uuids },
  );

  interface Node {
    id: string;
    identifier: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    url: string;
    priority: number;
    state: { name: string; type: string } | null;
    createdAt: string;
    completedAt: string | null;
    updatedAt: string | null;
    assignee: { id: string; name: string } | null;
    team: { id: string } | null;
    project: { id: string; name: string; startDate: string | null; targetDate: string | null } | null;
    relations?: { nodes: Array<{ type: string; relatedIssue: { identifier: string } }> };
    children?: { nodes: Array<{ id: string; completedAt: string | null }> };
  }

  const nodes = (data.issues as { nodes: Node[] }).nodes;

  const tasks: Task[] = [];
  const unscheduledTasks: Task[] = [];
  const doneTasks: Task[] = [];

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  for (const n of nodes) {
    const blocks: string[] = [];
    const blockedBy: string[] = [];
    for (const rel of n.relations?.nodes || []) {
      if (rel.type === 'blocks') blocks.push(rel.relatedIssue.identifier);
      else if (rel.type === 'blocked_by') blockedBy.push(rel.relatedIssue.identifier);
    }
    const children = n.children?.nodes || [];
    const totalChildren = children.length;
    const completedChildren = children.filter((c) => c.completedAt !== null).length;
    const progress = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;

    const projectTargetDate = n.project?.targetDate || null;
    const explicitDue = n.dueDate;
    const due = explicitDue || projectTargetDate || todayStr;
    const isDueImplicit = !explicitDue;

    const task: Task = {
      id: n.identifier,
      uuid: n.id,
      title: n.title,
      description: n.description || '',
      due,
      startDate: parseStartDate(n.description || ''),
      url: n.url,
      priorityVal: n.priority,
      priority: PRIORITY_MAP[n.priority] || 'None',
      status: n.state?.name || '',
      statusType: n.state?.type || '',
      assignee: n.assignee?.name || 'Unassigned',
      assigneeId: n.assignee?.id,
      teamId: n.team?.id || '',
      projectId: n.project?.id,
      projectName: n.project?.name,
      blocks,
      blockedBy,
      progress,
      totalChildren,
      completedChildren,
      completedAt: n.completedAt || undefined,
      updatedAt: n.updatedAt || undefined,
      isDueImplicit: isDueImplicit || undefined,
    };

    if (n.completedAt) {
      // Only keep completed issues that can be placed on the timeline.
      if (explicitDue || projectTargetDate) doneTasks.push(task);
    } else if (explicitDue || projectTargetDate) {
      tasks.push(task);
    } else {
      unscheduledTasks.push(task);
    }
  }

  return { tasks, unscheduledTasks, doneTasks };
}

// ---- Mutations (with debouncing for drag operations) ----

export async function updateIssueDueDate(apiKey: string, issueId: string, dueDate: string): Promise<void> {
  await debouncedApiCall(`due-${issueId}`, () =>
    gql(
      apiKey,
      `mutation($id: String!, $dueDate: TimelessDate!) {
        issueUpdate(id: $id, input: { dueDate: $dueDate }) {
          success
        }
      }`,
      { id: issueId, dueDate },
    ),
  );
}

export async function updateIssueStartDate(apiKey: string, issueId: string, startDate: string): Promise<void> {
  await debouncedApiCall(`start-${issueId}`, async () => {
    // Fetch current description
    const data = await gql(apiKey, `query($id: String!) { issue(id: $id) { description } }`, { id: issueId });
    const issue = data.issue as { description: string | null };
    const currentDesc: string = issue?.description || '';

    // Format the new start tag: "Start Date: YYYY-MM-DD" (startDate is already YYYY-MM-DD)
    const newTag = `Start Date: ${startDate}`;

    const newFormat = /start date:\s*\d{4}-\d{2}-\d{2}/i;
    const legacyFormat = /start:\s*\d{2}-\d{2}-\d{2}/i;

    let newDesc: string;
    if (newFormat.test(currentDesc)) {
      newDesc = currentDesc.replace(newFormat, newTag);
    } else if (legacyFormat.test(currentDesc)) {
      // Migrate any legacy "start: DD-MM-YY" tag to the new format
      newDesc = currentDesc.replace(legacyFormat, newTag);
    } else {
      newDesc = currentDesc.trim() ? `${currentDesc.trim()}\n${newTag}` : newTag;
    }

    await gql(
      apiKey,
      `mutation($id: String!, $description: String!) {
        issueUpdate(id: $id, input: { description: $description }) {
          success
        }
      }`,
      { id: issueId, description: newDesc },
    );
  });
}

/** Remove the GanttSmart start-date tag from an issue description (clears its start date). */
export async function clearIssueStartDate(apiKey: string, issueId: string): Promise<void> {
  await debouncedApiCall(`start-${issueId}`, async () => {
    const data = await gql(apiKey, `query($id: String!) { issue(id: $id) { description } }`, { id: issueId });
    const issue = data.issue as { description: string | null };
    const { body } = extractStartTag(issue?.description || '');
    await gql(
      apiKey,
      `mutation($id: String!, $description: String!) {
        issueUpdate(id: $id, input: { description: $description }) { success }
      }`,
      { id: issueId, description: body },
    );
  });
}

export async function updateIssueState(apiKey: string, issueId: string, stateId: string): Promise<void> {
  await gql(
    apiKey,
    `mutation($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) {
        success
      }
    }`,
    { id: issueId, stateId },
  );
}

export async function updateIssueTitle(apiKey: string, issueId: string, title: string): Promise<void> {
  await gql(
    apiKey,
    `mutation($id: String!, $title: String!) {
      issueUpdate(id: $id, input: { title: $title }) { success }
    }`,
    { id: issueId, title },
  );
}

export async function updateIssuePriority(apiKey: string, issueId: string, priority: number): Promise<void> {
  await gql(
    apiKey,
    `mutation($id: String!, $priority: Int!) {
      issueUpdate(id: $id, input: { priority: $priority }) { success }
    }`,
    { id: issueId, priority },
  );
}

export async function updateIssueAssignee(
  apiKey: string,
  issueId: string,
  assigneeId: string | null,
): Promise<void> {
  await gql(
    apiKey,
    `mutation($id: String!, $assigneeId: String) {
      issueUpdate(id: $id, input: { assigneeId: $assigneeId }) { success }
    }`,
    { id: issueId, assigneeId },
  );
}

/** Update the description body, preserving the GanttSmart start-date tag stored within it. */
export async function updateIssueDescription(apiKey: string, issueId: string, body: string): Promise<void> {
  const data = await gql(apiKey, `query($id: String!) { issue(id: $id) { description } }`, { id: issueId });
  const issue = data.issue as { description: string | null };
  const { tag } = extractStartTag(issue?.description || '');
  const newDesc = combineDescription(body, tag);

  await gql(
    apiKey,
    `mutation($id: String!, $description: String!) {
      issueUpdate(id: $id, input: { description: $description }) { success }
    }`,
    { id: issueId, description: newDesc },
  );
}

/** Update a project's start and/or target dates. Pass null to clear a date. */
export async function updateProjectDates(
  apiKey: string,
  projectId: string,
  startDate: string | null,
  targetDate: string | null,
): Promise<void> {
  await gql(
    apiKey,
    `mutation($id: String!, $startDate: TimelessDate, $targetDate: TimelessDate) {
      projectUpdate(id: $id, input: { startDate: $startDate, targetDate: $targetDate }) {
        success
      }
    }`,
    { id: projectId, startDate, targetDate },
  );
}

export async function fetchUsers(apiKey: string): Promise<User[]> {
  const data = await gql(
    apiKey,
    `query {
      users(first: 250, filter: { active: { eq: true } }) {
        nodes { id name }
      }
    }`,
  );
  const users = data.users as { nodes: User[] };
  return users.nodes.sort((a, b) => a.name.localeCompare(b.name));
}

/** Fetch all teams in the workspace (for the team picker when creating issues). */
export async function fetchTeams(apiKey: string): Promise<Team[]> {
  const data = await gql(
    apiKey,
    `query {
      teams(first: 250) {
        nodes { id name key }
      }
    }`,
  );
  const teams = data.teams as { nodes: Team[] };
  return teams.nodes.sort((a, b) => a.name.localeCompare(b.name));
}

export interface NewIssueInput {
  teamId: string;
  projectId: string;
  title: string;
  description?: string;
}

/** Create a new Linear issue in the given team/project. Returns the new issue's UUID + identifier. */
export async function createIssue(
  apiKey: string,
  input: NewIssueInput,
): Promise<{ id: string; identifier: string }> {
  const data = await gql(
    apiKey,
    `mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier }
      }
    }`,
    { input },
  );
  const result = data.issueCreate as { success: boolean; issue: { id: string; identifier: string } | null };
  if (!result?.success || !result.issue) throw new Error('Linear did not create the issue');
  return result.issue;
}

export async function createIssueRelation(
  apiKey: string,
  issueId: string,
  relatedIssueId: string,
): Promise<void> {
  await gql(
    apiKey,
    `mutation($issueId: String!, $relatedIssueId: String!) {
      issueRelationCreate(input: { issueId: $issueId, relatedIssueId: $relatedIssueId, type: blocks }) {
        success
      }
    }`,
    { issueId, relatedIssueId },
  );
}

export async function removeIssueRelation(apiKey: string, issueId: string, relatedIssueId: string): Promise<void> {
  // First find the relation ID, then delete it
  const data = await gql(
    apiKey,
    `query($id: String!) {
      issue(id: $id) {
        relations {
          nodes {
            id
            type
            relatedIssue { id }
          }
        }
      }
    }`,
    { id: issueId },
  );
  const issue = data.issue as { relations: { nodes: Array<{ id: string; type: string; relatedIssue: { id: string } }> } };
  const relation = issue.relations.nodes.find(
    (r) => r.type === 'blocks' && r.relatedIssue.id === relatedIssueId,
  );
  if (!relation) return;

  await gql(
    apiKey,
    `mutation($id: String!) {
      issueRelationDelete(id: $id) { success }
    }`,
    { id: relation.id },
  );
}

export async function fetchWorkflowStates(apiKey: string, teamId: string): Promise<WorkflowState[]> {
  const data = await gql(
    apiKey,
    `query($teamId: String!) {
      workflowStates(filter: { team: { id: { eq: $teamId } } }) {
        nodes {
          id
          name
          type
          position
        }
      }
    }`,
    { teamId },
  );
  const states = data.workflowStates as { nodes: WorkflowState[] };
  return states.nodes.sort((a, b) => a.position - b.position);
}
