import { formatUnreadBadge } from "../../src/components/chat/inbox/unreadBadge";

describe("ConversationItem unread badge formatting", () => {
  it("returns empty string for zero and negative values", () => {
    expect(formatUnreadBadge(0)).toBe("");
    expect(formatUnreadBadge(-3)).toBe("");
  });

  it("returns exact count for 1..99", () => {
    expect(formatUnreadBadge(1)).toBe("1");
    expect(formatUnreadBadge(42)).toBe("42");
    expect(formatUnreadBadge(99)).toBe("99");
  });

  it("caps counts above 99 as 99+", () => {
    expect(formatUnreadBadge(100)).toBe("99+");
    expect(formatUnreadBadge(999)).toBe("99+");
  });
});
