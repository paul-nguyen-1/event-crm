import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Gift, ExternalLink, ImageOff, Plus } from 'lucide-react'
import * as suggestionsApi from '@/api/suggestions'
import { AddGiftIdeaDialog } from '@/components/add-gift-idea-dialog'
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
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['contacts', contactId, 'suggestions'],
    queryFn: () => suggestionsApi.getSuggestions(contactId),
  })

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Gift className="size-4 text-primary" />
        <h3 className="m-0">{title}</h3>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label="Add a gift idea"
          title="Add a gift idea"
          onClick={() => setAddDialogOpen(true)}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading gift ideas…</p>}

      {suggestions && suggestions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No gift ideas yet — add one from an Amazon link.
        </p>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {suggestions.map((product) => (
            <div
              key={product.id}
              className="flex flex-col gap-2 rounded-md border border-border p-3"
            >
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt=""
                  className="aspect-square w-full rounded-sm object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-border text-muted-foreground">
                  <ImageOff className="size-5" />
                  <span className="text-[11px]">No image available</span>
                </div>
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
      )}

      <AddGiftIdeaDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        contactId={contactId}
      />
    </div>
  )
}
