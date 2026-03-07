import {
  callAcceptMessageRequest,
  callDeclineMessageRequest,
  normalizePendingMessageRequests,
} from "../../src/services/chat/messageRequestsContract";

describe("message requests behavior", () => {
  it("normalizes snapshot docs and keeps only pending requests sorted newest-first", () => {
    const docs = [
      {
        id: "chat-1",
        data: {
          chatId: "chat-1",
          requesterId: "u1",
          requesterName: "User 1",
          status: "accepted",
          createdAt: 1000,
          messagePreview: "old",
          messageKind: "text",
        },
      },
      {
        id: "chat-2",
        data: {
          requesterId: "u2",
          requesterName: "User 2",
          status: "pending",
          createdAt: 3000,
          messagePreview: "newest",
          messageKind: "text",
        },
      },
      {
        id: "chat-3",
        data: {
          requesterId: "u3",
          requesterName: "User 3",
          status: "pending",
          createdAt: 2000,
          messagePreview: "middle",
          messageKind: "media",
        },
      },
      {
        id: "chat-invalid",
        data: {
          status: "pending",
          createdAt: null,
        },
      },
    ];

    const result = normalizePendingMessageRequests(docs as any);
    expect(result.map((r) => r.chatId)).toEqual(["chat-2", "chat-3"]);
    expect(result.every((r) => r.status === "pending")).toBe(true);
  });

  it("validates accept callable response and throws for invalid contract", async () => {
    await expect(
      callAcceptMessageRequest("chat-1", async () => ({
        data: { success: true },
      })),
    ).resolves.toBeUndefined();

    await expect(
      callAcceptMessageRequest("chat-1", async () => ({
        data: { ok: true },
      })),
    ).rejects.toThrow("acceptMessageRequest returned an invalid response");
  });

  it("validates decline callable response and blockRequester payload", async () => {
    const invoke = jest.fn(async () => ({ data: { success: true } }));

    await callDeclineMessageRequest("chat-1", true, invoke);
    expect(invoke).toHaveBeenCalledWith({
      chatId: "chat-1",
      blockRequester: true,
    });

    await expect(
      callDeclineMessageRequest("chat-1", false, async () => ({
        data: { success: false },
      })),
    ).rejects.toThrow("declineMessageRequest returned an invalid response");
  });
});
