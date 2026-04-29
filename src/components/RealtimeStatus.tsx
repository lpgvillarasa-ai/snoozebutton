'use client';

import { useEffect, useState } from 'react';
import type { AvailabilityStatusRow, ResolvedStatus } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { resolveStatus } from '@/lib/status';
import { StatusDisplay } from './StatusDisplay';

export function RealtimeStatus({
  bossUserId,
  initial,
}: {
  bossUserId: string;
  initial: ResolvedStatus;
}) {
  const [status, setStatus] = useState<ResolvedStatus>(initial);

  useEffect(() => {
    const supabase = createClient();

    // Initial refetch in case page was cached.
    supabase
      .from('availability_status')
      .select('*')
      .eq('boss_user_id', bossUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setStatus(resolveStatus(data as AvailabilityStatusRow));
      });

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
          if (row) setStatus(resolveStatus(row));
        },
      )
      .subscribe();

    // Periodic re-resolve so snooze/calendar timers expire client-side too.
    const tick = setInterval(async () => {
      const { data } = await supabase
        .from('availability_status')
        .select('*')
        .eq('boss_user_id', bossUserId)
        .maybeSingle();
      if (data) setStatus(resolveStatus(data as AvailabilityStatusRow));
    }, 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(tick);
    };
  }, [bossUserId]);

  return <StatusDisplay status={status} />;
}
