import { api } from '@/lib/api'
import type { Product } from '@/schemas/product'

export function getSuggestions(contactId: string) {
  return api.get<Product[]>(`/contacts/${contactId}/suggestions`)
}
