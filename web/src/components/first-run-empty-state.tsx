import { CalendarDays, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STEPS = [
  'You add a person and a date.',
  'We email you a week before it arrives.',
  "You act, and it's logged so you don't repeat the gift.",
]

interface FirstRunEmptyStateProps {
  onAddPerson: () => void
}

export function FirstRunEmptyState({ onAddPerson }: FirstRunEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="grid size-14 place-items-center rounded-md border border-border">
        <CalendarDays className="size-6 text-primary" />
      </div>
      <div>
        <h2 className="mb-1">Nothing tracked yet</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Start with the one date you&apos;re most afraid of missing. You can bring the
          rest in later.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onAddPerson}>
          <Plus className="size-4" />
          Add one person
        </Button>
        <Button variant="outline" disabled title="Coming soon">
          Import from Google Contacts
        </Button>
        <Button variant="outline" disabled title="Coming soon">
          Upload a CSV
        </Button>
      </div>
      <div className="mt-4 flex w-full max-w-sm flex-col gap-2 border-t border-border pt-4 text-left">
        <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
          What happens next
        </span>
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-3 rounded-md px-2 py-1.5">
            <span className="font-mono text-xs text-primary">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-sm">{step}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
