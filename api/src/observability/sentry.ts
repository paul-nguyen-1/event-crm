import * as Sentry from '@sentry/node';

/** No-ops until SENTRY_DSN is set — same "inert until configured" pattern as RESEND_API_KEY. */
export function initSentry() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

export function captureException(err: unknown) {
  Sentry.captureException(err);
}
