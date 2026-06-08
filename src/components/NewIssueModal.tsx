import { useEffect, useState } from 'react';
import type { Team } from '@/types';
import CustomDropdown from './CustomDropdown';

export interface NewIssueTarget {
  projectId: string;
  projectName: string;
  /** Team to preselect (e.g. the team of the project's existing issues). */
  defaultTeamId?: string;
}

interface Props {
  target: NewIssueTarget | null;
  teams: Team[];
  onClose: () => void;
  onCreate: (projectId: string, teamId: string, title: string, description: string) => Promise<void>;
}

export default function NewIssueModal({ target, teams, onClose, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (target) {
      setTitle('');
      setDescription('');
      setTeamId(target.defaultTeamId || teams[0]?.id || '');
      setError('');
    }
  }, [target, teams]);

  if (!target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError('');
    try {
      await onCreate(target.projectId, teamId, title, description);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !creating) onClose();
      }}
    >
      <div className="bg-bg-card border border-border-secondary rounded-2xl w-full max-w-[440px] p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-text-primary mb-1">New issue</h3>
        <p className="text-xs text-text-muted mb-5 leading-relaxed">
          Creates a new issue in{' '}
          <span className="font-medium text-text-secondary">{target.projectName}</span>.
        </p>

        <form onSubmit={handleSubmit}>
          {teams.length > 0 && (
            <>
              <label className="block text-[11px] font-medium text-text-muted mb-1.5">Team</label>
              <div className="mb-4">
                <CustomDropdown
                  value={teamId}
                  options={teams.map((t) => ({ value: t.id, label: `${t.name} (${t.key})` }))}
                  placeholder="Select a team"
                  onChange={(v) => setTeamId(v)}
                  required
                />
              </div>
            </>
          )}

          <label className="block text-[11px] font-medium text-text-muted mb-1.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Issue title"
            autoFocus
            disabled={creating}
            className="w-full px-3 py-2 bg-bg-primary border border-border-secondary rounded-lg text-text-primary text-sm mb-4 outline-none transition-colors focus:border-accent disabled:opacity-50"
          />

          <label className="block text-[11px] font-medium text-text-muted mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={4}
            disabled={creating}
            className="w-full px-3 py-2 bg-bg-primary border border-border-secondary rounded-lg text-text-primary text-sm mb-4 outline-none transition-colors focus:border-accent resize-y disabled:opacity-50"
          />

          {error && <div className="text-urgent text-xs mb-3">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !title.trim() || (teams.length > 0 && !teamId)}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
