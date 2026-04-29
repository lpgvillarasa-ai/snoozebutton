import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveBusyUntil } from '@/lib/google/calendar';
import { resolveStatus } from '@/lib/status';
import { notifyAllAvailable } from '@/lib/push';
import type { AvailabilityStatusRow, ResolvedStatus } from '@/types/database';

export interface SyncResult {
  ok: boolean;
  status?: ResolvedStatus;
  calendar_busy_until?: string | null;
  error?: string;
}

/**
 * Pull the boss's current Google Calendar event end time, write it back to
 * `availability_status`, and notify subscribers if the resolved status flips
 * to "available".
 */
export async function syncBoss(
  bossUserId: string,
  bossName?: string | null,
): Promise<SyncResult> {
  const admin = createAdminClient();

  let busyUntil: Date | null;
  try {
    busyUntil = await getActiveBusyUntil(bossUserId);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  const { data: before } = await admin
    .from('availability_status')
    .select('*')
    .eq('boss_user_id', bossUserId)
    .maybeSingle<AvailabilityStatusRow>();

  const wasAvailable = before
    ? resolveStatus(before).status === 'available'
    : false;

  const { data: row } = await admin
    .from('availability_status')
    .upsert(
      {
        boss_user_id: bossUserId,
        calendar_busy_until: busyUntil ? busyUntil.toISOString() : null,
        current_status: before?.current_status ?? 'available',
      },
      { onConflict: 'boss_user_id' },
    )
    .select('*')
    .single<AvailabilityStatusRow>();

  if (!row) return { ok: false, error: 'no_row' };

  const resolved = resolveStatus(row);
  if (resolved.status !== row.current_status) {
    await admin
      .from('availability_status')
      .update({ current_status: resolved.status })
      .eq('boss_user_id', bossUserId);
  }

  if (resolved.status === 'available' && !wasAvailable) {
    await notifyAllAvailable({
      title: `${bossName || 'The boss'} is available`,
      body: 'Tap to open the dashboard.',
      url: '/dashboard',
    });
  }

  return { ok: true, status: resolved, calendar_busy_until: row.calendar_busy_until };
}
