import { Test, TestingModule } from '@nestjs/testing';
import { RemindersJobService, nextOccurrence } from './reminders-job.service';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';

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
    $transaction: jest.Mock;
  };
  let outbox: jest.Mocked<OutboxService>;

  // Fixed to UTC midnight so occurrence/dueAt math (always UTC-midnight-based)
  // produces exact, predictable boundaries in these tests.
  const NOW = '2026-08-22T00:00:00.000Z';

  function buildReminder(opts: {
    id: string;
    eventDate: string;
    recurrenceRule: string | null;
    leadTimeDays: number;
  }) {
    return {
      id: opts.id,
      leadTimeDays: opts.leadTimeDays,
      channel: 'EMAIL',
      sentStatus: false,
      event: {
        id: `${opts.id}-event`,
        date: new Date(opts.eventDate),
        recurrenceRule: opts.recurrenceRule,
        type: 'BIRTHDAY',
        contact: { userId: 'user-1', name: 'Sarah' },
      },
    };
  }

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date(NOW));

    prisma = {
      reminder: { findMany: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
        cb({ reminder: { update: prisma.reminder.update } }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersJobService,
        { provide: PrismaService, useValue: prisma },
        { provide: OutboxService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(RemindersJobService);
    outbox = module.get(OutboxService);
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

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('processes a reminder inside its lead-time window: marks sent and writes the outbox row', async () => {
    const due = buildReminder({
      id: 'due',
      eventDate: '2026-08-25T00:00:00.000Z',
      recurrenceRule: 'YEARLY',
      leadTimeDays: 5,
    });
    prisma.reminder.findMany.mockResolvedValue([due]);

    await service.checkDueReminders();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'due' },
      data: { sentStatus: true },
    });
    expect(outbox.record).toHaveBeenCalledWith(
      expect.anything(),
      'reminder.due',
      expect.objectContaining({
        reminderId: 'due',
        eventId: 'due-event',
        userId: 'user-1',
        title: "Sarah's birthday is coming up",
        channel: 'EMAIL',
      }),
    );
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

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
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

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(outbox.record).not.toHaveBeenCalled();
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

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'due' },
      data: { sentStatus: true },
    });
  });

  it('only queries reminders that have not already been sent', async () => {
    prisma.reminder.findMany.mockResolvedValue([]);

    await service.checkDueReminders();

    expect(prisma.reminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sentStatus: false } }),
    );
  });
});
