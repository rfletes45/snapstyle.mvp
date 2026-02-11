/** Duck-typed Firestore Timestamp for cross-boundary usage */
interface FirestoreTimestamp {
  toDate(): Date;
  toMillis(): number;
  seconds: number;
  nanoseconds: number;
}

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

/**
 * Format a timestamp as relative time string
 *
 * Examples:
 * - "now" (< 1 min)
 * - "5m" (< 60 min)
 * - "3h" (< 24 hours)
 * - "2d" (< 7 days)
 * - "Jan 15" (>= 7 days, same year)
 * - "Jan 15, 2024" (different year)
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  const date = new Date(timestamp);
  const currentYear = new Date().getFullYear();
  const timestampYear = date.getFullYear();

  if (timestampYear === currentYear) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Convert various timestamp formats to a number (milliseconds)
 *
 * Handles:
 * - Plain numbers (assumed to be ms)
 * - Firestore Timestamps (with .toMillis())
 * - Date objects
 * - Objects with .seconds property (Firestore-like)
 *
 * @param value - The timestamp value to convert
 * @returns Unix timestamp in milliseconds, or 0 if invalid
 */
export function toTimestamp(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("toMillis" in value && typeof obj.toMillis === "function") {
      return (value as FirestoreTimestamp).toMillis();
    }
    if ("getTime" in value && typeof obj.getTime === "function") {
      return (value as Date).getTime();
    }
    if ("seconds" in value && typeof obj.seconds === "number") {
      return (value as FirestoreTimestamp).seconds * 1000;
    }
  }
  return 0;
}
