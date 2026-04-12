import { CardWidthTracker } from "@/components/chat/CardWidthTracker";
import {
  buildGroupedCardRadii,
  getGroupedCardMinWidth,
  GROUPED_CARD_RADIUS,
  normalizeGroupedCardWidth,
} from "@/components/chat/groupedCardLayout";

function connectChain(tracker: CardWidthTracker, ids: string[]) {
  ids.forEach((id, index) => {
    tracker.setGroupNeighbors(id, ids[index - 1], ids[index + 1]);
  });
}

describe("grouped card layout", () => {
  it("rounds only the right side where the current message is wider", () => {
    const narrowerAboveWiderBelow = buildGroupedCardRadii({
      isGroupStart: false,
      isGroupEnd: false,
      currentWidth: 180,
      prevWidth: 220,
      nextWidth: 140,
    });

    expect(narrowerAboveWiderBelow.borderTopRightRadius).toBe(0);
    expect(narrowerAboveWiderBelow.borderBottomRightRadius).toBe(
      GROUPED_CARD_RADIUS,
    );

    const widerAboveNarrowerBelow = buildGroupedCardRadii({
      isGroupStart: false,
      isGroupEnd: false,
      currentWidth: 220,
      prevWidth: 180,
      nextWidth: 250,
    });

    expect(widerAboveNarrowerBelow.borderTopRightRadius).toBe(
      GROUPED_CARD_RADIUS,
    );
    expect(widerAboveNarrowerBelow.borderBottomRightRadius).toBe(0);
  });

  it("keeps group boundary right corners rounded", () => {
    const firstMessage = buildGroupedCardRadii({
      isGroupStart: true,
      isGroupEnd: false,
      currentWidth: 180,
      nextWidth: 220,
    });

    expect(firstMessage.borderTopRightRadius).toBe(GROUPED_CARD_RADIUS);
    expect(firstMessage.borderBottomRightRadius).toBe(0);

    const lastMessage = buildGroupedCardRadii({
      isGroupStart: false,
      isGroupEnd: true,
      currentWidth: 180,
      prevWidth: 220,
    });

    expect(lastMessage.borderTopRightRadius).toBe(0);
    expect(lastMessage.borderBottomRightRadius).toBe(GROUPED_CARD_RADIUS);
  });

  it("snaps an entire contiguous width cluster to the widest message", () => {
    const tracker = new CardWidthTracker();
    connectChain(tracker, ["a", "b", "c"]);

    tracker.report("a", 100);
    tracker.report("b", 120);
    tracker.report("c", 140);

    expect(tracker.getSnapshot("a").snappedWidth).toBe(140);
    expect(tracker.getSnapshot("b").snappedWidth).toBe(140);
    expect(tracker.getSnapshot("c").snappedWidth).toBe(140);
  });

  it("keeps internal right corners flat when snapped neighbors resolve equal", () => {
    const tracker = new CardWidthTracker();
    connectChain(tracker, ["a", "b", "c"]);

    tracker.report("a", 180);
    tracker.report("b", 190);
    tracker.report("c", 200);

    const snapshotA = tracker.getSnapshot("a");
    const snapshotB = tracker.getSnapshot("b");
    const snapshotC = tracker.getSnapshot("c");

    expect(snapshotA.snappedWidth).toBe(200);
    expect(snapshotB.snappedWidth).toBe(200);
    expect(snapshotC.snappedWidth).toBe(200);

    const middleRadii = buildGroupedCardRadii({
      isGroupStart: false,
      isGroupEnd: false,
      currentWidth: snapshotB.snappedWidth,
      prevWidth: snapshotA.snappedWidth,
      nextWidth: snapshotC.snappedWidth,
    });

    expect(middleRadii.borderTopRightRadius).toBe(0);
    expect(middleRadii.borderBottomRightRadius).toBe(0);
  });

  it("keeps unresolved internal corners flat until adjacent widths are known", () => {
    const unresolved = buildGroupedCardRadii({
      isGroupStart: false,
      isGroupEnd: false,
      currentWidth: 180,
      prevWidth: undefined,
      nextWidth: undefined,
    });

    expect(unresolved.borderTopRightRadius).toBe(0);
    expect(unresolved.borderBottomRightRadius).toBe(0);
  });

  it("applies the normalized snapped width to every measured card in a snap cluster", () => {
    expect(normalizeGroupedCardWidth(180.1)).toBe(182);
    expect(getGroupedCardMinWidth(182, 182)).toBe(182);
    expect(getGroupedCardMinWidth(180, 182)).toBe(182);
  });

  it("preserves subscriptions across tracker clears so remounted chats can recover", () => {
    jest.useFakeTimers();
    const tracker = new CardWidthTracker();
    connectChain(tracker, ["a", "b"]);

    const snapshots: (number | undefined)[] = [];
    const unsubscribe = tracker.subscribe("a", (snapshot) => {
      snapshots.push(snapshot.snappedWidth);
    });

    tracker.report("a", 120);
    tracker.report("b", 100);
    // Flush coalesced notifications so the 120 snapshot arrives
    jest.runAllTimers();

    tracker.clear();

    tracker.setGroupNeighbors("a", undefined, "b");
    tracker.setGroupNeighbors("b", "a", undefined);
    tracker.report("a", 160);
    tracker.report("b", 100);
    // Flush coalesced notifications so the 160 snapshot arrives
    jest.runAllTimers();

    expect(snapshots).toContain(120);
    expect(snapshots).toContain(160);

    unsubscribe();
    jest.useRealTimers();
  });
});
