/**
 * Tests for mentionParser service
 *
 * Covers: trigger detection, member filtering, mention insertion,
 * mention extraction, text segmentation, and edge cases.
 */

import {
  detectMentionTrigger,
  extractMentionsExact,
  filterMembersByQuery,
  insertMention,
  isMentioned,
  type MentionableMember,
  segmentTextWithMentions,
  validateMentionUids,
} from "../../src/services/mentionParser";

// =============================================================================
// Test Data
// =============================================================================

const MEMBERS: MentionableMember[] = [
  { uid: "u1", displayName: "Alice", username: "alice_w" },
  { uid: "u2", displayName: "Bob Smith", username: "bob" },
  { uid: "u3", displayName: "Charlie", username: "charlie123" },
  { uid: "u4", displayName: "Alice B", username: "alice_b" },
];

// =============================================================================
// detectMentionTrigger
// =============================================================================

describe("detectMentionTrigger", () => {
  it("detects @ at start of text", () => {
    const result = detectMentionTrigger("@al", 3);
    expect(result.active).toBe(true);
    expect(result.query).toBe("al");
    expect(result.startIndex).toBe(0);
  });

  it("detects @ after whitespace", () => {
    const result = detectMentionTrigger("Hello @ja", 9);
    expect(result.active).toBe(true);
    expect(result.query).toBe("ja");
    expect(result.startIndex).toBe(6);
  });

  it("returns empty query for bare @", () => {
    const result = detectMentionTrigger("Hello @", 7);
    expect(result.active).toBe(true);
    expect(result.query).toBe("");
    expect(result.startIndex).toBe(6);
  });

  it("does not trigger mid-word", () => {
    const result = detectMentionTrigger("email@test", 10);
    expect(result.active).toBe(false);
  });

  it("does not trigger with no @", () => {
    const result = detectMentionTrigger("Hello world", 11);
    expect(result.active).toBe(false);
  });

  it("handles cursor at position 0", () => {
    const result = detectMentionTrigger("text", 0);
    expect(result.active).toBe(false);
  });

  it("handles out-of-bounds cursor", () => {
    expect(detectMentionTrigger("abc", -1).active).toBe(false);
    expect(detectMentionTrigger("abc", 100).active).toBe(false);
  });

  it("detects @ after newline", () => {
    const result = detectMentionTrigger("line1\n@bob", 10);
    expect(result.active).toBe(true);
    expect(result.query).toBe("bob");
  });
});

// =============================================================================
// filterMembersByQuery
// =============================================================================

describe("filterMembersByQuery", () => {
  it("returns all members for empty query", () => {
    const result = filterMembersByQuery(MEMBERS, "");
    expect(result).toHaveLength(4);
  });

  it("filters by display name", () => {
    const result = filterMembersByQuery(MEMBERS, "ali");
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.uid)).toContain("u1");
    expect(result.map((m) => m.uid)).toContain("u4");
  });

  it("filters by username", () => {
    const result = filterMembersByQuery(MEMBERS, "charlie");
    expect(result).toHaveLength(1);
    expect(result[0].uid).toBe("u3");
  });

  it("excludes specified UIDs", () => {
    const result = filterMembersByQuery(MEMBERS, "", ["u1"]);
    expect(result).toHaveLength(3);
    expect(result.map((m) => m.uid)).not.toContain("u1");
  });

  it("is case-insensitive", () => {
    const result = filterMembersByQuery(MEMBERS, "BOB");
    expect(result).toHaveLength(1);
    expect(result[0].uid).toBe("u2");
  });

  it("ranks prefix matches higher", () => {
    const result = filterMembersByQuery(MEMBERS, "alice");
    // "Alice" (prefix match) should come before "Alice B" (also prefix)
    expect(result[0].displayName).toBe("Alice");
  });

  it("returns empty for no matches", () => {
    const result = filterMembersByQuery(MEMBERS, "zzzzz");
    expect(result).toHaveLength(0);
  });
});

// =============================================================================
// insertMention
// =============================================================================

describe("insertMention", () => {
  it("inserts mention replacing @query", () => {
    const result = insertMention("Hello @al", 6, 9, MEMBERS[0]);
    expect(result.newText).toBe("Hello @Alice ");
    expect(result.newCursorPosition).toBe(13);
  });

  it("inserts at start of text", () => {
    const result = insertMention("@bo", 0, 3, MEMBERS[1]);
    expect(result.newText).toBe("@Bob Smith ");
    expect(result.newCursorPosition).toBe(11);
  });

  it("preserves text after cursor", () => {
    const result = insertMention("Hey @al please help", 4, 7, MEMBERS[0]);
    expect(result.newText).toBe("Hey @Alice  please help");
  });
});

// =============================================================================
// extractMentionsExact
// =============================================================================

describe("extractMentionsExact", () => {
  it("extracts single mention", () => {
    const result = extractMentionsExact("Hey @Alice check this", MEMBERS);
    expect(result.mentionUids).toEqual(["u1"]);
    expect(result.mentionSpans).toHaveLength(1);
    expect(result.mentionSpans[0]).toEqual(
      expect.objectContaining({
        uid: "u1",
        start: 4,
        end: 10,
        displayName: "Alice",
      }),
    );
  });

  it("extracts multiple mentions", () => {
    const result = extractMentionsExact(
      "@Alice and @Bob Smith are here",
      MEMBERS,
    );
    expect(result.mentionUids).toContain("u1");
    expect(result.mentionUids).toContain("u2");
    expect(result.mentionSpans).toHaveLength(2);
  });

  it("handles mention with space in name", () => {
    const result = extractMentionsExact("Hey @Bob Smith!", MEMBERS);
    expect(result.mentionUids).toEqual(["u2"]);
    expect(result.mentionSpans[0].end).toBe(14);
  });

  it("does not match mid-word @", () => {
    const result = extractMentionsExact("email@Alice.com", MEMBERS);
    expect(result.mentionUids).toHaveLength(0);
  });

  it("limits to MAX_MENTIONS_PER_MESSAGE", () => {
    // Create text with more than 5 mentions
    const manyMembers = Array.from({ length: 10 }, (_, i) => ({
      uid: `m${i}`,
      displayName: `User${i}`,
    }));
    const text = manyMembers.map((m) => `@${m.displayName}`).join(" ");
    const result = extractMentionsExact(text, manyMembers);
    expect(result.mentionUids.length).toBeLessThanOrEqual(5);
    expect(result.limitReached).toBe(true);
  });

  it("avoids overlapping spans for names that are substrings", () => {
    // "Alice B" is longer than "Alice", so it should be matched first
    const result = extractMentionsExact("Hello @Alice B!", MEMBERS);
    expect(result.mentionUids).toEqual(["u4"]);
    expect(result.mentionSpans).toHaveLength(1);
    expect(result.mentionSpans[0].displayName).toBe("Alice B");
  });

  it("returns empty for no mentions", () => {
    const result = extractMentionsExact("Just a normal message", MEMBERS);
    expect(result.mentionUids).toHaveLength(0);
    expect(result.mentionSpans).toHaveLength(0);
    expect(result.limitReached).toBe(false);
  });

  it("includes displayName and username in spans", () => {
    const result = extractMentionsExact("Hey @Charlie!", MEMBERS);
    expect(result.mentionSpans[0]).toEqual(
      expect.objectContaining({
        uid: "u3",
        displayName: "Charlie",
        username: "charlie123",
      }),
    );
  });
});

// =============================================================================
// segmentTextWithMentions
// =============================================================================

describe("segmentTextWithMentions", () => {
  it("returns single text segment for no mentions", () => {
    const segments = segmentTextWithMentions("Hello world", undefined);
    expect(segments).toEqual([{ type: "text", content: "Hello world" }]);
  });

  it("returns single text segment for empty spans", () => {
    const segments = segmentTextWithMentions("Hello world", []);
    expect(segments).toEqual([{ type: "text", content: "Hello world" }]);
  });

  it("segments text with single mention", () => {
    const spans = [{ uid: "u1", start: 4, end: 10, displayName: "Alice" }];
    const segments = segmentTextWithMentions("Hey @Alice check", spans);
    expect(segments).toEqual([
      { type: "text", content: "Hey " },
      {
        type: "mention",
        content: "@Alice",
        uid: "u1",
        displayName: "Alice",
        username: undefined,
      },
      { type: "text", content: " check" },
    ]);
  });

  it("handles mention at start", () => {
    const spans = [{ uid: "u1", start: 0, end: 6 }];
    const segments = segmentTextWithMentions("@Alice hi", spans);
    expect(segments[0].type).toBe("mention");
    expect(segments[1].type).toBe("text");
  });

  it("handles mention at end", () => {
    const spans = [{ uid: "u1", start: 3, end: 9 }];
    const segments = segmentTextWithMentions("Hi @Alice", spans);
    expect(segments).toHaveLength(2);
    expect(segments[1].type).toBe("mention");
  });

  it("skips out-of-bounds spans (backward compat)", () => {
    const badSpans = [
      { uid: "u1", start: -1, end: 5 },
      { uid: "u2", start: 0, end: 100 },
      { uid: "u3", start: 5, end: 3 }, // end before start
    ];
    const segments = segmentTextWithMentions("Hello", badSpans);
    expect(segments).toEqual([{ type: "text", content: "Hello" }]);
  });

  it("handles multiple adjacent mentions", () => {
    const spans = [
      { uid: "u1", start: 0, end: 6 },
      { uid: "u2", start: 7, end: 17 },
    ];
    const segments = segmentTextWithMentions("@Alice @Bob Smith", spans);
    expect(segments).toHaveLength(3);
    expect(segments[0].type).toBe("mention");
    expect(segments[1].type).toBe("text");
    expect(segments[1].content).toBe(" ");
    expect(segments[2].type).toBe("mention");
  });
});

// =============================================================================
// Utility Functions
// =============================================================================

describe("validateMentionUids", () => {
  it("filters valid UIDs", () => {
    const result = validateMentionUids(["u1", "u2", "unknown"], MEMBERS);
    expect(result).toEqual(["u1", "u2"]);
  });

  it("returns empty for no valid UIDs", () => {
    const result = validateMentionUids(["x1", "x2"], MEMBERS);
    expect(result).toEqual([]);
  });
});

describe("isMentioned", () => {
  it("returns true when UID is in list", () => {
    expect(isMentioned(["u1", "u2"], "u1")).toBe(true);
  });

  it("returns false when UID is not in list", () => {
    expect(isMentioned(["u2", "u3"], "u1")).toBe(false);
  });

  it("returns false for undefined list", () => {
    expect(isMentioned(undefined, "u1")).toBe(false);
  });
});
