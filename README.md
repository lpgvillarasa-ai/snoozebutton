# Boss Availability

A premium, mobile-first PWA that shows the boss's real-time availability to the team.

- One-tap status control for the boss (Available / Unavailable / Snooze 15m / 30m / 1h / Custom)
- Google Calendar integration: automatic "In a meeting" while events are active, with **no event titles, guests, or descriptions exposed**
- Real-time updates via Supabase Realtime — viewers never refresh
- Web Push notifications when the boss flips back to Available
- Installable PWA with dark mode

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres, Auth, Realtime, RLS) · Google Calendar API · Web Push (VAPID) · Vercel (Cron)

---

## 1. Local setup

```bash
git clone <this repo>
cd snoozebutton
npm install
cp .env.example .env.local
# Fill in the values (see below)
npm run dev
```

The app is at http://localhost:3000.

---

## 2. Supabase

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor** and run the contents of [`supabase/schema.sql`](supabase/schema.sql).
   This creates tables, enums, RLS policies, the `handle_new_user` trigger, and adds `availability_status` to the realtime publication.
3. Copy these into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API → `anon` `public`)
   - `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → `service_role` — **server-only**)

> **Don't** ship the service role key to the browser. It is only read in API routes.

---

## 3. Google OAuth + Calendar

We use Supabase Auth's Google provider, but add the Calendar read-only scope so the boss sign-in returns a Google `provider_token` we can use server-side.

1. Go to <https://console.cloud.google.com/apis/credentials>.
2. **OAuth consent screen** → External → fill the basics → add scope `https://www.googleapis.com/auth/calendar.readonly` → add the boss's email under **Test users** (until you publish).
3. **Create credentials → OAuth client ID → Web application**.
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - your Vercel URL (e.g. `https://boss-availability.vercel.app`)
   - Authorized redirect URIs:
     - `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
4. In **Supabase Dashboard → Authentication → Providers → Google**:
   - Enable Google.
   - Paste the Client ID and Client Secret.
5. Set both in `.env.local` as well (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) — used by `googleapis` for token refresh.
6. Set `BOSS_EMAILS=boss@example.com` to the boss's Google email. Anyone in this list becomes a `boss` on first sign-in.

The login button requests `access_type=offline&prompt=consent` so we receive a refresh token. The boss's tokens are stored server-side in `google_calendar_tokens` and never exposed to the client.

---

## 4. Web Push (VAPID)

```bash
npm run vapid:generate
```

Copy the printed `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` into `.env.local`. Set `VAPID_SUBJECT=mailto:you@example.com`.

If you skip this, push is silently disabled — the rest of the app still works.

---

## 5. Cron (Vercel)

[`vercel.json`](vercel.json) registers `*/2 * * * *` → `/api/cron/sync-calendar`. Vercel Cron requires the **Pro** plan for sub-daily schedules; on Hobby use a free external pinger (e.g. cron-job.org) hitting `/api/cron/sync-calendar?secret=$CRON_SECRET` every 1–2 min.

`CRON_SECRET` protects the endpoint. Vercel automatically passes it as `Authorization: Bearer $CRON_SECRET` for cron-triggered invocations.

---

## 6. Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add **all** env vars from `.env.example` to the Vercel project settings (set scope to Production + Preview + Development).
4. Update `NEXT_PUBLIC_APP_URL` to your Vercel URL.
5. Add the Vercel URL to:
   - Google OAuth → Authorized JavaScript origins
   - Supabase → Authentication → URL Configuration → Site URL + Redirect URLs (`https://YOUR-DOMAIN/auth/callback`)
6. Deploy.

---

## 7. Status logic

`src/lib/status.ts` — the single source of truth.

Priority (highest wins):

1. `calendar_busy_until > now` → **In a meeting** (calendar busy is sticky per spec)
2. `manual_override = 'unavailable'` → **Unavailable**
3. `snooze_until > now` → **Snoozed**
4. otherwise → **Available**

Boss buttons:

| Button            | Effect                                                          |
| ----------------- | --------------------------------------------------------------- |
| Available now     | `manual_override='available'`, clears snooze                    |
| Unavailable now   | `manual_override='unavailable'`, clears snooze                  |
| Snooze 15/30/60m  | `snooze_until=now+N`, sets `manual_override='available'` so it falls back to Available |

When the resolved status flips to `available`, every push subscription receives one notification.

---

## 8. App routes

| Route        | Who         | Purpose                                                     |
| ------------ | ----------- | ----------------------------------------------------------- |
| `/login`     | anyone      | Google sign-in (requests Calendar scope)                    |
| `/auth/callback` | anyone  | Handles OAuth code; stores boss's Calendar tokens           |
| `/dashboard` | signed in   | Live read-only status                                       |
| `/admin`     | boss only   | Status control panel                                        |
| `/settings`  | signed in   | Theme, push, sign out · (boss) connect calendar, sync, team |

API:

```
POST /api/status              boss: set manual_override / clear snooze
POST /api/snooze              boss: snooze for N minutes
POST /api/calendar/sync       boss: pull calendar now
GET  /api/cron/sync-calendar  cron: pull every boss's calendar
POST /api/push/subscribe      any: register push subscription
DELETE /api/push/subscribe    any: unregister
```

---

## 9. Privacy

- Event titles, descriptions, guests, and locations are **never** sent to any client.
- Only the **end time** of the current event leaves the server, and only as `calendar_busy_until`.
- `google_calendar_tokens` has no RLS read policy — only the service role (server) can touch it.

---

## 10. Wrapping as a native app (later)

The PWA is the source of truth. To ship to iOS / Play Store:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "Boss Availability" com.example.bossavailability
# Build a static export OR point Capacitor at your hosted URL via:
#   server: { url: 'https://YOUR-DOMAIN', cleartext: false }
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios     # requires Xcode
npx cap open android # requires Android Studio
```

Notes:

- For Capacitor, swap Web Push for `@capacitor/push-notifications` (APNs / FCM) and add a small native bridge instead of `/api/push/subscribe`.
- Google sign-in inside a WebView requires `@capacitor/browser` or the Google Sign-In plugin to satisfy Google's policy.
- All UI, state, and business logic stay identical — only the auth + push transports change.

---

## 11. File map

```
supabase/schema.sql
src/
  app/
    layout.tsx  page.tsx  globals.css
    login/page.tsx
    auth/callback/route.ts
    dashboard/page.tsx
    admin/page.tsx
    settings/page.tsx
    api/
      status/route.ts
      snooze/route.ts
      calendar/sync/route.ts
      cron/sync-calendar/route.ts
      push/subscribe/route.ts
  components/
    StatusBadge.tsx  StatusDisplay.tsx  RealtimeStatus.tsx
    AdminControls.tsx  CustomSnoozeModal.tsx
    BottomNav.tsx  ThemeToggle.tsx  PWAInstaller.tsx
    LoginButton.tsx  Settings.tsx
  lib/
    boss.ts  push.ts  status.ts  time.ts
    google/calendar.ts
    supabase/{client,server,admin,middleware}.ts
  types/database.ts
  middleware.ts
public/
  manifest.webmanifest  sw.js
  icons/{icon-192,icon-512,icon-maskable}.svg
```
