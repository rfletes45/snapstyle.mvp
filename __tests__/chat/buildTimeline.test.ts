/**
 * Tests for buildTimeline — date divider insertion logic
 */

import { buildTimeline, timelineKeyExtractor } from "@/chat/buildTimeline";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FakeMsg {
  id: string;
  sender: string;
  createdAt: number;
}

const ms = (date: string, time = "12:00:00") =>
  new Date(`${date}T${time}`).getTime();

/** Simple grouping: same sender within 2 minutes */
const areGrouped = (a: FakeMsg | null, b: FakeMsg | null) => {
  if (!a || !b) return false;
  if (a.sender !== b.sender) return false;
  return Math.abs(a.createdAt - b.createdAt) < 2 * 60 * 1000;
};

const getTs = (m: FakeMsg) => m.createdAt;
const getId = (m: FakeMsg) => m.id;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildTimeline", () => {
  it("returns empty array for empty messages", () => {
    expect(buildTimeline([], getTs, areGrouped)).toEqual([]);
  });

  it("adds a single divider for messages on the same day", () => {
    // Inverted order: newest first
    const msgs: FakeMsg[] = [
      { id: "3", sender: "A", createdAt: ms("2026-03-24", "14:00:00") },
      { id: "2", sender: "B", createdAt: ms("2026-03-24", "13:00:00") },
      { id: "1", sender: "A", createdAt: ms("2026-03-24", "12:00:00") },
    ];

    const timeline = buildTimeline(msgs, getTs, areGrouped);

    // 3 messages + 1 divider = 4 items
    expect(timeline).toHaveLength(4);
    expect(timeline[0].type).toBe("message");
    expect(timeline[1].type).toBe("message");
    expect(timeline[2].type).toBe("message");
    expect(timeline[3].type).toBe("date-divider");
    if (timeline[3].type === "date-divider") {
      expect(timeline[3].dateKey).toBe("2026-03-24");
    }
  });

  it("inserts dividers at day boundaries (inverted list)", () => {
    // Inverted order: newest first (index 0 = visually at bottom)
    const msgs: FakeMsg[] = [
      { id: "4", sender: "A", createdAt: ms("2026-03-25", "09:00:00") },
      { id: "3", sender: "A", createdAt: ms("2026-03-25", "08:00:00") },
      { id: "2", sender: "B", createdAt: ms("2026-03-24", "23:00:00") },
      { id: "1", sender: "A", createdAt: ms("2026-03-24", "22:00:00") },
    ];

    const timeline = buildTimeline(msgs, getTs, areGrouped);

    // 4 messages + 2 dividers (one for each day) = 6 items
    expect(timeline).toHaveLength(6);

    // Walk through expected order:
    // msg4, msg3, divider(Mar 25), msg2, msg1, divider(Mar 24)
    expect(timeline[0].type).toBe("message");
    expect(timeline[1].type).toBe("message");
    expect(timeline[2].type).toBe("date-divider");
    if (timeline[2].type === "date-divider") {
      expect(timeline[2].dateKey).toBe("2026-03-25");
    }
    expect(timeline[3].type).toBe("message");
    expect(timeline[4].type).toBe("message");
    expect(timeline[5].type).toBe("date-divider");
    if (timeline[5].type === "date-divider") {
      expect(timeline[5].dateKey).toBe("2026-03-24");
    }
  });

  it("breaks grouping across day boundaries", () => {
    // Two messages by same sender, 1 second apart, crossing midnight
    const msgs: FakeMsg[] = [
      { id: "2", sender: "A", createdAt: ms("2026-03-25", "00:00:01") },
      { id: "1", sender: "A", createdAt: ms("2026-03-24", "23:59:59") },
    ];

    const timeline = buildTimeline(msgs, getTs, areGrouped);

    // Both messages should NOT be grouped despite being <2min apart
    const msg1 = timeline.find(
      (t) => t.type === "message" && t.data.id === "2",
    );
    const msg2 = timeline.find(
      (t) => t.type === "message" && t.data.id === "1",
    );

    expect(msg1).toBeDefined();
    expect(msg2).toBeDefined();
    if (msg1?.type === "message") {
      // msg "2" (newer) should not be grouped with next (older day)
      expect(msg1.isGroupedWithNext).toBe(false);
    }
    if (msg2?.type === "message") {
      // msg "1" (older) should not be grouped with previous (newer day)
      expect(msg2.isGroupedWithPrevious).toBe(false);
    }
  });

  it("groups messages within the same day correctly", () => {
    // Two messages by same sender, 30 seconds apart, same day
    // Inverted order: index 0 = newest (bottom), index 1 = older (top)
    const msgs: FakeMsg[] = [
      { id: "2", sender: "A", createdAt: ms("2026-03-24", "12:00:30") },
      { id: "1", sender: "A", createdAt: ms("2026-03-24", "12:00:00") },
    ];

    const timeline = buildTimeline(msgs, getTs, areGrouped);

    const msg1 = timeline.find(
      (t) => t.type === "message" && t.data.id === "2",
    );
    const msg2 = timeline.find(
      (t) => t.type === "message" && t.data.id === "1",
    );

    // In inverted list: "previous" = above (older), "next" = below (newer)
    // msg "2" (newest, bottom): grouped with msg "1" above → isGroupedWithPrevious=true
    if (msg1?.type === "message") {
      expect(msg1.isGroupedWithPrevious).toBe(true);
    }
    // msg "1" (oldest, top): grouped with msg "2" below → isGroupedWithNext=true
    if (msg2?.type === "message") {
      expect(msg2.isGroupedWithNext).toBe(true);
    }
  });

  it("does not produce duplicate adjacent dividers", () => {
    const msgs: FakeMsg[] = [
      { id: "1", sender: "A", createdAt: ms("2026-03-24", "12:00:00") },
    ];

    const timeline = buildTimeline(msgs, getTs, areGrouped);
    const dividers = timeline.filter((t) => t.type === "date-divider");
    expect(dividers).toHaveLength(1);
  });
});

describe("timelineKeyExtractor", () => {
  it("returns message id for message items", () => {
    const item = {
      type: "message" as const,
      data: { id: "msg-123" } as FakeMsg,
      sourceIndex: 0,
      isGroupedWithPrevious: false,
      isGroupedWithNext: false,
    };
    expect(timelineKeyExtractor(item, getId)).toBe("msg-123");
  });

  it("returns prefixed key for date divider items", () => {
    const item = {
      type: "date-divider" as const,
      dateKey: "2026-03-24",
      label: "March 24, 2026",
    };
    expect(timelineKeyExtractor(item, getId)).toBe("__divider__2026-03-24");
  });
});
