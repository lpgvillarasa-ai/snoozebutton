// Shared between server (token storage) and client (sign-in). No deps.

export const GOOGLE_CALENDAR_SCOPE =
  'https://www.googleapis.com/auth/calendar.readonly';

export const GOOGLE_OAUTH_SCOPES =
  `openid email profile ${GOOGLE_CALENDAR_SCOPE}`;
