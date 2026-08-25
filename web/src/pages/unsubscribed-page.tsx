import { Link } from 'react-router'

export function UnsubscribedPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="mb-2 flex items-baseline gap-1.5">
        <span className="font-heading text-lg font-semibold tracking-wide">OCCASION</span>
        <span className="font-mono text-[9px] text-primary">+</span>
      </div>
      <h1 className="text-2xl">Reminder turned off</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        You won&apos;t get another reminder for this occasion. You can turn it back on any
        time from the contact&apos;s page.
      </p>
      <Link to="/dashboard" className="mt-2 text-sm text-primary underline-offset-4 hover:underline">
        Go to dashboard
      </Link>
    </div>
  )
}
