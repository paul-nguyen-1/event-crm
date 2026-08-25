import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { Plus, X } from 'lucide-react'
import * as contactsApi from '@/api/contacts'
import * as eventsApi from '@/api/events'
import * as remindersApi from '@/api/reminders'
import * as giftsApi from '@/api/gifts'
import { ContactDialog } from '@/components/contact-dialog'
import { EventDialog } from '@/components/event-dialog'
import { GiftDialog } from '@/components/gift-dialog'
import { SuggestionPanel } from '@/components/suggestion-panel'
import { EVENT_TYPE_LABELS, type Event } from '@/schemas/event'
import { daysUntil, daysUntilLabel } from '@/lib/dates'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [eventDialogOpen, setEventDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | undefined>()
  const [giftDialogOpen, setGiftDialogOpen] = useState(false)

  const { data: contact, isLoading: contactLoading } = useQuery({
    queryKey: ['contacts', id],
    queryFn: () => contactsApi.getContact(id!),
    enabled: Boolean(id),
  })

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['events', id],
    queryFn: () => eventsApi.listEventsForContact(id!),
    enabled: Boolean(id),
  })

  const { data: upcoming } = useQuery({
    queryKey: ['events', 'upcoming'],
    queryFn: eventsApi.listUpcomingEvents,
  })

  const { data: gifts } = useQuery({
    queryKey: ['gifts', id],
    queryFn: () => giftsApi.listGifts(id!),
    enabled: Boolean(id),
  })

  const nextUp = useMemo(
    () => upcoming?.filter((e) => e.contact.id === id && daysUntil(e.nextOccurrence) >= 0)[0],
    [upcoming, id],
  )

  const deleteEventMutation = useMutation({
    mutationFn: eventsApi.deleteEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events', id] }),
  })

  const deleteContactMutation = useMutation({
    mutationFn: contactsApi.deleteContact,
    onSuccess: () => navigate('/contacts'),
  })

  if (contactLoading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>
  }

  if (!contact) {
    return <p className="p-6 text-sm text-muted-foreground">Contact not found.</p>
  }

  return (
    <div className="p-6">
      <Link to="/contacts" className="text-xs text-muted-foreground no-underline">
        ← People
      </Link>

      <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-6">
          <div>
            <div className="mb-1 flex items-start justify-between gap-2">
              <h2 className="m-0">{contact.name}</h2>
              <Button variant="ghost" size="sm" onClick={() => setContactDialogOpen(true)}>
                Edit
              </Button>
            </div>
            <p className="m-0 text-xs text-muted-foreground">
              {contact.relationshipType || 'Contact'} · added{' '}
              {new Date(contact.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>

          <div>
            <div className="mb-2 text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
              Tracked dates
            </div>
            {eventsLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            <div className="flex flex-col">
              {events?.map((event) => (
                <div
                  key={event.id}
                  className="group flex items-start gap-1 border-b border-border py-2 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEvent(event)
                      setEventDialogOpen(true)
                    }}
                    className="flex flex-1 flex-col gap-0.5 text-left hover:opacity-70"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span>{EVENT_TYPE_LABELS[event.type]}</span>
                      <span className="font-mono text-primary">
                        {new Date(event.date).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          timeZone: 'UTC',
                        })}
                      </span>
                    </div>
                    {event.note && (
                      <span className="text-xs text-muted-foreground">{event.note}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${EVENT_TYPE_LABELS[event.type]}`}
                    onClick={() => {
                      if (confirm('Remove this occasion?')) {
                        deleteEventMutation.mutate(event.id)
                      }
                    }}
                    className="mt-0.5 shrink-0 cursor-pointer border-none bg-transparent p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingEvent(undefined)
                setEventDialogOpen(true)
              }}
              className="mt-2 cursor-pointer border-none bg-transparent p-0 text-sm text-primary underline-offset-4 hover:underline"
            >
              + Add a date
            </button>
          </div>

          <div>
            <div className="mb-2 text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
              Notes
            </div>
            <p className="m-0 text-sm text-muted-foreground">
              {contact.notes || 'No notes yet.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {nextUp && (
            <div className="rounded-md border border-border p-4">
              <div className="mb-1 text-[10px] tracking-[0.1em] text-primary uppercase">
                Next up · {daysUntilLabel(nextUp.nextOccurrence)}
              </div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <h3 className="m-0">
                  {EVENT_TYPE_LABELS[nextUp.type]},{' '}
                  {new Date(nextUp.nextOccurrence).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'long',
                    timeZone: 'UTC',
                  })}
                </h3>
                <Button
                  onClick={() =>
                    setGiftDialogOpen(true)
                  }
                >
                  Plan the gift
                </Button>
              </div>
              <ReminderStatus eventId={nextUp.id} />
            </div>
          )}

          <div>
            <div className="mb-3 flex items-center gap-3">
              <h3 className="m-0">Gift ledger</h3>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => setGiftDialogOpen(true)}
              >
                <Plus className="size-4" />
                Log a gift
              </Button>
            </div>
            {gifts && gifts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead>Occasion</TableHead>
                    <TableHead>Gift</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gifts.map((gift) => (
                    <TableRow key={gift.id}>
                      <TableCell className="font-mono">
                        {new Date(gift.giftDate).getUTCFullYear()}
                      </TableCell>
                      <TableCell>{gift.occasion}</TableCell>
                      <TableCell>{gift.description}</TableCell>
                      <TableCell className="text-right font-mono">
                        {gift.costCents != null ? `$${(gift.costCents / 100).toFixed(0)}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No gifts logged yet.</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Kept so you don&apos;t repeat yourself. Only you can see it.
            </p>
          </div>

          <SuggestionPanel
            contactId={contact.id}
            occasionLabel={nextUp ? EVENT_TYPE_LABELS[nextUp.type] : undefined}
          />

          <div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm(`Remove ${contact.name}? This also removes their tracked dates.`)) {
                  deleteContactMutation.mutate(contact.id)
                }
              }}
            >
              Remove {contact.name}
            </Button>
          </div>
        </div>
      </div>

      <ContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        contact={contact}
      />
      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        contactId={contact.id}
        contactName={contact.name}
        event={editingEvent}
      />
      <GiftDialog
        open={giftDialogOpen}
        onOpenChange={setGiftDialogOpen}
        contactId={contact.id}
        contactName={contact.name}
        initial={nextUp ? { occasion: EVENT_TYPE_LABELS[nextUp.type] } : undefined}
      />
    </div>
  )
}

function ReminderStatus({ eventId }: { eventId: string }) {
  const { data: reminders } = useQuery({
    queryKey: ['reminders', eventId],
    queryFn: () => remindersApi.listRemindersForEvent(eventId),
  })
  const reminder = reminders?.[0]

  if (!reminder) return <Badge variant="outline">No reminder set</Badge>
  if (reminder.sentStatus) return <Badge variant="secondary">Reminder sent</Badge>
  return <Badge variant="secondary">{reminder.leadTimeDays} days before</Badge>
}

