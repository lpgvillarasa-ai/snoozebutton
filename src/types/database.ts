// Hand-written, minimal Database types for Supabase.
// Regenerate with: supabase gen types typescript --project-id <id>

export type UserRole = 'boss' | 'admin' | 'viewer';

export type EffectiveStatus =
  | 'available'
  | 'unavailable'
  | 'snoozed'
  | 'calendar_busy';

export type ManualOverrideKind = 'available' | 'unavailable';

export interface UserRow {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface AvailabilityStatusRow {
  id: string;
  boss_user_id: string;
  current_status: EffectiveStatus;
  status_message: string | null;
  snooze_until: string | null;       // ISO
  calendar_busy_until: string | null; // ISO
  manual_override: ManualOverrideKind | null;
  updated_at: string;
}

export interface NotificationSubscriptionRow {
  id: string;
  user_id: string;
  subscription_data: PushSubscriptionJSON;
  endpoint: string;
  created_at: string;
}

export interface GoogleCalendarTokensRow {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expiry_date: number | null;
  scope: string | null;
  updated_at: string;
}

export interface ResolvedStatus {
  status: EffectiveStatus;
  message: string;
  /** ISO timestamp when this state ends, if known. */
  until: string | null;
}

// ---- Supabase Database<> generic shape ----
//
// `@supabase/supabase-js` requires `Tables` entries to declare Row/Insert/Update
// AND `Relationships`, plus the public schema must declare `Views`, `Functions`,
// `Enums`, and `CompositeTypes` — even when empty — or the typed client falls
// back to `never` for query results.

type TableShape<R> = {
  Row: R;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      users: TableShape<UserRow>;
      availability_status: TableShape<AvailabilityStatusRow>;
      notification_subscriptions: TableShape<NotificationSubscriptionRow>;
      google_calendar_tokens: TableShape<GoogleCalendarTokensRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      effective_status: EffectiveStatus;
      manual_override_kind: ManualOverrideKind;
    };
    CompositeTypes: Record<string, never>;
  };
}

// Browser-friendly redeclaration of PushSubscriptionJSON (matches DOM type).
export interface PushSubscriptionJSON {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: { p256dh?: string; auth?: string };
}
