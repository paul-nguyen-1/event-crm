import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import * as giftsApi from '@/api/gifts'
import { giftFormSchema, type GiftFormInput } from '@/schemas/gift'
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

interface GiftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactName: string
  initial?: { occasion?: string; giftDate?: string }
}

export function GiftDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  initial,
}: GiftDialogProps) {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GiftFormInput>({ resolver: zodResolver(giftFormSchema) })

  useEffect(() => {
    if (!open) return
    reset({
      occasion: initial?.occasion ?? '',
      giftDate: initial?.giftDate ?? new Date().toISOString().slice(0, 10),
      description: '',
      cost: '',
    })
    setServerError(null)
  }, [open, initial, reset])

  async function onSubmit(input: GiftFormInput) {
    setServerError(null)
    try {
      const dollars = Number(input.cost)
      await giftsApi.createGift({
        contactId,
        occasion: input.occasion,
        giftDate: input.giftDate,
        description: input.description,
        costCents: input.cost && !Number.isNaN(dollars) ? Math.round(dollars * 100) : undefined,
      })
      queryClient.invalidateQueries({ queryKey: ['gifts'] })
      onOpenChange(false)
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a gift — {contactName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-occasion">
                Occasion <span className="text-muted-foreground">(required)</span>
              </Label>
              <Input id="g-occasion" placeholder="Birthday" {...register('occasion')} />
              {errors.occasion && (
                <p className="text-xs text-destructive">{errors.occasion.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-date">
                Date <span className="text-muted-foreground">(required)</span>
              </Label>
              <Input id="g-date" type="date" {...register('giftDate')} />
              {errors.giftDate && (
                <p className="text-xs text-destructive">{errors.giftDate.message}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="g-desc">
              Gift <span className="text-muted-foreground">(required)</span>
            </Label>
            <Input id="g-desc" placeholder="Candle set" {...register('description')} />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="g-cost">Cost (optional)</Label>
            <Input id="g-cost" type="number" step="0.01" min="0" placeholder="42" {...register('cost')} />
          </div>
          <p className="text-xs text-muted-foreground">
            Kept so you don&apos;t repeat yourself. Only you can see it.
          </p>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Save gift
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
