import { z } from 'zod'

export const EVENT_TYPES = [
  'BIRTHDAY',
  'ANNIVERSARY',
  'WEDDING',
  'CUSTOM',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  BIRTHDAY: 'Birthday',
  ANNIVERSARY: 'Anniversary',
  WEDDING: 'Wedding',
  CUSTOM: 'Custom',
}

// Mirrors api/src/events/dto/create-event.dto.ts (contactId is supplied separately, not part of the form)
export const eventFormSchema = z.object({
  type: z.enum(EVENT_TYPES),
  date: z.string().min(1, 'Date is required.'),
  recurrenceRule: z.enum(['YEARLY', 'ONCE']),
  leadTimeDays: z.enum(['7', '3', '14', 'NONE']),
})
export type EventFormInput = z.infer<typeof eventFormSchema>

export interface Event {
  id: string
  contactId: string
  type: EventType
  date: string
  recurrenceRule: string | null
  createdAt: string
  updatedAt: string
  reminders?: Reminder[]
}

export interface Reminder {
  id: string
  eventId: string
  leadTimeDays: number
  channel: 'EMAIL' | 'IN_APP'
  sentStatus: boolean
  createdAt: string
}
