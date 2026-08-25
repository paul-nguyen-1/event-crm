import { Injectable } from '@nestjs/common';

export interface QuietHoursUser {
  quietHoursStartHour: number | null;
  quietHoursEndHour: number | null;
  timezone: string | null;
}

@Injectable()
export class NotificationPreferencesService {
  /**
   * Quiet hours are a local-time-of-day window in the user's own timezone
   * (falls back to UTC if unset). The window may wrap past midnight (e.g.
   * 22 -> 7), so equal start/end can't be treated as "no window" — an
   * unconfigured window is represented by either bound being null instead.
   */
  isWithinQuietHours(user: QuietHoursUser, at: Date): boolean {
    if (user.quietHoursStartHour == null || user.quietHoursEndHour == null) {
      return false;
    }

    const hour = this.localHour(at, user.timezone ?? 'UTC');
    const { quietHoursStartHour: start, quietHoursEndHour: end } = user;

    if (start === end) return true;
    if (start < end) return hour >= start && hour < end;
    return hour >= start || hour < end;
  }

  private localHour(at: Date, timezone: string): number {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(at);
    // "24" is midnight in this formatter's hour12:false output for some ICU
    // versions/locales; normalize it to 0 so callers get a plain 0-23 hour.
    return Number(formatted) % 24;
  }
}
