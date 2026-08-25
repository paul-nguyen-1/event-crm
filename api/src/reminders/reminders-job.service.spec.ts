import { Test, TestingModule } from '@nestjs/testing';
import { RemindersJobService, nextOccurrence } from './reminders-job.service';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { NotificationPreferencesService } from '../notifications/notification-preferences.service';
import { EmailService } from '../notifications/email.service';
import { SuggestionsService } from '../suggestions/suggestions.service';
import { RemindersService } from './reminders.service';
import type { ProductModel } from '../../generated/prisma/models';

describe('nextOccurrence', () => {
  it('returns the literal date for a non-yearly (e.g. CUSTOM one-time) event', () => {
    const date = new Date('2026-08-25T00:00:00.000Z');
    const from = new Date('2026-01-01T00:00:00.000Z');

    expect(nextOccurrence(date, null, from)).toEqual(date);
  });

  it('rolls a passed yearly occurrence forward to next year', () => {
    const date = new Date('2026-01-10T00:00:00.000Z');
    const from = new Date('2026-08-22T00:00:00.000Z');

    expect(nextOccurrence(date, 'YEARLY', from)).toEqual(
      new Date('2027-01-10T00:00:00.000Z'),
    );
  });

  it('keeps an upcoming yearly occurrence in the current year', () => {
    const date = new Date('2026-12-25T00:00:00.000Z');
    const from = new Date('2026-08-22T00:00:00.000Z');

    expect(nextOccurrence(date, 'YEARLY', from)).toEqual(
      new Date('2026-12-25T00:00:00.000Z'),
    );
  });

  it('is not shifted by the server local timezone (regression: UTC-midnight dates must not shift a day)', () => {
    // An ISO date-only string like "2026-08-25" parses as UTC midnight. If the
    // occurrence were computed with local-time getters/setters on a server
    // west of UTC, this would resolve to 2026-08-24 instead.
    const date = new Date('2026-08-25');
    const from = new Date('2026-08-01T00:00:00.000Z');

    const result = nextOccurrence(date, 'YEARLY', from);

    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(7); // August
    expect(result.getUTCDate()).toBe(25);
  });
});

describe('RemindersJobService.checkDueReminders', () => {
  let service: RemindersJobService;
  let prisma: {
    reminder: { findMany: jest.Mock; update: jest.Mock };
  };
  let outbox: jest.Mocked<OutboxService>;
  let preferences: jest.Mocked<NotificationPreferencesService>;
  let email: jest.Mocked<EmailService>;
  let suggestions: jest.Mocked<SuggestionsService>;

  // Fixed to UTC midnight so occurrence/dueAt math (always UTC-midnight-based)
  // produces exact, predictable boundaries in these tests.
  const NOW = '2026-08-22T00:00:00.000Z';

  function buildReminder(opts: {
    id: string;
    eventDate: string;
    recurrenceRule: string | null;
    leadTimeDays: number;
    channel?: 'EMAIL' | 'IN_APP';
  }) {
    return {
      id: opts.id,
      leadTimeDays: opts.leadTimeDays,
      channel: opts.channel ?? 'EMAIL',
      sentStatus: false,
      event: {
        id: `${opts.id}-event`,
        date: new Date(opts.eventDate),
        recurrenceRule: opts.recurrenceRule,
        type: 'BIRTHDAY',
        contact: {
          id: `${opts.id}-contact`,
          name: 'Sarah',
          user: {
            id: 'user-1',
            email: 'sarah-owner@example.com',
            quietHoursStartHour: null,
            quietHoursEndHour: null,
            timezone: null,
          },
        },
      },
    };
  }

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date(NOW));

    prisma = {
      reminder: { findMany: jest.fn(), update: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersJobService,
        { provide: PrismaService, useValue: prisma },
        { provide: OutboxService, useValue: { record: jest.fn() } },
        {
          provide: NotificationPreferencesService,
          useValue: { isWithinQuietHours: jest.fn().mockReturnValue(false) },
        },
        {
          provide: EmailService,
          useValue: { sendReminderEmail: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: SuggestionsService,
          useValue: { getForContact: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: RemindersService,
          useValue: {
            signUnsubscribeToken: jest.fn().mockResolvedValue('signed-token'),
          },
        },
      ],
    }).compile();

    service = module.get(RemindersJobService);
    outbox = module.get(OutboxService);
    preferences = module.get(NotificationPreferencesService);
    email = module.get(EmailService);
    suggestions = module.get(SuggestionsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('skips a reminder whose lead-time window has not started yet', async () => {
    const notDue = buildReminder({
      id: 'not-due',
      eventDate: '2026-01-01T00:00:00.000Z',
      recurrenceRule: 'YEARLY',
      leadTimeDays: 5,
    });
    prisma.reminder.findMany.mockResolvedValue([notDue]);

    await service.checkDueReminders();

    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('writes the outbox row and sends email for a due reminder with no quiet-hours conflict', async () => {
    const due = buildReminder({
      id: 'due',
      eventDate: '2026-08-25T00:00:00.000Z',
      recurrenceRule: 'YEARLY',
      leadTimeDays: 5,
    });
    prisma.reminder.findMany.mockResolvedValue([due]);

    await service.checkDueReminders();

    expect(outbox.record).toHaveBeenCalledWith(
      prisma,
      'reminder.due',
      expect.objectContaining({
        reminderId: 'due',
        userId: 'user-1',
        title: "Sarah's birthday is coming up",
        channel: 'EMAIL',
        deepLink: '/contacts/due-contact',
      }),
    );
    expect(email.sendReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sarah-owner@example.com',
        subject: "Sarah's birthday is coming up",
      }),
    );
    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'due' },
      data: { sentStatus: true },
    });
  });

  it('enriches the email with the contact-specific age, top-3 suggestions, and a signed unsubscribe link', async () => {
    const originalFrontendUrl = process.env.FRONTEND_URL;
    const originalApiUrl = process.env.API_URL;
    process.env.FRONTEND_URL = 'https://app.example.com';
    process.env.API_URL = 'https://api.example.com/v1';
    function buildProduct(name: string, basePrice: string) {
      return {
        id: name,
        name,
        tags: [],
        imageUrl: null,
        basePrice: { toString: () => basePrice },
        network: 'AMAZON',
        externalId: name,
        createdAt: new Date(),
      } as unknown as ProductModel;
    }
    suggestions.getForContact.mockResolvedValue([
      buildProduct('Candle set', '42'),
      buildProduct('Mug pair', '44'),
      buildProduct('Grinder', '49'),
      buildProduct('Extra item', '10'),
    ]);
    const due = buildReminder({
      id: 'due',
      eventDate: '1991-08-25T00:00:00.000Z',
      recurrenceRule: 'YEARLY',
      leadTimeDays: 5,
    });
    prisma.reminder.findMany.mockResolvedValue([due]);

    await service.checkDueReminders();

    expect(suggestions.getForContact).toHaveBeenCalledWith(
      'due-contact',
      'user-1',
    );
    expect(email.sendReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        contactName: 'Sarah',
        occasionLabel: 'Birthday',
        daysUntil: 5,
        description:
          'Sarah is turning 35. Here are a few things they might like.',
        suggestions: [
          { name: 'Candle set', basePrice: '42', imageUrl: null },
          { name: 'Mug pair', basePrice: '44', imageUrl: null },
          { name: 'Grinder', basePrice: '49', imageUrl: null },
        ],
        seeAllUrl: 'https://app.example.com/contacts/due-contact',
        changeTimingUrl: 'https://app.example.com/contacts/due-contact',
        unsubscribeUrl:
          'https://api.example.com/v1/reminders/unsubscribe/signed-token',
      }),
    );

    process.env.FRONTEND_URL = originalFrontendUrl;
    process.env.API_URL = originalApiUrl;
  });

  it("defers a due reminder inside the owning user's quiet hours: no outbox write, no email, sentStatus left false", async () => {
    preferences.isWithinQuietHours.mockReturnValue(true);
    const due = buildReminder({
      id: 'due',
      eventDate: '2026-08-25T00:00:00.000Z',
      recurrenceRule: 'YEARLY',
      leadTimeDays: 5,
    });
    prisma.reminder.findMany.mockResolvedValue([due]);

    await service.checkDueReminders();

    expect(outbox.record).not.toHaveBeenCalled();
    expect(email.sendReminderEmail).not.toHaveBeenCalled();
    expect(prisma.reminder.update).not.toHaveBeenCalled();
  });

  it('does not mark sentStatus when Resend rejects the send, leaving it for retry next tick', async () => {
    email.sendReminderEmail.mockResolvedValue(false);
    const due = buildReminder({
      id: 'due',
      eventDate: '2026-08-25T00:00:00.000Z',
      recurrenceRule: 'YEARLY',
      leadTimeDays: 5,
    });
    prisma.reminder.findMany.mockResolvedValue([due]);

    await service.checkDueReminders();

    expect(outbox.record).toHaveBeenCalled();
    expect(prisma.reminder.update).not.toHaveBeenCalled();
  });

  it('writes the outbox row for an IN_APP reminder but never calls email or sets sentStatus itself', async () => {
    const due = buildReminder({
      id: 'due',
      eventDate: '2026-08-25T00:00:00.000Z',
      recurrenceRule: 'YEARLY',
      leadTimeDays: 5,
      channel: 'IN_APP',
    });
    prisma.reminder.findMany.mockResolvedValue([due]);

    await service.checkDueReminders();

    expect(outbox.record).toHaveBeenCalledWith(
      prisma,
      'reminder.due',
      expect.objectContaining({ channel: 'IN_APP' }),
    );
    expect(email.sendReminderEmail).not.toHaveBeenCalled();
    expect(prisma.reminder.update).not.toHaveBeenCalled();
  });

  it('processes a reminder exactly at the due boundary (dueAt === now)', async () => {
    const boundary = buildReminder({
      id: 'boundary',
      eventDate: '2026-08-27T00:00:00.000Z',
      recurrenceRule: 'YEARLY',
      leadTimeDays: 5,
    });
    prisma.reminder.findMany.mockResolvedValue([boundary]);

    await service.checkDueReminders();

    expect(outbox.record).toHaveBeenCalled();
  });

  it('never fires for a one-time (non-recurring) event whose date has already fully passed', async () => {
    // dueAt for this reminder is in the past too, so without the explicit
    // "occurrence already passed" guard this would incorrectly fire forever.
    const lapsed = buildReminder({
      id: 'lapsed',
      eventDate: '2026-01-01T00:00:00.000Z',
      recurrenceRule: null,
      leadTimeDays: 1,
    });
    prisma.reminder.findMany.mockResolvedValue([lapsed]);

    await service.checkDueReminders();

    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('continues processing the rest of the batch when one reminder throws (e.g. Resend misconfigured)', async () => {
    email.sendReminderEmail
      .mockRejectedValueOnce(new Error('Missing API key'))
      .mockResolvedValueOnce(true);
    const failing = buildReminder({
      id: 'failing',
      eventDate: '2026-08-25T00:00:00.000Z',
      recurrenceRule: 'YEARLY',
      leadTimeDays: 5,
    });
    const succeeding = buildReminder({
      id: 'succeeding',
      eventDate: '2026-08-26T00:00:00.000Z',
      recurrenceRule: 'YEARLY',
      leadTimeDays: 5,
    });
    prisma.reminder.findMany.mockResolvedValue([failing, succeeding]);

    await service.checkDueReminders();

    expect(outbox.record).toHaveBeenCalledTimes(2);
    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'succeeding' },
      data: { sentStatus: true },
    });
  });

  it('processes only the due reminders out of a mixed batch', async () => {
    const notDue = buildReminder({
      id: 'not-due',
      eventDate: '2026-01-01T00:00:00.000Z',
      recurrenceRule: 'YEARLY',
      leadTimeDays: 5,
    });
    const due = buildReminder({
      id: 'due',
      eventDate: '2026-08-25T00:00:00.000Z',
      recurrenceRule: 'YEARLY',
      leadTimeDays: 5,
    });
    const lapsed = buildReminder({
      id: 'lapsed',
      eventDate: '2026-01-01T00:00:00.000Z',
      recurrenceRule: null,
      leadTimeDays: 1,
    });
    prisma.reminder.findMany.mockResolvedValue([notDue, due, lapsed]);

    await service.checkDueReminders();

    expect(outbox.record).toHaveBeenCalledTimes(1);
    expect(outbox.record).toHaveBeenCalledWith(
      prisma,
      'reminder.due',
      expect.objectContaining({ reminderId: 'due' }),
    );
  });

  it('only queries reminders that have not already been sent', async () => {
    prisma.reminder.findMany.mockResolvedValue([]);

    await service.checkDueReminders();

    expect(prisma.reminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sentStatus: false } }),
    );
  });
});
