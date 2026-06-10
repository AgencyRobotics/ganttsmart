import { useCallback, useEffect, useState } from 'react';
import AuthPage from '@/components/AuthPage';
import FilterBar from '@/components/FilterBar';
import GanttChart from '@/components/GanttChart';
import Header from '@/components/Header';
import LinearConnect from '@/components/LinearConnect';
import NewIssueModal, { type NewIssueTarget } from '@/components/NewIssueModal';
import Onboarding from '@/components/Onboarding';
import StatsRow from '@/components/StatsRow';
import ToastContainer from '@/components/Toast';
import DetailPanel, {
  setRemoveRelationHandler,
  setCreateDependentIssueHandler,
  setPanelEditContext,
} from '@/components/DetailPanel';
import { useAuth } from '@/hooks/useAuth';
import { useColumnConfig } from '@/hooks/useColumnConfig';
import { useLinearData } from '@/hooks/useLinearData';
import { usePlanningHistory } from '@/hooks/usePlanningHistory';
import { useTheme } from '@/hooks/useTheme';

function GanttView({
  linearToken,
  onDisconnectLinear,
  onSignOut,
}: {
  linearToken: string;
  onDisconnectLinear: () => void | Promise<void>;
  onSignOut: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('gantt_onboarding_done');
  });

  const {
    projects,
    initiatives,
    selectedProjectId,
    selectedInitiativeId,
    selectedProjectIds,
    showCompletedProjects,
    setShowCompletedProjects,
    projectMetas,
    projectName,
    tasks,
    doneTasks,
    unscheduledTasks,
    filteredTasks,
    milestones,
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
    rescheduleWithDependents,
    workflowStatesByTeam,
    users,
    teams,
  } = useLinearData(linearToken, onDisconnectLinear);

  // Planning history: log change events for audit
  const { logChange, logStatusTransition } = usePlanningHistory(selectedProjectId);

  // Per-user visible-column configuration
  const { visibleColumns, setVisibleColumns } = useColumnConfig();

  // Wrap reschedule to log due date changes. Uses the dependency-aware variant so that
  // dragging an issue's end past a dependent's start slides the dependents along too.
  const rescheduleWithHistory = useCallback(
    async (taskUuid: string, newDueDate: string) => {
      const task = tasks.find((t) => t.uuid === taskUuid);
      if (task) logChange(task.id, 'due_date', task.due, newDueDate);
      return rescheduleWithDependents(taskUuid, newDueDate);
    },
    [rescheduleWithDependents, tasks, logChange],
  );

  // Wrap rescheduleStart to log start date changes
  const rescheduleStartWithHistory = useCallback(
    async (taskUuid: string, newStartDate: string) => {
      const task = tasks.find((t) => t.uuid === taskUuid);
      if (task) logChange(task.id, 'start_date', task.startDate, newStartDate);
      return rescheduleStart(taskUuid, newStartDate);
    },
    [rescheduleStart, tasks, logChange],
  );

  // Wrap cycleStatus to log status transitions
  const cycleStatusWithHistory = useCallback(
    async (taskUuid: string) => {
      const task = tasks.find((t) => t.uuid === taskUuid);
      if (task) logStatusTransition(task.id, task.status, '(next)');
      return cycleStatus(taskUuid);
    },
    [cycleStatus, tasks, logStatusTransition],
  );

  const editStatusWithHistory = useCallback(
    async (taskUuid: string, stateId: string) => {
      const task = tasks.find((t) => t.uuid === taskUuid);
      const state = Object.values(workflowStatesByTeam)
        .flat()
        .find((s) => s.id === stateId);
      if (task && state) logStatusTransition(task.id, task.status, state.name);
      return editStatus(taskUuid, stateId);
    },
    [editStatus, tasks, workflowStatesByTeam, logStatusTransition],
  );

  // "+" on a project header opens a modal to create a new issue in that project.
  const [newIssueTarget, setNewIssueTarget] = useState<NewIssueTarget | null>(null);
  const handleAddIssueToProject = useCallback(
    (projectId: string, projectName: string) => {
      // Default the team to whatever team the project's existing issues belong to.
      const defaultTeamId = tasks.find((t) => t.projectId === projectId)?.teamId;
      setNewIssueTarget({ projectId, projectName, defaultTeamId });
    },
    [tasks],
  );

  // Register the remove handler for DetailPanel's × buttons
  useEffect(() => {
    setRemoveRelationHandler(removeRelation);
    return () => setRemoveRelationHandler(null);
  }, [removeRelation]);

  // Register the create-dependent-issue handler for DetailPanel's buttons
  useEffect(() => {
    setCreateDependentIssueHandler(createDependentIssue);
    return () => setCreateDependentIssueHandler(null);
  }, [createDependentIssue]);

  // Register the field-edit context for the DetailPanel (uses history-wrapped date handlers)
  useEffect(() => {
    setPanelEditContext({
      editTitle,
      editPriority,
      editStatus: editStatusWithHistory,
      editAssignee,
      editDescription,
      reschedule: rescheduleWithHistory,
      rescheduleStart: rescheduleStartWithHistory,
      workflowStatesByTeam,
      users,
      teams,
    });
    return () => setPanelEditContext(null);
  }, [
    editTitle,
    editPriority,
    editStatusWithHistory,
    editAssignee,
    editDescription,
    rescheduleWithHistory,
    rescheduleStartWithHistory,
    workflowStatesByTeam,
    users,
    teams,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT') {
        if (e.key === 'Escape') {
          setFilters({ ...filters, search: '' });
          (e.target as HTMLElement).blur();
        }
        return;
      }
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) refresh();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-' || e.key === '_') zoomOut();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [refresh, filters, setFilters, zoomIn, zoomOut]);

  const completeOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('gantt_onboarding_done', '1');
  };

  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden print:h-auto print:block print:overflow-visible">
      {showOnboarding && <Onboarding onComplete={completeOnboarding} />}

      <Header
        projectName={projectName}
        loading={loading}
        lastSynced={lastSynced}
        onRefresh={refresh}
        onDisconnectLinear={onDisconnectLinear}
        onSignOut={onSignOut}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        dayWidth={dayWidth}
        theme={theme}
        onThemeChange={setTheme}
        projectId={selectedProjectId}
        tasks={filteredTasks}
      />

      <FilterBar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={selectProject}
        initiatives={initiatives}
        selectedInitiativeId={selectedInitiativeId}
        onSelectInitiative={selectInitiative}
        selectedProjectIds={selectedProjectIds}
        onVisibleProjectIdsChange={setVisibleProjectIds}
        showCompletedProjects={showCompletedProjects}
        onShowCompletedProjectsChange={setShowCompletedProjects}
        assignees={assignees}
        statuses={statuses}
        filters={filters}
        onFiltersChange={setFilters}
        totalCount={tasks.length}
        filteredCount={filteredTasks.length}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        visibleColumns={visibleColumns}
        onVisibleColumnsChange={setVisibleColumns}
      />

      <StatsRow tasks={filteredTasks} />

      <div className="flex-1 min-h-0 overflow-hidden print:overflow-visible">
        <GanttChart
          tasks={filteredTasks}
          doneTasks={doneTasks}
          unscheduledTasks={unscheduledTasks}
          milestones={milestones}
          loading={loading}
          error={error}
          dayWidth={dayWidth}
          groupBy={groupBy}
          visibleColumns={visibleColumns}
          groupByProject={!!selectedInitiativeId}
          projectMetas={projectMetas}
          onReschedule={rescheduleWithHistory}
          onRescheduleStart={rescheduleStartWithHistory}
          onCycleStatus={cycleStatusWithHistory}
          onEditStatus={editStatusWithHistory}
          workflowStatesByTeam={workflowStatesByTeam}
          onCreateRelation={createRelation}
          onAddIssueToProject={selectedInitiativeId ? handleAddIssueToProject : undefined}
          onEditProjectDates={selectedInitiativeId ? editProjectDates : undefined}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
        />
      </div>

      <NewIssueModal
        target={newIssueTarget}
        teams={teams}
        onClose={() => setNewIssueTarget(null)}
        onCreate={createIssueInProject}
      />
      <DetailPanel />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  const { user, loading, linearToken, signUp, signIn, signInWithGoogle, signOut, disconnectLinear } = useAuth();

  // Initialize theme on app load (applies class to <html> even on auth pages)
  useTheme();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-bg-primary flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-border-primary border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage onSignIn={signIn} onSignUp={signUp} onGoogleSignIn={signInWithGoogle} />;
  }

  if (!linearToken) {
    return <LinearConnect userEmail={user.email || ''} onSignOut={signOut} />;
  }

  return <GanttView linearToken={linearToken} onDisconnectLinear={disconnectLinear} onSignOut={signOut} />;
}
