import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveStatus } from '@/lib/status';
import { AdminControls } from '@/components/AdminControls';
import { BottomNav } from '@/components/BottomNav';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  const admin = createAdminClient();
  const { data: me } = await admin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<import('@/types/database').UserRow>();

  if (!me || me.role !== 'boss') {
    return (
      <main className="flex-1 px-6 py-12 safe-top">
        <div className="card p-8 text-center fade-up">
          <h1 className="text-xl font-semibold">Boss only</h1>
          <p className="mt-3 text-ink-500">
            This control panel is reserved for the boss account.
          </p>
        </div>
      </main>
    );
  }

  const { data: row } = await admin
    .from('availability_status')
    .select('*')
    .eq('boss_user_id', me.id)
    .maybeSingle<import('@/types/database').AvailabilityStatusRow>();

  const initial = row
    ? resolveStatus(row)
    : { status: 'available' as const, message: 'Available', until: null };

  return (
    <>
      <main className="flex-1 flex flex-col px-6 pt-10 pb-28 safe-top">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-400 dark:text-ink-500">
            Control panel
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Set your status
          </h1>
        </header>
        <AdminControls bossUserId={me.id} initial={initial} />
      </main>
      <BottomNav active="admin" isBoss />
    </>
  );
}
