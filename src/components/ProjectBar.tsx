import { useCallback, useRef, useState } from 'react';
import type { ProjectMeta } from '@/types';

interface Props {
  projectMeta: ProjectMeta;
  /** Bar geometry (px) computed by the parent, accounting for date fallbacks. */
  geom: { left: number; width: number };
  chartStart: Date;
  dayWidth: number;
  onEditProjectDates: (projectId: string, startDate: string | null, targetDate: string | null) => void;
}

const DAY_MS = 86_400_000;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ProjectBar({ projectMeta, geom, chartStart, dayWidth, onEditProjectDates }: Props) {
  // Visual drag deltas (px) applied live; committed to dates on mouse up.
  const [startDelta, setStartDelta] = useState(0); // left edge
  const [endDelta, setEndDelta] = useState(0); // right edge
  const [moveDelta, setMoveDelta] = useState(0); // whole bar
  const [dragging, setDragging] = useState(false);
  const didDragRef = useRef(false);

  // Base dates: use the project's explicit dates when present, else derive from the bar geometry
  // so dragging an undated edge still produces a sensible date.
  const baseStart =
    projectMeta.startDate
      ? new Date(projectMeta.startDate + 'T00:00:00')
      : new Date(chartStart.getTime() + Math.round(geom.left / dayWidth) * DAY_MS);
  const baseTarget =
    projectMeta.targetDate
      ? new Date(projectMeta.targetDate + 'T00:00:00')
      : new Date(chartStart.getTime() + (Math.round((geom.left + geom.width) / dayWidth) - 1) * DAY_MS);

  const displayLeft = geom.left + startDelta + moveDelta;
  const displayWidth = Math.max(geom.width - startDelta + endDelta, dayWidth);

  const makeDragHandler = useCallback(
    (mode: 'start' | 'end' | 'move') => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      didDragRef.current = false;
      setDragging(true);
      const setDelta = mode === 'start' ? setStartDelta : mode === 'end' ? setEndDelta : setMoveDelta;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        if (Math.abs(delta) > 3) didDragRef.current = true;
        setDelta(delta);
      };

      const onUp = (ev: MouseEvent) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        const days = Math.round((ev.clientX - startX) / dayWidth);
        setStartDelta(0);
        setEndDelta(0);
        setMoveDelta(0);
        setDragging(false);

        if (days !== 0) {
          if (mode === 'start') {
            const ns = new Date(baseStart.getTime() + days * DAY_MS);
            onEditProjectDates(projectMeta.id, ymd(ns), projectMeta.targetDate);
          } else if (mode === 'end') {
            const nt = new Date(baseTarget.getTime() + days * DAY_MS);
            onEditProjectDates(projectMeta.id, projectMeta.startDate, ymd(nt));
          } else {
            const ns = new Date(baseStart.getTime() + days * DAY_MS);
            const nt = new Date(baseTarget.getTime() + days * DAY_MS);
            onEditProjectDates(projectMeta.id, ymd(ns), ymd(nt));
          }
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [baseStart, baseTarget, dayWidth, onEditProjectDates, projectMeta.id, projectMeta.startDate, projectMeta.targetDate],
  );

  return (
    <div
      data-project-bar={projectMeta.id}
      className={`absolute h-[16px] rounded top-1/2 -translate-y-1/2 bg-accent/70 border border-accent/80 shadow-sm group/pbar ${
        dragging ? 'cursor-grabbing opacity-80' : 'cursor-grab'
      }`}
      style={{ left: displayLeft, width: displayWidth }}
      title={`${projectMeta.name}${projectMeta.startDate ? ` · ${projectMeta.startDate}` : ''}${projectMeta.targetDate ? ` → ${projectMeta.targetDate}` : ''} — drag edges to change dates`}
      onMouseDown={makeDragHandler('move')}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Left edge handle (start date) */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[7px] cursor-col-resize rounded-l hover:bg-white/30"
        onMouseDown={makeDragHandler('start')}
        onClick={(e) => e.stopPropagation()}
      />
      {/* Right edge handle (target date) */}
      <div
        className="absolute right-0 top-0 bottom-0 w-[7px] cursor-col-resize rounded-r hover:bg-white/30"
        onMouseDown={makeDragHandler('end')}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
