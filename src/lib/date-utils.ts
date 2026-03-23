import { format, subDays, startOfDay } from 'date-fns';

/** Format a Date as YYYY-MM-DD. */
export function toDateString(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

/** Get yesterday's date string. */
export function yesterday(): string {
  return toDateString(subDays(startOfDay(new Date()), 1));
}

/** Get today's date string. */
export function today(): string {
  return toDateString(new Date());
}

/** Get date string for N days ago. */
export function daysAgo(n: number): string {
  return toDateString(subDays(startOfDay(new Date()), n));
}

/** Build a date range { startDate, endDate } for the last N days (ending yesterday). */
export function lastNDays(n: number): { startDate: string; endDate: string } {
  return {
    startDate: daysAgo(n),
    endDate: yesterday(),
  };
}

/** Get ISO 8601 timestamp string. */
export function nowISO(): string {
  return new Date().toISOString();
}
