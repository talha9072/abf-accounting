/**
 * Time helpers for the daily pull.
 *
 * - The schedule runs on South Africa time (Africa/Johannesburg, UTC+2, no DST):
 *   the pull starts at 06:00 there.
 * - Incorporation dates come from Companies House as UK calendar dates.
 */

export const SCHEDULE_TZ = "Africa/Johannesburg";
export const UK_TZ = "Europe/London";
export const PULL_HOUR = 6; // 06:00 South Africa time

/** "YYYY-MM-DD" for `date` in the given time zone. */
export function dateInTz(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Hour (0–23) of `date` in the given time zone. */
export function hourInTz(date: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(date));
}

/** Add whole days to a "YYYY-MM-DD" string. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of days between two "YYYY-MM-DD" strings. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The instant today's scheduled pull is due (06:00 South Africa time, = 04:00 UTC). */
export function todaysScheduleStart(now: Date): Date {
  const saDay = dateInTz(now, SCHEDULE_TZ);
  // Africa/Johannesburg is a fixed UTC+2 offset.
  return new Date(`${saDay}T${String(PULL_HOUR).padStart(2, "0")}:00:00+02:00`);
}

/** "06:04" in South Africa time — what the UI shows. */
export function formatSaTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: SCHEDULE_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

/** "21 Sep 2026" for a "YYYY-MM-DD" string. */
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T12:00:00Z`),
  );
}
