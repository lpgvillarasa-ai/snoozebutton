import type {
  AvailabilityStatusRow,
  ResolvedStatus,
} from '@/types/database';
import { isFuture } from './time';

/**
 * Resolution priority (highest first):
 *
 *   1. calendar_busy_until > now            -> calendar_busy
 *   2. manual_override = 'unavailable'      -> unavailable
 *   3. snooze_until > now                   -> snoozed
 *   4. otherwise                             -> available
 *
 * Notes (per spec):
 *   - calendar_busy always wins; "Available now" does NOT override it.
 *   - "Available now" clears snooze and manual unavailable.
 */
export function resolveStatus(
  row: Pick<
    AvailabilityStatusRow,
    'snooze_until' | 'calendar_busy_until' | 'manual_override' | 'status_message'
  >,
  now: Date = new Date(),
): ResolvedStatus {
  if (isFuture(row.calendar_busy_until, now)) {
    return {
      status: 'calendar_busy',
      message: 'In a meeting',
      until: row.calendar_busy_until,
    };
  }

  if (row.manual_override === 'unavailable') {
    return {
      status: 'unavailable',
      message: row.status_message || 'Unavailable',
      until: null,
    };
  }

  if (isFuture(row.snooze_until, now)) {
    return {
      status: 'snoozed',
      message: row.status_message || 'Snoozed',
      until: row.snooze_until,
    };
  }

  return { status: 'available', message: 'Available', until: null };
}

export function statusLabel(status: ResolvedStatus): string {
  switch (status.status) {
    case 'available':     return 'Available';
    case 'unavailable':   return 'Unavailable';
    case 'snoozed':       return 'Snoozed';
    case 'calendar_busy': return 'In a meeting';
  }
}
