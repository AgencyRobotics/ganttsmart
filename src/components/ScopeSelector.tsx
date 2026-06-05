import { useEffect, useRef, useState } from 'react';
import type { Initiative, Project } from '@/types';

interface Props {
  projects: Project[];
  initiatives: Initiative[];
  selectedProjectId: string;
  selectedInitiativeId: string;
  onSelectProject: (id: string) => void;
  onSelectInitiative: (id: string) => void;
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function InitiativeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%238b949e' d='M1 1l4 4 4-4'/%3E%3C/svg%3E")`;

export default function ScopeSelector({
  projects,
  initiatives,
  selectedProjectId,
  selectedInitiativeId,
  onSelectProject,
  onSelectInitiative,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeInitiative = initiatives.find((i) => i.id === selectedInitiativeId);
  const activeProject = projects.find((p) => p.id === selectedProjectId);
  const label = activeInitiative ? activeInitiative.name : activeProject ? activeProject.name : 'Select scope';
  const Icon = activeInitiative ? InitiativeIcon : FolderIcon;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 py-[7px] pl-2.5 pr-7 bg-bg-card border border-border-secondary rounded-md text-text-primary text-xs font-medium cursor-pointer outline-none transition-colors hover:border-text-muted focus:border-accent max-w-[220px] bg-no-repeat bg-[right_10px_center] bg-[length:10px_6px] w-full"
        style={{ backgroundImage: chevron }}
        title="Select a project or initiative"
      >
        <Icon />
        <span className="truncate">{label}</span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 bg-bg-card border border-border-secondary rounded-lg shadow-xl z-50 min-w-[240px] max-h-[340px] overflow-y-auto py-1">
          {initiatives.length > 0 && (
            <>
              <div className="px-3 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                Initiatives
              </div>
              {initiatives.map((i) => (
                <button
                  key={i.id}
                  onClick={() => {
                    onSelectInitiative(i.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left cursor-pointer transition-colors ${
                    selectedInitiativeId === i.id ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  <InitiativeIcon />
                  <span className="truncate">{i.name}</span>
                  <span className="ml-auto text-[10px] text-text-muted">{i.projects.length}</span>
                </button>
              ))}
              <div className="my-1 border-t border-border-primary" />
            </>
          )}

          <div className="px-3 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-text-muted font-semibold">
            Projects
          </div>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onSelectProject(p.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left cursor-pointer transition-colors ${
                !selectedInitiativeId && selectedProjectId === p.id
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-primary hover:bg-bg-hover'
              }`}
            >
              <FolderIcon />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
