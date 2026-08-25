import { api } from '@/lib/api'
import type { Gift } from '@/schemas/gift'

export function listGifts(contactId?: string) {
  const query = contactId ? `?contactId=${contactId}` : ''
  return api.get<Gift[]>(`/gifts${query}`)
}

export function createGift(input: {
  contactId: string
  occasion: string
  giftDate: string
  description: string
  costCents?: number
}) {
  return api.post<Gift>('/gifts', input)
}

export function deleteGift(id: string) {
  return api.delete<void>(`/gifts/${id}`)
}
