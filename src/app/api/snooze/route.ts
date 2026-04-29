import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveStatus } from '@/lib/status';
import { minutesFromNow } from '@/lib/time';
import type { AvailabilityStatusRow, UserRow } from '@/types/database';

export const dynamic = 'force-dynamic';

interface SnoozeBody {
  /** Snooze for N minutes from now. Pass 0 or null to clear. */
  minutes: number | null;
}

const MAX_SNOOZE_MINUTES = 24 * 60;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<UserRow>();
  if (!me || me.role !== 'boss') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { minutes } = (await request.json().catch(() => ({}))) as SnoozeBody;
  if (minutes !== null && (typeof minutes !== 'number' || !Number.isFinite(minutes))) {
    return NextResponse.json({ error: 'invalid_minutes' }, { status: 400 });
  }

  const clamped = minutes === null
    ? null
    : Math.max(0, Math.min(MAX_SNOOZE_MINUTES, Math.round(minutes)));

  const snoozeUntil = !clamped ? null : minutesFromNow(clamped).toISOString();
  const message = !clamped
    ? null
    : clamped >= 60
      ? `Snoozed for ${Math.round(clamped / 60)}h`
      : `Snoozed for ${clamped}m`;

  // Snooze implies a "be back soon" intent — don't carry an old manual unavailable.
  const { data: row, error } = await admin
    .from('availability_status')
    .upsert(
      {
        boss_user_id: me.id,
        current_status: 'snoozed',
        snooze_until: snoozeUntil,
        status_message: message,
        manual_override: 'available',
      },
      { onConflict: 'boss_user_id' },
    )
    .select('*')
    .single<AvailabilityStatusRow>();

  if (error || !row) return NextResponse.json({ error: error?.message || 'no_row' }, { status: 500 });

  const resolved = resolveStatus(row);
  if (resolved.status !== row.current_status) {
    await admin
      .from('availability_status')
      .update({ current_status: resolved.status })
      .eq('boss_user_id', me.id);
  }

  return NextResponse.json({ status: resolved });
}
