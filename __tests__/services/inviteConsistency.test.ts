/**
 * Invite Creation Consistency Tests
 *
 * Validates that invite payloads produced by different creation flows
 * (chat, play-lobby, MiniGolf) share the same structural shape once
 * volatile fields (timestamps, IDs) are stripped via `normalizeInvitePayload`.
 *
 * Also tests the `buildDmConversationId` helper.
 */

import {
  buildDmConversationId,
  normalizeInvitePayload,
} from "@/services/gameInvites";
import type { UniversalGameInvite } from "@/types/turnBased";

// =============================================================================
// buildDmConversationId
// =============================================================================

describe("buildDmConversationId", () => {
  it("produces a deterministic sorted ID", () => {
    expect(buildDmConversationId("alice", "bob")).toBe("alice_bob");
    expect(buildDmConversationId("bob", "alice")).toBe("alice_bob");
  });

  it("handles equal UIDs (edge case)", () => {
    expect(buildDmConversationId("x", "x")).toBe("x_x");
  });
});

// =============================================================================
// normalizeInvitePayload
// =============================================================================

/** Factory for a minimal mock invite. */
function mockInvite(
  overrides: Partial<UniversalGameInvite> = {},
): UniversalGameInvite {
  return {
    id: "uinv_test_abc",
    gameType: "chess",
    senderId: "host",
    senderName: "Host",
    senderAvatar: undefined,
    context: "dm",
    conversationId: "guest_host",
    conversationName: undefined,
    targetType: "specific",
    recipientId: "guest",
    recipientName: "Guest",
    recipientAvatar: undefined,
    eligibleUserIds: ["host", "guest"],
    requiredPlayers: 2,
    maxPlayers: 2,
    claimedSlots: [
      {
        playerId: "host",
        playerName: "Host",
        playerAvatar: undefined,
        claimedAt: 1000,
        isHost: true,
      },
    ],
    filledAt: undefined,
    spectatingEnabled: true,
    spectatorOnly: false,
    spectators: [],
    status: "pending",
    gameId: undefined,
    inviteVersion: 1,
    traceId: "trace_xyz",
    settings: {
      isRated: false,
      timeControl: { type: "per_turn", seconds: 86400 },
      chatEnabled: true,
    },
    createdAt: 1000,
    updatedAt: 1000,
    expiresAt: 3600000,
    respondedAt: undefined,
    showInPlayPage: true,
    chatMessageId: undefined,
    ...overrides,
  } as UniversalGameInvite;
}

describe("normalizeInvitePayload", () => {
  it("strips volatile fields (id, traceId, timestamps, chatMessageId)", () => {
    const invite = mockInvite();
    const normalized = normalizeInvitePayload(invite);

    expect(normalized).not.toHaveProperty("id");
    expect(normalized).not.toHaveProperty("traceId");
    expect(normalized).not.toHaveProperty("createdAt");
    expect(normalized).not.toHaveProperty("updatedAt");
    expect(normalized).not.toHaveProperty("expiresAt");
    expect(normalized).not.toHaveProperty("chatMessageId");
  });

  it("preserves non-volatile fields", () => {
    const invite = mockInvite();
    const normalized = normalizeInvitePayload(invite);

    expect(normalized.gameType).toBe("chess");
    expect(normalized.senderId).toBe("host");
    expect(normalized.context).toBe("dm");
    expect(normalized.conversationId).toBe("guest_host");
    expect(normalized.recipientId).toBe("guest");
    expect(normalized.settings.isRated).toBe(false);
    expect(normalized.showInPlayPage).toBe(true);
  });

  it("produces structurally matching payloads from chat vs play flows", () => {
    // Simulate: Chat flow creates an invite (isRated false, no colyseusRoomKey)
    const chatInvite = mockInvite({
      id: "uinv_chat_111",
      traceId: "trace_chat",
      createdAt: 2000,
      updatedAt: 2000,
      expiresAt: 3600000 + 2000,
      settings: {
        isRated: false,
        chatEnabled: true,
        timeControl: { type: "per_turn", seconds: 86400 },
      },
    });

    // Simulate: Play-lobby flow creates an invite (isRated true, has colyseusRoomKey)
    const playInvite = mockInvite({
      id: "uinv_play_222",
      traceId: "trace_play",
      createdAt: 3000,
      updatedAt: 3000,
      expiresAt: 3600000 + 3000,
      settings: {
        isRated: true,
        chatEnabled: true,
        timeControl: { type: "per_turn", seconds: 86400 },
        colyseusRoomKey: "chess_room_abc",
      },
    });

    const normChat = normalizeInvitePayload(chatInvite);
    const normPlay = normalizeInvitePayload(playInvite);

    // Volatile fields stripped — both have the same keys
    const chatKeys = Object.keys(normChat).sort();
    const playKeys = Object.keys(normPlay).sort();
    expect(chatKeys).toEqual(playKeys);

    // Non-settings fields are identical
    expect(normChat.gameType).toBe(normPlay.gameType);
    expect(normChat.senderId).toBe(normPlay.senderId);
    expect(normChat.context).toBe(normPlay.context);
    expect(normChat.conversationId).toBe(normPlay.conversationId);
    expect(normChat.recipientId).toBe(normPlay.recipientId);

    // Settings differ intentionally (isRated, colyseusRoomKey)
    expect(normChat.settings.isRated).toBe(false);
    expect(normPlay.settings.isRated).toBe(true);
    expect(normPlay.settings.colyseusRoomKey).toBe("chess_room_abc");
    expect(normChat.settings.colyseusRoomKey).toBeUndefined();
  });
});
