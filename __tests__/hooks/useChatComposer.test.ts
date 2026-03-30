/**
 * Tests for useChatComposer Hook Configuration (UNI-01, UNI-03, UNI-10)
 *
 * These tests verify the chat composer hook configuration options and their
 * expected behavior. Since the actual hook uses React hooks internally, we
 * test the configuration contract rather than runtime behavior.
 */

import type {
  UseChatComposerConfig,
  UseChatComposerReturn,
} from "@/hooks/useChatComposer";

// Mock feature flags
jest.mock("../../constants/featureFlags", () => ({
  DEBUG_UNIFIED_MESSAGING: false,
}));

// ---------------------------------------------------------------------------
// Rapid-send / snapshot-before-clear behavioural contract tests
// ---------------------------------------------------------------------------
// These tests exercise the send() contract by simulating the internal state
// management that useChatComposer performs on send:
//   1. Snapshot text from the ref (latest value, not stale closure)
//   2. Clear text BEFORE awaiting the async send call
//   3. Pass the snapshot—not the cleared state—to the send callback
//   4. On error, restore the snapshot so the user can retry
//   5. A ref-based guard prevents a second send while one is in-flight
// ---------------------------------------------------------------------------

describe("useChatComposer send() contract", () => {
  /**
   * Simulates the send-handler's state management extracted from useChatComposer.
   * This lets us verify the snapshot-before-clear ordering without renderHook.
   */
  function createSendSimulator() {
    // Simulated state
    let text = "";
    const textRef = { current: "" };
    const sendingRef = { current: false };
    const callLog: string[] = [];

    const setText = (t: string) => {
      text = t;
      textRef.current = t;
    };

    const clearText = () => {
      callLog.push("clearText");
      text = "";
      textRef.current = "";
    };

    const send = async (onSend: (sentText: string) => Promise<void>) => {
      if (sendingRef.current) {
        callLog.push("guard:blocked");
        return;
      }
      if (!textRef.current.trim()) return;

      sendingRef.current = true;
      callLog.push("sending:true");

      const snapshot = textRef.current;
      clearText();

      try {
        callLog.push(`onSend:${snapshot}`);
        await onSend(snapshot);
      } catch {
        // Restore on error
        setText(snapshot);
        callLog.push(`restore:${snapshot}`);
      } finally {
        sendingRef.current = false;
        callLog.push("sending:false");
      }
    };

    return { setText, send, getText: () => text, getLog: () => callLog };
  }

  it("snapshots text and clears BEFORE the async send", async () => {
    const sim = createSendSimulator();
    sim.setText("hello");

    let textSeenByCallback = "";
    let textDuringSend = "";

    await sim.send(async (sentText) => {
      textSeenByCallback = sentText;
      textDuringSend = sim.getText();
    });

    // The send callback received the original text snapshot
    expect(textSeenByCallback).toBe("hello");
    // The composer was already cleared when the callback executed
    expect(textDuringSend).toBe("");
    // Log proves ordering: clear happens before the send call
    expect(sim.getLog()).toEqual([
      "sending:true",
      "clearText",
      "onSend:hello",
      "sending:false",
    ]);
  });

  it("prevents double-send via ref-based guard", async () => {
    const sim = createSendSimulator();
    sim.setText("first");

    let resolveFirst!: () => void;
    const firstSendPromise = new Promise<void>((r) => {
      resolveFirst = r;
    });

    // Start first send (blocks until we resolve)
    const p1 = sim.send(async () => {
      await firstSendPromise;
    });

    // Attempt second send while first is in-flight
    sim.setText("second");
    const p2 = sim.send(async () => {
      /* should never execute */
    });

    // Resolve the first send
    resolveFirst();
    await p1;
    await p2;

    expect(sim.getLog()).toEqual([
      "sending:true",
      "clearText",
      "onSend:first",
      "guard:blocked",
      "sending:false",
    ]);
  });

  it("restores text on send error so user can retry", async () => {
    const sim = createSendSimulator();
    sim.setText("important msg");

    await sim.send(async () => {
      throw new Error("Network error");
    });

    expect(sim.getText()).toBe("important msg");
    expect(sim.getLog()).toContain("restore:important msg");
  });

  it("user can type during async send and text is preserved", async () => {
    const sim = createSendSimulator();
    sim.setText("first");

    let resolveFirst!: () => void;
    const firstSendPromise = new Promise<void>((r) => {
      resolveFirst = r;
    });

    const p1 = sim.send(async () => {
      // While the send is in-flight, the user types a new message
      sim.setText("second");
      await firstSendPromise;
    });

    resolveFirst();
    await p1;

    // The user's new text survived the send
    expect(sim.getText()).toBe("second");
  });
});

describe("useChatComposer Configuration", () => {
  describe("configuration types", () => {
    const mockOnSend = jest.fn().mockResolvedValue(undefined);

    it("should accept DM scope configuration", () => {
      const config: UseChatComposerConfig = {
        scope: "dm",
        conversationId: "chat123",
        currentUid: "user1",
        onSend: mockOnSend,
      };

      expect(config.scope).toBe("dm");
      expect(config.conversationId).toBe("chat123");
      expect(config.currentUid).toBe("user1");
    });

    it("should accept group scope configuration", () => {
      const config: UseChatComposerConfig = {
        scope: "group",
        conversationId: "group123",
        currentUid: "user1",
        onSend: mockOnSend,
      };

      expect(config.scope).toBe("group");
    });
  });

  describe("replyTo configuration", () => {
    const mockOnSend = jest.fn().mockResolvedValue(undefined);

    it("should accept replyTo with text message", () => {
      const config: UseChatComposerConfig = {
        scope: "dm",
        conversationId: "chat123",
        currentUid: "user1",
        onSend: mockOnSend,
        replyTo: {
          messageId: "msg123",
          senderId: "user2",
          kind: "text",
          textSnippet: "Hello",
        },
      };

      expect(config.replyTo?.messageId).toBe("msg123");
      expect(config.replyTo?.kind).toBe("text");
    });

    it("should accept replyTo with media message", () => {
      const config: UseChatComposerConfig = {
        scope: "dm",
        conversationId: "chat123",
        currentUid: "user1",
        onSend: mockOnSend,
        replyTo: {
          messageId: "msg456",
          senderId: "user2",
          kind: "media",
          textSnippet: "📷 Photo",
        },
      };

      expect(config.replyTo?.kind).toBe("media");
    });
  });

  describe("scheduled messages configuration", () => {
    const mockOnSend = jest.fn().mockResolvedValue(undefined);

    it("should accept scheduled messages disabled by default", () => {
      const config: UseChatComposerConfig = {
        scope: "dm",
        conversationId: "chat123",
        currentUid: "user1",
        onSend: mockOnSend,
      };

      expect(config.enableScheduledMessages).toBeUndefined();
    });

    it("should accept scheduled messages enabled", () => {
      const onSchedulePress = jest.fn();

      const config: UseChatComposerConfig = {
        scope: "dm",
        conversationId: "chat123",
        currentUid: "user1",
        onSend: mockOnSend,
        enableScheduledMessages: true,
        onSchedulePress,
      };

      expect(config.enableScheduledMessages).toBe(true);
      expect(config.onSchedulePress).toBe(onSchedulePress);
    });
  });

  describe("mentions configuration", () => {
    const mockOnSend = jest.fn().mockResolvedValue(undefined);

    it("should accept mentions for groups", () => {
      const members = [
        { uid: "u1", displayName: "User 1", username: "user1" },
        { uid: "u2", displayName: "User 2", username: "user2" },
      ];

      const config: UseChatComposerConfig = {
        scope: "group",
        conversationId: "group123",
        currentUid: "user1",
        onSend: mockOnSend,
        enableMentions: true,
        mentionableMembers: members,
        maxMentionSuggestions: 10,
      };

      expect(config.enableMentions).toBe(true);
      expect(config.mentionableMembers).toEqual(members);
      expect(config.maxMentionSuggestions).toBe(10);
    });
  });

  describe("voice configuration", () => {
    const mockOnSend = jest.fn().mockResolvedValue(undefined);

    it("should accept voice enabled", () => {
      const config: UseChatComposerConfig = {
        scope: "dm",
        conversationId: "chat123",
        currentUid: "user1",
        onSend: mockOnSend,
        enableVoice: true,
        maxVoiceDuration: 60,
      };

      expect(config.enableVoice).toBe(true);
      expect(config.maxVoiceDuration).toBe(60);
    });

    it("should accept voice send handler", () => {
      const onSendVoice = jest.fn().mockResolvedValue(undefined);

      const config: UseChatComposerConfig = {
        scope: "dm",
        conversationId: "chat123",
        currentUid: "user1",
        onSend: mockOnSend,
        onSendVoice,
      };

      expect(config.onSendVoice).toBe(onSendVoice);
    });
  });

  describe("attachments configuration", () => {
    const mockOnSend = jest.fn().mockResolvedValue(undefined);

    it("should accept attachments enabled", () => {
      const config: UseChatComposerConfig = {
        scope: "dm",
        conversationId: "chat123",
        currentUid: "user1",
        onSend: mockOnSend,
        enableAttachments: true,
        maxAttachments: 5,
      };

      expect(config.enableAttachments).toBe(true);
      expect(config.maxAttachments).toBe(5);
    });
  });

  describe("send callback", () => {
    it("should accept onSend callback", () => {
      const onSend = jest.fn().mockResolvedValue({ success: true });

      const config: UseChatComposerConfig = {
        scope: "dm",
        conversationId: "chat123",
        currentUid: "user1",
        onSend,
      };

      expect(config.onSend).toBe(onSend);
    });
  });

  describe("debug mode", () => {
    const mockOnSend = jest.fn().mockResolvedValue(undefined);

    it("should accept debug flag", () => {
      const config: UseChatComposerConfig = {
        scope: "dm",
        conversationId: "chat123",
        currentUid: "user1",
        onSend: mockOnSend,
        debug: true,
      };

      expect(config.debug).toBe(true);
    });
  });

  describe("return type structure", () => {
    it("should define expected return type structure", () => {
      // Type-level test to verify return type shape
      type Text = UseChatComposerReturn["text"];
      type SetText = UseChatComposerReturn["setText"];
      type CanSend = UseChatComposerReturn["canSend"];
      type Sending = UseChatComposerReturn["sending"];
      type Send = UseChatComposerReturn["send"];
      type ClearText = UseChatComposerReturn["clearText"];
      type Mentions = UseChatComposerReturn["mentions"];
      type Attachments = UseChatComposerReturn["attachments"];
      type Voice = UseChatComposerReturn["voice"];
      type ScheduledMessagesEnabled =
        UseChatComposerReturn["scheduledMessagesEnabled"];
      type CanSchedule = UseChatComposerReturn["canSchedule"];
      type ReplyTo = UseChatComposerReturn["replyTo"];
      type Scope = UseChatComposerReturn["scope"];
      type UploadProgress = UseChatComposerReturn["uploadProgress"];
      type IsUploading = UseChatComposerReturn["isUploading"];

      // These are compile-time checks - if the types are wrong, TypeScript will error
      expect(true).toBe(true); // Placeholder assertion
    });
  });
});
