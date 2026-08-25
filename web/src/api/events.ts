import { api } from '@/lib/api'
import type { Event, EventType, UpcomingEvent } from '@/schemas/event'

export function listEventsForContact(contactId: string) {
  return api.get<Event[]>(`/events?contactId=${contactId}`)
}

export function listUpcomingEvents() {
  return api.get<UpcomingEvent[]>('/events/upcoming')
}

export function createEvent(input: {
  contactId: string
  type: EventType
  date: string
  recurrenceRule?: string
}) {
  return api.post<Event>('/events', input)
}

export function updateEvent(
  id: string,
  input: Partial<{ type: EventType; date: string; recurrenceRule: string | null }>,
) {
  return api.patch<Event>(`/events/${id}`, input)
}

export function deleteEvent(id: string) {
  return api.delete<void>(`/events/${id}`)
}
