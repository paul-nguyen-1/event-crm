import { api } from '@/lib/api'
import type { SavedGift } from '@/schemas/gift-idea'

export function listGiftIdeas(contactId: string) {
  return api.get<SavedGift[]>(`/gift-ideas?contactId=${contactId}`)
}

export function createGiftIdea(input: {
  contactId: string
  url: string
  name: string
  basePrice: number
  imageUrl?: string
}) {
  return api.post<SavedGift>('/gift-ideas', input)
}

export function deleteGiftIdea(id: string) {
  return api.delete<void>(`/gift-ideas/${id}`)
}
