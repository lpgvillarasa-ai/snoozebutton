import { NextResponse } from 'next/server';
import { syncBoss } from '@/lib/sync';
import { requireBoss } from '@/lib/boss';

export const dynamic = 'force-dynamic';

/**
 * Boss-triggered manual sync. The cron route does the same on a schedule.
 */
export async function POST() {
  const guard = await requireBoss();
  if (!guard.ok) return guard.res;

  const result = await syncBoss(guard.me);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({
    status: result.status,
    calendar_busy_until: result.calendar_busy_until,
  });
}
