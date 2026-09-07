import { PrismaPg } from '@prisma/adapter-pg'
// Reuses the api's generated Prisma client rather than duplicating a schema
// or standing up a second one — this helper only exists to drive the real
// running api's OutboxRelayService (5s cron) the same way a real due
// reminder would, so the dashboard live-update path is exercised end to end.
// eslint-disable-next-line import/no-relative-packages
import { PrismaClient } from '../../../api/generated/prisma/client'

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://eventcrm:eventcrm@localhost:5432/eventcrm'

/**
 * Writes a `reminder.due` outbox row directly, matching the shape
 * RemindersJobService writes in production (api/src/reminders/reminders-job.service.ts).
 * The already-running api's OutboxRelayService picks it up on its own 5s
 * cron and publishes it for real — this only fabricates the "a reminder is
 * due" starting point, not the relay/delivery mechanism being tested.
 */
export async function insertReminderDueEvent(params: {
  userId: string
  title: string
  body: string
  deepLink: string
}): Promise<string> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
  })
  try {
    const event = await prisma.domainEvent.create({
      data: {
        type: 'reminder.due',
        payload: {
          userId: params.userId,
          reminderId: `playwright-${Date.now()}`,
          title: params.title,
          body: params.body,
          deepLink: params.deepLink,
          channel: 'IN_APP',
        },
      },
    })
    return event.id
  } finally {
    await prisma.$disconnect()
  }
}
