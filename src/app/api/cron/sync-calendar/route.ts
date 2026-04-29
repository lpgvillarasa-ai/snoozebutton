import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncBoss } from '@/lib/sync';
import type { UserRow } from '@/types/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 503 });
  }
  const authHeader = request.headers.get('authorization');
  const fromQuery = new URL(request.url).searchParams.get('secret');
  const ok = authHeader === `Bearer ${secret}` || fromQuery === secret;
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: bosses, error } = await createAdminClient()
    .from('users')
    .select('*')
    .eq('role', 'boss')
    .returns<UserRow[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!bosses?.length) return NextResponse.json({ ok: true, synced: 0 });

  const results = await Promise.all(
    bosses.map(async (boss) => {
      const r = await syncBoss(boss);
      return { boss: boss.email, ok: r.ok, error: r.ok ? undefined : r.error };
    }),
  );

  return NextResponse.json({ ok: true, results });
}
