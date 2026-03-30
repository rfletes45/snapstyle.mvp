import {
  compareMessagesCanonicalDesc,
  dedupeAndSortMessages,
  mergeMessageCollections,
  normalizeMessageFromFirestoreDoc,
  normalizeMessageFromLocalRow,
} from "../../src/services/chat/normalizeMessage";
import type { AttachmentRow, MessageRow } from "../../src/types/database";
import type { MessageV2 } from "../../src/types/messaging";

function buildLocalRow(
  overrides: Partial<MessageRow> = {},
): MessageRow & { attachments: AttachmentRow[] } {
  return {
    id: "msg-1",
    conversation_id: "chat-1",
    scope: "dm",
    sender_id: "user-b",
    sender_name: "User B",
    kind: "text",
    text: "hello",
    created_at: 1000,
    server_received_at: 2000,
    edited_at: null,
    reply_to_id: null,
    reply_to_preview: null,
    thread_root_id: null,
    reply_count: 0,
    last_reply_at: null,
    mentions_json: null,
    reactions_json: null,
    deleted_for_all: 0,
    deleted_by: null,
    deleted_at: null,
    hidden_for_json: null,
    link_preview_json: null,
    sender_style_json: null,
    sync_status: "synced",
    sync_error: null,
    retry_count: 0,
    attachments: [],
    ...overrides,
  };
}

function buildServerData(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    scope: "dm",
    conversationId: "chat-1",
    senderId: "user-b",
    senderName: "User B",
    kind: "text",
    text: "hello",
    createdAt: 1000,
    serverReceivedAt: 2000,
    status: "sent",
    ...overrides,
  };
}

describe("normalizeMessage", () => {
  it("normalizes local and firestore records into identical canonical fields", () => {
    const local = normalizeMessageFromLocalRow(buildLocalRow(), "user-a");
    const server = normalizeMessageFromFirestoreDoc({
      id: "msg-1",
      data: buildServerData(),
      scopeHint: "dm",
      conversationIdHint: "chat-1",
    });

    expect(local).not.toBeNull();
    expect(server.id).toBe(local!.id);
    expect(server.scope).toBe(local!.scope);
    expect(server.conversationId).toBe(local!.conversationId);
    expect(server.senderId).toBe(local!.senderId);
    expect(server.kind).toBe(local!.kind);
    expect(server.text).toBe(local!.text);
    expect(server.serverReceivedAt).toBe(local!.serverReceivedAt);
  });

  it("uses deterministic newest-first ordering with id tie-breakers", () => {
    const messages: MessageV2[] = [
      normalizeMessageFromFirestoreDoc({
        id: "a-id",
        data: buildServerData({ serverReceivedAt: 4000, createdAt: 3000 }),
        scopeHint: "dm",
        conversationIdHint: "chat-1",
      }),
      normalizeMessageFromFirestoreDoc({
        id: "z-id",
        data: buildServerData({ serverReceivedAt: 4000, createdAt: 3000 }),
        scopeHint: "dm",
        conversationIdHint: "chat-1",
      }),
      normalizeMessageFromFirestoreDoc({
        id: "mid-id",
        data: buildServerData({ serverReceivedAt: 3500, createdAt: 2000 }),
        scopeHint: "dm",
        conversationIdHint: "chat-1",
      }),
    ];

    const sorted = [...messages].sort(compareMessagesCanonicalDesc);
    expect(sorted.map((m) => m.id)).toEqual(["z-id", "a-id", "mid-id"]);
  });

  it("reconciles local optimistic duplicate with server version", () => {
    const optimistic = normalizeMessageFromFirestoreDoc({
      id: "msg-1",
      data: buildServerData({
        createdAt: 1000,
        serverReceivedAt: 1000,
        status: "sending",
        isLocal: true,
      }),
      scopeHint: "dm",
      conversationIdHint: "chat-1",
    });
    const server = normalizeMessageFromFirestoreDoc({
      id: "msg-1",
      data: buildServerData({
        createdAt: 1000,
        serverReceivedAt: 3000,
        status: "sent",
      }),
      scopeHint: "dm",
      conversationIdHint: "chat-1",
    });

    const merged = dedupeAndSortMessages([optimistic, server]);
    expect(merged).toHaveLength(1);
    expect(merged[0].serverReceivedAt).toBe(3000);
    expect(merged[0].status).toBe("sent");
  });

  it("dedupes across existing and incoming collections", () => {
    const existing = [
      normalizeMessageFromFirestoreDoc({
        id: "msg-1",
        data: buildServerData({ serverReceivedAt: 2000 }),
        scopeHint: "dm",
        conversationIdHint: "chat-1",
      }),
    ];
    const incoming = [
      normalizeMessageFromFirestoreDoc({
        id: "msg-1",
        data: buildServerData({ serverReceivedAt: 2100 }),
        scopeHint: "dm",
        conversationIdHint: "chat-1",
      }),
      normalizeMessageFromFirestoreDoc({
        id: "msg-2",
        data: buildServerData({ serverReceivedAt: 2200 }),
        scopeHint: "dm",
        conversationIdHint: "chat-1",
      }),
    ];

    const merged = mergeMessageCollections(existing, incoming);
    expect(merged.map((m) => m.id)).toEqual(["msg-2", "msg-1"]);
    expect(merged).toHaveLength(2);
  });

  it("normalizes firestore timestamp-like objects that rely on method binding", () => {
    const firestoreLikeTimestamp = {
      seconds: 1730839200,
      nanoseconds: 250_000_000,
      toMillis() {
        return this.seconds * 1000 + Math.floor(this.nanoseconds / 1_000_000);
      },
    };

    const normalized = normalizeMessageFromFirestoreDoc({
      id: "msg-ts",
      data: buildServerData({
        createdAt: firestoreLikeTimestamp,
        serverReceivedAt: undefined,
      }),
      scopeHint: "group",
      conversationIdHint: "group-1",
    });

    expect(normalized.createdAt).toBe(1_730_839_200_250);
    expect(normalized.serverReceivedAt).toBe(1_730_839_200_250);
  });

  // ---------------------------------------------------------------------------
  // Burst-send ordering stability
  // ---------------------------------------------------------------------------

  it("preserves burst-send order when serverReceivedAt arrives out of band", () => {
    // Simulate 5 rapid messages: initially pending (serverReceivedAt = createdAt),
    // then progressively confirmed with larger server timestamps.

    const pending = (id: string, created: number): MessageV2 =>
      normalizeMessageFromFirestoreDoc({
        id,
        data: buildServerData({
          createdAt: created,
          serverReceivedAt: created, // placeholder while pending
          status: "sending",
          isLocal: true,
        }),
        scopeHint: "dm",
        conversationIdHint: "chat-1",
      });

    const confirmed = (
      id: string,
      created: number,
      serverRx: number,
    ): MessageV2 =>
      normalizeMessageFromFirestoreDoc({
        id,
        data: buildServerData({
          createdAt: created,
          serverReceivedAt: serverRx,
          status: "sent",
        }),
        scopeHint: "dm",
        conversationIdHint: "chat-1",
      });

    // Phase 1: all pending — order by createdAt DESC
    const allPending = dedupeAndSortMessages([
      pending("m1", 1000),
      pending("m2", 1010),
      pending("m3", 1020),
      pending("m4", 1030),
      pending("m5", 1040),
    ]);
    expect(allPending.map((m) => m.id)).toEqual(["m5", "m4", "m3", "m2", "m1"]);

    // Phase 2: m1 confirmed with serverReceivedAt >> m5.createdAt
    // BUG (old): m1 would jump to index 0 because 1200 > 1040
    // FIX: m1 stays at index 4 because createdAt=1000 hasn't changed
    const m1Confirmed = dedupeAndSortMessages([
      confirmed("m1", 1000, 1200),
      pending("m2", 1010),
      pending("m3", 1020),
      pending("m4", 1030),
      pending("m5", 1040),
    ]);
    expect(m1Confirmed.map((m) => m.id)).toEqual([
      "m5",
      "m4",
      "m3",
      "m2",
      "m1",
    ]);

    // Phase 3: m1 + m2 confirmed, rest pending
    const m1m2Confirmed = dedupeAndSortMessages([
      confirmed("m1", 1000, 1200),
      confirmed("m2", 1010, 1250),
      pending("m3", 1020),
      pending("m4", 1030),
      pending("m5", 1040),
    ]);
    expect(m1m2Confirmed.map((m) => m.id)).toEqual([
      "m5",
      "m4",
      "m3",
      "m2",
      "m1",
    ]);

    // Phase 4: all confirmed — order still matches original send order
    const allConfirmed = dedupeAndSortMessages([
      confirmed("m1", 1000, 1200),
      confirmed("m2", 1010, 1250),
      confirmed("m3", 1020, 1300),
      confirmed("m4", 1030, 1350),
      confirmed("m5", 1040, 1400),
    ]);
    expect(allConfirmed.map((m) => m.id)).toEqual([
      "m5",
      "m4",
      "m3",
      "m2",
      "m1",
    ]);
  });

  it("server-confirmed messages replace optimistic duplicates without reorder", () => {
    // Optimistic message exists in thread
    const optimistic = normalizeMessageFromFirestoreDoc({
      id: "burst-msg",
      data: buildServerData({
        createdAt: 5000,
        serverReceivedAt: 5000,
        status: "sending",
        isLocal: true,
      }),
      scopeHint: "dm",
      conversationIdHint: "chat-1",
    });

    // Existing confirmed message above and below
    const older = normalizeMessageFromFirestoreDoc({
      id: "older-msg",
      data: buildServerData({ createdAt: 4000, serverReceivedAt: 4100 }),
      scopeHint: "dm",
      conversationIdHint: "chat-1",
    });
    const newer = normalizeMessageFromFirestoreDoc({
      id: "newer-msg",
      data: buildServerData({ createdAt: 6000, serverReceivedAt: 6100 }),
      scopeHint: "dm",
      conversationIdHint: "chat-1",
    });

    // Before reconciliation
    const before = dedupeAndSortMessages([newer, optimistic, older]);
    expect(before.map((m) => m.id)).toEqual([
      "newer-msg",
      "burst-msg",
      "older-msg",
    ]);

    // Server version arrives with large serverReceivedAt
    const serverVersion = normalizeMessageFromFirestoreDoc({
      id: "burst-msg",
      data: buildServerData({
        createdAt: 5000,
        serverReceivedAt: 7000, // much later than newer-msg
        status: "sent",
      }),
      scopeHint: "dm",
      conversationIdHint: "chat-1",
    });

    // After reconciliation — order must NOT change
    const after = mergeMessageCollections(before, [serverVersion]);
    expect(after.map((m) => m.id)).toEqual([
      "newer-msg",
      "burst-msg",
      "older-msg",
    ]);
    // But the data now has the server-confirmed values
    const reconciledMsg = after.find((m) => m.id === "burst-msg")!;
    expect(reconciledMsg.serverReceivedAt).toBe(7000);
    expect(reconciledMsg.status).toBe("sent");
  });
});
