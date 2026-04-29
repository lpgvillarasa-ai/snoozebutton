'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function LoginButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback${
      next ? `?next=${encodeURIComponent(next)}` : ''
    }`;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        scopes: 'openid email profile https://www.googleapis.com/auth/calendar.readonly',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
  }

  return (
    <button onClick={signIn} disabled={loading} className="btn-primary w-full h-14 text-base">
      <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
        <path
          fill="currentColor"
          d="M21.35 11.1H12v2.93h5.39c-.23 1.5-1.66 4.4-5.39 4.4-3.24 0-5.88-2.68-5.88-6s2.64-6 5.88-6c1.84 0 3.08.78 3.79 1.45l2.59-2.5C16.62 3.86 14.55 3 12 3 6.99 3 3 6.99 3 12s3.99 9 9 9c5.2 0 8.64-3.66 8.64-8.81 0-.59-.06-1.04-.14-1.49z"
        />
      </svg>
      {loading ? 'Connecting…' : 'Continue with Google'}
    </button>
  );
}
