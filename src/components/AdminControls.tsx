'use client';

import { useState, useTransition } from 'react';
import type { ResolvedStatus } from '@/types/database';
import { StatusDisplay } from './StatusDisplay';
import { CustomSnoozeModal } from './CustomSnoozeModal';

const SNOOZE_PRESETS = [
  { label: 'Snooze 15m', minutes: 15 },
  { label: 'Snooze 30m', minutes: 30 },
  { label: 'Snooze 1h',  minutes: 60 },
];

export function AdminControls({ initial }: { initial: ResolvedStatus }) {
  const [status, setStatus] = useState<ResolvedStatus>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(false);

  async function call(path: string, body: unknown, key: string) {
    setBusy(key);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.status) startTransition(() => setStatus(json.status));
    } finally {
      setBusy(null);
    }
  }

  function setAvailable() {
    return call('/api/status', { manual_override: 'available', clear_snooze: true }, 'available');
  }
  function setUnavailable() {
    return call('/api/status', { manual_override: 'unavailable', clear_snooze: true, status_message: 'Unavailable' }, 'unavailable');
  }
  function snooze(minutes: number) {
    return call('/api/snooze', { minutes }, `snooze-${minutes}`);
  }

  return (
    <>
      <StatusDisplay status={status} />

      <section className="mt-8 grid grid-cols-2 gap-3">
        <button
          onClick={setAvailable}
          disabled={busy !== null}
          className="btn-primary col-span-2 h-16 text-lg"
        >
          {busy === 'available' ? '…' : 'Available now'}
        </button>

        <button
          onClick={setUnavailable}
          disabled={busy !== null}
          className="btn-secondary col-span-2 h-14 text-base"
        >
          {busy === 'unavailable' ? '…' : 'Unavailable now'}
        </button>

        {SNOOZE_PRESETS.map((p) => (
          <button
            key={p.minutes}
            onClick={() => snooze(p.minutes)}
            disabled={busy !== null}
            className="btn-secondary h-14"
          >
            {busy === `snooze-${p.minutes}` ? '…' : p.label}
          </button>
        ))}

        <button
          onClick={() => setCustomOpen(true)}
          disabled={busy !== null}
          className="btn-secondary h-14"
        >
          Custom…
        </button>
      </section>

      <p className="mt-6 text-center text-xs text-ink-400 dark:text-ink-500">
        Calendar events automatically mark you unavailable.
      </p>

      <CustomSnoozeModal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onConfirm={async (minutes) => {
          setCustomOpen(false);
          await snooze(minutes);
        }}
      />
    </>
  );
}
