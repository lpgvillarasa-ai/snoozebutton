import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveStatus } from '@/lib/status';
import { applyAvailabilityUpdate } from '@/lib/sync';
import { getBossUser, requireBoss } from '@/lib/boss';
import type { AvailabilityStatusRow, ManualOverrideKind } from '@/types/database';

export const dynamic = 'force-dynamic';

interface UpdateBody {
  manual_override?: ManualOverrideKind | null;
  status_message?: string | null;
  /** Set true to clear any active snooze. */
  clear_snooze?: boolean;
}

export async function GET() {
  const boss = await getBossUser();
  if (!boss) return NextResponse.json({ error: 'no_boss' }, { status: 404 });

  const { data: row } = await createAdminClient()
    .from('availability_status')
    .select('*')
    .eq('boss_user_id', boss.id)
    .maybeSingle<AvailabilityStatusRow>();

  const status = row
    ? resolveStatus(row)
    : { status: 'available' as const, message: 'Available', until: null };

  return NextResponse.json({
    boss: { name: boss.name, email: boss.email },
    status,
  });
}

export async function POST(request: NextRequest) {
  const guard = await requireBoss();
  if (!guard.ok) return guard.res;

  const body = (await request.json().catch(() => ({}))) as UpdateBody;

  const patch: Parameters<typeof applyAvailabilityUpdate>[1] = {};
  if ('manual_override' in body) patch.manual_override = body.manual_override ?? null;
  if ('status_message' in body) patch.status_message = body.status_message ?? null;
  if (body.clear_snooze) patch.snooze_until = null;

  try {
    const { status } = await applyAvailabilityUpdate(guard.me, patch, {
      notifyOnAvailable: true,
    });
    return NextResponse.json({ status });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
