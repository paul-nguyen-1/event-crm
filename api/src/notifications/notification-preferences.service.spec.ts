import { NotificationPreferencesService } from './notification-preferences.service';

describe('NotificationPreferencesService.isWithinQuietHours', () => {
  let service: NotificationPreferencesService;

  beforeEach(() => {
    service = new NotificationPreferencesService();
  });

  it('is never within quiet hours when the user has not configured a window', () => {
    const user = {
      quietHoursStartHour: null,
      quietHoursEndHour: null,
      timezone: null,
    };

    expect(
      service.isWithinQuietHours(user, new Date('2026-08-22T03:00:00.000Z')),
    ).toBe(false);
  });

  it('treats a non-wrapping window (e.g. 1-6) as blocking only the hours in between, in UTC', () => {
    const user = {
      quietHoursStartHour: 1,
      quietHoursEndHour: 6,
      timezone: 'UTC',
    };

    expect(
      service.isWithinQuietHours(user, new Date('2026-08-22T03:00:00.000Z')),
    ).toBe(true);
    expect(
      service.isWithinQuietHours(user, new Date('2026-08-22T06:00:00.000Z')),
    ).toBe(false);
    expect(
      service.isWithinQuietHours(user, new Date('2026-08-22T00:00:00.000Z')),
    ).toBe(false);
  });

  it('treats a wrapping window (e.g. 22-7) as blocking overnight hours, in UTC', () => {
    const user = {
      quietHoursStartHour: 22,
      quietHoursEndHour: 7,
      timezone: 'UTC',
    };

    expect(
      service.isWithinQuietHours(user, new Date('2026-08-22T23:00:00.000Z')),
    ).toBe(true);
    expect(
      service.isWithinQuietHours(user, new Date('2026-08-22T02:00:00.000Z')),
    ).toBe(true);
    expect(
      service.isWithinQuietHours(user, new Date('2026-08-22T12:00:00.000Z')),
    ).toBe(false);
    expect(
      service.isWithinQuietHours(user, new Date('2026-08-22T07:00:00.000Z')),
    ).toBe(false);
  });

  it("converts to the user's configured timezone before checking the hour", () => {
    const user = {
      quietHoursStartHour: 22,
      quietHoursEndHour: 7,
      timezone: 'America/New_York',
    };

    // 02:00 UTC is 22:00 the previous day in America/New_York (EDT, UTC-4)
    expect(
      service.isWithinQuietHours(user, new Date('2026-08-22T02:00:00.000Z')),
    ).toBe(true);
    // 16:00 UTC is 12:00 in America/New_York — outside the overnight window
    expect(
      service.isWithinQuietHours(user, new Date('2026-08-22T16:00:00.000Z')),
    ).toBe(false);
  });

  it('falls back to UTC when timezone is unset', () => {
    const user = {
      quietHoursStartHour: 22,
      quietHoursEndHour: 7,
      timezone: null,
    };

    expect(
      service.isWithinQuietHours(user, new Date('2026-08-22T23:00:00.000Z')),
    ).toBe(true);
  });

  it('treats an equal start/end hour as blocking the entire day', () => {
    const user = {
      quietHoursStartHour: 5,
      quietHoursEndHour: 5,
      timezone: 'UTC',
    };

    expect(
      service.isWithinQuietHours(user, new Date('2026-08-22T00:00:00.000Z')),
    ).toBe(true);
    expect(
      service.isWithinQuietHours(user, new Date('2026-08-22T23:00:00.000Z')),
    ).toBe(true);
  });
});
