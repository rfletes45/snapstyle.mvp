/**
 * dateSearchParser — Natural date query parsing for search
 *
 * Parses user-typed date queries (e.g. "january", "January 4th",
 * "january fourth") into structured date ranges for SQL filtering.
 *
 * Supports:
 * - Month names (full and common abbreviations)
 * - Month + numeric day ("January 4", "Jan 4th")
 * - Month + ordinal word day ("January fourth")
 * - Case-insensitive
 *
 * Does NOT attempt full natural-language parsing. If the input
 * doesn't match a recognized date pattern, returns null so the
 * caller can fall back to normal text search.
 */

// =============================================================================
// Month name lookup
// =============================================================================

const MONTH_MAP: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

// =============================================================================
// Ordinal word → number
// =============================================================================

const ORDINAL_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  "twenty-first": 21,
  "twenty first": 21,
  "twenty-second": 22,
  "twenty second": 22,
  "twenty-third": 23,
  "twenty third": 23,
  "twenty-fourth": 24,
  "twenty fourth": 24,
  "twenty-fifth": 25,
  "twenty fifth": 25,
  "twenty-sixth": 26,
  "twenty sixth": 26,
  "twenty-seventh": 27,
  "twenty seventh": 27,
  "twenty-eighth": 28,
  "twenty eighth": 28,
  "twenty-ninth": 29,
  "twenty ninth": 29,
  thirtieth: 30,
  "thirty-first": 31,
  "thirty first": 31,
};

// =============================================================================
// Public API
// =============================================================================

export interface DateRange {
  /** Inclusive start timestamp (ms) */
  startMs: number;
  /** Exclusive end timestamp (ms) */
  endMs: number;
}

/**
 * Try to parse a user query as a date reference.
 *
 * Returns a DateRange if the query matches a recognized date pattern,
 * or null if it doesn't look like a date query.
 *
 * The range is computed for the current year by default. If we're early
 * in the year and the month hasn't happened yet, we still match the
 * current year (the user may be searching past years anyway — the SQL
 * query will just return whatever matches).
 */
export function parseDateQuery(query: string): DateRange | null {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return null;

  // Try "month day" pattern first (more specific)
  const monthDay = parseMonthDay(trimmed);
  if (monthDay) return monthDay;

  // Try month-only
  const monthOnly = parseMonthOnly(trimmed);
  if (monthOnly) return monthOnly;

  return null;
}

// =============================================================================
// Internal parsers
// =============================================================================

/**
 * Parse "january 4", "jan 4th", "january fourth", "december twenty-first"
 */
function parseMonthDay(input: string): DateRange | null {
  // Split on whitespace; the first token should be a month name.
  const tokens = input.split(/\s+/);
  if (tokens.length < 2) return null;

  const monthToken = tokens[0];
  const month = MONTH_MAP[monthToken];
  if (month === undefined) return null;

  // The rest is the day portion
  const dayPart = tokens.slice(1).join(" ");

  let day: number | undefined;

  // Try numeric ordinal: "4th", "21st", "2nd", "3rd", "4"
  const numericMatch = dayPart.match(/^(\d{1,2})(?:st|nd|rd|th)?$/);
  if (numericMatch) {
    day = parseInt(numericMatch[1], 10);
  }

  // Try ordinal word: "fourth", "twenty-first", "twenty first"
  if (day === undefined) {
    day = ORDINAL_WORDS[dayPart];
  }

  if (!day || day < 1 || day > 31) return null;

  // Validate the day is possible for this month
  // Use a recent leap year (2024) for February to be permissive
  const maxDay = new Date(2024, month + 1, 0).getDate();
  if (day > maxDay) return null;

  // Build range for this day across all years the app might have data for.
  // We generate ranges for each year from a reasonable start to now.
  return buildDayRangeAllYears(month, day);
}

/**
 * Parse "january", "jan", "december"
 */
function parseMonthOnly(input: string): DateRange | null {
  const month = MONTH_MAP[input];
  if (month === undefined) return null;

  return buildMonthRangeAllYears(month);
}

/**
 * Build a date range spanning a specific month across multiple years.
 * This lets searches find messages from any year, not just the current one.
 */
function buildMonthRangeAllYears(month: number): DateRange {
  const now = new Date();
  const currentYear = now.getFullYear();
  // Go back 5 years — reasonable for a messaging app
  const startYear = currentYear - 5;

  const startMs = new Date(startYear, month, 1).getTime();
  // End at the start of the next month in the current year
  const endMs = new Date(currentYear, month + 1, 1).getTime();

  return { startMs, endMs };
}

/**
 * Build a date range spanning a specific day-of-month across multiple years.
 */
function buildDayRangeAllYears(month: number, day: number): DateRange {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = currentYear - 5;

  // Earliest possible start
  const startMs = new Date(startYear, month, day).getTime();
  // End at the start of the next day in the current year
  const endMs = new Date(currentYear, month, day + 1).getTime();

  return { startMs, endMs };
}

/**
 * Check if a timestamp falls within any year's instance of this date range.
 * Used when we need to filter in-memory rather than in SQL.
 *
 * For month-only queries, checks if the timestamp's month matches.
 * For month+day queries, checks if both month and day match.
 */
export function timestampMatchesDateQuery(
  timestampMs: number,
  query: string,
): boolean {
  const range = parseDateQuery(query);
  if (!range) return false;
  return timestampMs >= range.startMs && timestampMs < range.endMs;
}
