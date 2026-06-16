/** Linear-style workflow state icons (by type + optional status name). */

export type StatusIconKind = 'backlog' | 'todo' | 'triage' | 'inProgress' | 'inReview' | 'done' | 'canceled';

export function resolveStatusIconKind(statusType: string, statusName = ''): StatusIconKind {
  const name = statusName.toLowerCase();
  if (statusType === 'completed') return 'done';
  if (statusType === 'canceled') return 'canceled';
  if (statusType === 'triage') return 'triage';
  if (statusType === 'backlog') return 'backlog';
  if (statusType === 'unstarted') return 'todo';
  if (statusType === 'started') {
    if (name.includes('review')) return 'inReview';
    return 'inProgress';
  }
  return 'todo';
}

interface Props {
  statusType: string;
  statusName?: string;
  size?: number;
  /** Use on colored Gantt bars (white/light icon). */
  variant?: 'default' | 'onBar';
  className?: string;
  title?: string;
}

export default function StatusIcon({
  statusType,
  statusName,
  size = 14,
  variant = 'default',
  className = '',
  title,
}: Props) {
  const kind = resolveStatusIconKind(statusType, statusName);
  const onBar = variant === 'onBar';

  const stroke = onBar ? 'rgba(255,255,255,0.95)' : '#9ca3af';
  const fillProgress = onBar ? 'rgba(255,255,255,0.95)' : '#e2b203';
  const fillReview = onBar ? 'rgba(255,255,255,0.95)' : '#4cb782';
  const fillDone = onBar ? 'rgba(255,255,255,0.35)' : '#5e6ad2';
  const fillCanceled = onBar ? 'rgba(255,255,255,0.35)' : '#9ca3af';
  const mark = onBar ? 'rgba(255,255,255,0.95)' : '#fff';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      className={`shrink-0 ${className}`}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {kind === 'backlog' || kind === 'todo' ? (
        <circle cx="7" cy="7" r="5.25" stroke={stroke} strokeWidth="1.5" />
      ) : null}

      {kind === 'triage' ? (
        <>
          <circle cx="7" cy="7" r="5.25" stroke={onBar ? stroke : '#f59e0b'} strokeWidth="1.5" strokeDasharray="2.5 2" />
          <circle cx="7" cy="7" r="1.25" fill={onBar ? stroke : '#f59e0b'} />
        </>
      ) : null}

      {kind === 'inProgress' ? (
        <>
          <circle cx="7" cy="7" r="5.25" stroke={onBar ? stroke : fillProgress} strokeWidth="1.5" />
          <path d="M7 1.75 A5.25 5.25 0 0 1 7 12.25 Z" fill={fillProgress} />
        </>
      ) : null}

      {kind === 'inReview' ? (
        <>
          <circle cx="7" cy="7" r="5.25" stroke={onBar ? stroke : fillReview} strokeWidth="1.5" />
          <path d="M7 7 L7 1.75 A5.25 5.25 0 0 1 12.25 7 Z" fill={fillReview} />
        </>
      ) : null}

      {kind === 'done' ? (
        <>
          <circle cx="7" cy="7" r="5.25" fill={fillDone} />
          <path
            d="M4.25 7.1 L6.2 9.05 L9.85 5.2"
            stroke={mark}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : null}

      {kind === 'canceled' ? (
        <>
          <circle cx="7" cy="7" r="5.25" fill={fillCanceled} />
          <path d="M5 5 L9 9 M9 5 L5 9" stroke={mark} strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : null}
    </svg>
  );
}
