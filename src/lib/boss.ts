import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { UserRow } from '@/types/database';

/**
 * Returns the single "boss" user for this deployment.
 * MVP: there is exactly one boss; if multiple, the first wins.
 */
export async function getBossUser(): Promise<UserRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'boss')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<UserRow>();
  if (error) throw error;
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
