import { useQuery, useMutation } from '@tanstack/react-query'
import { Gift, ExternalLink } from 'lucide-react'
import * as suggestionsApi from '@/api/suggestions'
import * as linksApi from '@/api/links'
import { Button } from '@/components/ui/button'

interface SuggestionPanelProps {
  contactId: string
}

export function SuggestionPanel({ contactId }: SuggestionPanelProps) {
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['contacts', contactId, 'suggestions'],
    queryFn: () => suggestionsApi.getSuggestions(contactId),
  })

  const clickMutation = useMutation({
    mutationFn: async ({
      productId,
      newTab,
    }: {
      productId: string
      newTab: Window | null
    }) => {
      try {
        const { url } = await linksApi.resolveAffiliateLink(productId, contactId)
        if (newTab) newTab.location.href = url
      } catch (err) {
        newTab?.close()
        throw err
      }
    },
  })

  function handleBuyClick(productId: string) {
    // Opened synchronously, in direct response to the click, then navigated
    // once the (authenticated) click-logging call resolves — a same-tick
    // window.open() is what keeps popup blockers from stepping in; doing it
    // in the mutation's async onSuccess instead would fall outside the
    // click gesture and get blocked in some browsers. `opener` is severed
    // immediately to avoid a reverse-tabnabbing window back into this app.
    const newTab = window.open('', '_blank')
    if (newTab) newTab.opener = null
    clickMutation.mutate({ productId, newTab })
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading gift ideas…</p>
  }

  if (!suggestions || suggestions.length === 0) return null

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Gift className="size-4 text-primary" />
        <h3 className="m-0">Gift ideas</h3>
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
            <Button
              size="sm"
              variant="outline"
              className="mt-auto"
              disabled={clickMutation.isPending}
              onClick={() => handleBuyClick(product.id)}
            >
              Buy <ExternalLink className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
