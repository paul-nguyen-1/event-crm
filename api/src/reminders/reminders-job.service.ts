import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { NotificationPreferencesService } from '../notifications/notification-preferences.service';
import { EmailService } from '../notifications/email.service';
import { SuggestionsService } from '../suggestions/suggestions.service';
import { RemindersService } from './reminders.service';

const SUGGESTIONS_IN_EMAIL = 3;

/** "BIRTHDAY" -> "Birthday" */
function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/**
 * The personalized line under the heading. Only birthdays/anniversaries
 * have a meaningful "turning N" framing; anything else gets a plain nudge.
 */
function buildDescription(
  contactName: string,
  occasionLabel: string,
  eventType: string,
  age: number | null,
): string {
  if (age != null && eventType === 'BIRTHDAY') {
    return `${contactName} is turning ${age}. Here are a few things they might like.`;
  }
  if (age != null && eventType === 'ANNIVERSARY') {
    return `${contactName} is celebrating ${age} years. Here are a few things they might like.`;
  }
  return `A reminder that ${contactName}'s ${occasionLabel.toLowerCase()} is coming up.`;
}

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
    private readonly suggestions: SuggestionsService,
    private readonly reminders: RemindersService,
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
          const occasionLabel = titleCase(event.type);
          const age =
            event.recurrenceRule === 'YEARLY'
              ? occurrence.getUTCFullYear() - event.date.getUTCFullYear()
              : null;
          const suggestions = (
            await this.suggestions.getForContact(event.contact.id, user.id)
          )
            .slice(0, SUGGESTIONS_IN_EMAIL)
            .map((p) => ({
              name: p.name,
              basePrice: p.basePrice.toString(),
              imageUrl: p.imageUrl,
            }));
          const unsubscribeToken = await this.reminders.signUnsubscribeToken(
            reminder.id,
          );
          const frontendUrl =
            process.env.FRONTEND_URL || 'http://localhost:5173';
          const apiUrl = process.env.API_URL || 'http://localhost:3000/v1';

          const sent = await this.email.sendReminderEmail({
            to: user.email,
            subject: title,
            body,
            deepLink,
            contactName: event.contact.name,
            occasionLabel,
            occasionDateLabel: occurrence.toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'long',
              timeZone: 'UTC',
            }),
            daysUntil: reminder.leadTimeDays,
            description: buildDescription(
              event.contact.name,
              occasionLabel,
              event.type,
              age && age > 0 ? age : null,
            ),
            suggestions,
            seeAllUrl: `${frontendUrl}${deepLink}`,
            changeTimingUrl: `${frontendUrl}${deepLink}`,
            unsubscribeUrl: `${apiUrl}/reminders/unsubscribe/${unsubscribeToken}`,
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
