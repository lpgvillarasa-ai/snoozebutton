import type { EffectiveStatus } from '@/types/database';

export const STATUS_STYLES: Record<
  EffectiveStatus,
  { dot: string; ring: string; text: string; label: string }
> = {
  available: {
    dot:  'bg-status-available',
    ring: 'ring-status-available/20 text-emerald-700 dark:text-emerald-300',
    text: 'text-status-available',
    label: 'Available',
  },
  unavailable: {
    dot:  'bg-status-unavailable',
    ring: 'ring-status-unavailable/20 text-red-700 dark:text-red-300',
    text: 'text-status-unavailable',
    label: 'Unavailable',
  },
  snoozed: {
    dot:  'bg-status-snoozed',
    ring: 'ring-status-snoozed/20 text-amber-700 dark:text-amber-300',
    text: 'text-status-snoozed',
    label: 'Snoozed',
  },
  calendar_busy: {
    dot:  'bg-status-calendar',
    ring: 'ring-status-calendar/20 text-slate-700 dark:text-slate-300',
    text: 'text-status-calendar',
    label: 'In a meeting',
  },
};

export function StatusBadge({
  status,
  pulse = false,
}: {
  status: EffectiveStatus;
  pulse?: boolean;
}) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`pill ${s.ring}`}>
      <span className={`status-dot ${s.dot} ${pulse ? 'live' : ''}`} />
      {s.label}
    </span>
  );
}
