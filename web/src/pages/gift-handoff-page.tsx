import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { ImageOff } from 'lucide-react'
import * as productsApi from '@/api/products'
import * as contactsApi from '@/api/contacts'
import * as linksApi from '@/api/links'
import * as giftsApi from '@/api/gifts'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

export function GiftHandoffPage() {
  const { productId } = useParams<{ productId: string }>()
  const [searchParams] = useSearchParams()
  const contactId = searchParams.get('contactId') ?? undefined
  const occasion = searchParams.get('occasion') || 'Gift'
  const [savedGiftId, setSavedGiftId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: product, isLoading } = useQuery({
    queryKey: ['products', productId],
    queryFn: () => productsApi.getProduct(productId!),
    enabled: Boolean(productId),
  })

  const { data: contact } = useQuery({
    queryKey: ['contacts', contactId],
    queryFn: () => contactsApi.getContact(contactId!),
    enabled: Boolean(contactId),
  })

  const logGiftMutation = useMutation({
    mutationFn: () =>
      giftsApi.createGift({
        contactId: contactId!,
        occasion,
        giftDate: new Date().toISOString().slice(0, 10),
        description: product!.name,
        costCents: Math.round(Number(product!.basePrice) * 100),
        // Checking this box just means "this is the plan" — not proof the
        // Amazon order was actually completed — so it starts pending. The
        // ledger's status can be flipped to Bought once it actually is.
        status: 'PENDING',
      }),
    onSuccess: (gift) => setSavedGiftId(gift.id),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong.'),
  })

  const unmarkGiftMutation = useMutation({
    mutationFn: () => giftsApi.deleteGift(savedGiftId!),
    onSuccess: () => setSavedGiftId(null),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong.'),
  })

  const clickMutation = useMutation({
    mutationFn: async (newTab: Window | null) => {
      try {
        const { url } = await linksApi.resolveAffiliateLink(productId!, contactId)
        if (newTab) newTab.location.href = url
      } catch (err) {
        newTab?.close()
        throw err
      }
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong.'),
  })

  function handleContinue() {
    // Same popup-blocker-safe pattern as the suggestion panel: open
    // synchronously in the click handler, navigate once the (authenticated)
    // click-logging call resolves.
    const newTab = window.open('', '_blank')
    if (newTab) newTab.opener = null
    clickMutation.mutate(newTab)
  }

  const backLink = contactId ? `/contacts/${contactId}` : '/dashboard'

  if (isLoading) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
  }

  if (!product) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Product not found.</p>
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-8 flex items-baseline gap-1.5">
        <span className="font-heading text-lg font-semibold tracking-wide">OCCASION</span>
        <span className="font-mono text-[9px] text-primary">+</span>
      </div>

      <div className="w-full max-w-sm">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            className="mx-auto mb-5 aspect-square w-40 rounded-md object-cover"
          />
        ) : (
          <div className="mx-auto mb-5 flex aspect-square w-40 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-muted-foreground">
            <ImageOff className="size-6" />
            <span className="text-xs">No image available</span>
          </div>
        )}

        <h1 className="mb-2 text-2xl">Opening Amazon</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          {product.name}, ${product.basePrice}. You&apos;ll check out on Amazon — Occasion
          isn&apos;t handling the purchase or your card.
        </p>

        {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

        <Button
          className="w-full"
          onClick={handleContinue}
          disabled={clickMutation.isPending}
        >
          Continue to Amazon
        </Button>

        {contact && (
          <label className="mt-5 flex items-center justify-center gap-2 text-sm">
            <Checkbox
              checked={savedGiftId !== null}
              disabled={logGiftMutation.isPending || unmarkGiftMutation.isPending}
              onCheckedChange={(checked) =>
                checked ? logGiftMutation.mutate() : unmarkGiftMutation.mutate()
              }
            />
            Mark this as the gift I gave {contact.name}
          </label>
        )}

        <p className="mt-5 text-xs text-muted-foreground">Commission disclosed</p>
        <Link
          to={backLink}
          className="mt-2 inline-block text-xs text-muted-foreground no-underline hover:underline"
        >
          ← Back
        </Link>
      </div>
    </div>
  )
}
