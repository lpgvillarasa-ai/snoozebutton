import 'server-only';
import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';
import type { NotificationSubscriptionRow } from '@/types/database';

let configured = false;

function configure() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  if (!pub || !priv) return; // push disabled
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export interface AvailableNotification {
  title: string;
  body: string;
  url?: string;
}

export async function notifyAllAvailable(payload: AvailableNotification) {
  configure();
  if (!configured) return { sent: 0, removed: 0, skipped: true };

  const supabase = createAdminClient();
  const { data: subs, error } = await supabase
    .from('notification_subscriptions')
    .select('id, subscription_data')
    .returns<Pick<NotificationSubscriptionRow, 'id' | 'subscription_data'>[]>();

  if (error || !subs?.length) return { sent: 0, removed: 0, skipped: false };

  const body = JSON.stringify(payload);
  const stale: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription_data as webpush.PushSubscription, body);
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) stale.push(s.id);
      }
    }),
  );

  if (stale.length) {
    await supabase.from('notification_subscriptions').delete().in('id', stale);
  }

  return { sent, removed: stale.length, skipped: false };
}
