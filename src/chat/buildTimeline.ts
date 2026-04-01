/**
 * buildTimeline — Derives a rendered timeline from a chronological message list.
 *
 * Inserts date-divider items whenever the calendar day changes between
 * consecutive messages. Dividers are NOT stored — they are computed at render
 * time from real message timestamps.
 *
 * Works with any chat message shape by accepting a generic type plus
 * timestamp + grouping accessors. DM and group screens both pass canonical
 * `MessageV2` rows after the unification refactor.
 *
 * Compatible with:
 * - Initial load
 * - Loading older / newer messages
 * - Optimistic local messages
 * - Inverted FlatList rendering (newest-first array order)
 *
 * @module chat/buildTimeline
 */

// ---------------------------------------------------------------------------
// Timeline Item Types
// ---------------------------------------------------------------------------

/** Discriminated union for all possible timeline row types */
export type TimelineItem<T> = TimelineMessageItem<T> | TimelineDateDivider;

export interface TimelineMessageItem<T> {
  type: "message";
  data: T;
  /** Original index in the source messages array (for stable identity) */
  sourceIndex: number;
  /** Precomputed: is this message grouped with the one visually above? */
  isGroupedWithPrevious: boolean;
  /** Precomputed: is this message grouped with the one visually below? */
  isGroupedWithNext: boolean;
}

export interface TimelineDateDivider {
  type: "date-divider";
  dateKey: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Date helpers (local calendar day)
// ---------------------------------------------------------------------------

/**
 * Returns a stable "YYYY-MM-DD" key for the local calendar day of a timestamp.
 * Uses the device's local timezone (via Date constructor).
 */
function localDayKey(timestampMs: number): string {
  const d = new Date(timestampMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Formats a "YYYY-MM-DD" key into a human-readable label.
 * - Today → "Today"
 * - Yesterday → "Yesterday"
 * - Otherwise → "March 24, 2026"
 */
function formatDayLabel(dateKey: string): string {
  const today = localDayKey(Date.now());
  if (dateKey === today) return "Today";

  const yesterday = localDayKey(Date.now() - 86_400_000);
  if (dateKey === yesterday) return "Yesterday";

  // Parse the key back to a Date to format it
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Grouping checker type
// ---------------------------------------------------------------------------

/**
 * Function that returns true when two adjacent messages should be grouped
 * (same sender, close timestamps, no intervening reply, etc.).
 * The caller provides this so buildTimeline stays generic.
 */
export type AreGroupedFn<T> = (a: T | null, b: T | null) => boolean;

// ---------------------------------------------------------------------------
// buildTimeline
// ---------------------------------------------------------------------------

/**
 * Build a timeline array with date dividers injected at day boundaries.
 *
 * @param messages - Array of messages in display order.
 *   For an inverted FlatList this is newest-first (index 0 = newest).
 * @param getTimestamp - Accessor that returns a ms-epoch timestamp from a message.
 * @param areGrouped - Grouping predicate (same sender, close time, etc.).
 * @returns TimelineItem[] in the same order, with date-divider items inserted
 *   and grouping flags precomputed on each message item.
 *
 * In an inverted list the visual order is bottom-to-top (index 0 at bottom).
 * A date divider is inserted **after** the last message of a day (i.e. before
 * the first message of the previous day in array order) so that visually
 * it appears above all messages belonging to that day.
 *
 * Grouping is automatically broken at day boundaries: two messages on
 * different calendar days are never grouped, even if they would otherwise
 * meet the time/sender threshold.
 */
export function buildTimeline<T>(
  messages: readonly T[],
  getTimestamp: (msg: T) => number,
  areGrouped: AreGroupedFn<T>,
): TimelineItem<T>[] {
  if (messages.length === 0) return [];

  const len = messages.length;
  const dayKeys: string[] = new Array(len);
  for (let i = 0; i < len; i++) {
    dayKeys[i] = localDayKey(getTimestamp(messages[i]));
  }

  // Pre-compute grouping flags for each message.
  // In an inverted list:
  //   - "previous" visually (above) = messages[i + 1]
  //   - "next" visually (below)     = messages[i - 1]
  // Grouping is broken across day boundaries.
  const groupedWithPrev: boolean[] = new Array(len);
  const groupedWithNext: boolean[] = new Array(len);

  for (let i = 0; i < len; i++) {
    const above = i + 1 < len ? messages[i + 1] : null;
    const sameDayAbove = i + 1 < len && dayKeys[i] === dayKeys[i + 1];
    groupedWithPrev[i] = sameDayAbove ? areGrouped(messages[i], above) : false;

    const below = i - 1 >= 0 ? messages[i - 1] : null;
    const sameDayBelow = i - 1 >= 0 && dayKeys[i] === dayKeys[i - 1];
    groupedWithNext[i] = sameDayBelow ? areGrouped(messages[i], below) : false;
  }

  // Build the result with date dividers inserted at day boundaries.
  const result: TimelineItem<T>[] = [];

  for (let i = 0; i < len; i++) {
    result.push({
      type: "message",
      data: messages[i],
      sourceIndex: i,
      isGroupedWithPrevious: groupedWithPrev[i],
      isGroupedWithNext: groupedWithNext[i],
    });

    // Insert a date divider when the next message (older, in inverted order)
    // belongs to a different day — or after the very last (oldest) message.
    const nextDayKey = i + 1 < len ? dayKeys[i + 1] : null;
    if (nextDayKey !== dayKeys[i]) {
      result.push({
        type: "date-divider",
        dateKey: dayKeys[i],
        label: formatDayLabel(dayKeys[i]),
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Key extractor helper
// ---------------------------------------------------------------------------

/**
 * Stable key extractor for TimelineItem used in FlatList.
 * Message items use their original ID; dividers use a prefix + date key.
 */
export function timelineKeyExtractor<T>(
  item: TimelineItem<T>,
  getMessageId: (msg: T) => string,
): string {
  if (item.type === "date-divider") {
    return `__divider__${item.dateKey}`;
  }
  return getMessageId(item.data);
}
