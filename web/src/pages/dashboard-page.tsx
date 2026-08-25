import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { Plus, Radio, RadioTower, Search } from 'lucide-react'
import * as eventsApi from '@/api/events'
import * as contactsApi from '@/api/contacts'
import { useNotifications } from '@/contexts/notifications-context'
import { EVENT_TYPE_LABELS, type UpcomingEvent } from '@/schemas/event'
import type { Contact } from '@/schemas/contact'
import { daysUntil, daysUntilLabel } from '@/lib/dates'
import { ContactDialog } from '@/components/contact-dialog'
import { EventDialog } from '@/components/event-dialog'
import { SuggestionPanel } from '@/components/suggestion-panel'
import { FirstRunEmptyState } from '@/components/first-run-empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const POLL_INTERVAL_MS = 30000
const DUE_SOON_WINDOW_DAYS = 14
const DAY_FILTERS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'all', label: 'All' },
] as const
type DayFilter = (typeof DAY_FILTERS)[number]['value']

export function DashboardPage() {
  const navigate = useNavigate()
  const { connectionState, clearUnread } = useNotifications()
  const [search, setSearch] = useState('')
  const [dayFilter, setDayFilter] = useState<DayFilter>('all')
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [eventDialogTarget, setEventDialogTarget] = useState<UpcomingEvent | null>(null)

  useEffect(() => {
    clearUnread()
  }, [clearUnread])

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', 'upcoming'],
    queryFn: eventsApi.listUpcomingEvents,
    refetchInterval: connectionState === 'connected' ? false : POLL_INTERVAL_MS,
  })

  const { data: contacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: contactsApi.listContacts,
  })

  // A one-time ("Once") event keeps its original date forever — unlike a
  // yearly one, nothing rolls it forward — so a past-dated one-time event
  // (e.g. a typo'd year) would otherwise show up as "-12000 days" here.
  // This is a forward-looking work queue, so drop anything already past.
  const upcomingEvents = useMemo(
    () => (events ?? []).filter((e) => daysUntil(e.nextOccurrence) >= 0),
    [events],
  )

  const filteredEvents = useMemo(() => {
    const maxDays = dayFilter === 'all' ? Infinity : Number(dayFilter)
    const query = search.trim().toLowerCase()
    return upcomingEvents.filter((event) => {
      if (daysUntil(event.nextOccurrence) > maxDays) return false
      if (!query) return true
      return (
        event.contact.name.toLowerCase().includes(query) ||
        EVENT_TYPE_LABELS[event.type].toLowerCase().includes(query)
      )
    })
  }, [upcomingEvents, dayFilter, search])

  const dueSoonCount = useMemo(
    () => upcomingEvents.filter((e) => daysUntil(e.nextOccurrence) <= DUE_SOON_WINDOW_DAYS).length,
    [upcomingEvents],
  )

  const decisions = useMemo(
    () => buildDecisions(upcomingEvents, contacts ?? []),
    [upcomingEvents, contacts],
  )
  const soonestEvent = upcomingEvents[0]

  if (contacts && contacts.length === 0) {
    return (
      <div className="p-6">
        <FirstRunEmptyState onAddPerson={() => setContactDialogOpen(true)} />
        <ContactDialog
          open={contactDialogOpen}
          onOpenChange={setContactDialogOpen}
          onSaved={(saved) => navigate(`/contacts/${saved.id}`)}
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[1fr_300px]">
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search people and occasions"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Badge variant="secondary">
            {dueSoonCount} due in {DUE_SOON_WINDOW_DAYS} days
          </Badge>
          <ConnectionIndicator state={connectionState} />
          <Button className="ml-auto" onClick={() => setContactDialogOpen(true)}>
            <Plus className="size-4" />
            Add person
          </Button>
        </div>

        <div className="mb-3 flex items-center gap-3">
          <h3 className="m-0">Upcoming</h3>
          <div className="ml-auto inline-flex overflow-hidden rounded-md border border-border">
            {DAY_FILTERS.map((f, i) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setDayFilter(f.value)}
                className={`px-3 py-1.5 text-[13px] ${i > 0 ? 'border-l border-border' : ''} ${
                  dayFilter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-foreground/5'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {events && events.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <h2>Nothing upcoming</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Add a date for someone you care about and it&apos;ll show up here.
            </p>
          </div>
        )}

        {filteredEvents.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>In</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Occasion</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reminder</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((event) => {
                const reminder = event.reminders[0]
                return (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {daysUntilLabel(event.nextOccurrence)}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/contacts/${event.contact.id}`}
                        className="flex items-center gap-2 no-underline"
                      >
                        <span className="grid size-[26px] flex-none place-items-center border border-border font-heading text-xs font-semibold text-primary">
                          {initials(event.contact.name)}
                        </span>
                        <span className="font-medium text-foreground">
                          {event.contact.name}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {EVENT_TYPE_LABELS[event.type]}
                      {occasionDetail(event) && ` · ${occasionDetail(event)}`}
                    </TableCell>
                    <TableCell className="font-mono">
                      {new Date(event.date).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        timeZone: 'UTC',
                      })}
                    </TableCell>
                    <TableCell>
                      {!reminder ? (
                        <Badge variant="outline">Not set</Badge>
                      ) : reminder.sentStatus ? (
                        <Badge variant="secondary">
                          {reminder.channel === 'EMAIL' ? 'Email queued' : 'In-app queued'}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{reminder.leadTimeDays}d before</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!reminder ? (
                        <Button size="sm" onClick={() => setEventDialogTarget(event)}>
                          Set reminder
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/contacts/${event.contact.id}`}>Open</Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {decisions.length > 0 && (
          <div className="rounded-md border border-border p-3">
            <div className="mb-2 text-[10px] tracking-[0.1em] text-primary uppercase">
              Needs a decision
            </div>
            <div className="flex flex-col gap-2">
              {decisions.map((d) => (
                <div key={d.key} className="flex items-start justify-between gap-2 text-sm">
                  <span>{d.label}</span>
                  {d.to ? (
                    <Link to={d.to} className="shrink-0 text-primary underline-offset-4 hover:underline">
                      {d.actionLabel}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={d.onAction}
                      className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-primary underline-offset-4 hover:underline"
                    >
                      {d.actionLabel}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {soonestEvent && (
          <div className="rounded-md border border-border p-3">
            <SuggestionPanel
              contactId={soonestEvent.contact.id}
              title={`Gift ideas · ${soonestEvent.contact.name}`}
              occasionLabel={EVENT_TYPE_LABELS[soonestEvent.type]}
            />
          </div>
        )}
      </div>

      <ContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        onSaved={(saved) => navigate(`/contacts/${saved.id}`)}
      />
      {eventDialogTarget && (
        <EventDialog
          open={Boolean(eventDialogTarget)}
          onOpenChange={(open) => !open && setEventDialogTarget(null)}
          contactId={eventDialogTarget.contact.id}
          contactName={eventDialogTarget.contact.name}
          event={eventDialogTarget}
        />
      )}
    </div>
  )
}

function ConnectionIndicator({ state }: { state: 'connecting' | 'connected' | 'polling' }) {
  if (state === 'connected') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <RadioTower className="size-3.5 text-primary" />
        Live
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Radio className="size-3.5" />
      {state === 'connecting' ? 'Connecting…' : 'Polling for updates'}
    </span>
  )
}

interface Decision {
  key: string
  label: string
  actionLabel: string
  to?: string
  onAction?: () => void
}

function buildDecisions(events: UpcomingEvent[], contacts: Contact[]): Decision[] {
  const decisions: Decision[] = []

  const noReminder = events
    .filter((e) => e.reminders.length === 0)
    .sort((a, b) => daysUntil(a.nextOccurrence) - daysUntil(b.nextOccurrence))[0]
  if (noReminder) {
    decisions.push({
      key: 'no-reminder',
      label: `${noReminder.contact.name}'s ${EVENT_TYPE_LABELS[noReminder.type].toLowerCase()} has no reminder`,
      actionLabel: 'Fix',
      to: `/contacts/${noReminder.contact.id}`,
    })
  }

  const dueSoon = events
    .filter((e) => daysUntil(e.nextOccurrence) <= 3)
    .sort((a, b) => daysUntil(a.nextOccurrence) - daysUntil(b.nextOccurrence))[0]
  if (dueSoon && dueSoon.id !== noReminder?.id) {
    decisions.push({
      key: 'due-soon',
      label: `${dueSoon.contact.name}'s ${EVENT_TYPE_LABELS[dueSoon.type].toLowerCase()} is in ${daysUntilLabel(dueSoon.nextOccurrence).toLowerCase()}`,
      actionLabel: 'Act',
      to: `/contacts/${dueSoon.contact.id}`,
    })
  }

  const trackedContactIds = new Set(events.map((e) => e.contact.id))
  const noDatesCount = contacts.filter((c) => !trackedContactIds.has(c.id)).length
  if (noDatesCount > 0) {
    decisions.push({
      key: 'no-dates',
      label: `${noDatesCount} ${noDatesCount === 1 ? 'person has' : 'people have'} no dates`,
      actionLabel: 'Review',
      to: '/contacts',
    })
  }

  return decisions
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function occasionDetail(event: UpcomingEvent): string | null {
  if (event.recurrenceRule !== 'YEARLY') return null
  const years = new Date(event.nextOccurrence).getUTCFullYear() - new Date(event.date).getUTCFullYear()
  if (years <= 0) return null
  if (event.type === 'BIRTHDAY') return String(years)
  if (event.type === 'ANNIVERSARY') return `${years} yr`
  return null
}
