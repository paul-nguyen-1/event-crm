import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { Plus } from 'lucide-react'
import * as contactsApi from '@/api/contacts'
import * as eventsApi from '@/api/events'
import * as remindersApi from '@/api/reminders'
import { ContactDialog } from '@/components/contact-dialog'
import { EventDialog } from '@/components/event-dialog'
import { EVENT_TYPE_LABELS, type Event } from '@/schemas/event'
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

      <div className="my-3 mb-4 flex items-start gap-4">
        <div>
          <h2 className="mb-1">{contact.name}</h2>
          {contact.relationshipType && (
            <Badge variant="secondary">{contact.relationshipType}</Badge>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setContactDialogOpen(true)}>
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm(`Remove ${contact.name}? This also removes their tracked dates.`)) {
                deleteContactMutation.mutate(contact.id)
              }
            }}
          >
            Remove
          </Button>
        </div>
      </div>

      {contact.notes && (
        <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{contact.notes}</p>
      )}

      <div className="mb-3 flex items-center gap-3">
        <h3 className="m-0">Dates</h3>
      </div>

      {eventsLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {events && events.length > 0 && (
        <Table className="mb-6">
          <TableHeader>
            <TableRow>
              <TableHead>Occasion</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Repeats</TableHead>
              <TableHead>Reminder</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>{EVENT_TYPE_LABELS[event.type]}</TableCell>
                <TableCell className="font-mono">
                  {new Date(event.date).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {event.recurrenceRule === 'YEARLY' ? 'Yearly' : 'Once'}
                </TableCell>
                <TableCell>
                  <ReminderCell eventId={event.id} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingEvent(event)
                      setEventDialogOpen(true)
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Remove this occasion?')) {
                        deleteEventMutation.mutate(event.id)
                      }
                    }}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Button
        variant="outline"
        onClick={() => {
          setEditingEvent(undefined)
          setEventDialogOpen(true)
        }}
      >
        <Plus className="size-4" />
        Add an occasion
      </Button>

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
    </div>
  )
}

function ReminderCell({ eventId }: { eventId: string }) {
  const { data: reminders } = useQuery({
    queryKey: ['reminders', eventId],
    queryFn: () => remindersApi.listRemindersForEvent(eventId),
  })
  const reminder = reminders?.[0]

  if (!reminder) return <Badge variant="outline">Not set</Badge>
  return <Badge variant="secondary">{reminder.leadTimeDays} days before</Badge>
}
