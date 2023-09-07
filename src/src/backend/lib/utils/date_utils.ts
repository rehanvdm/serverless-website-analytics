import { DateTime, Duration, IANAZone, Interval, Settings } from 'luxon';
Settings.defaultZone = 'utc';

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

  /* Careful timezones */
  static stringifyFormat(date: Date, format: string): string {
    return DateTime.fromJSDate(date).toFormat(format);
  }

  static parseFormat(date: string, format: string): Date {
    return this.toJSDate(DateTime.fromFormat(date, format));
  }

  static endOfDay(dt: Date): Date {
    return DateTime.fromJSDate(dt).endOf('day').toJSDate();
  }

  static startOfDay(dt: Date): Date {
    return DateTime.fromJSDate(dt).startOf('day').toJSDate();
  }

  static addSeconds(dt: Date, seconds: number): Date {
    return DateTime.fromJSDate(dt).plus({ seconds }).toJSDate();
  }

  static addMinutes(dt: Date, minutes: number): Date {
    return DateTime.fromJSDate(dt).plus({ minutes }).toJSDate();
  }

  static addHours(dt: Date, hours: number): Date {
    return DateTime.fromJSDate(dt).plus({ hours }).toJSDate();
  }

  static addDays(dt: Date, days: number): Date {
    return DateTime.fromJSDate(dt).plus({ days }).toJSDate();
  }

  static difference(dt1: Date, dt2: Date, unit: 'days' | 'hours'): number {
    return DateTime.fromJSDate(dt1).diff(DateTime.fromJSDate(dt2), unit)[unit];
  }

  static isTimeZoneValid(timeZone: string): boolean {
    return DateTime.now().setZone(timeZone).isValid;
  }

  /**
   * Epoch shift a UTC date by the TZ value
   * Careful epoch shifts the date, only do this if you want to store the Date in DB as the local time.
   * @param date
   * @param zone
   */
  static shiftDateInTZ(date: Date, zone: string) {
    const tzDate = DateTime.fromJSDate(date).setZone(zone);
    /* Take the Local time at TZ and say that it is at UTC */
    const localDate = DateTime.fromObject(
      {
        year: tzDate.year,
        month: tzDate.month,
        day: tzDate.day,
        hour: tzDate.hour,
        minute: tzDate.minute,
        second: tzDate.second,
      },
      { zone: 'UTC' }
    );
    return localDate.toJSDate();
  }

  /**
   * Epoch shift a local date in a TZ back to the UTC value
   * Careful epoch shifts the date, only do this if you want to store the Date in DB as the UTC time (of the local time) .
   * @param date
   * @param zone
   */
  static shiftDateInUTC(date: Date, zone: string) {
    const tzDate = DateTime.fromJSDate(date).setZone('UTC');
    /* Take the Local time at TZ and say that it is at UTC */
    const localDate = DateTime.fromObject(
      {
        year: tzDate.year,
        month: tzDate.month,
        day: tzDate.day,
        hour: tzDate.hour,
        minute: tzDate.minute,
        second: tzDate.second,
      },
      { zone }
    );
    return localDate.toJSDate();
  }

  /**
   * Minus 1 millisecond from the end date because the interval is inclusive when used in Queries
   * @param startDate
   * @param endDate
   */
  static getPreviousPeriod(startDate: Date, endDate: Date) {
    const start = DateTime.fromJSDate(startDate);
    const end = DateTime.fromJSDate(endDate);

    const duration = end.diff(start);
    const prevStart = start.minus(duration).minus(Duration.fromObject({ milliseconds: 1 }));
    const prevEnd = start.minus(Duration.fromObject({ milliseconds: 1 }));
    return {
      prevStartDate: DateUtils.toJSDate(prevStart),
      prevEndDate: DateUtils.toJSDate(prevEnd),
    };
  }

  static isValidTimeZone(tz: string) {
    return IANAZone.isValidZone(tz);
  }
}
