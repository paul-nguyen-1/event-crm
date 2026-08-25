import { api } from '@/lib/api'
import type { Product } from '@/schemas/product'

export function getProduct(id: string) {
  return api.get<Product>(`/products/${id}`)
}
