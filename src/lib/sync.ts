import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveBusyUntil } from '@/lib/google/calendar';
import { resolveStatus } from '@/lib/status';
import { notifyAllAvailable } from '@/lib/push';
import type { AvailabilityStatusRow, ResolvedStatus, UserRow } from '@/types/database';

type AvailabilityPatch = Partial<
  Pick<
    AvailabilityStatusRow,
    'manual_override' | 'snooze_until' | 'calendar_busy_until' | 'status_message'
  >
>;

export interface ApplyOptions {
  /** When the resolved status flips to 'available', send a push to subscribers. */
  notifyOnAvailable?: boolean;
}

export interface ApplyResult {
  row: AvailabilityStatusRow;
  status: ResolvedStatus;
}

/**
 * Single write-path for availability state. Reads the current row, merges the
 * patch, upserts, then fires a push if the resolved status transitioned to
 * `available`. All three callers (status route, snooze route, calendar sync)
 * use this so they can't drift.
 */
export async function applyAvailabilityUpdate(
  boss: Pick<UserRow, 'id' | 'name'>,
  patch: AvailabilityPatch,
  opts: ApplyOptions = {},
): Promise<ApplyResult> {
  const admin = createAdminClient();

  const { data: before } = await admin
    .from('availability_status')
    .select('*')
    .eq('boss_user_id', boss.id)
    .maybeSingle<AvailabilityStatusRow>();

  const wasAvailable = before
    ? resolveStatus(before).status === 'available'
    : false;

  const { data: row, error } = await admin
    .from('availability_status')
    .upsert(
      { boss_user_id: boss.id, ...before, ...patch },
      { onConflict: 'boss_user_id' },
    )
    .select('*')
    .single<AvailabilityStatusRow>();

  if (error || !row) throw error ?? new Error('availability_upsert_failed');

  const status = resolveStatus(row);

  if (
    opts.notifyOnAvailable &&
    status.status === 'available' &&
    !wasAvailable
  ) {
    await notifyAllAvailable({
      title: `${boss.name || 'The boss'} is available`,
      body: 'Tap to open the dashboard.',
      url: '/dashboard',
    });
  }

  return { row, status };
}

/** Refresh the boss's calendar busy-until from Google and apply it. */
export async function syncBoss(
  boss: Pick<UserRow, 'id' | 'name'>,
): Promise<{ ok: true; status: ResolvedStatus; calendar_busy_until: string | null } | { ok: false; error: string }> {
  let busyUntil: Date | null;
  try {
    busyUntil = await getActiveBusyUntil(boss.id);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const { row, status } = await applyAvailabilityUpdate(
    boss,
    { calendar_busy_until: busyUntil ? busyUntil.toISOString() : null },
    { notifyOnAvailable: true },
  );

  return { ok: true, status, calendar_busy_until: row.calendar_busy_until };
}
