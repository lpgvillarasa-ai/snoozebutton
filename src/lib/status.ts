import type {
  AvailabilityStatusRow,
  ResolvedStatus,
} from '@/types/database';
import { isFuture } from './time';

// Priority (highest wins):
//   1. calendar_busy_until > now           -> calendar_busy   (always sticky per spec)
//   2. manual_override = 'unavailable'     -> unavailable
//   3. snooze_until > now                  -> snoozed
//   4. otherwise                           -> available
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
