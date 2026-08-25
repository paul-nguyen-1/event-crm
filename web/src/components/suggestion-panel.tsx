import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Gift, ExternalLink } from 'lucide-react'
import * as suggestionsApi from '@/api/suggestions'
import { Button } from '@/components/ui/button'

interface SuggestionPanelProps {
  contactId: string
  title?: string
  occasionLabel?: string
}

export function SuggestionPanel({
  contactId,
  title = 'Gift ideas',
  occasionLabel,
}: SuggestionPanelProps) {
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['contacts', contactId, 'suggestions'],
    queryFn: () => suggestionsApi.getSuggestions(contactId),
  })

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading gift ideas…</p>
  }

  if (!suggestions || suggestions.length === 0) return null

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Gift className="size-4 text-primary" />
        <h3 className="m-0">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {suggestions.map((product) => (
          <div
            key={product.id}
            className="flex flex-col gap-2 rounded-md border border-border p-3"
          >
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt=""
                className="aspect-square w-full rounded-sm object-cover"
              />
            )}
            <p className="m-0 line-clamp-2 text-sm font-medium">{product.name}</p>
            <p className="m-0 text-xs text-muted-foreground">
              ${product.basePrice}
            </p>
            <Button size="sm" variant="outline" className="mt-auto" asChild>
              <Link
                to={`/gift/${product.id}?contactId=${contactId}&occasion=${encodeURIComponent(occasionLabel ?? 'Gift')}`}
              >
                Buy <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
