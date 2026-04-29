import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { UserRow } from '@/types/database';

/** First boss in the system. MVP supports a single boss. */
export async function getBossUser(): Promise<UserRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'boss')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<UserRow>();
  return data ?? null;
}

export function isBossEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.BOSS_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/**
 * Server-side guard for boss-only API routes. Returns either the boss row,
 * or a NextResponse to short-circuit with 401/403.
 */
export async function requireBoss(): Promise<
  { ok: true; me: UserRow } | { ok: false; res: NextResponse }
> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }
  const admin = createAdminClient();
  const { data: me } = await admin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<UserRow>();
  if (!me || me.role !== 'boss') {
    return { ok: false, res: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { ok: true, me };
}
