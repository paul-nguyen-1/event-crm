import { z } from 'zod'

export const GIFT_STATUSES = ['PENDING', 'BOUGHT', 'REFUNDED', 'CANCELLED'] as const
export type GiftStatus = (typeof GIFT_STATUSES)[number]

export const GIFT_STATUS_LABELS: Record<GiftStatus, string> = {
  PENDING: 'Pending',
  BOUGHT: 'Bought',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
}

// Mirrors api/src/gifts/dto/create-gift.dto.ts
export const giftFormSchema = z.object({
  occasion: z.string().min(1, 'Occasion is required.'),
  giftDate: z.string().min(1, 'Date is required.'),
  description: z.string().min(1, 'Description is required.'),
  cost: z.string().optional(),
  status: z.enum(GIFT_STATUSES),
})
export type GiftFormInput = z.infer<typeof giftFormSchema>

export interface Gift {
  id: string
  contactId: string
  occasion: string
  giftDate: string
  description: string
  costCents: number | null
  status: GiftStatus
  createdAt: string
}
