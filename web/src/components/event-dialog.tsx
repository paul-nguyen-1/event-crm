import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as eventsApi from '@/api/events'
import * as remindersApi from '@/api/reminders'
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  eventFormSchema,
  type Event,
  type EventFormInput,
} from '@/schemas/event'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactName: string
  event?: Event
}

const REMIND_OPTIONS = [
  { value: '7', label: '7 days before' },
  { value: '3', label: '3 days before' },
  { value: '14', label: '14 days before' },
  { value: 'NONE', label: "Don't remind me" },
] as const

export function EventDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  event,
}: EventDialogProps) {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const isEdit = Boolean(event)

  const { data: existingReminders } = useQuery({
    queryKey: ['reminders', event?.id],
    queryFn: () => remindersApi.listRemindersForEvent(event!.id),
    enabled: open && isEdit,
  })
  const existingReminder = existingReminders?.[0]

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EventFormInput>({ resolver: zodResolver(eventFormSchema) })

  const wantsReminder = watch('leadTimeDays') !== 'NONE'

  useEffect(() => {
    if (!open) return
    if (isEdit && existingReminders === undefined) return
    reset({
      type: event?.type ?? 'BIRTHDAY',
      date: event?.date ? event.date.slice(0, 10) : '',
      recurrenceRule: event?.recurrenceRule === 'YEARLY' ? 'YEARLY' : 'ONCE',
      leadTimeDays: existingReminder ? (String(existingReminder.leadTimeDays) as '7' | '3' | '14') : '7',
      channel: existingReminder?.channel ?? 'EMAIL',
      note: event?.note ?? '',
    })
    setServerError(null)
  }, [open, event, existingReminders, existingReminder, isEdit, reset])

  async function onSubmit(input: EventFormInput) {
    setServerError(null)
    try {
      const payload = {
        type: input.type,
        date: input.date,
        recurrenceRule: input.recurrenceRule === 'YEARLY' ? 'YEARLY' : undefined,
        // Edit mode sends an explicit null to clear a note (an omitted key
        // leaves the existing value untouched); create just omits it.
        note: input.note || (isEdit ? null : undefined),
      }

      const savedEvent = isEdit
        ? await eventsApi.updateEvent(event!.id, payload)
        : await eventsApi.createEvent({ contactId, ...payload })

      const desiredLeadTime =
        input.leadTimeDays === 'NONE' ? null : Number(input.leadTimeDays)
      const reminderChanged =
        desiredLeadTime !== (existingReminder?.leadTimeDays ?? null) ||
        (desiredLeadTime !== null && input.channel !== existingReminder?.channel)
      if (reminderChanged) {
        if (existingReminder) await remindersApi.deleteReminder(existingReminder.id)
        if (desiredLeadTime !== null) {
          await remindersApi.createReminder({
            eventId: savedEvent.id,
            leadTimeDays: desiredLeadTime,
            channel: input.channel,
          })
        }
      }

      queryClient.invalidateQueries({ queryKey: ['events', contactId] })
      queryClient.invalidateQueries({ queryKey: ['reminders', savedEvent.id] })
      onOpenChange(false)
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit an occasion' : 'Add an occasion'} — {contactName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">Type</legend>
                <div
                  role="radiogroup"
                  className="inline-flex overflow-hidden rounded-md border border-border"
                >
                  {EVENT_TYPES.map((type, i) => (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={field.value === type}
                      onClick={() => field.onChange(type)}
                      className={`px-3 py-1.5 text-[13px] ${i > 0 ? 'border-l border-border' : ''} ${
                        field.value === type
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-foreground/5'
                      }`}
                    >
                      {EVENT_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-date">
                Date <span className="text-muted-foreground">(required)</span>
              </Label>
              <Input id="e-date" type="date" {...register('date')} />
              {errors.date && (
                <p className="text-xs text-destructive">{errors.date.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-repeats">Repeats</Label>
              <Controller
                control={control}
                name="recurrenceRule"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="e-repeats" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YEARLY">Every year</SelectItem>
                      <SelectItem value="ONCE">Once</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-remind">Remind me</Label>
            <Controller
              control={control}
              name="leadTimeDays"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="e-remind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMIND_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {!wantsReminder && (
              <p className="text-xs text-muted-foreground">
                SMS is not available yet.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="e-note">
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="e-note"
              rows={2}
              placeholder="Turning 34 — she mentioned wanting a grinder"
              {...register('note')}
            />
          </div>
          {wantsReminder && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="e-channel">Notify me by</Label>
              <Controller
                control={control}
                name="channel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="e-channel" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="IN_APP">In-app</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                In-app reminders show up as a live toast — keep this tab open to catch them.
              </p>
            </div>
          )}
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Save occasion
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
