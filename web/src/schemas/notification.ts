// Mirrors the flat envelope the outbox relay publishes (api/src/outbox/outbox-relay.service.ts)
// and that the Go notification-service forwards verbatim over WebSocket/SSE.
export interface ReminderNotification {
  eventId: string
  type: string
  userId: string
  reminderId: string
  title: string
  body: string
  deepLink: string
  channel: 'EMAIL' | 'IN_APP'
  occurredAt: string
  schemaVersion: number
}
