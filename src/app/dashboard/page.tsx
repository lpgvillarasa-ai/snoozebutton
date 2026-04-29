import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { resolveStatus } from '@/lib/status';
import { getBossUser } from '@/lib/boss';
import { RealtimeStatus } from '@/components/RealtimeStatus';
import { BottomNav } from '@/components/BottomNav';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const boss = await getBossUser();
  if (!boss) {
    return (
      <main className="flex-1 px-6 py-12 safe-top">
        <div className="card p-8 text-center">
          <h1 className="text-xl font-semibold">No boss configured</h1>
          <p className="mt-3 text-ink-500">
            Ask the boss to sign in once on this app to set up the dashboard.
          </p>
        </div>
      </main>
    );
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('availability_status')
    .select('*')
    .eq('boss_user_id', boss.id)
    .maybeSingle<import('@/types/database').AvailabilityStatusRow>();

  const initial = row
    ? resolveStatus(row)
    : { status: 'available' as const, message: 'Available', until: null };

  const isBoss = user?.id === boss.id;

  return (
    <>
      <main className="flex-1 flex flex-col px-6 pt-10 pb-28 safe-top">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-ink-400 dark:text-ink-500">
              {boss.name || 'The boss'}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Right now
            </h1>
          </div>
          <Link href="/settings" className="btn-ghost px-3 py-2 text-sm">
            Settings
          </Link>
        </header>

        <RealtimeStatus bossUserId={boss.id} initial={initial} />

        {isBoss && (
          <Link href="/admin" className="btn-primary mt-10 w-full">
            Open control panel
          </Link>
        )}
      </main>
      <BottomNav active="dashboard" isBoss={isBoss} />
    </>
  );
}
