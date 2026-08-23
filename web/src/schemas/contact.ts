import { z } from 'zod'

// Mirrors api/src/contacts/dto/create-contact.dto.ts
export const contactSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  relationshipType: z.string().optional(),
  notes: z.string().optional(),
})
export type ContactInput = z.infer<typeof contactSchema>

export interface Contact {
  id: string
  userId: string
  name: string
  relationshipType: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}
