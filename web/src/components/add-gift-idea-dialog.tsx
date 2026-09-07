import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import * as giftIdeasApi from '@/api/gift-ideas'
import { giftIdeaFormSchema, type GiftIdeaFormInput } from '@/schemas/gift-idea'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AddGiftIdeaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
}

export function AddGiftIdeaDialog({ open, onOpenChange, contactId }: AddGiftIdeaDialogProps) {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GiftIdeaFormInput>({ resolver: zodResolver(giftIdeaFormSchema) })

  useEffect(() => {
    if (open) {
      reset({ url: '', name: '', basePrice: '', imageUrl: '' })
      setServerError(null)
    }
  }, [open, reset])

  async function onSubmit(input: GiftIdeaFormInput) {
    setServerError(null)
    try {
      await giftIdeasApi.createGiftIdea({
        contactId,
        url: input.url,
        name: input.name,
        basePrice: Number(input.basePrice),
        imageUrl: input.imageUrl || undefined,
      })
      queryClient.invalidateQueries({ queryKey: ['contacts', contactId, 'suggestions'] })
      onOpenChange(false)
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a gift idea</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gi-url">
              Amazon link <span className="text-muted-foreground">(required)</span>
            </Label>
            <Input
              id="gi-url"
              placeholder="https://www.amazon.com/dp/..."
              {...register('url')}
            />
            {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gi-name">
              Name <span className="text-muted-foreground">(required)</span>
            </Label>
            <Input id="gi-name" placeholder="Baratza Encore grinder" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gi-price">
              Price <span className="text-muted-foreground">(required)</span>
            </Label>
            <Input id="gi-price" type="number" step="0.01" min="0" placeholder="179.95" {...register('basePrice')} />
            {errors.basePrice && (
              <p className="text-xs text-destructive">{errors.basePrice.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gi-image">Image URL (optional)</Label>
            <Input id="gi-image" placeholder="https://…" {...register('imageUrl')} />
            {errors.imageUrl && (
              <p className="text-xs text-destructive">{errors.imageUrl.message}</p>
            )}
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Add gift idea
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
