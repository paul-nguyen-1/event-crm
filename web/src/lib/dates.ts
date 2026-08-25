const MS_PER_DAY = 24 * 60 * 60 * 1000

export function daysUntil(isoDate: string): number {
  const today = new Date()
  const target = new Date(isoDate)
  return Math.round(
    (Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()) -
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) /
      MS_PER_DAY,
  )
}

export function daysUntilLabel(isoDate: string): string {
  const diffDays = daysUntil(isoDate)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return `${diffDays} days`
}
