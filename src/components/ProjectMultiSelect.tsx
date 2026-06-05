import { useEffect, useRef, useState } from 'react';
import type { Project } from '@/types';

interface Props {
  projects: Project[]; // projects available in the active initiative
  selectedIds: string[]; // currently shown
  onChange: (ids: string[]) => void;
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export default function ProjectMultiSelect({ projects, selectedIds, onChange }: Props) {
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

  const selected = new Set(selectedIds);
  const allOn = projects.length > 0 && projects.every((p) => selected.has(p.id));

  const toggle = (id: string) => {
    const next = projects.filter((p) => (p.id === id ? !selected.has(p.id) : selected.has(p.id))).map((p) => p.id);
    onChange(next);
  };

  const label =
    allOn || selectedIds.length === 0
      ? 'All projects'
      : `${selectedIds.length} of ${projects.length} projects`;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors ${
          open
            ? 'border-accent text-accent bg-accent/10'
            : 'bg-bg-card border-border-primary text-text-secondary hover:border-border-secondary hover:text-text-primary'
        }`}
        title="Filter which projects are shown"
      >
        <FilterIcon />
        {label}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-60 bg-bg-card border border-border-primary rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
            <span className="text-[10.5px] uppercase tracking-wider text-text-muted font-semibold">Projects</span>
            <button
              onClick={() => onChange(projects.map((p) => p.id))}
              className="text-[11px] text-text-muted hover:text-accent cursor-pointer"
            >
              Select all
            </button>
          </div>
          <div className="px-1.5 pb-2 max-h-[50vh] overflow-y-auto">
            {projects.map((p) => {
              const checked = selected.has(p.id);
              return (
                <label
                  key={p.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs text-text-primary hover:bg-bg-hover cursor-pointer select-none"
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} className="sr-only" />
                  <span
                    className={`flex items-center justify-center w-4 h-4 rounded border transition-colors ${
                      checked ? 'border-accent bg-accent text-white' : 'border-border-secondary bg-bg-primary text-transparent'
                    }`}
                  >
                    <CheckIcon />
                  </span>
                  <span className="truncate">{p.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
