import { api } from '@/lib/api'
import type { UserProfile } from '@/schemas/user'

export function getMe() {
  return api.get<UserProfile>('/users/me')
}

export function updatePreferences(input: {
  quietHoursStartHour: number | null
  quietHoursEndHour: number | null
  timezone: string | null
}) {
  return api.patch<UserProfile>('/users/me', input)
}
