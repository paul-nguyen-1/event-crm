import { z } from 'zod'

// Mirrors api/src/gift-ideas/dto/create-gift-idea.dto.ts
export const giftIdeaFormSchema = z.object({
  url: z.string().url('Enter a valid Amazon product link.'),
  name: z.string().min(1, 'Name is required.'),
  basePrice: z
    .string()
    .min(1, 'Price is required.')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, 'Enter a valid price.'),
  imageUrl: z.string().url('Enter a valid image URL.').optional().or(z.literal('')),
})
export type GiftIdeaFormInput = z.infer<typeof giftIdeaFormSchema>

export interface SavedGift {
  id: string
  contactId: string
  productId: string
  createdAt: string
  product: {
    id: string
    name: string
    tags: string[]
    imageUrl: string | null
    basePrice: string
    network: 'AMAZON'
    externalId: string
  }
}
