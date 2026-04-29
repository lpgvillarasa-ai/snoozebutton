'use client';

import { useEffect, useRef, useState } from 'react';
import type { AvailabilityStatusRow, ResolvedStatus } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { resolveStatus } from '@/lib/status';
import { StatusDisplay } from './StatusDisplay';

function sameStatus(a: ResolvedStatus, b: ResolvedStatus): boolean {
  return a.status === b.status && a.message === b.message && a.until === b.until;
}

export function RealtimeStatus({
  bossUserId,
  initial,
}: {
  bossUserId: string;
  initial: ResolvedStatus;
}) {
  const [status, setStatus] = useState<ResolvedStatus>(initial);
  // Cache the last raw row so we can re-resolve when a snooze/calendar timer
  // expires without going back to the database.
  const rowRef = useRef<AvailabilityStatusRow | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    let boundaryTimer: ReturnType<typeof setTimeout> | undefined;

    function adopt(row: AvailabilityStatusRow) {
      if (!alive) return;
      rowRef.current = row;
      const next = resolveStatus(row);
      setStatus((prev) => (sameStatus(prev, next) ? prev : next));
      scheduleBoundary(next.until);
    }

    function scheduleBoundary(untilIso: string | null) {
      if (boundaryTimer) clearTimeout(boundaryTimer);
      if (!untilIso) return;
      const ms = new Date(untilIso).getTime() - Date.now() + 500;
      if (ms <= 0) return;
      // Cap at ~1 day to dodge setTimeout overflow on far-future timestamps.
      boundaryTimer = setTimeout(() => {
        if (rowRef.current) adopt(rowRef.current);
      }, Math.min(ms, 24 * 60 * 60 * 1000));
    }

    supabase
      .from('availability_status')
      .select('*')
      .eq('boss_user_id', bossUserId)
      .maybeSingle<AvailabilityStatusRow>()
      .then(({ data }) => { if (data) adopt(data); });

    const channel = supabase
      .channel(`availability:${bossUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability_status',
          filter: `boss_user_id=eq.${bossUserId}`,
        },
        (payload) => {
          const row = payload.new as AvailabilityStatusRow;
          if (row) adopt(row);
        },
      )
      .subscribe();

    return () => {
      alive = false;
      if (boundaryTimer) clearTimeout(boundaryTimer);
      supabase.removeChannel(channel);
    };
  }, [bossUserId]);

  return <StatusDisplay status={status} />;
}
