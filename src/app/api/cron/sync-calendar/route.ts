import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncBoss } from '@/lib/sync';
import type { UserRow } from '@/types/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Vercel Cron entrypoint. Runs every 2 minutes (see vercel.json).
 *
 * Auth options:
 *   - Vercel sets `Authorization: Bearer $CRON_SECRET` automatically when
 *     CRON_SECRET is set as a project env var. We accept that.
 *   - For manual invocation: pass `?secret=...` in the URL.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get('authorization');
    const fromQuery = new URL(request.url).searchParams.get('secret');
    const ok = authHeader === `Bearer ${secret}` || fromQuery === secret;
    if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: bosses, error } = await admin
    .from('users')
    .select('*')
    .eq('role', 'boss')
    .returns<UserRow[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!bosses?.length) return NextResponse.json({ ok: true, synced: 0 });

  const results = await Promise.all(
    bosses.map(async (boss) => {
      const r = await syncBoss(boss.id, boss.name);
      return { boss: boss.email, ok: r.ok, error: r.error };
    }),
  );

  return NextResponse.json({ ok: true, results });
}
