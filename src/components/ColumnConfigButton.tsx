import { useEffect, useRef, useState } from 'react';
import { COLUMN_DEFS, DEFAULT_VISIBLE_COLUMNS, type ColumnKey } from '@/utils/columns';

interface Props {
  visibleColumns: ColumnKey[];
  onChange: (next: ColumnKey[]) => void;
}

function ColumnsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

export default function ColumnConfigButton({ visibleColumns, onChange }: Props) {
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

  const visibleSet = new Set(visibleColumns);

  const toggle = (key: ColumnKey) => {
    const next = COLUMN_DEFS.map((c) => c.key).filter((k) =>
      k === key ? !visibleSet.has(k) : visibleSet.has(k),
    );
    onChange(next);
  };

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`h-8 px-2.5 inline-flex items-center gap-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors ${
          open
            ? 'border-accent text-accent bg-accent/10'
            : 'bg-bg-card border-border-primary text-text-secondary hover:border-border-secondary hover:text-text-primary'
        }`}
        title="Configure visible columns"
      >
        <ColumnsIcon />
        Columns
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-bg-card border border-border-primary rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
            <span className="text-[10.5px] uppercase tracking-wider text-text-muted font-semibold">Columns</span>
            <button
              onClick={() => onChange([...DEFAULT_VISIBLE_COLUMNS])}
              className="text-[11px] text-text-muted hover:text-accent cursor-pointer"
            >
              Reset
            </button>
          </div>

          <div className="px-1.5 pb-2 max-h-[60vh] overflow-y-auto">
            <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs text-text-muted cursor-not-allowed select-none">
              <span className="flex items-center justify-center w-4 h-4 rounded border border-border-secondary bg-bg-hover text-accent">
                <CheckIcon />
              </span>
              Task
              <span className="ml-auto text-[10px] uppercase tracking-wide">Always</span>
            </label>

            {COLUMN_DEFS.map((col) => {
              const checked = visibleSet.has(col.key);
              return (
                <label
                  key={col.key}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs text-text-primary hover:bg-bg-hover cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(col.key)}
                    className="sr-only"
                  />
                  <span
                    className={`flex items-center justify-center w-4 h-4 rounded border transition-colors ${
                      checked ? 'border-accent bg-accent text-white' : 'border-border-secondary bg-bg-primary text-transparent'
                    }`}
                  >
                    <CheckIcon />
                  </span>
                  {col.label}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
