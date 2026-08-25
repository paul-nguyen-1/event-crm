import { api } from '@/lib/api'

export function resolveAffiliateLink(productId: string, contactId?: string) {
  const query = contactId ? `?contactId=${contactId}` : ''
  return api.get<{ url: string }>(`/links/${productId}/click${query}`)
}
