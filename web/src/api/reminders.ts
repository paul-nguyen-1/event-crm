import { api } from '@/lib/api'
import type { Reminder } from '@/schemas/event'

export function listRemindersForEvent(eventId: string) {
  return api.get<Reminder[]>(`/reminders?eventId=${eventId}`)
}

export function createReminder(input: {
  eventId: string
  leadTimeDays: number
  channel: 'EMAIL' | 'IN_APP'
}) {
  return api.post<Reminder>('/reminders', input)
}

export function deleteReminder(id: string) {
  return api.delete<void>(`/reminders/${id}`)
}
