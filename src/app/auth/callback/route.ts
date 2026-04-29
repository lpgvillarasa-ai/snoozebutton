import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isBossEmail } from '@/lib/boss';
import { GOOGLE_CALENDAR_SCOPE } from '@/lib/google/calendar';

export const dynamic = 'force-dynamic';

/** Allow only relative same-origin paths — closes an open-redirect hole. */
function safeNext(raw: string | null, fallback = '/dashboard'): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return fallback;
  }
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const session = data.session;

  if (isBossEmail(session.user.email) && session.provider_token) {
    const admin = createAdminClient();
    // Token storage + role promotion. Run in parallel; `availability_status`
    // is created lazily by `applyAvailabilityUpdate` on first state change,
    // and the `handle_new_user` trigger has already inserted the user row.
    await Promise.all([
      admin.from('google_calendar_tokens').upsert(
        {
          user_id: session.user.id,
          access_token: session.provider_token,
          refresh_token: session.provider_refresh_token ?? null,
          expiry_date: session.expires_at ? session.expires_at * 1000 : null,
          scope: GOOGLE_CALENDAR_SCOPE,
        },
        { onConflict: 'user_id' },
      ),
      // No-op on subsequent sign-ins (filtered to viewer rows only).
      admin
        .from('users')
        .update({ role: 'boss' })
        .eq('id', session.user.id)
        .eq('role', 'viewer'),
    ]);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
