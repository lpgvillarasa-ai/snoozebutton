import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isBossEmail } from '@/lib/boss';

export const dynamic = 'force-dynamic';

/**
 * Supabase OAuth redirect target.
 *
 * - Exchanges the `code` for a session.
 * - If the signed-in user is the boss, captures their Google access/refresh
 *   tokens for Calendar reads and stores them server-side.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/dashboard';

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const session = data.session;
  const email = session.user.email;

  // If this is the boss and Supabase returned a Google provider token, persist
  // it so our server can read the calendar in the background.
  if (
    isBossEmail(email) &&
    session.provider_token
  ) {
    const admin = createAdminClient();
    await admin.from('google_calendar_tokens').upsert(
      {
        user_id: session.user.id,
        access_token: session.provider_token,
        refresh_token: session.provider_refresh_token ?? null,
        expiry_date: session.expires_at ? session.expires_at * 1000 : null,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
      },
      { onConflict: 'user_id' },
    );

    // Make sure they're flagged as boss in our mirrored users table.
    await admin
      .from('users')
      .update({ role: 'boss' })
      .eq('id', session.user.id);

    // Ensure an availability row exists.
    await admin.from('availability_status').upsert(
      { boss_user_id: session.user.id, current_status: 'available' },
      { onConflict: 'boss_user_id' },
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
