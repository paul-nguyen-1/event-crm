import { z } from 'zod'

// Mirrors api/src/gifts/dto/create-gift.dto.ts
export const giftFormSchema = z.object({
  occasion: z.string().min(1, 'Occasion is required.'),
  giftDate: z.string().min(1, 'Date is required.'),
  description: z.string().min(1, 'Description is required.'),
  cost: z.string().optional(),
})
export type GiftFormInput = z.infer<typeof giftFormSchema>

export interface Gift {
  id: string
  contactId: string
  occasion: string
  giftDate: string
  description: string
  costCents: number | null
  createdAt: string
}
