import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncBoss } from '@/lib/sync';
import type { UserRow } from '@/types/database';

export const dynamic = 'force-dynamic';

/**
 * Boss-triggered manual sync. Useful from the Settings screen.
 * The cron route does the same work on a schedule.
 */
export async function POST() {
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

  const result = await syncBoss(me.id, me.name);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'sync_failed' }, { status: 500 });
  }
  return NextResponse.json({
    status: result.status,
    calendar_busy_until: result.calendar_busy_until,
  });
}
