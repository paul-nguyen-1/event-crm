import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { Plus, Search } from 'lucide-react'
import * as contactsApi from '@/api/contacts'
import * as eventsApi from '@/api/events'
import * as giftsApi from '@/api/gifts'
import { ContactDialog } from '@/components/contact-dialog'
import { FirstRunEmptyState } from '@/components/first-run-empty-state'
import { useAuth } from '@/contexts/auth-context'
import { FREE_CONTACT_LIMIT } from '@/schemas/user'
import type { UpcomingEvent } from '@/schemas/event'
import type { Gift } from '@/schemas/gift'
import { daysUntil } from '@/lib/dates'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function ContactsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: contactsApi.listContacts,
  })

  const { data: events } = useQuery({
    queryKey: ['events', 'upcoming'],
    queryFn: eventsApi.listUpcomingEvents,
  })

  const { data: gifts } = useQuery({
    queryKey: ['gifts'],
    queryFn: () => giftsApi.listGifts(),
  })

  const deleteMutation = useMutation({
    mutationFn: contactsApi.deleteContact,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  })

  const filteredContacts = useMemo(() => {
    if (!contacts) return []
    const query = search.trim().toLowerCase()
    if (!query) return contacts
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.relationshipType?.toLowerCase().includes(query),
    )
  }, [contacts, search])

  const isFree = user?.tier !== 'PAID'
  const atLimit = isFree && (contacts?.length ?? 0) >= FREE_CONTACT_LIMIT

  function toggleSelected(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(filteredContacts.map((c) => c.id)) : new Set())
  }

  async function removeSelected() {
    if (!confirm(`Remove ${selected.size} people? This also removes their tracked dates.`)) return
    await Promise.all([...selected].map((id) => deleteMutation.mutateAsync(id)))
    setSelected(new Set())
  }

  if (contacts && contacts.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <h3 className="m-0">People</h3>
        </div>
        <FirstRunEmptyState onAddPerson={() => setDialogOpen(true)} />
        <ContactDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={(saved) => navigate(`/contacts/${saved.id}`)}
        />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <h3 className="m-0">People</h3>
        {contacts && isFree && (
          <Badge variant={atLimit ? 'destructive' : 'secondary'}>
            {contacts.length} / {FREE_CONTACT_LIMIT} on free
          </Badge>
        )}
        <Button
          variant="outline"
          className="ml-auto"
          disabled
          title="Coming soon"
        >
          Import
        </Button>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Add person
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search people"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <button
            type="button"
            onClick={removeSelected}
            className="cursor-pointer border-none bg-transparent p-0 text-primary underline-offset-4 hover:underline"
          >
            Remove
          </button>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {filteredContacts.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={
                    selected.size > 0 && selected.size === filteredContacts.length
                  }
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Relationship</TableHead>
              <TableHead>Occasions</TableHead>
              <TableHead>Next</TableHead>
              <TableHead>Last gift</TableHead>
              <TableHead>Reminders</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.map((contact) => {
              const contactEvents = (events ?? []).filter(
                (e) => e.contact.id === contact.id,
              )
              // "Next" should only ever point forward — a one-time event
              // keeps its original date, so a past-dated one shouldn't
              // surface here as if it were still coming up.
              const nextEvent = contactEvents.find((e) => daysUntil(e.nextOccurrence) >= 0)
              const lastGift = (gifts ?? []).find((g) => g.contactId === contact.id)

              return (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(contact.id)}
                      onCheckedChange={(checked) =>
                        toggleSelected(contact.id, checked === true)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="grid size-[26px] flex-none place-items-center border border-border font-heading text-xs font-semibold text-primary">
                        {initials(contact.name)}
                      </span>
                      {contact.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.relationshipType || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contactEvents.length || '—'}
                  </TableCell>
                  <TableCell className="font-mono">
                    {nextEvent
                      ? new Date(nextEvent.nextOccurrence).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          timeZone: 'UTC',
                        })
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatLastGift(lastGift)}
                  </TableCell>
                  <TableCell>
                    <ReminderBadge event={nextEvent} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Remove ${contact.name}?`)) {
                          deleteMutation.mutate(contact.id)
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {atLimit && (
        <p className="mt-4 text-sm text-muted-foreground">
          You&apos;ve used all ten places on the free plan.
        </p>
      )}

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(saved) => navigate(`/contacts/${saved.id}`)}
      />
    </div>
  )
}

function ReminderBadge({ event }: { event?: UpcomingEvent }) {
  const reminder = event?.reminders[0]
  if (!reminder) return <Badge variant="outline">Off</Badge>
  return <Badge variant="secondary">{reminder.channel === 'EMAIL' ? 'Email' : 'In-app'}</Badge>
}

function formatLastGift(gift?: Gift) {
  if (!gift) return '—'
  const year = new Date(gift.giftDate).getUTCFullYear()
  const cost = gift.costCents != null ? ` · $${(gift.costCents / 100).toFixed(0)}` : ''
  return `${year} · ${gift.description}${cost}`
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
