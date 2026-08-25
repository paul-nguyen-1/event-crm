import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { NotificationPreferencesService } from '../notifications/notification-preferences.service';
import { EmailService } from '../notifications/email.service';

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
    private readonly preferences: NotificationPreferencesService,
    private readonly email: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkDueReminders() {
    const now = new Date();
    const reminders = await this.prisma.reminder.findMany({
      where: { sentStatus: false },
      include: { event: { include: { contact: { include: { user: true } } } } },
    });

    for (const reminder of reminders) {
      const { event } = reminder;
      const occurrence = nextOccurrence(event.date, event.recurrenceRule, now);
      const dueAt = new Date(occurrence);
      dueAt.setUTCDate(dueAt.getUTCDate() - reminder.leadTimeDays);

      if (dueAt > now || occurrence < now) continue;

      const { user } = event.contact;
      if (this.preferences.isWithinQuietHours(user, now)) {
        this.logger.log(
          `Reminder ${reminder.id} deferred: within ${user.id}'s quiet hours`,
        );
        continue;
      }

      const title = `${event.contact.name}'s ${event.type.toLowerCase()} is coming up`;
      const body = `${event.contact.name}'s ${event.type.toLowerCase()} is on ${occurrence.toISOString().slice(0, 10)}.`;
      const deepLink = `/contacts/${event.contact.id}`;

      try {
        // Not wrapped in a transaction: sentStatus is no longer set here.
        // It's only ever flipped by a confirmed-delivery path downstream —
        // Resend's response for EMAIL (below), the receipts queue for IN_APP
        // (Phase 2.5) — so there's nothing else to commit atomically here.
        await this.outbox.record(this.prisma, 'reminder.due', {
          reminderId: reminder.id,
          userId: user.id,
          title,
          body,
          deepLink,
          channel: reminder.channel,
        });

        this.logger.log(`Reminder ${reminder.id} due, outbox row written`);

        if (reminder.channel === 'EMAIL') {
          const sent = await this.email.sendReminderEmail({
            to: user.email,
            subject: title,
            body,
            deepLink,
          });
          if (sent) {
            await this.prisma.reminder.update({
              where: { id: reminder.id },
              data: { sentStatus: true },
            });
          }
        }
      } catch (err) {
        // One reminder's dispatch failure (e.g. Resend misconfigured, broker
        // hiccup) must not stop the rest of this hour's batch from being
        // considered — sentStatus stays false either way, so it retries.
        this.logger.error(`Failed to dispatch reminder ${reminder.id}: ${err}`);
      }
    }
  }
}
