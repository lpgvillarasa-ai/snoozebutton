import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets, the cron / push API routes (which auth themselves),
    // and the PWA manifest + service worker. Each non-skipped request would
    // otherwise round-trip Supabase to validate the session.
    '/((?!_next/static|_next/image|favicon.ico|icons/|api/cron/|api/push/|manifest.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
