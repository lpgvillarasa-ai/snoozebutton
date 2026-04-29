import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Body {
  subscription: PushSubscriptionJSON;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { subscription } = (await request.json().catch(() => ({}))) as Body;
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 });
  }

  const { error } = await supabase
    .from('notification_subscriptions')
    .upsert(
      { user_id: user.id, subscription_data: subscription },
      { onConflict: 'endpoint' },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { subscription } = (await request.json().catch(() => ({}))) as Body;
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 });
  }

  await supabase
    .from('notification_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', subscription.endpoint);

  return NextResponse.json({ ok: true });
}
