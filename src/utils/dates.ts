/**
 * Get the day key for streak logic
 * Accounts for timezone
 */
export function dayKey(
  timestamp: number,
  tz: string = "America/Chicago",
): string {
  const date = new Date(timestamp);

  // Simple timezone offset adjustment (for MVP, basic approach)
  // For production, use library like date-fns-tz
  const tzOffsets: { [key: string]: number } = {
    "America/Chicago": -6, // CST
    "America/New_York": -5, // EST
    UTC: 0,
  };

  const offset = tzOffsets[tz] ?? 0;
  const adjustedDate = new Date(date.getTime() + offset * 60 * 60 * 1000);

  const year = adjustedDate.getUTCFullYear();
  const month = String(adjustedDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(adjustedDate.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Get current day key
 */
export function todayKey(tz: string = "America/Chicago"): string {
  return dayKey(Date.now(), tz);
}

/**
 * Get yesterday's day key
 */
export function yesterdayKey(tz: string = "America/Chicago"): string {
  return dayKey(Date.now() - 86400 * 1000, tz);
}

/**
 * Check if a day key is today
 */
export function isToday(
  dayStr: string,
  tz: string = "America/Chicago",
): boolean {
  return dayStr === todayKey(tz);
}

/**
 * Check if a day key is yesterday
 */
export function isYesterday(
  dayStr: string,
  tz: string = "America/Chicago",
): boolean {
  return dayStr === yesterdayKey(tz);
}

/**
 * Expiration timestamp: now + duration in ms
 */
export function expiresAt(duration: number): number {
  return Date.now() + duration;
}

/**
 * 24 hours in milliseconds
 */
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
