/**
 * Unit tests for GroupMessage ↔ MessageV2 adapters
 *
 * Tests cover:
 * - Type guards (isLegacyGroupMessage, isMessageV2)
 * - Conversion functions (fromGroupMessage, toGroupMessage)
 * - All message types (text, image, voice, scorecard, system)
 * - Edge cases (missing fields, replyTo, deletedForAll)
 */

import {
  fromGroupMessage,
  fromGroupMessages,
  isLegacyGroupMessage,
  isMessageV2,
  toGroupMessage,
} from "@/services/messaging/adapters";
import { MessageV2 } from "@/types/messaging";
import { GroupMessage } from "@/types/models";

// =============================================================================
// Test Fixtures
// =============================================================================

const createTextGroupMessage = (
  overrides?: Partial<GroupMessage>,
): GroupMessage => ({
  id: "msg-001",
  groupId: "group-123",
  sender: "user-456",
  senderDisplayName: "John Doe",
  type: "text",
  content: "Hello, world!",
  createdAt: 1706400000000,
  ...overrides,
});

const createImageGroupMessage = (
  overrides?: Partial<GroupMessage>,
): GroupMessage => ({
  id: "msg-002",
  groupId: "group-123",
  sender: "user-456",
  senderDisplayName: "John Doe",
  type: "image",
  content: "",
  createdAt: 1706400000000,
  imagePath: "https://storage.example.com/groups/group-123/images/photo.jpg",
  ...overrides,
});

const createVoiceGroupMessage = (
  overrides?: Partial<GroupMessage>,
): GroupMessage => ({
  id: "msg-003",
  groupId: "group-123",
  sender: "user-456",
  senderDisplayName: "John Doe",
  type: "voice",
  content: "",
  createdAt: 1706400000000,
  voiceMetadata: {
    durationMs: 5000,
    storagePath: "groups/group-123/voice/audio.m4a",
    sizeBytes: 50000,
  },
  ...overrides,
});

const createScorecardGroupMessage = (
  overrides?: Partial<GroupMessage>,
): GroupMessage => ({
  id: "msg-004",
  groupId: "group-123",
  sender: "user-456",
  senderDisplayName: "John Doe",
  type: "scorecard",
  content: "Check out my score!",
  createdAt: 1706400000000,
  scorecard: {
    gameId: "flappy" as any,
    score: 42,
    playerName: "John Doe",
  },
  ...overrides,
});

const createSystemGroupMessage = (
  overrides?: Partial<GroupMessage>,
): GroupMessage => ({
  id: "msg-005",
  groupId: "group-123",
  sender: "system",
  senderDisplayName: "System",
  type: "system",
  content: "John joined the group",
  createdAt: 1706400000000,
  systemType: "member_joined",
  systemMeta: {
    targetUid: "user-456",
    targetDisplayName: "John Doe",
  },
  ...overrides,
});

const createMessageV2 = (overrides?: Partial<MessageV2>): MessageV2 => ({
  id: "msg-v2-001",
  scope: "group",
  conversationId: "group-123",
  senderId: "user-456",
  senderName: "John Doe",
  kind: "text",
  text: "Hello from V2!",
  createdAt: 1706400000000,
  serverReceivedAt: 1706400001000,
  clientId: "client-123",
  idempotencyKey: "client-123:msg-v2-001",
  status: "sent",
  ...overrides,
});

// =============================================================================
// isLegacyGroupMessage Tests
// =============================================================================

describe("isLegacyGroupMessage", () => {
  it("should return true for valid GroupMessage format", () => {
    const msg = createTextGroupMessage();
    expect(isLegacyGroupMessage(msg)).toBe(true);
  });

  it("should return true for all GroupMessage types", () => {
    expect(isLegacyGroupMessage(createTextGroupMessage())).toBe(true);
    expect(isLegacyGroupMessage(createImageGroupMessage())).toBe(true);
    expect(isLegacyGroupMessage(createVoiceGroupMessage())).toBe(true);
    expect(isLegacyGroupMessage(createScorecardGroupMessage())).toBe(true);
    expect(isLegacyGroupMessage(createSystemGroupMessage())).toBe(true);
  });

  it("should return false for MessageV2 format", () => {
    const msg = createMessageV2();
    expect(isLegacyGroupMessage(msg)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isLegacyGroupMessage(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isLegacyGroupMessage(undefined)).toBe(false);
  });

  it("should return false for primitive values", () => {
    expect(isLegacyGroupMessage("string")).toBe(false);
    expect(isLegacyGroupMessage(123)).toBe(false);
    expect(isLegacyGroupMessage(true)).toBe(false);
  });

  it("should return false for empty object", () => {
    expect(isLegacyGroupMessage({})).toBe(false);
  });

  it("should return false for partial GroupMessage (missing sender)", () => {
    const partial = {
      id: "msg-001",
      groupId: "group-123",
      content: "Hello",
      createdAt: 1706400000000,
    };
    expect(isLegacyGroupMessage(partial)).toBe(false);
  });

  it("should return false for partial GroupMessage (missing content)", () => {
    const partial = {
      id: "msg-001",
      groupId: "group-123",
      sender: "user-456",
      createdAt: 1706400000000,
    };
    expect(isLegacyGroupMessage(partial)).toBe(false);
  });

  it("should return false for partial GroupMessage (missing groupId)", () => {
    const partial = {
      id: "msg-001",
      sender: "user-456",
      content: "Hello",
      createdAt: 1706400000000,
    };
    expect(isLegacyGroupMessage(partial)).toBe(false);
  });
});

// =============================================================================
// isMessageV2 Tests
// =============================================================================

describe("isMessageV2", () => {
  it("should return true for valid MessageV2 format", () => {
    const msg = createMessageV2();
    expect(isMessageV2(msg)).toBe(true);
  });

  it("should return true for DM scope", () => {
    const msg = createMessageV2({ scope: "dm", conversationId: "chat-123" });
    expect(isMessageV2(msg)).toBe(true);
  });

  it("should return true for group scope", () => {
    const msg = createMessageV2({ scope: "group" });
    expect(isMessageV2(msg)).toBe(true);
  });

  it("should return false for GroupMessage format", () => {
    const msg = createTextGroupMessage();
    expect(isMessageV2(msg)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isMessageV2(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isMessageV2(undefined)).toBe(false);
  });

  it("should return false for primitive values", () => {
    expect(isMessageV2("string")).toBe(false);
    expect(isMessageV2(123)).toBe(false);
    expect(isMessageV2(true)).toBe(false);
  });

  it("should return false for invalid scope", () => {
    const invalid = {
      senderId: "user-456",
      scope: "invalid",
      conversationId: "group-123",
    };
    expect(isMessageV2(invalid)).toBe(false);
  });

  it("should return false for missing senderId", () => {
    const invalid = {
      scope: "group",
      conversationId: "group-123",
    };
    expect(isMessageV2(invalid)).toBe(false);
  });

  it("should return false for missing conversationId", () => {
    const invalid = {
      senderId: "user-456",
      scope: "group",
    };
    expect(isMessageV2(invalid)).toBe(false);
  });
});

// =============================================================================
// fromGroupMessage Tests
// =============================================================================

describe("fromGroupMessage", () => {
  describe("text messages", () => {
    it("should convert text message correctly", () => {
      const legacy = createTextGroupMessage();
      const v2 = fromGroupMessage(legacy);

      expect(v2.id).toBe("msg-001");
      expect(v2.scope).toBe("group");
      expect(v2.conversationId).toBe("group-123");
      expect(v2.senderId).toBe("user-456");
      expect(v2.senderName).toBe("John Doe");
      expect(v2.kind).toBe("text");
      expect(v2.text).toBe("Hello, world!");
      expect(v2.createdAt).toBe(1706400000000);
      expect(v2.serverReceivedAt).toBe(1706400000000);
      expect(v2.status).toBe("sent");
    });

    it("should set empty clientId and idempotencyKey for legacy messages", () => {
      const legacy = createTextGroupMessage();
      const v2 = fromGroupMessage(legacy);

      expect(v2.clientId).toBe("");
      expect(v2.idempotencyKey).toBe("");
    });
  });

  describe("image messages", () => {
    it("should convert image message correctly", () => {
      const legacy = createImageGroupMessage();
      const v2 = fromGroupMessage(legacy);

      expect(v2.kind).toBe("media");
      expect(v2.attachments).toHaveLength(1);
      expect(v2.attachments![0].kind).toBe("image");
      expect(v2.attachments![0].url).toBe(
        "https://storage.example.com/groups/group-123/images/photo.jpg",
      );
    });

    it("should handle image message without imagePath", () => {
      const legacy = createImageGroupMessage({ imagePath: undefined });
      const v2 = fromGroupMessage(legacy);

      expect(v2.kind).toBe("media");
      expect(v2.attachments).toBeUndefined();
    });
  });

  describe("voice messages", () => {
    it("should convert voice message correctly", () => {
      const legacy = createVoiceGroupMessage();
      const v2 = fromGroupMessage(legacy);

      expect(v2.kind).toBe("voice");
      expect(v2.attachments).toHaveLength(1);
      expect(v2.attachments![0].kind).toBe("audio");
      expect(v2.attachments![0].durationMs).toBe(5000);
      expect(v2.attachments![0].sizeBytes).toBe(50000);
      expect(v2.attachments![0].path).toBe("groups/group-123/voice/audio.m4a");
    });

    it("should handle voice message without voiceMetadata", () => {
      const legacy = createVoiceGroupMessage({ voiceMetadata: undefined });
      const v2 = fromGroupMessage(legacy);

      expect(v2.kind).toBe("voice");
      expect(v2.attachments).toBeUndefined();
    });
  });

  describe("scorecard messages", () => {
    it("should convert scorecard message correctly", () => {
      const legacy = createScorecardGroupMessage();
      const v2 = fromGroupMessage(legacy);

      expect(v2.kind).toBe("scorecard");
      expect(v2.text).toContain("scorecard");

      const parsed = JSON.parse(v2.text!);
      expect(parsed.type).toBe("scorecard");
      expect(parsed.gameId).toBe("flappy");
      expect(parsed.score).toBe(42);
      expect(parsed.playerName).toBe("John Doe");
    });
  });

  describe("system messages", () => {
    it("should convert system message correctly", () => {
      const legacy = createSystemGroupMessage();
      const v2 = fromGroupMessage(legacy);

      expect(v2.kind).toBe("system");
      expect(v2.text).toContain("system");

      const parsed = JSON.parse(v2.text!);
      expect(parsed.type).toBe("system");
      expect(parsed.systemType).toBe("member_joined");
      expect(parsed.displayText).toBe("John joined the group");
      expect(parsed.meta.targetUid).toBe("user-456");
    });
  });

  describe("replyTo metadata", () => {
    it("should convert replyTo correctly", () => {
      const legacy = createTextGroupMessage({
        replyTo: {
          messageId: "original-msg",
          senderId: "other-user",
          senderName: "Jane",
          textSnippet: "Original message...",
        },
      });
      const v2 = fromGroupMessage(legacy);

      expect(v2.replyTo).toBeDefined();
      expect(v2.replyTo!.messageId).toBe("original-msg");
      expect(v2.replyTo!.senderId).toBe("other-user");
      expect(v2.replyTo!.senderName).toBe("Jane");
      expect(v2.replyTo!.textSnippet).toBe("Original message...");
    });

    it("should convert replyTo with voice attachment", () => {
      const legacy = createTextGroupMessage({
        replyTo: {
          messageId: "voice-msg",
          senderId: "other-user",
          senderName: "Jane",
          attachmentKind: "voice",
        },
      });
      const v2 = fromGroupMessage(legacy);

      expect(v2.replyTo!.kind).toBe("voice");
      expect(v2.replyTo!.attachmentPreview?.kind).toBe("audio");
    });

    it("should convert replyTo with image attachment", () => {
      const legacy = createTextGroupMessage({
        replyTo: {
          messageId: "image-msg",
          senderId: "other-user",
          senderName: "Jane",
          attachmentKind: "image",
        },
      });
      const v2 = fromGroupMessage(legacy);

      expect(v2.replyTo!.attachmentPreview?.kind).toBe("image");
    });

    it("should handle message without replyTo", () => {
      const legacy = createTextGroupMessage();
      const v2 = fromGroupMessage(legacy);

      expect(v2.replyTo).toBeUndefined();
    });
  });

  describe("deletion markers", () => {
    it("should convert hiddenFor correctly", () => {
      const legacy = createTextGroupMessage({
        hiddenFor: ["user-1", "user-2"],
      });
      const v2 = fromGroupMessage(legacy);

      expect(v2.hiddenFor).toEqual(["user-1", "user-2"]);
    });

    it("should convert deletedForAll correctly", () => {
      const legacy = createTextGroupMessage({
        deletedForAll: {
          by: "admin-user",
          at: 1706500000000,
        },
      });
      const v2 = fromGroupMessage(legacy);

      expect(v2.deletedForAll).toEqual({
        by: "admin-user",
        at: 1706500000000,
      });
    });
  });

  describe("missing optional fields", () => {
    it("should handle minimal GroupMessage", () => {
      const minimal: GroupMessage = {
        id: "msg-minimal",
        groupId: "group-123",
        sender: "user-456",
        senderDisplayName: "John",
        type: "text",
        content: "Hi",
        createdAt: 1706400000000,
      };

      const v2 = fromGroupMessage(minimal);

      expect(v2.id).toBe("msg-minimal");
      expect(v2.kind).toBe("text");
      expect(v2.text).toBe("Hi");
      expect(v2.attachments).toBeUndefined();
      expect(v2.replyTo).toBeUndefined();
      expect(v2.hiddenFor).toBeUndefined();
      expect(v2.deletedForAll).toBeUndefined();
    });
  });
});

// =============================================================================
// fromGroupMessages Tests
// =============================================================================

describe("fromGroupMessages", () => {
  it("should convert array of GroupMessages", () => {
    const messages = [
      createTextGroupMessage({ id: "msg-1" }),
      createImageGroupMessage({ id: "msg-2" }),
      createVoiceGroupMessage({ id: "msg-3" }),
    ];

    const v2Messages = fromGroupMessages(messages);

    expect(v2Messages).toHaveLength(3);
    expect(v2Messages[0].id).toBe("msg-1");
    expect(v2Messages[0].kind).toBe("text");
    expect(v2Messages[1].id).toBe("msg-2");
    expect(v2Messages[1].kind).toBe("media");
    expect(v2Messages[2].id).toBe("msg-3");
    expect(v2Messages[2].kind).toBe("voice");
  });

  it("should return empty array for empty input", () => {
    const v2Messages = fromGroupMessages([]);
    expect(v2Messages).toEqual([]);
  });
});

// =============================================================================
// toGroupMessage Tests (reverse conversion)
// =============================================================================

describe("toGroupMessage", () => {
  it("should convert text MessageV2 to GroupMessage", () => {
    const v2 = createMessageV2();
    const legacy = toGroupMessage(v2);

    expect(legacy.id).toBe("msg-v2-001");
    expect(legacy.groupId).toBe("group-123");
    expect(legacy.sender).toBe("user-456");
    expect(legacy.senderDisplayName).toBe("John Doe");
    expect(legacy.type).toBe("text");
    expect(legacy.content).toBe("Hello from V2!");
    expect(legacy.createdAt).toBe(1706400000000);
  });

  it("should convert media MessageV2 to image GroupMessage", () => {
    const v2 = createMessageV2({
      kind: "media",
      text: "",
      attachments: [
        {
          id: "att-1",
          kind: "image",
          mime: "image/jpeg",
          url: "https://example.com/image.jpg",
          path: "images/image.jpg",
          sizeBytes: 10000,
        },
      ],
    });
    const legacy = toGroupMessage(v2);

    expect(legacy.type).toBe("image");
    expect(legacy.imagePath).toBe("https://example.com/image.jpg");
  });

  it("should convert voice MessageV2 to voice GroupMessage", () => {
    const v2 = createMessageV2({
      kind: "voice",
      text: "",
      attachments: [
        {
          id: "att-1",
          kind: "audio",
          mime: "audio/m4a",
          url: "https://example.com/audio.m4a",
          path: "audio/audio.m4a",
          sizeBytes: 5000,
          durationMs: 3000,
        },
      ],
    });
    const legacy = toGroupMessage(v2);

    expect(legacy.type).toBe("voice");
    expect(legacy.voiceMetadata).toEqual({
      durationMs: 3000,
      storagePath: "audio/audio.m4a",
      sizeBytes: 5000,
    });
  });

  it("should convert replyTo correctly", () => {
    const v2 = createMessageV2({
      replyTo: {
        messageId: "original-msg",
        senderId: "other-user",
        senderName: "Jane",
        kind: "text",
        textSnippet: "Original...",
      },
    });
    const legacy = toGroupMessage(v2);

    expect(legacy.replyTo).toEqual({
      messageId: "original-msg",
      senderId: "other-user",
      senderName: "Jane",
      textSnippet: "Original...",
      attachmentKind: undefined,
    });
  });

  it("should convert replyTo with audio attachment", () => {
    const v2 = createMessageV2({
      replyTo: {
        messageId: "voice-msg",
        senderId: "other-user",
        kind: "voice",
        attachmentPreview: { kind: "audio" },
      },
    });
    const legacy = toGroupMessage(v2);

    expect(legacy.replyTo!.attachmentKind).toBe("voice");
  });

  it("should convert hiddenFor correctly", () => {
    const v2 = createMessageV2({
      hiddenFor: ["user-1", "user-2"],
    });
    const legacy = toGroupMessage(v2);

    expect(legacy.hiddenFor).toEqual(["user-1", "user-2"]);
  });

  it("should convert deletedForAll correctly", () => {
    const v2 = createMessageV2({
      deletedForAll: { by: "admin", at: 1706500000000 },
    });
    const legacy = toGroupMessage(v2);

    expect(legacy.deletedForAll).toEqual({ by: "admin", at: 1706500000000 });
  });

  it("should use Unknown for missing senderName", () => {
    const v2 = createMessageV2({ senderName: undefined });
    const legacy = toGroupMessage(v2);

    expect(legacy.senderDisplayName).toBe("Unknown");
  });
});

// =============================================================================
// Round-trip Tests
// =============================================================================

describe("round-trip conversion", () => {
  it("should preserve essential fields after GroupMessage → MessageV2 → GroupMessage", () => {
    const original = createTextGroupMessage({
      replyTo: {
        messageId: "reply-to-id",
        senderId: "reply-sender",
        senderName: "Reply Sender",
        textSnippet: "Snippet",
      },
      hiddenFor: ["hidden-user"],
    });

    const v2 = fromGroupMessage(original);
    const roundTrip = toGroupMessage(v2);

    expect(roundTrip.id).toBe(original.id);
    expect(roundTrip.groupId).toBe(original.groupId);
    expect(roundTrip.sender).toBe(original.sender);
    expect(roundTrip.senderDisplayName).toBe(original.senderDisplayName);
    expect(roundTrip.type).toBe(original.type);
    expect(roundTrip.content).toBe(original.content);
    expect(roundTrip.createdAt).toBe(original.createdAt);
    expect(roundTrip.replyTo?.messageId).toBe(original.replyTo?.messageId);
    expect(roundTrip.hiddenFor).toEqual(original.hiddenFor);
  });

  it("should preserve image attachment after round-trip", () => {
    const original = createImageGroupMessage();

    const v2 = fromGroupMessage(original);
    const roundTrip = toGroupMessage(v2);

    expect(roundTrip.type).toBe("image");
    expect(roundTrip.imagePath).toBe(original.imagePath);
  });

  it("should preserve voice metadata after round-trip", () => {
    const original = createVoiceGroupMessage();

    const v2 = fromGroupMessage(original);
    const roundTrip = toGroupMessage(v2);

    expect(roundTrip.type).toBe("voice");
    expect(roundTrip.voiceMetadata?.durationMs).toBe(
      original.voiceMetadata?.durationMs,
    );
    expect(roundTrip.voiceMetadata?.storagePath).toBe(
      original.voiceMetadata?.storagePath,
    );
    expect(roundTrip.voiceMetadata?.sizeBytes).toBe(
      original.voiceMetadata?.sizeBytes,
    );
  });
});
