import { api } from '@/lib/api'
import type { Gift, GiftStatus } from '@/schemas/gift'

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
  status?: GiftStatus
}) {
  return api.post<Gift>('/gifts', input)
}

export function updateGiftStatus(id: string, status: GiftStatus) {
  return api.patch<Gift>(`/gifts/${id}`, { status })
}

export function deleteGift(id: string) {
  return api.delete<void>(`/gifts/${id}`)
}
