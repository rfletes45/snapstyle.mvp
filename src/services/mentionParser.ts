/**
 * Mention Parser Service
 *
 * Parses @mentions from text, generates spans for highlighting,
 * and handles mention insertion for the composer.
 *
 * @module services/mentionParser
 */

import { MAX_MENTIONS_PER_MESSAGE, MentionSpan } from "@/types/messaging";
import { createLogger } from "@/utils/log";

const log = createLogger("mentionParser");

// =============================================================================
// Types
// =============================================================================

/**
 * Member info needed for mention matching
 */
export interface MentionableMember {
  uid: string;
  displayName: string;
  username?: string;
}

/**
 * Result of detecting an active mention trigger
 */
export interface MentionTriggerResult {
  /** Whether a mention trigger is active */
  active: boolean;
  /** The search query after @ (empty string if just @) */
  query: string;
  /** Index where the @ symbol starts */
  startIndex: number;
}

/**
 * Result of extracting mentions from text
 */
export interface ExtractMentionsResult {
  /** UIDs of all mentioned users */
  mentionUids: string[];
  /** Spans for highlighting */
  mentionSpans: MentionSpan[];
  /** Whether max mentions limit was reached */
  limitReached: boolean;
}

/**
 * Result of inserting a mention
 */
export interface InsertMentionResult {
  /** New text with mention inserted */
  newText: string;
  /** New cursor position (after the mention) */
  newCursorPosition: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Characters that can appear before @ to start a mention */
const MENTION_TRIGGER_CHARS = new Set([" ", "\n", "\t", ""]);

/** Characters that can appear in a display name */
const VALID_MENTION_CHARS = /^[a-zA-Z0-9_\s-]+$/;

/** Maximum length of mention query to search */
const MAX_QUERY_LENGTH = 50;

// =============================================================================
// Mention Trigger Detection
// =============================================================================

/**
 * Detect if there's an active mention trigger at the cursor position.
 *
 * A trigger is active when:
 * - There's an @ character
 * - The @ is at the start of text or preceded by whitespace
 * - Cursor is after the @ and before any whitespace
 *
 * @param text - Current text content
 * @param cursorPosition - Current cursor position (index)
 * @returns Trigger state with query and position
 *
 * @example
 * detectMentionTrigger("Hello @ja", 9) // { active: true, query: "ja", startIndex: 6 }
 * detectMentionTrigger("Hello @", 7)   // { active: true, query: "", startIndex: 6 }
 * detectMentionTrigger("Hello", 5)     // { active: false, query: "", startIndex: -1 }
 */
export function detectMentionTrigger(
  text: string,
  cursorPosition: number,
): MentionTriggerResult {
  const notActive: MentionTriggerResult = {
    active: false,
    query: "",
    startIndex: -1,
  };

  // Cursor must be within text bounds
  if (cursorPosition < 0 || cursorPosition > text.length) {
    return notActive;
  }

  // Look backwards from cursor for @ symbol
  let atIndex = -1;
  for (let i = cursorPosition - 1; i >= 0; i--) {
    const char = text[i];

    // Found @
    if (char === "@") {
      atIndex = i;
      break;
    }

    // Stop if we hit whitespace (no active trigger)
    if (char === " " || char === "\n" || char === "\t") {
      return notActive;
    }
  }

  // No @ found before cursor
  if (atIndex === -1) {
    return notActive;
  }

  // Check that @ is at start or preceded by whitespace
  if (atIndex > 0) {
    const charBefore = text[atIndex - 1];
    if (!MENTION_TRIGGER_CHARS.has(charBefore)) {
      return notActive;
    }
  }

  // Extract query (text between @ and cursor)
  const query = text.substring(atIndex + 1, cursorPosition);

  // Validate query isn't too long
  if (query.length > MAX_QUERY_LENGTH) {
    return notActive;
  }

  return {
    active: true,
    query,
    startIndex: atIndex,
  };
}

// =============================================================================
// Member Filtering
// =============================================================================

/**
 * Filter members by search query.
 *
 * Matches against:
 * - Display name (case-insensitive, prefix match)
 * - Username (case-insensitive, prefix match)
 *
 * @param members - List of mentionable members
 * @param query - Search query
 * @param excludeUids - UIDs to exclude (e.g., current user)
 * @returns Filtered and sorted members
 */
export function filterMembersByQuery(
  members: MentionableMember[],
  query: string,
  excludeUids: string[] = [],
): MentionableMember[] {
  const lowerQuery = query.toLowerCase().trim();
  const excludeSet = new Set(excludeUids);

  const filtered = members.filter((member) => {
    // Skip excluded users
    if (excludeSet.has(member.uid)) {
      return false;
    }

    // Empty query shows all
    if (!lowerQuery) {
      return true;
    }

    // Match display name
    if (member.displayName.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Match username
    if (member.username?.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    return false;
  });

  // Sort by relevance:
  // 1. Prefix match on display name
  // 2. Prefix match on username
  // 3. Contains match (alphabetical)
  return filtered.sort((a, b) => {
    const aNamePrefix = a.displayName.toLowerCase().startsWith(lowerQuery);
    const bNamePrefix = b.displayName.toLowerCase().startsWith(lowerQuery);

    if (aNamePrefix && !bNamePrefix) return -1;
    if (!aNamePrefix && bNamePrefix) return 1;

    const aUserPrefix = a.username?.toLowerCase().startsWith(lowerQuery);
    const bUserPrefix = b.username?.toLowerCase().startsWith(lowerQuery);

    if (aUserPrefix && !bUserPrefix) return -1;
    if (!aUserPrefix && bUserPrefix) return 1;

    // Alphabetical fallback
    return a.displayName.localeCompare(b.displayName);
  });
}

// =============================================================================
// Mention Insertion
// =============================================================================

/**
 * Insert a mention at the trigger position.
 *
 * Replaces "@query" with "@DisplayName " (with trailing space).
 *
 * @param text - Current text
 * @param triggerStartIndex - Index of the @ symbol
 * @param cursorPosition - Current cursor position
 * @param member - Member to mention
 * @returns New text and cursor position
 */
export function insertMention(
  text: string,
  triggerStartIndex: number,
  cursorPosition: number,
  member: MentionableMember,
): InsertMentionResult {
  // Build mention text: @DisplayName with trailing space
  const mentionText = `@${member.displayName} `;

  // Replace from @ to cursor with mention
  const before = text.substring(0, triggerStartIndex);
  const after = text.substring(cursorPosition);
  const newText = before + mentionText + after;

  // Position cursor after the mention
  const newCursorPosition = triggerStartIndex + mentionText.length;

  return {
    newText,
    newCursorPosition,
  };
}

// =============================================================================
// Mention Extraction
// =============================================================================

/**
 * Extract all mentions from text.
 *
 * Looks for @DisplayName patterns and matches them against known members.
 * This is used before sending a message to populate mentionUids and mentionSpans.
 *
 * @param text - Message text
 * @param members - Known group members
 * @returns Extracted mentions with UIDs and spans
 */
export function extractMentions(
  text: string,
  members: MentionableMember[],
): ExtractMentionsResult {
  const mentionUids: string[] = [];
  const mentionSpans: MentionSpan[] = [];

  // Build a map for efficient lookup (display name -> member)
  const nameToMember = new Map<string, MentionableMember>();
  for (const member of members) {
    nameToMember.set(member.displayName.toLowerCase(), member);
  }

  // Regex to find @mentions
  // Matches @ followed by word characters, spaces, hyphens until a delimiter
  const mentionRegex = /@([a-zA-Z0-9_\s-]+?)(?=\s|$|@|[.,!?;:])/g;

  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    // Check if we've hit the limit
    if (mentionUids.length >= MAX_MENTIONS_PER_MESSAGE) {
      break;
    }

    const potentialName = match[1].trim().toLowerCase();
    const member = nameToMember.get(potentialName);

    if (member && !mentionUids.includes(member.uid)) {
      mentionUids.push(member.uid);
      mentionSpans.push({
        uid: member.uid,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return {
    mentionUids,
    mentionSpans,
    limitReached: mentionUids.length >= MAX_MENTIONS_PER_MESSAGE,
  };
}

/**
 * Alternative extraction that matches against exact display names.
 *
 * More precise than regex-based extraction - looks for exact @DisplayName matches.
 *
 * @param text - Message text
 * @param members - Known group members
 * @returns Extracted mentions with UIDs and spans
 */
export function extractMentionsExact(
  text: string,
  members: MentionableMember[],
): ExtractMentionsResult {
  const mentionUids: string[] = [];
  const mentionSpans: MentionSpan[] = [];

  // Sort members by display name length (longest first) to avoid partial matches
  const sortedMembers = [...members].sort(
    (a, b) => b.displayName.length - a.displayName.length,
  );

  let searchText = text;
  let offset = 0;

  for (const member of sortedMembers) {
    if (mentionUids.length >= MAX_MENTIONS_PER_MESSAGE) {
      break;
    }

    const mentionPattern = `@${member.displayName}`;
    const lowerText = searchText.toLowerCase();
    const lowerPattern = mentionPattern.toLowerCase();

    let searchFrom = 0;
    let foundIndex = lowerText.indexOf(lowerPattern, searchFrom);

    while (foundIndex !== -1 && mentionUids.length < MAX_MENTIONS_PER_MESSAGE) {
      // Check if this is a word boundary (preceded by whitespace or start)
      const isStart = foundIndex === 0;
      const isPrecededBySpace =
        foundIndex > 0 && /\s/.test(text[foundIndex - 1]);

      // Check if followed by word boundary
      const endIndex = foundIndex + mentionPattern.length;
      const isEnd = endIndex >= text.length;
      const isFollowedByBoundary =
        endIndex < text.length && /[\s.,!?;:]/.test(text[endIndex]);

      if ((isStart || isPrecededBySpace) && (isEnd || isFollowedByBoundary)) {
        if (!mentionUids.includes(member.uid)) {
          mentionUids.push(member.uid);
          mentionSpans.push({
            uid: member.uid,
            start: foundIndex,
            end: endIndex,
          });
        }
      }

      // Continue searching
      searchFrom = foundIndex + 1;
      foundIndex = lowerText.indexOf(lowerPattern, searchFrom);
    }
  }

  // Sort spans by start position
  mentionSpans.sort((a, b) => a.start - b.start);

  return {
    mentionUids,
    mentionSpans,
    limitReached: mentionUids.length >= MAX_MENTIONS_PER_MESSAGE,
  };
}

// =============================================================================
// Mention Validation
// =============================================================================

/**
 * Validate mention UIDs against known members.
 *
 * Filters out any UIDs that don't correspond to actual group members.
 *
 * @param mentionUids - UIDs to validate
 * @param members - Known group members
 * @returns Validated UIDs
 */
export function validateMentionUids(
  mentionUids: string[],
  members: MentionableMember[],
): string[] {
  const memberUids = new Set(members.map((m) => m.uid));
  return mentionUids.filter((uid) => memberUids.has(uid));
}

/**
 * Check if a user is mentioned in a message.
 *
 * @param mentionUids - UIDs mentioned in the message
 * @param uid - User ID to check
 * @returns True if mentioned
 */
export function isMentioned(
  mentionUids: string[] | undefined,
  uid: string,
): boolean {
  return mentionUids?.includes(uid) ?? false;
}

// =============================================================================
// Text Rendering
// =============================================================================

/**
 * Segment text into mention and non-mention parts for rendering.
 *
 * Returns an array of segments that can be rendered with different styles.
 *
 * @param text - Message text
 * @param mentionSpans - Mention spans from extraction
 * @returns Array of text segments
 */
export interface TextSegment {
  type: "text" | "mention";
  content: string;
  uid?: string;
}

export function segmentTextWithMentions(
  text: string,
  mentionSpans: MentionSpan[] | undefined,
): TextSegment[] {
  if (!mentionSpans || mentionSpans.length === 0) {
    return [{ type: "text", content: text }];
  }

  const segments: TextSegment[] = [];
  let lastEnd = 0;

  // Sort spans by start position
  const sortedSpans = [...mentionSpans].sort((a, b) => a.start - b.start);

  for (const span of sortedSpans) {
    // Add text before this mention
    if (span.start > lastEnd) {
      segments.push({
        type: "text",
        content: text.substring(lastEnd, span.start),
      });
    }

    // Add the mention
    segments.push({
      type: "mention",
      content: text.substring(span.start, span.end),
      uid: span.uid,
    });

    lastEnd = span.end;
  }

  // Add remaining text after last mention
  if (lastEnd < text.length) {
    segments.push({
      type: "text",
      content: text.substring(lastEnd),
    });
  }

  return segments;
}

// =============================================================================
// Debug Helpers
// =============================================================================

/**
 * Log mention extraction results for debugging.
 */
export function logMentionExtraction(
  text: string,
  result: ExtractMentionsResult,
): void {
  if (__DEV__) {
    log.debug("Mention extraction", {
      data: {
        text: text.substring(0, 100),
        uids: result.mentionUids,
        spans: result.mentionSpans,
        limitReached: result.limitReached,
      },
    });
  }
}
