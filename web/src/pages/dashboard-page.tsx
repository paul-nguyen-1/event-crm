import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Radio, RadioTower } from 'lucide-react'
import * as eventsApi from '@/api/events'
import { useNotifications } from '@/contexts/notifications-context'
import { EVENT_TYPE_LABELS } from '@/schemas/event'
import { Badge } from '@/components/ui/badge'

const POLL_INTERVAL_MS = 30000

export function DashboardPage() {
  const { connectionState, clearUnread } = useNotifications()

  useEffect(() => {
    clearUnread()
  }, [clearUnread])

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', 'upcoming'],
    queryFn: eventsApi.listUpcomingEvents,
    refetchInterval: connectionState === 'connected' ? false : POLL_INTERVAL_MS,
  })

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <h3 className="m-0">Dashboard</h3>
        <ConnectionIndicator state={connectionState} />
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

      {events && events.length > 0 && (
        <ul className="flex max-w-xl flex-col gap-2">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                to={`/contacts/${event.contact.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5 no-underline hover:bg-foreground/5"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {event.contact.name}
                  </span>
                  <Badge variant="secondary">{EVENT_TYPE_LABELS[event.type]}</Badge>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {daysUntil(event.nextOccurrence)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
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

function daysUntil(isoDate: string): string {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const today = new Date()
  const target = new Date(isoDate)
  const diffDays = Math.round(
    (Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()) -
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) /
      MS_PER_DAY,
  )
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return `In ${diffDays} days`
}
