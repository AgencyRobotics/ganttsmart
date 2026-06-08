import { useMemo } from 'react';
import type { Filters, GroupBy, Initiative, Project } from '@/types';
import type { ColumnKey } from '@/utils/columns';
import { Avatar } from '@/utils/avatar';
import ColumnConfigButton from './ColumnConfigButton';
import CustomDropdown from './CustomDropdown';
import type { DropdownOption } from './CustomDropdown';
import DateRangePicker from './DateRangePicker';
import ScopeSelector from './ScopeSelector';
import ProjectMultiSelect from './ProjectMultiSelect';

interface Props {
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  initiatives?: Initiative[];
  selectedInitiativeId?: string;
  onSelectInitiative?: (id: string) => void;
  selectedProjectIds?: string[];
  onVisibleProjectIdsChange?: (ids: string[]) => void;
  showCompletedProjects?: boolean;
  onShowCompletedProjectsChange?: (show: boolean) => void;
  assignees: string[];
  statuses: string[];
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  totalCount: number;
  filteredCount: number;
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
  hideProjectSelector?: boolean;
  visibleColumns?: ColumnKey[];
  onVisibleColumnsChange?: (next: ColumnKey[]) => void;
  driftCount?: number;
  baselineBusy?: boolean;
  onAcceptAll?: () => void;
  onRevertAll?: () => void;
}

const PRIORITY_CHIPS = [
  { val: 1, label: 'Urgent', cls: 'urgent' },
  { val: 2, label: 'High', cls: 'high' },
  { val: 3, label: 'Medium', cls: 'medium' },
  { val: 4, label: 'Low', cls: 'low' },
  { val: 0, label: 'None', cls: 'none' },
];

const chipActiveColors: Record<string, string> = {
  urgent: 'border-urgent/60 text-urgent bg-urgent/10',
  high: 'border-high/60 text-high bg-high/10',
  medium: 'border-medium/60 text-medium bg-medium/10',
  low: 'border-low/60 text-low bg-low/15',
  none: 'border-accent/60 text-accent bg-accent/10',
};

// Icons
function SearchIcon() {
  return (
    <svg className="absolute left-2.5 text-text-muted pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 00-4-4H4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-7-11-7a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 7 11 7a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function FilterBar({
  projects,
  selectedProjectId,
  onSelectProject,
  initiatives,
  selectedInitiativeId,
  onSelectInitiative,
  selectedProjectIds,
  onVisibleProjectIdsChange,
  showCompletedProjects = true,
  onShowCompletedProjectsChange,
  assignees,
  statuses,
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
  groupBy,
  onGroupByChange,
  hideProjectSelector,
  visibleColumns,
  onVisibleColumnsChange,
  driftCount = 0,
  baselineBusy,
  onAcceptAll,
  onRevertAll,
}: Props) {
  const togglePriority = (val: number) => {
    const next = new Set(filters.priorities);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onFiltersChange({ ...filters, priorities: next });
  };

  const hasSearch = !!filters.search;
  const hasAssignee = !!filters.assignee;
  const hasStatus = !!filters.status;
  const hasDateRange = !!filters.dateFrom || !!filters.dateTo;
  const prioritiesFiltered = filters.priorities.size > 0 && filters.priorities.size < 5;
  const anyActiveChip = hasSearch || hasAssignee || hasStatus || hasDateRange || prioritiesFiltered;

  const clearAll = () => {
    onFiltersChange({
      ...filters,
      search: '',
      assignee: '',
      status: '',
      dateFrom: '',
      dateTo: '',
      priorities: new Set([0, 1, 2, 3, 4]),
    });
  };

  // Build dropdown options
  const projectOptions: DropdownOption[] = useMemo(
    () => projects.map((p) => ({ value: p.id, label: p.name, icon: <FolderIcon /> })),
    [projects],
  );

  const assigneeOptions: DropdownOption[] = useMemo(
    () => assignees.map((a) => ({ value: a, label: a, icon: <Avatar name={a} size="sm" /> })),
    [assignees],
  );

  const statusOptions: DropdownOption[] = useMemo(
    () => statuses.map((s) => ({ value: s, label: s, icon: <StatusIcon /> })),
    [statuses],
  );

  const groupOptions: DropdownOption[] = useMemo(
    () => [
      { value: 'none', label: 'No grouping', icon: <GroupIcon /> },
      { value: 'assignee', label: 'Group by assignee', icon: <GroupIcon /> },
      { value: 'priority', label: 'Group by priority', icon: <GroupIcon /> },
      { value: 'status', label: 'Group by status', icon: <GroupIcon /> },
    ],
    [],
  );

  return (
    <div className="shrink-0 border-b border-border-primary bg-bg-header print:hidden relative z-20">
      {/* Main filter row — 48px */}
      <div className="h-12 flex items-center gap-2 px-4">
        {/* Search */}
        <div className="relative flex items-center shrink-0">
          <SearchIcon />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder="Search tasks…"
            className="h-8 pl-8 pr-3 bg-bg-card border border-border-primary rounded-md text-text-primary text-xs outline-none transition-colors w-[200px] hover:border-border-secondary focus:border-accent placeholder:text-text-muted"
          />
        </div>

        <div className="w-px h-5 bg-border-primary shrink-0" />

        {/* Scope: project or initiative */}
        {!hideProjectSelector &&
          (onSelectInitiative ? (
            <>
              <ScopeSelector
                projects={projects}
                initiatives={initiatives || []}
                selectedProjectId={selectedProjectId}
                selectedInitiativeId={selectedInitiativeId || ''}
                onSelectProject={onSelectProject}
                onSelectInitiative={onSelectInitiative}
              />
              {selectedInitiativeId && onVisibleProjectIdsChange && (
                <ProjectMultiSelect
                  projects={initiatives?.find((i) => i.id === selectedInitiativeId)?.projects || []}
                  selectedIds={selectedProjectIds || []}
                  onChange={onVisibleProjectIdsChange}
                />
              )}
              {selectedInitiativeId && onShowCompletedProjectsChange && (
                <button
                  onClick={() => onShowCompletedProjectsChange(!showCompletedProjects)}
                  className={`h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                    showCompletedProjects
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-bg-card border-border-primary text-text-muted hover:border-border-secondary hover:text-text-secondary'
                  }`}
                  title={showCompletedProjects ? 'Hide completed projects' : 'Show completed projects'}
                >
                  {showCompletedProjects ? <EyeIcon /> : <EyeOffIcon />}
                  Completed
                </button>
              )}
            </>
          ) : (
            <CustomDropdown
              value={selectedProjectId}
              options={projectOptions}
              placeholder="All Projects"
              placeholderIcon={<FolderIcon />}
              onChange={(v) => onSelectProject(v)}
              required
            />
          ))}

        {/* Assignee */}
        <CustomDropdown
          value={filters.assignee}
          options={assigneeOptions}
          placeholder="Assignee"
          placeholderIcon={<UsersIcon />}
          onChange={(v) => onFiltersChange({ ...filters, assignee: v })}
        />

        {/* Status */}
        <CustomDropdown
          value={filters.status}
          options={statusOptions}
          placeholder="Status"
          placeholderIcon={<StatusIcon />}
          onChange={(v) => onFiltersChange({ ...filters, status: v })}
        />

        <div className="w-px h-5 bg-border-primary shrink-0" />

        {/* Priority chips */}
        <div className="flex gap-1 items-center shrink-0">
          {PRIORITY_CHIPS.map((c) => {
            const active = filters.priorities.has(c.val);
            return (
              <button
                key={c.val}
                onClick={() => togglePriority(c.val)}
                className={`h-7 px-2.5 rounded-full text-[11px] font-medium cursor-pointer transition-all border select-none active:scale-95 ${
                  active
                    ? chipActiveColors[c.cls]
                    : 'bg-bg-card border-border-primary text-text-muted hover:border-border-secondary hover:text-text-secondary'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="w-px h-5 bg-border-primary shrink-0" />

        {/* Group by — disabled in initiative mode (grouped by project) */}
        <CustomDropdown
          value={selectedInitiativeId ? 'project' : groupBy === 'none' ? '' : groupBy}
          options={
            selectedInitiativeId
              ? [{ value: 'project', label: 'Grouped by project', icon: <GroupIcon /> }]
              : groupOptions
          }
          placeholder="No grouping"
          placeholderIcon={<GroupIcon />}
          onChange={(v) => onGroupByChange((v || 'none') as GroupBy)}
          required
          disabled={!!selectedInitiativeId}
          title={selectedInitiativeId ? 'Grouping is set to project in initiative mode' : undefined}
        />

        {/* Date range */}
        <DateRangePicker
          from={filters.dateFrom}
          to={filters.dateTo}
          onChange={(dateFrom, dateTo) => onFiltersChange({ ...filters, dateFrom, dateTo })}
        />

        <div className="flex-1" />

        {/* Bulk baseline actions — only when something has drifted from its baseline */}
        {driftCount > 0 && onAcceptAll && onRevertAll && (
          <>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="w-2.5 h-2.5 rounded-sm border-[1.5px] border-dashed border-amber-400/70 shrink-0"
                title={`${driftCount} task(s) drifted from baseline`}
              />
              <button
                onClick={onAcceptAll}
                disabled={baselineBusy}
                className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors bg-success/10 border-success/30 text-success hover:bg-success/20 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Accept current dates as the new baseline for all drifted tasks"
              >
                <CheckIcon />
                {baselineBusy ? 'Working…' : `Accept all (${driftCount})`}
              </button>
              <button
                onClick={onRevertAll}
                disabled={baselineBusy}
                className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors bg-bg-card border-border-primary text-text-secondary hover:border-border-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                title="Revert all drifted tasks back to their baseline dates"
              >
                <UndoIcon />
                Revert all
              </button>
            </div>
            <div className="w-px h-5 bg-border-primary shrink-0" />
          </>
        )}

        {/* Column configuration */}
        {visibleColumns && onVisibleColumnsChange && (
          <ColumnConfigButton visibleColumns={visibleColumns} onChange={onVisibleColumnsChange} />
        )}

        {/* Count pill */}
        <span className="shrink-0 bg-bg-hover text-text-secondary text-[11px] font-medium font-mono tabular-nums px-2.5 h-7 rounded-full flex items-center">
          {filteredCount}/{totalCount}
        </span>
      </div>

      {/* Active filter chips row */}
      {anyActiveChip && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-t border-border-primary/50 bg-bg-primary/40 flex-wrap">
          <span className="text-[10.5px] uppercase tracking-wider text-text-muted font-semibold mr-1">Filters</span>
          {hasSearch && (
            <ActiveChip label={`"${filters.search}"`} onClear={() => onFiltersChange({ ...filters, search: '' })} />
          )}
          {hasAssignee && (
            <ActiveChip label={filters.assignee} onClear={() => onFiltersChange({ ...filters, assignee: '' })} />
          )}
          {hasStatus && (
            <ActiveChip label={filters.status} onClear={() => onFiltersChange({ ...filters, status: '' })} />
          )}
          {prioritiesFiltered && (
            <ActiveChip
              label={`${filters.priorities.size} priorit${filters.priorities.size === 1 ? 'y' : 'ies'}`}
              onClear={() => onFiltersChange({ ...filters, priorities: new Set([0, 1, 2, 3, 4]) })}
            />
          )}
          {hasDateRange && (
            <ActiveChip
              label={`${filters.dateFrom || '…'} → ${filters.dateTo || '…'}`}
              onClear={() => onFiltersChange({ ...filters, dateFrom: '', dateTo: '' })}
            />
          )}
          <button
            onClick={clearAll}
            className="ml-1 text-[11px] text-text-muted hover:text-text-primary cursor-pointer underline underline-offset-2 decoration-dotted"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full bg-accent/10 border border-accent/30 text-[11px] font-medium text-accent">
      <span className="truncate max-w-[180px]">{label}</span>
      <button
        onClick={onClear}
        className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-accent/20 cursor-pointer"
        title="Clear filter"
      >
        <XIcon />
      </button>
    </span>
  );
}
