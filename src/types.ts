export interface Task {
  id: string; // display identifier (e.g., "SEED-14")
  uuid: string; // Linear UUID for mutations
  title: string;
  description: string;
  due: string;
  startDate: string | null;
  priorityVal: number;
  priority: string;
  status: string;
  statusType: string;
  assignee: string;
  assigneeId?: string; // Linear user UUID (for editing assignee)
  url: string; // direct Linear URL
  teamId: string; // team UUID for workflow states
  projectId?: string; // owning project UUID (used in initiative / multi-project mode)
  projectName?: string; // owning project name
  blocks: string[];
  blockedBy: string[];
  progress: number;
  totalChildren: number;
  completedChildren: number;
  completedAt?: string;
  /** True when `due` was derived from project.targetDate (issue has no explicit due date) */
  isDueImplicit?: boolean;
}

export interface Project {
  id: string;
  name: string;
  startDate?: string | null;
  targetDate?: string | null;
}

export interface Initiative {
  id: string;
  name: string;
  projects: Project[];
}

/** A project rendered as a summary bar in initiative mode, plus its project-to-project deps. */
export interface ProjectMeta {
  id: string;
  name: string;
  startDate: string | null;
  targetDate: string | null;
  blocks: string[]; // project ids this project blocks
  blockedBy: string[]; // project ids that block this project
}

export interface Milestone {
  id: string;
  name: string;
  targetDate: string | null;
}

export interface WorkflowState {
  id: string;
  name: string;
  type: string; // 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'
  position: number;
}

export interface User {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  key: string;
}

export type GroupBy = 'none' | 'assignee' | 'priority' | 'status';

export const PRIORITY_MAP: Record<number, string> = {
  0: 'None',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
};

export const DEFAULT_DAY_WIDTH = 28;
export const MIN_DAY_WIDTH = 14;
export const MAX_DAY_WIDTH = 56;

export interface Filters {
  assignee: string;
  status: string;
  priorities: Set<number>;
  search: string;
  dateFrom: string;
  dateTo: string;
}
