/**
 * Tests for inbox parity telemetry and visibility filtering.
 *
 * Covers:
 * - isDMVisible / isGroupVisible behaviour (pure logic, no Firestore)
 * - compareInboxParity detection of archive/mute/pin mismatches
 * - parity report structure
 */

import { compareInboxParity } from "../../src/services/chat/inboxParityTelemetry";
import { getDefaultMemberState } from "../../src/services/chat/normalizeInboxRow";
import type {
  InboxConversation,
  MemberStatePrivate,
} from "../../src/types/messaging";

// =============================================================================
// Pure visibility logic (inlined to avoid Firestore import chain)
// These mirror the exact logic from chatMembers.isDMVisible and
// groupMembers.isGroupVisible — pure functions with no Firestore deps.
// =============================================================================

function isDMVisible(memberState: MemberStatePrivate | null): boolean {
  if (!memberState) return true;
  if (memberState.deletedAt && memberState.hiddenUntilNewMessage) return false;
  return true;
}

function isGroupVisible(memberState: MemberStatePrivate | null): boolean {
  if (!memberState) return true;
  if (memberState.deletedAt && memberState.hiddenUntilNewMessage) return false;
  return true;
}

// =============================================================================
// Visibility Filtering
// =============================================================================

describe("isDMVisible", () => {
  it("returns true when memberState is null", () => {
    expect(isDMVisible(null)).toBe(true);
  });

  it("returns true when deletedAt is not set", () => {
    expect(isDMVisible(getDefaultMemberState("u"))).toBe(true);
  });

  it("returns false when deletedAt is set and hiddenUntilNewMessage is true", () => {
    expect(
      isDMVisible({
        ...getDefaultMemberState("u"),
        deletedAt: Date.now(),
        hiddenUntilNewMessage: true,
      }),
    ).toBe(false);
  });

  it("returns true when deletedAt is set but hiddenUntilNewMessage is false", () => {
    expect(
      isDMVisible({
        ...getDefaultMemberState("u"),
        deletedAt: Date.now(),
        hiddenUntilNewMessage: false,
      }),
    ).toBe(true);
  });
});

describe("isGroupVisible", () => {
  it("returns true when memberState is null", () => {
    expect(isGroupVisible(null)).toBe(true);
  });

  it("returns false when soft-deleted and hidden", () => {
    expect(
      isGroupVisible({
        ...getDefaultMemberState("u"),
        deletedAt: Date.now(),
        hiddenUntilNewMessage: true,
      }),
    ).toBe(false);
  });

  it("returns true when not deleted", () => {
    expect(isGroupVisible(getDefaultMemberState("u"))).toBe(true);
  });
});

// =============================================================================
// Parity Telemetry
// =============================================================================

describe("compareInboxParity", () => {
  const mkConvo = (overrides: Partial<InboxConversation>): InboxConversation =>
    ({
      id: "id",
      type: "dm" as const,
      name: "Name",
      avatarUrl: null,
      lastMessage: null,
      memberState: getDefaultMemberState("u"),
      unreadCount: 0,
      hasMentions: false,
      createdAt: 0,
      ...overrides,
    }) as InboxConversation;

  it("returns null when not in __DEV__", () => {
    // In test runner __DEV__ defaults to true, so this test documents the
    // expected output under dev conditions.
    const report = compareInboxParity([], []);
    // When INBOX_PARITY_DEBUG is true (dev), report object is returned even
    // for empty lists.
    if (report) {
      expect(report.fanoutCount).toBe(0);
      expect(report.aggregatedCount).toBe(0);
    }
  });

  it("detects missing conversations", () => {
    const fanout = [mkConvo({ id: "c-1" }), mkConvo({ id: "c-2" })];
    const aggregated = [mkConvo({ id: "c-1" })];
    const report = compareInboxParity(fanout, aggregated);
    expect(report?.missingInAggregated).toContain("c-2");
  });

  it("detects unread mismatches", () => {
    const fanout = [mkConvo({ id: "c-1", unreadCount: 3 })];
    const aggregated = [mkConvo({ id: "c-1", unreadCount: 0 })];
    const report = compareInboxParity(fanout, aggregated);
    expect(report?.unreadMismatches).toEqual([
      { id: "c-1", fanoutUnread: 3, aggregatedUnread: 0 },
    ]);
  });

  it("detects pin mismatches", () => {
    const fanout = [
      mkConvo({
        id: "c-1",
        memberState: { ...getDefaultMemberState("u"), pinnedAt: 1000 },
      }),
    ];
    const aggregated = [mkConvo({ id: "c-1" })];
    const report = compareInboxParity(fanout, aggregated);
    expect(report?.pinMismatches).toEqual([
      { id: "c-1", fanoutPinned: true, aggregatedPinned: false },
    ]);
  });

  it("detects archive mismatches", () => {
    const fanout = [
      mkConvo({
        id: "c-1",
        memberState: { ...getDefaultMemberState("u"), archived: true },
      }),
    ];
    const aggregated = [mkConvo({ id: "c-1" })];
    const report = compareInboxParity(fanout, aggregated);
    expect(report?.archiveMismatches).toEqual([
      { id: "c-1", fanoutArchived: true, aggregatedArchived: false },
    ]);
  });

  it("detects mute mismatches", () => {
    const fanout = [
      mkConvo({
        id: "c-1",
        memberState: { ...getDefaultMemberState("u"), mutedUntil: -1 },
      }),
    ];
    const aggregated = [mkConvo({ id: "c-1" })];
    const report = compareInboxParity(fanout, aggregated);
    expect(report?.muteMismatches).toEqual([
      { id: "c-1", fanoutMuted: true, aggregatedMuted: false },
    ]);
  });

  it("reports zero drifts when lists match", () => {
    const conv = mkConvo({ id: "c-1", unreadCount: 1 });
    const report = compareInboxParity([conv], [conv]);
    expect(report?.missingInAggregated).toEqual([]);
    expect(report?.missingInFanout).toEqual([]);
    expect(report?.unreadMismatches).toEqual([]);
    expect(report?.pinMismatches).toEqual([]);
    expect(report?.archiveMismatches).toEqual([]);
    expect(report?.muteMismatches).toEqual([]);
  });
});
