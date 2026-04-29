'use client';

import { useEffect, useState } from 'react';
import type { ResolvedStatus } from '@/types/database';
import { formatUntil } from '@/lib/time';
import { STATUS_STYLES } from './StatusBadge';

export function StatusDisplay({ status }: { status: ResolvedStatus }) {
  const s = STATUS_STYLES[status.status];

  // Re-render every 30s so a live "until 4:30 PM" stays fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="card p-8 fade-up text-center">
      <div className="flex justify-center">
        <span className={`status-dot live ${s.dot}`} style={{ width: 14, height: 14 }} />
      </div>
      <h2 className={`mt-6 text-4xl font-semibold tracking-tight ${s.text}`}>
        {s.label}
      </h2>
      {status.until && (
        <p className="mt-3 text-ink-500 dark:text-ink-400">
          Until {formatUntil(status.until)}
        </p>
      )}
      {!status.until && status.status === 'unavailable' && (
        <p className="mt-3 text-ink-500 dark:text-ink-400">{status.message}</p>
      )}
      {!status.until && status.status === 'available' && (
        <p className="mt-3 text-ink-500 dark:text-ink-400">Reach out anytime.</p>
      )}
    </div>
  );
}
