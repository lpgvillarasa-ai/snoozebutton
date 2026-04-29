import { NextResponse, type NextRequest } from 'next/server';
import { applyAvailabilityUpdate } from '@/lib/sync';
import { requireBoss } from '@/lib/boss';
import { minutesFromNow } from '@/lib/time';

export const dynamic = 'force-dynamic';

interface SnoozeBody {
  /** Snooze for N minutes from now. Pass 0 or null to clear. */
  minutes: number | null;
}

const MAX_SNOOZE_MINUTES = 24 * 60;

function formatSnoozeMessage(minutes: number): string {
  return minutes >= 60
    ? `Snoozed for ${Math.round(minutes / 60)}h`
    : `Snoozed for ${minutes}m`;
}

export async function POST(request: NextRequest) {
  const guard = await requireBoss();
  if (!guard.ok) return guard.res;

  const { minutes } = (await request.json().catch(() => ({}))) as SnoozeBody;
  if (minutes !== null && (typeof minutes !== 'number' || !Number.isFinite(minutes))) {
    return NextResponse.json({ error: 'invalid_minutes' }, { status: 400 });
  }

  const clamped = minutes === null
    ? null
    : Math.max(0, Math.min(MAX_SNOOZE_MINUTES, Math.round(minutes)));

  try {
    const { status } = await applyAvailabilityUpdate(
      guard.me,
      {
        snooze_until: clamped ? minutesFromNow(clamped).toISOString() : null,
        status_message: clamped ? formatSnoozeMessage(clamped) : null,
        // Snoozing clears any standing manual override so it falls back to
        // available when the snooze ends (calendar busy still wins).
        manual_override: null,
      },
    );
    return NextResponse.json({ status });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
