'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ThemeToggle } from './ThemeToggle';
import {
  detectPushSupport,
  urlBase64ToUint8Array,
  type PushState,
} from '@/lib/push-client';
import { GOOGLE_OAUTH_SCOPES } from '@/lib/google/scopes';
import type { UserRole } from '@/types/database';

interface TeamMember { name: string | null; email: string; role: UserRole }

async function readPushState(): Promise<PushState> {
  if (!detectPushSupport()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) return 'subscribed';
  return Notification.permission === 'granted' ? 'granted' : 'unknown';
}

export function Settings({
  isBoss,
  email,
  calendarConnected,
  team,
  vapidPublicKey,
}: {
  isBoss: boolean;
  email?: string;
  calendarConnected: boolean;
  team: TeamMember[];
  vapidPublicKey: string;
}) {
  const [pushState, setPushState] = useState<PushState>('unknown');
  const [pushBusy, setPushBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    readPushState().then((s) => { if (alive) setPushState(s); });
    return () => { alive = false; };
  }, []);

  async function enablePush() {
    if (!vapidPublicKey) return alert('Push notifications are not configured.');
    setPushBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setPushState(perm === 'denied' ? 'denied' : 'unknown');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
        });
      }
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setPushState('subscribed');
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
        await sub.unsubscribe();
      }
      setPushState('granted');
    } finally {
      setPushBusy(false);
    }
  }

  async function syncCalendar() {
    setSyncing(true); setSyncMsg(null);
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' });
      const json = await res.json();
      setSyncMsg(json.error ? `Error: ${json.error}` : 'Calendar synced.');
    } finally {
      setSyncing(false);
    }
  }

  async function reconnectGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
        scopes: GOOGLE_OAUTH_SCOPES,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="space-y-4">
      {isBoss && (
        <Section title="Google Calendar">
          <Row label="Status" value={calendarConnected ? 'Connected' : 'Not connected'} />
          <div className="mt-3 flex gap-3">
            <button onClick={reconnectGoogle} className="btn-secondary flex-1">
              {calendarConnected ? 'Reconnect' : 'Connect Google'}
            </button>
            <button
              onClick={syncCalendar}
              disabled={syncing || !calendarConnected}
              className="btn-secondary flex-1"
            >
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
          {syncMsg && <p className="mt-2 text-sm text-ink-500">{syncMsg}</p>}
          <p className="mt-3 text-xs text-ink-400">
            Only busy times are read. Event titles, guests and details are never shown to viewers.
          </p>
        </Section>
      )}

      <Section title="Notifications">
        <PushControl
          state={pushState}
          busy={pushBusy}
          onEnable={enablePush}
          onDisable={disablePush}
        />
      </Section>

      <Section title="Appearance">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">Theme</div>
          <ThemeToggle />
        </div>
      </Section>

      {isBoss && (
        <Section title="Team">
          {team.length === 0 ? (
            <p className="text-sm text-ink-500">Anyone who signs in with Google appears here automatically.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {team.map((m) => (
                <li key={m.email} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{m.name || m.email}</div>
                    <div className="text-xs text-ink-500 truncate">{m.email}</div>
                  </div>
                  <span className="pill ring-[var(--border)] text-ink-500 capitalize">{m.role}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-400">
            To make someone the boss, set their email in <code>BOSS_EMAILS</code> and have them sign in.
          </p>
        </Section>
      )}

      <Section title="Account">
        <Row label="Signed in as" value={email || '—'} />
        <button onClick={signOut} className="btn-secondary mt-3 w-full">Sign out</button>
      </Section>
    </div>
  );
}

function PushControl({
  state, busy, onEnable, onDisable,
}: {
  state: PushState;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  if (state === 'unsupported') {
    return <p className="text-sm text-ink-500">This browser doesn't support push.</p>;
  }
  if (state === 'denied') {
    return <p className="text-sm text-ink-500">Notifications are blocked in your browser settings.</p>;
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium">Push when boss is available</div>
        <div className="text-xs text-ink-500">Get a single ping the moment status flips to green.</div>
      </div>
      {state === 'subscribed' ? (
        <button onClick={onDisable} disabled={busy} className="btn-secondary">Off</button>
      ) : (
        <button onClick={onEnable} disabled={busy} className="btn-primary">Enable</button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 fade-up">
      <h3 className="text-xs uppercase tracking-[0.18em] text-ink-400 dark:text-ink-500">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink-500">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
