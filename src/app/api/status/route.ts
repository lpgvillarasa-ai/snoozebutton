import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveStatus } from '@/lib/status';
import { notifyAllAvailable } from '@/lib/push';
import { getBossUser } from '@/lib/boss';
import type { AvailabilityStatusRow, ManualOverrideKind, UserRow } from '@/types/database';

export const dynamic = 'force-dynamic';

interface UpdateBody {
  manual_override?: ManualOverrideKind | null;
  status_message?: string | null;
  /** Set true to clear any active snooze. */
  clear_snooze?: boolean;
}

/**
 * GET  /api/status   — current resolved status for the boss.
 * POST /api/status   — boss-only: update manual override / message / clear snooze.
 */
export async function GET() {
  const boss = await getBossUser();
  if (!boss) return NextResponse.json({ error: 'no_boss' }, { status: 404 });

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('availability_status')
    .select('*')
    .eq('boss_user_id', boss.id)
    .maybeSingle<AvailabilityStatusRow>();

  if (!row) return NextResponse.json({ error: 'no_status' }, { status: 404 });

  const resolved = resolveStatus(row);
  return NextResponse.json({ boss: { name: boss.name, email: boss.email }, status: resolved, raw: row });
}

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

  const body = (await request.json().catch(() => ({}))) as UpdateBody;

  // Read previous state so we can detect available transitions.
  const { data: before } = await admin
    .from('availability_status')
    .select('*')
    .eq('boss_user_id', me.id)
    .maybeSingle<AvailabilityStatusRow>();

  const update: Record<string, unknown> = {};
  if ('manual_override' in body) update.manual_override = body.manual_override ?? null;
  if ('status_message' in body) update.status_message = body.status_message ?? null;
  if (body.clear_snooze) update.snooze_until = null;

  const { data: row, error } = await admin
    .from('availability_status')
    .upsert(
      {
        boss_user_id: me.id,
        current_status: 'available',
        ...update,
      },
      { onConflict: 'boss_user_id' },
    )
    .select('*')
    .single<AvailabilityStatusRow>();

  if (error || !row) return NextResponse.json({ error: error?.message || 'no_row' }, { status: 500 });

  const resolved = resolveStatus(row);
  // Cache resolved status in the row so realtime payloads carry it.
  if (resolved.status !== row.current_status) {
    await admin
      .from('availability_status')
      .update({ current_status: resolved.status })
      .eq('boss_user_id', me.id);
  }

  // Notify viewers when status flips to available.
  const wasAvailable = before ? resolveStatus(before).status === 'available' : false;
  if (resolved.status === 'available' && !wasAvailable) {
    await notifyAllAvailable({
      title: `${me.name || 'The boss'} is available`,
      body: 'Tap to open the dashboard.',
      url: '/dashboard',
    });
  }

  return NextResponse.json({ status: resolved });
}
