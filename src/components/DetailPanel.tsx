import { useEffect, useRef, useState } from 'react';
import type { Task, Team, User, WorkflowState } from '@/types';
import { PRIORITY_MAP } from '@/types';
import type { TaskBaseline } from '@/hooks/usePlanningHistory';
import { Avatar } from '@/utils/avatar';
import { isSafeUrl } from '@/utils/url';
import { priorityColors, statusDotColors } from '@/utils/colors';
import { formatDateShort } from '@/utils/date';
import { extractStartTag } from '@/utils/description';
import CustomDropdown, { type DropdownOption } from './CustomDropdown';

type DependencyDirection = 'blocking' | 'blocked';
type CreateDependentIssueHandler = (
  currentTaskUuid: string,
  direction: DependencyDirection,
  title: string,
  description: string,
  teamId: string,
) => Promise<void>;

interface PanelEditContext {
  editTitle: (taskUuid: string, title: string) => Promise<void>;
  editPriority: (taskUuid: string, priorityVal: number) => Promise<void>;
  editStatus: (taskUuid: string, stateId: string) => Promise<void>;
  editAssignee: (taskUuid: string, assigneeId: string | null) => Promise<void>;
  editDescription: (taskUuid: string, body: string) => Promise<void>;
  reschedule: (taskUuid: string, newDueDate: string) => Promise<void>;
  rescheduleStart: (taskUuid: string, newStartDate: string) => Promise<void>;
  acceptBaseline: (task: Task) => Promise<void>;
  revertBaseline: (task: Task) => Promise<void>;
  workflowStatesByTeam: Record<string, WorkflowState[]>;
  users: User[];
  teams: Team[];
}

// Global state management
let globalOpenPanel: ((task: Task) => void) | null = null;
let globalClosePanel: (() => void) | null = null;
let globalRemoveRelation: ((sourceId: string, targetId: string) => Promise<void>) | null = null;
let globalCreateDependentIssue: CreateDependentIssueHandler | null = null;
let globalEditContext: PanelEditContext | null = null;
let globalBaselines: Map<string, TaskBaseline> = new Map();

export function setBaselinesForPanel(baselines: Map<string, TaskBaseline>) {
  globalBaselines = baselines;
}

export function setPanelEditContext(ctx: PanelEditContext | null) {
  globalEditContext = ctx;
}

export function openDetailPanel(task: Task) {
  globalOpenPanel?.(task);
}
export function closeDetailPanel() {
  globalClosePanel?.();
}
export function setRemoveRelationHandler(handler: ((sourceId: string, targetId: string) => Promise<void>) | null) {
  globalRemoveRelation = handler;
}
export function setCreateDependentIssueHandler(handler: CreateDependentIssueHandler | null) {
  globalCreateDependentIssue = handler;
}

export default function DetailPanel() {
  const [task, setTask] = useState<Task | null>(null);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // New-dependent-issue modal state
  const [modalDirection, setModalDirection] = useState<DependencyDirection | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTeamId, setNewTeamId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const closeModal = () => {
    setModalDirection(null);
    setNewTitle('');
    setNewDescription('');
    setCreateError('');
    setCreating(false);
  };

  // Inline-edit drafts (title + description), synced whenever a different task opens
  const [titleDraft, setTitleDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [baselineBusy, setBaselineBusy] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitleDraft(task.title);
    setDescDraft(extractStartTag(task.description).body);
    setEditingTitle(false);
    setEditingDesc(false);
    setBaselineBusy(false);
  }, [task?.uuid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update the locally displayed task snapshot (keeps the panel in sync after an edit)
  const patchLocalTask = (patch: Partial<Task>) => setTask((t) => (t ? { ...t, ...patch } : t));

  useEffect(() => {
    globalOpenPanel = (t: Task) => {
      setTask(t);
      // Trigger animation on next frame
      requestAnimationFrame(() => setVisible(true));
    };
    globalClosePanel = () => {
      setVisible(false);
      setTimeout(() => setTask(null), 250); // Wait for slide-out animation
    };
    return () => {
      globalOpenPanel = null;
      globalClosePanel = null;
    };
  }, []);

  // Close on Escape (modal takes priority over the panel)
  useEffect(() => {
    if (!task) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (modalDirection) {
        closeModal();
        return;
      }
      // Don't close the panel while the user is typing in a field — let it blur instead.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        (e.target as HTMLElement).blur();
        return;
      }
      closeDetailPanel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [task, modalDirection]);

  // Close on click outside (disabled while the modal is open)
  useEffect(() => {
    if (!task || modalDirection) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeDetailPanel();
      }
    };
    // Delay to prevent the click that opened the panel from closing it
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [task, modalDirection]);

  const handleCreateDependent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !modalDirection) return;
    if (!newTitle.trim()) {
      setCreateError('Title is required.');
      return;
    }
    if (!globalCreateDependentIssue) {
      setCreateError('Issue creation is unavailable right now.');
      return;
    }
    if (!newTeamId) {
      setCreateError('Please select a team.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      await globalCreateDependentIssue(task.uuid, modalDirection, newTitle, newDescription, newTeamId);
      closeModal();
      closeDetailPanel();
    } catch (err) {
      setCreateError((err as Error).message);
      setCreating(false);
    }
  };

  if (!task) return null;

  const dueDate = new Date(task.due + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
  const overdue = daysLeft < 0;
  const statusDotColor = statusDotColors[task.statusType] || '#52525b';
  const priorityColor = priorityColors[task.priority] || '#52525b';

  const ctx = globalEditContext;
  const canEdit = !!ctx;

  const priorityDot = (color: string) => (
    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
  );

  // Priority order: Urgent, High, Medium, Low, None
  const priorityOptions: DropdownOption[] = [1, 2, 3, 4, 0].map((val) => ({
    value: String(val),
    label: PRIORITY_MAP[val],
    icon: priorityDot(priorityColors[PRIORITY_MAP[val]] || '#52525b'),
  }));

  const teamStates = ctx?.workflowStatesByTeam[task.teamId] || [];
  const statusOptions: DropdownOption[] = teamStates.map((s) => ({
    value: s.id,
    label: s.name,
    icon: priorityDot(statusDotColors[s.type] || '#52525b'),
  }));
  const currentStateId = teamStates.find((s) => s.name === task.status)?.id || '';

  const assigneeOptions: DropdownOption[] = (ctx?.users || []).map((u) => ({
    value: u.id,
    label: u.name,
    icon: <Avatar name={u.name} size="sm" />,
  }));

  const handleStatusChange = (stateId: string) => {
    const state = teamStates.find((s) => s.id === stateId);
    if (!ctx || !state) return;
    patchLocalTask({ status: state.name, statusType: state.type });
    ctx.editStatus(task.uuid, stateId);
  };

  const handlePriorityChange = (value: string) => {
    if (!ctx) return;
    const val = Number(value);
    patchLocalTask({ priorityVal: val, priority: PRIORITY_MAP[val] || 'None' });
    ctx.editPriority(task.uuid, val);
  };

  const handleAssigneeChange = (value: string) => {
    if (!ctx) return;
    const user = value ? ctx.users.find((u) => u.id === value) : null;
    patchLocalTask({ assignee: user ? user.name : 'Unassigned', assigneeId: value || undefined });
    ctx.editAssignee(task.uuid, value || null);
  };

  const handleStartDateChange = (value: string) => {
    if (!ctx || !value) return;
    patchLocalTask({ startDate: value });
    ctx.rescheduleStart(task.uuid, value);
  };

  const handleDueDateChange = (value: string) => {
    if (!ctx || !value) return;
    patchLocalTask({ due: value, isDueImplicit: undefined });
    ctx.reschedule(task.uuid, value);
  };

  const saveTitle = () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (!ctx || !trimmed || trimmed === task.title) {
      setTitleDraft(task.title);
      return;
    }
    patchLocalTask({ title: trimmed });
    ctx.editTitle(task.uuid, trimmed);
  };

  const saveDescription = () => {
    setEditingDesc(false);
    if (!ctx) return;
    const currentBody = extractStartTag(task.description).body;
    if (descDraft === currentBody) return;
    const tag = extractStartTag(task.description).tag;
    const trimmed = descDraft.trim();
    const newDesc = tag ? (trimmed ? `${trimmed}\n${tag}` : tag) : trimmed;
    patchLocalTask({ description: newDesc });
    ctx.editDescription(task.uuid, descDraft);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[150] transition-opacity duration-250 ${visible ? 'bg-black/20 backdrop-blur-[2px]' : 'opacity-0 pointer-events-none'}`}
        onClick={() => closeDetailPanel()}
      />

      {/* Panel — bottom sheet on mobile, side panel on desktop */}
      <div
        ref={panelRef}
        className={`fixed z-[151] bg-bg-card shadow-2xl flex flex-col transition-transform duration-250 ease-out print:hidden
          inset-x-0 bottom-0 max-h-[75vh] rounded-t-2xl border-t border-border-secondary
          md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:max-h-none md:rounded-none md:border-t-0 md:border-l md:w-[420px] md:max-w-[90vw]
          ${visible ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-primary shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold tracking-wide" style={{ color: priorityColor }}>
              {task.id}
            </span>
            <span className="text-[10px] text-text-muted">·</span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `${priorityColor}18`,
                color: priorityColor,
                border: `1px solid ${priorityColor}30`,
              }}
            >
              {task.priority}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={isSafeUrl(task.url) ? task.url : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md hover:bg-bg-hover text-text-muted hover:text-accent transition-colors"
              title="Open in Linear"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
            <button
              onClick={() => closeDetailPanel()}
              className="p-1.5 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Title section */}
          <div className="px-5 pt-5 pb-4">
            {canEdit && editingTitle ? (
              <textarea
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.target as HTMLTextAreaElement).blur();
                  }
                }}
                rows={2}
                autoFocus
                className="w-full text-base font-semibold text-text-primary leading-snug mb-4 bg-bg-primary border border-accent rounded-md px-2 py-1.5 outline-none resize-none"
              />
            ) : (
              <h2
                className={`text-base font-semibold text-text-primary leading-snug mb-4 rounded-md -mx-1 px-1 ${canEdit ? 'cursor-text hover:bg-bg-hover' : ''}`}
                title={canEdit ? 'Click to edit title' : undefined}
                onClick={() => canEdit && setEditingTitle(true)}
              >
                {task.title}
              </h2>
            )}

            {/* Metadata */}
            <div className="space-y-3">
              {/* Status */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-text-muted shrink-0">Status</span>
                {canEdit && statusOptions.length > 0 ? (
                  <CustomDropdown
                    value={currentStateId}
                    options={statusOptions}
                    placeholder="Status"
                    onChange={handleStatusChange}
                    required
                    className="max-w-[200px]"
                  />
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-primary">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusDotColor }} />
                    {task.status}
                  </span>
                )}
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-text-muted shrink-0">Priority</span>
                {canEdit ? (
                  <CustomDropdown
                    value={String(task.priorityVal)}
                    options={priorityOptions}
                    placeholder="Priority"
                    onChange={handlePriorityChange}
                    required
                    className="max-w-[200px]"
                  />
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${priorityColor}18`,
                      color: priorityColor,
                      border: `1px solid ${priorityColor}30`,
                    }}
                  >
                    {task.priority}
                  </span>
                )}
              </div>

              {/* Assignee */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-text-muted shrink-0">Assignee</span>
                {canEdit && assigneeOptions.length > 0 ? (
                  <CustomDropdown
                    value={task.assigneeId || ''}
                    options={assigneeOptions}
                    placeholder="Unassigned"
                    placeholderIcon={<Avatar name="?" size="sm" />}
                    onChange={handleAssigneeChange}
                    className="max-w-[200px]"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Avatar name={task.assignee} size="sm" />
                    <span className="text-xs font-medium text-text-primary">{task.assignee}</span>
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-text-muted shrink-0">Start Date</span>
                {canEdit ? (
                  <input
                    type="date"
                    value={task.startDate || ''}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="bg-bg-primary border border-border-secondary rounded-md text-text-primary text-xs px-2 py-1.5 outline-none hover:border-text-muted focus:border-accent"
                  />
                ) : (
                  <span className="text-xs font-medium text-text-primary tabular-nums">
                    {task.startDate ? formatDateShort(task.startDate) : '—'}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-text-muted shrink-0">Due Date</span>
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] tabular-nums"
                      style={{ color: overdue ? 'var(--color-urgent)' : daysLeft <= 7 ? 'var(--color-high)' : 'var(--color-text-muted)' }}
                    >
                      ({overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`})
                    </span>
                    <input
                      type="date"
                      value={task.due}
                      onChange={(e) => handleDueDateChange(e.target.value)}
                      className="bg-bg-primary border border-border-secondary rounded-md text-text-primary text-xs px-2 py-1.5 outline-none hover:border-text-muted focus:border-accent"
                    />
                  </div>
                ) : (
                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{ color: overdue ? 'var(--color-urgent)' : daysLeft <= 7 ? 'var(--color-high)' : undefined }}
                  >
                    {formatDateShort(task.due)}
                    <span className="ml-1.5 text-[11px]">
                      ({overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`})
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Baseline drift */}
            {(() => {
              const bl = globalBaselines.get(task.id);
              if (!bl) return null;
              const actualDue = new Date(task.due + 'T00:00:00');
              const plannedDue = new Date(bl.planned_due + 'T00:00:00');
              const dueDrift = Math.round((actualDue.getTime() - plannedDue.getTime()) / 86400000);
              const actualStart = task.startDate ? new Date(task.startDate + 'T00:00:00') : null;
              const plannedStart = bl.planned_start ? new Date(bl.planned_start + 'T00:00:00') : null;
              const startDrift = actualStart && plannedStart
                ? Math.round((actualStart.getTime() - plannedStart.getTime()) / 86400000)
                : null;
              if (dueDrift === 0 && (startDrift === null || startDrift === 0)) return null;
              return (
                <div className="mt-3 p-2.5 rounded-lg bg-bg-primary border border-border-primary">
                  <div className="text-[10px] font-medium text-text-muted mb-1.5">Baseline Drift</div>
                  {startDrift !== null && startDrift !== 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Start</span>
                      <span style={{ color: startDrift > 0 ? 'var(--color-high)' : 'var(--color-accent)' }}>
                        {formatDateShort(bl.planned_start!)} → {formatDateShort(task.startDate!)}
                        <span className="ml-1 font-semibold">({startDrift > 0 ? '+' : ''}{startDrift}d)</span>
                      </span>
                    </div>
                  )}
                  {dueDrift !== 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Due</span>
                      <span style={{ color: dueDrift > 0 ? 'var(--color-high)' : 'var(--color-accent)' }}>
                        {formatDateShort(bl.planned_due)} → {formatDateShort(task.due)}
                        <span className="ml-1 font-semibold">({dueDrift > 0 ? '+' : ''}{dueDrift}d)</span>
                      </span>
                    </div>
                  )}
                  {canEdit && (
                    <div className="flex gap-2 mt-2.5">
                      <button
                        disabled={baselineBusy}
                        onClick={async () => {
                          if (!ctx) return;
                          setBaselineBusy(true);
                          try {
                            await ctx.acceptBaseline(task);
                            closeDetailPanel();
                          } catch {
                            setBaselineBusy(false);
                          }
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-md bg-success/15 text-success border border-success/25 hover:bg-success/25 transition-colors cursor-pointer disabled:opacity-50"
                        title="Make the current dates the new baseline"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Accept
                      </button>
                      <button
                        disabled={baselineBusy}
                        onClick={async () => {
                          if (!ctx) return;
                          setBaselineBusy(true);
                          try {
                            await ctx.revertBaseline(task);
                            closeDetailPanel();
                          } catch {
                            setBaselineBusy(false);
                          }
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-md bg-bg-hover text-text-secondary border border-border-secondary hover:bg-bg-card transition-colors cursor-pointer disabled:opacity-50"
                        title="Restore the issue's dates to the baseline"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 14 4 9 9 4" />
                          <path d="M20 20v-7a4 4 0 00-4-4H4" />
                        </svg>
                        Revert
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Progress */}
          {task.totalChildren > 0 && (
            <div className="px-5 pb-4">
              <div className="p-3 rounded-lg bg-bg-primary border border-border-primary">
                <div className="flex items-center justify-between text-[11px] mb-2">
                  <span className="text-text-muted font-medium">Sub-issue Progress</span>
                  <span className="text-text-secondary font-semibold">
                    {task.completedChildren}/{task.totalChildren} ({task.progress}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-border-primary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${task.progress}%`,
                      background: task.progress === 100 ? 'var(--color-success)' : 'var(--color-accent)',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dependencies */}
          {(task.blocks.length > 0 || task.blockedBy.length > 0) && (
            <div className="px-5 pb-4">
              <div className="text-[11px] font-medium text-text-muted mb-2">Dependencies</div>
              <div className="flex flex-wrap gap-1.5">
                {task.blockedBy.map((blockerId) => (
                  <span
                    key={`by-${blockerId}`}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-urgent/10 text-urgent border border-urgent/20 font-medium"
                  >
                    Blocked by {blockerId}
                    {globalRemoveRelation && (
                      <button
                        className="ml-0.5 p-0.5 rounded hover:bg-urgent/20 transition-colors cursor-pointer"
                        title={`Remove dependency: ${blockerId} → ${task.id}`}
                        onClick={() => {
                          globalRemoveRelation?.(blockerId, task.id);
                          closeDetailPanel();
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </span>
                ))}
                {task.blocks.map((blockedId) => (
                  <span
                    key={`blocks-${blockedId}`}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-high/10 text-high border border-high/20 font-medium"
                  >
                    Blocks {blockedId}
                    {globalRemoveRelation && (
                      <button
                        className="ml-0.5 p-0.5 rounded hover:bg-high/20 transition-colors cursor-pointer"
                        title={`Remove dependency: ${task.id} → ${blockedId}`}
                        onClick={() => {
                          globalRemoveRelation?.(task.id, blockedId);
                          closeDetailPanel();
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Add dependent issue */}
          <div className="px-5 pb-4">
            <div className="text-[11px] font-medium text-text-muted mb-2">Create dependent issue</div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setModalDirection('blocking');
                  setNewTeamId(task.teamId || '');
                  setCreateError('');
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-medium px-2.5 py-2 rounded-md bg-urgent/10 text-urgent border border-urgent/20 hover:bg-urgent/20 transition-colors cursor-pointer"
                title={`Create a new issue that blocks ${task.id}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New blocking issue
              </button>
              <button
                onClick={() => {
                  setModalDirection('blocked');
                  setNewTeamId(task.teamId || '');
                  setCreateError('');
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] font-medium px-2.5 py-2 rounded-md bg-high/10 text-high border border-high/20 hover:bg-high/20 transition-colors cursor-pointer"
                title={`Create a new issue blocked by ${task.id}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New blocked issue
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-5 border-t border-border-primary" />

          {/* Description */}
          <div className="px-5 py-4">
            <div className="text-[11px] font-medium text-text-muted mb-2.5">Description</div>
            {canEdit && editingDesc ? (
              <textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={saveDescription}
                rows={6}
                autoFocus
                placeholder="Add a description"
                className="w-full text-sm text-text-secondary leading-relaxed bg-bg-primary border border-accent rounded-md px-2.5 py-2 outline-none resize-y"
              />
            ) : (
              <div
                className={`text-sm text-text-secondary leading-relaxed whitespace-pre-wrap break-words rounded-md -mx-1 px-1 min-h-[1.5rem] ${canEdit ? 'cursor-text hover:bg-bg-hover' : ''}`}
                title={canEdit ? 'Click to edit description' : undefined}
                onClick={() => canEdit && setEditingDesc(true)}
              >
                {descDraft ? (
                  descDraft
                ) : (
                  <span className="text-xs text-text-muted italic">{canEdit ? 'Click to add a description' : 'No description'}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create-dependent-issue modal */}
      {modalDirection && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !creating) closeModal();
          }}
        >
          <div className="bg-bg-card border border-border-secondary rounded-2xl w-full max-w-[440px] p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-text-primary mb-1">
              {modalDirection === 'blocking' ? 'New blocking issue' : 'New blocked issue'}
            </h3>
            <p className="text-xs text-text-muted mb-5 leading-relaxed">
              {modalDirection === 'blocking' ? (
                <>
                  Creates a new issue in this project that <span className="text-urgent font-medium">blocks</span>{' '}
                  <span className="font-medium text-text-secondary">{task.id}</span>.
                </>
              ) : (
                <>
                  Creates a new issue in this project that is{' '}
                  <span className="text-high font-medium">blocked by</span>{' '}
                  <span className="font-medium text-text-secondary">{task.id}</span>.
                </>
              )}
            </p>

            <form onSubmit={handleCreateDependent}>
              {ctx && ctx.teams.length > 0 && (
                <>
                  <label className="block text-[11px] font-medium text-text-muted mb-1.5">Team</label>
                  <div className="mb-4">
                    <CustomDropdown
                      value={newTeamId}
                      options={ctx.teams.map((t) => ({ value: t.id, label: `${t.name} (${t.key})` }))}
                      placeholder="Select a team"
                      onChange={(v) => setNewTeamId(v)}
                      required
                    />
                  </div>
                </>
              )}

              <label className="block text-[11px] font-medium text-text-muted mb-1.5">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Issue title"
                autoFocus
                disabled={creating}
                className="w-full px-3 py-2 bg-bg-primary border border-border-secondary rounded-lg text-text-primary text-sm mb-4 outline-none transition-colors focus:border-accent disabled:opacity-50"
              />

              <label className="block text-[11px] font-medium text-text-muted mb-1.5">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
                rows={4}
                disabled={creating}
                className="w-full px-3 py-2 bg-bg-primary border border-border-secondary rounded-lg text-text-primary text-sm mb-4 outline-none transition-colors focus:border-accent resize-y disabled:opacity-50"
              />

              {createError && <div className="text-urgent text-xs mb-3">{createError}</div>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={creating}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
