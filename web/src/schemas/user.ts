import { z } from 'zod'

// Matches the "10 free" pitch in the signup page and Phase 4's planned
// free-tier cap — not yet enforced server-side (that lands in Phase 4).
export const FREE_CONTACT_LIMIT = 10

export interface UserProfile {
  id: string
  email: string
  name: string | null
  tier: 'FREE' | 'PAID'
  quietHoursStartHour: number | null
  quietHoursEndHour: number | null
  timezone: string | null
}

// Mirrors api/src/users/dto/update-preferences.dto.ts
export const preferencesFormSchema = z.object({
  quietHoursEnabled: z.boolean(),
  quietHoursStartHour: z.string(),
  quietHoursEndHour: z.string(),
  timezone: z.string().min(1, 'Timezone is required.'),
})
export type PreferencesFormInput = z.infer<typeof preferencesFormSchema>
