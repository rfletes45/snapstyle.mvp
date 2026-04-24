import {
  SCORECARD_SENTINEL,
  SCORECARD_VISIBLE_TEXT,
  buildMessagePreviewText,
  sanitizeMessagePreviewText,
} from "../../firebase-backend/functions/src/messagePreview";
import { getMessagePreviewText, type MessageV2 } from "../../src/types/messaging";

const SCORECARD_WIRE_TEXT = `${SCORECARD_SENTINEL}{"v":1,"sessionId":"session-1"}\n${SCORECARD_VISIBLE_TEXT}`;

function buildMessage(
  overrides: Partial<MessageV2> = {},
): MessageV2 {
  return {
    id: "msg-1",
    scope: "dm",
    conversationId: "chat-1",
    senderId: "user-1",
    senderName: "User 1",
    kind: "text",
    text: "hello",
    createdAt: 1,
    serverReceivedAt: 1,
    clientId: "server",
    idempotencyKey: "server:1",
    status: "sent",
    ...overrides,
  };
}

describe("scorecard preview sanitization", () => {
  it("sanitizes sentinel-encoded wire text to the generic scorecard label", () => {
    expect(sanitizeMessagePreviewText(SCORECARD_WIRE_TEXT)).toBe(
      SCORECARD_VISIBLE_TEXT,
    );
  });

  it("builds backend preview text without leaking scorecard payload JSON", () => {
    expect(
      buildMessagePreviewText({
        kind: "text",
        text: SCORECARD_WIRE_TEXT,
        maxTextLength: 120,
      }),
    ).toBe(SCORECARD_VISIBLE_TEXT);
  });

  it("keeps normal text truncation behavior for non-scorecard messages", () => {
    const longText = "a".repeat(130);
    expect(
      buildMessagePreviewText({
        kind: "text",
        text: longText,
        maxTextLength: 120,
      }),
    ).toBe(`${"a".repeat(117)}...`);
  });

  it("keeps client-side preview helpers generic for scorecard messages", () => {
    expect(
      getMessagePreviewText(
        buildMessage({
          text: SCORECARD_WIRE_TEXT,
          clientId: "server",
        }),
      ),
    ).toBe(SCORECARD_VISIBLE_TEXT);
  });
});
