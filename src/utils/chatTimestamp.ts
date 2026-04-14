/**
 * Centralized chat timestamp formatting.
 *
 * All chat-related timestamp display strings should be produced by
 * `formatChatTimestamp()` so formatting is consistent across:
 * - Bubble-mode footer
 * - Stacked-mode header
 * - Group stacked-mode header
 * - Media viewer header
 * - Chat list preview (uses `formatRelativeTime` separately)
 *
 * Formatting rules:
 * - Today (local calendar day)      → "2:53PM"
 * - Yesterday (local calendar day)  → "Yesterday at 2:53PM"
 * - Older                           → "3/25/26, 2:53PM"
 *
 * All comparisons use the device's local timezone via the Date constructor.
 *
 * @module utils/chatTimestamp
 */

import { toTimestamp } from "./dates";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns "YYYY-MM-DD" in the device's local timezone. */
function localDayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Formats the time portion as "h:mmAM/PM" with no leading zero and no space
 * before the meridiem. Examples: "2:53PM", "12:05AM".
 */
export function formatTimeOnly(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  if (hours === 0) hours = 12;

  const mm = String(minutes).padStart(2, "0");
  return `${hours}:${mm}${ampm}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Format a message timestamp for display in the chat UI.
 *
 * Accepts any format the app may encounter:
 * - Firestore Timestamp objects
 * - JS Date objects
 * - Numeric millisecond epochs
 * - ISO 8601 strings
 * - null / undefined / malformed values (returns empty string)
 *
 * @param timestamp - The raw message timestamp.
 * @param now       - Optional "current time" override (ms epoch) for testing.
 * @returns A formatted string, or "" if the timestamp is invalid.
 */
export function formatChatTimestamp(timestamp: unknown, now?: number): string {
  // ── Normalise to ms epoch ────────────────────────────────────────
  let ms: number;

  if (timestamp instanceof Date) {
    ms = timestamp.getTime();
  } else if (typeof timestamp === "string") {
    const parsed = Date.parse(timestamp);
    if (isNaN(parsed)) return "";
    ms = parsed;
  } else {
    ms = toTimestamp(timestamp);
  }

  if (!ms || !isFinite(ms)) return "";

  const currentMs = now ?? Date.now();
  const date = new Date(ms);
  const todayKey = localDayKey(currentMs);
  const yesterdayKey = localDayKey(currentMs - 86_400_000);
  const messageKey = localDayKey(ms);

  const time = formatTimeOnly(date);

  if (messageKey === todayKey) {
    return time; // e.g. "2:53PM"
  }

  if (messageKey === yesterdayKey) {
    return `Yesterday at ${time}`; // e.g. "Yesterday at 2:53PM"
  }

  // Older — M/D/YY, h:mmAM/PM
  const month = date.getMonth() + 1; // 1-based, no leading zero
  const day = date.getDate();
  const year = String(date.getFullYear()).slice(-2); // last 2 digits
  return `${month}/${day}/${year}, ${time}`; // e.g. "3/25/26, 2:53PM"
}

/**
 * Format a message timestamp for bubble-mode display (time only, no date).
 *
 * Accepts the same input formats as `formatChatTimestamp` but always returns
 * the time portion only (e.g. "2:53PM"), matching group-chat bubble behavior.
 */
export function formatBubbleTimestamp(timestamp: unknown): string {
  let ms: number;

  if (timestamp instanceof Date) {
    ms = timestamp.getTime();
  } else if (typeof timestamp === "string") {
    const parsed = Date.parse(timestamp);
    if (isNaN(parsed)) return "";
    ms = parsed;
  } else {
    ms = toTimestamp(timestamp);
  }

  if (!ms || !isFinite(ms)) return "";

  return formatTimeOnly(new Date(ms));
}
