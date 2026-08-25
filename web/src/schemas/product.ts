export interface Product {
  id: string
  name: string
  tags: string[]
  imageUrl: string | null
  basePrice: string
  network: 'AMAZON'
  externalId: string
}
