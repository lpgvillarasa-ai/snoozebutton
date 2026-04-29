import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Settings } from '@/components/Settings';
import { BottomNav } from '@/components/BottomNav';
import type { UserRow } from '@/types/database';

export const dynamic = 'force-dynamic';

interface TeamMember { name: string | null; email: string; role: string }

export default async function SettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const me: UserRow | null = user
    ? (await admin.from('users').select('*').eq('id', user.id).maybeSingle<UserRow>()).data
    : null;

  const isBoss = me?.role === 'boss';

  let calendarConnected = false;
  let team: TeamMember[] = [];

  if (isBoss && me) {
    const [{ data: tokens }, { data: users }] = await Promise.all([
      admin
        .from('google_calendar_tokens')
        .select('user_id')
        .eq('user_id', me.id)
        .maybeSingle<{ user_id: string }>(),
      admin
        .from('users')
        .select('name,email,role')
        .order('created_at', { ascending: true })
        .returns<TeamMember[]>(),
    ]);
    calendarConnected = Boolean(tokens);
    team = users ?? [];
  }

  return (
    <>
      <main className="flex-1 flex flex-col px-6 pt-10 pb-28 safe-top">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-400 dark:text-ink-500">
            Settings
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {me?.name || me?.email || 'Account'}
          </h1>
        </header>

        <Settings
          isBoss={isBoss}
          email={me?.email}
          calendarConnected={calendarConnected}
          team={team}
          vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''}
        />
      </main>
      <BottomNav active="settings" isBoss={isBoss} />
    </>
  );
}
