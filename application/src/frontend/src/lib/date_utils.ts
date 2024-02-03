import { DateTime, Interval } from 'luxon';
// Settings.defaultZone = "utc"; // Run in the user timezone

/**
 * Wrapper that uses luxon internally but uses the JS Date function as interface for all arguments or returns.
 */
export class DateUtils {
  private static fromJSDate(dt: Date): DateTime {
    return DateTime.fromJSDate(dt);
  }

  private static toJSDate(dt: DateTime): Date {
    return dt.toJSDate();
  }

  static now(): Date {
    return DateTime.now().toJSDate();
  }

  static stringifyIso(date: Date): string {
    return date.toISOString();
  }

  static parseIso(date: string): Date {
    return this.toJSDate(DateTime.fromISO(date));
  }

  static stringifyFormat(date: Date, format: string): string {
    return DateTime.fromJSDate(date).toFormat(format);
  }

  static startOfDay(date: Date): Date {
    return this.toJSDate(DateTime.fromJSDate(date).startOf('day'));
  }

  static endOfDay(date: Date): Date {
    return this.toJSDate(DateTime.fromJSDate(date).endOf('day'));
  }

  static getDayRange(range: 'today' | 'yesterday' | 'last_7_days' | 'last_30_days'): {
    startDate: Date;
    endDate: Date;
  } {
    const now = DateTime.now();
    let startDate: DateTime;
    let endDate: DateTime;

    switch (range) {
      case 'today':
        startDate = now.startOf('day');
        endDate = now.endOf('day');
        break;
      case 'yesterday':
        startDate = now.minus({ days: 1 }).startOf('day');
        endDate = now.minus({ days: 1 }).endOf('day');
        break;
      case 'last_7_days':
        startDate = now.minus({ days: 7 }).startOf('day');
        endDate = now.endOf('day');
        break;
      case 'last_30_days':
        startDate = now.minus({ days: 30 }).startOf('day');
        endDate = now.endOf('day');
        break;
    }

    return {
      startDate: startDate.toJSDate(),
      endDate: endDate.toJSDate(),
    };
  }

  static getAbsoluteDayRange(range: 'this_month' | 'last_week' | 'last_month'): { startDate: Date; endDate: Date } {
    const now = DateTime.now();
    let startDate: DateTime;
    let endDate: DateTime;

    switch (range) {
      case 'this_month':
        startDate = now.startOf('month');
        endDate = now.endOf('month');
        break;
      case 'last_week':
        startDate = now.minus({ weeks: 1 }).startOf('week');
        endDate = now.minus({ weeks: 1 }).endOf('week');
        break;
      case 'last_month':
        startDate = now.minus({ months: 1 }).startOf('month');
        endDate = now.minus({ months: 1 }).endOf('month');
        break;
    }

    return {
      startDate: startDate.toJSDate(),
      endDate: endDate.toJSDate(),
    };
  }

  static daysBetween(startDate: Date, endDate: Date) {
    const interval = Interval.fromDateTimes(DateTime.fromJSDate(startDate), DateTime.fromJSDate(endDate));
    return interval.length('days');
  }

  static currentTimeZone() {
    const tz = DateTime.local().zoneName;
    if (!tz) {
      throw new Error('Could not determine timezone');
    }
    return tz;
  }
}
