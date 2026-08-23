import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';

/**
 * Events recur yearly (birthdays, anniversaries) when recurrenceRule is
 * "YEARLY" — this maps the stored date onto the nearest upcoming occurrence.
 * Anything else (e.g. a one-time CUSTOM event) uses the literal date.
 */
export function nextOccurrence(
  date: Date,
  recurrenceRule: string | null,
  from: Date,
): Date {
  if (recurrenceRule !== 'YEARLY') return date;

  // UTC throughout: dates arrive as UTC-midnight (ISO date-only strings parse
  // as UTC), so reading them back with local-time getters could shift the
  // calendar day depending on the server's timezone.
  const occurrence = new Date(
    Date.UTC(from.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  if (occurrence < from) {
    occurrence.setUTCFullYear(occurrence.getUTCFullYear() + 1);
  }
  return occurrence;
}

@Injectable()
export class RemindersJobService {
  private readonly logger = new Logger(RemindersJobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkDueReminders() {
    const now = new Date();
    const reminders = await this.prisma.reminder.findMany({
      where: { sentStatus: false },
      include: { event: { include: { contact: true } } },
    });

    for (const reminder of reminders) {
      const { event } = reminder;
      const occurrence = nextOccurrence(event.date, event.recurrenceRule, now);
      const dueAt = new Date(occurrence);
      dueAt.setUTCDate(dueAt.getUTCDate() - reminder.leadTimeDays);

      if (dueAt > now || occurrence < now) continue;

      await this.prisma.$transaction(async (tx) => {
        await tx.reminder.update({
          where: { id: reminder.id },
          data: { sentStatus: true },
        });
        await this.outbox.record(tx, 'reminder.due', {
          reminderId: reminder.id,
          eventId: event.id,
          userId: event.contact.userId,
          title: `${event.contact.name}'s ${event.type.toLowerCase()} is coming up`,
          channel: reminder.channel,
        });
      });

      this.logger.log(`Reminder ${reminder.id} due, outbox row written`);
    }
  }
}
