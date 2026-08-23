import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as contactsApi from '@/api/contacts'
import { contactSchema, type Contact, type ContactInput } from '@/schemas/contact'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: Contact
  onSaved?: (contact: Contact) => void
}

export function ContactDialog({
  open,
  onOpenChange,
  contact,
  onSaved,
}: ContactDialogProps) {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const isEdit = Boolean(contact)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactInput>({ resolver: zodResolver(contactSchema) })

  useEffect(() => {
    if (open) {
      reset({
        name: contact?.name ?? '',
        relationshipType: contact?.relationshipType ?? '',
        notes: contact?.notes ?? '',
      })
      setServerError(null)
    }
  }, [open, contact, reset])

  const mutation = useMutation({
    mutationFn: (input: ContactInput) =>
      isEdit
        ? contactsApi.updateContact(contact!.id, input)
        : contactsApi.createContact(input),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['contacts', saved.id] })
      onSaved?.(saved)
      onOpenChange(false)
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong.')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit person' : 'Add a person'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((input) => mutation.mutate(input))}
          className="flex flex-col gap-3"
        >
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-name">
              Name <span className="text-muted-foreground">(required)</span>
            </Label>
            <Input id="c-name" {...register('name')} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-rel">Relationship</Label>
            <Input
              id="c-rel"
              placeholder="Sister, colleague, friend…"
              {...register('relationshipType')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-notes">Notes</Label>
            <Textarea id="c-notes" rows={3} {...register('notes')} />
          </div>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {isEdit ? 'Save changes' : 'Add person'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
