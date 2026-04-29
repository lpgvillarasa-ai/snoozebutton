import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/admin';
import type { GoogleCalendarTokensRow } from '@/types/database';

/**
 * Build a Google OAuth2 client preloaded with the boss's stored tokens,
 * and wire a listener that persists token refreshes back to the database.
 */
export async function getCalendarClient(bossUserId: string) {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from('google_calendar_tokens')
    .select('*')
    .eq('user_id', bossUserId)
    .maybeSingle<GoogleCalendarTokensRow>();

  if (error) throw error;
  if (!row) throw new Error('Calendar not connected');

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
  );

  oauth2.setCredentials({
    access_token: row.access_token,
    refresh_token: row.refresh_token ?? undefined,
    expiry_date: row.expiry_date ?? undefined,
    scope: row.scope ?? undefined,
  });

  oauth2.on('tokens', async (tokens) => {
    const update: Partial<GoogleCalendarTokensRow> = {
      access_token: tokens.access_token ?? row.access_token,
      expiry_date: tokens.expiry_date ?? row.expiry_date,
      scope: tokens.scope ?? row.scope,
    };
    if (tokens.refresh_token) update.refresh_token = tokens.refresh_token;
    await supabase
      .from('google_calendar_tokens')
      .update(update)
      .eq('user_id', bossUserId);
  });

  return google.calendar({ version: 'v3', auth: oauth2 });
}

/**
 * Returns the end time of the boss's currently-active event, or null.
 * "Active" = event with start <= now <= end, on the primary calendar,
 * not declined, not transparent (free), not all-day.
 */
export async function getActiveBusyUntil(
  bossUserId: string,
  now: Date = new Date(),
): Promise<Date | null> {
  const calendar = await getCalendarClient(bossUserId);

  // Peek slightly forward so we catch an event that started in the same minute.
  const timeMin = new Date(now.getTime() - 60_000).toISOString();
  const timeMax = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();

  const { data } = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 25,
  });

  let latestEnd: Date | null = null;

  for (const ev of data.items ?? []) {
    if (ev.status === 'cancelled') continue;
    if (ev.transparency === 'transparent') continue; // marked free
    if (!ev.start?.dateTime || !ev.end?.dateTime) continue; // skip all-day

    const myAttendee = ev.attendees?.find((a) => a.self);
    if (myAttendee?.responseStatus === 'declined') continue;

    const start = new Date(ev.start.dateTime);
    const end = new Date(ev.end.dateTime);
    if (start <= now && end > now) {
      if (!latestEnd || end > latestEnd) latestEnd = end;
    }
  }

  return latestEnd;
}
