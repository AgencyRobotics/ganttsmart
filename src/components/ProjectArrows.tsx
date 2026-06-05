import { memo, useCallback, useEffect, useState } from 'react';
import type { ProjectMeta } from '@/types';

interface Props {
  projectMetas: ProjectMeta[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface Arrow {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  sourceId: string;
  targetId: string;
}

/**
 * Draws project-to-project dependency arrows between the project summary bars in
 * initiative mode. Mirrors DependencyArrows but reads `data-project-bar` and the
 * `blocks` lists from project metadata (blocker's right edge -> blocked's left edge).
 */
export default memo(function ProjectArrows({ projectMetas, containerRef }: Props) {
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const compute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const next: Arrow[] = [];

    for (const meta of projectMetas) {
      if (!meta.blocks || meta.blocks.length === 0) continue;
      const fromBar = container.querySelector(`[data-project-bar="${meta.id}"]`) as HTMLElement | null;
      if (!fromBar) continue;
      const fromRect = fromBar.getBoundingClientRect();

      for (const blockedId of meta.blocks) {
        const toBar = container.querySelector(`[data-project-bar="${blockedId}"]`) as HTMLElement | null;
        if (!toBar) continue;
        const toRect = toBar.getBoundingClientRect();
        next.push({
          fromX: fromRect.right - containerRect.left,
          fromY: fromRect.top + fromRect.height / 2 - containerRect.top,
          toX: toRect.left - containerRect.left,
          toY: toRect.top + toRect.height / 2 - containerRect.top,
          sourceId: meta.id,
          targetId: blockedId,
        });
      }
    }

    setArrows(next);
    setSize({ width: container.scrollWidth, height: container.scrollHeight });
  }, [projectMetas, containerRef]);

  useEffect(() => {
    const frame = requestAnimationFrame(compute);
    const container = containerRef.current;
    if (!container) return () => cancelAnimationFrame(frame);
    const observer = new ResizeObserver(compute);
    observer.observe(container);
    window.addEventListener('resize', compute);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [compute]);

  if (arrows.length === 0) return null;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none z-[3]"
      width={size.width}
      height={size.height}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker id="proj-arrow" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill="#7c5cfc" opacity="0.95" />
        </marker>
      </defs>
      {arrows.map((a) => {
        const dx = a.toX - a.fromX;
        const cx = Math.min(Math.max(Math.abs(dx) * 0.4, 20), 70);
        const path =
          dx > 30
            ? `M ${a.fromX} ${a.fromY} C ${a.fromX + cx} ${a.fromY}, ${a.toX - cx} ${a.toY}, ${a.toX} ${a.toY}`
            : `M ${a.fromX} ${a.fromY} C ${a.fromX + 45} ${a.fromY}, ${a.fromX + 45} ${(a.fromY + a.toY) / 2}, ${(a.fromX + a.toX) / 2} ${(a.fromY + a.toY) / 2} S ${a.toX - 45} ${a.toY}, ${a.toX} ${a.toY}`;
        return (
          <path
            key={`${a.sourceId}-${a.targetId}`}
            d={path}
            fill="none"
            stroke="#7c5cfc"
            strokeWidth={2}
            strokeDasharray="2 0"
            opacity={0.7}
            markerEnd="url(#proj-arrow)"
          />
        );
      })}
    </svg>
  );
});
