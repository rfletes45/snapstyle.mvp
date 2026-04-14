import { estimateMessageWidth } from "@/components/chat/estimateMessageWidth";

describe("estimateMessageWidth", () => {
  it("uses identical horizontal padding for dm and group cards", () => {
    const dmWidth = estimateMessageWidth({
      text: "hello",
      kind: "text",
      hasReplyPreview: false,
      hasReactions: false,
      isGroupStart: false,
      variant: "dm",
      screenWidth: 430,
    });

    const groupWidth = estimateMessageWidth({
      text: "hello",
      kind: "text",
      hasReplyPreview: false,
      hasReactions: false,
      isGroupStart: false,
      variant: "group",
      screenWidth: 430,
    });

    expect(dmWidth).toBe(groupWidth);
  });

  it("widens the card only for inline thread indicators", () => {
    const base = estimateMessageWidth({
      text: "hi",
      kind: "text",
      hasReplyPreview: false,
      hasReactions: false,
      isGroupStart: false,
      variant: "group",
      screenWidth: 430,
    });

    const externalThread = estimateMessageWidth({
      text: "hi",
      kind: "text",
      hasReplyPreview: false,
      hasThread: true,
      threadPlacement: "external",
      hasReactions: false,
      isGroupStart: false,
      variant: "group",
      screenWidth: 430,
    });

    const inlineThread = estimateMessageWidth({
      text: "hi",
      kind: "text",
      hasReplyPreview: false,
      hasThread: true,
      threadPlacement: "inline",
      hasReactions: false,
      isGroupStart: false,
      variant: "group",
      screenWidth: 430,
    });

    expect(externalThread).toBe(base);
    expect(inlineThread).toBeGreaterThan(base);
  });
});
