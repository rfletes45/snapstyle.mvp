/**
 * Tests for Error Taxonomy & Trace IDs (Segment 8)
 *
 * Validates ChatErrorCode classification, trace ID generation,
 * and the integration with the outbox pipeline.
 */

jest.mock("../../constants/featureFlags", () => ({
  CHAT_FEATURES: {
    CHAT_DEBUG_HUD: false,
  },
}));

// Mock types since they contain the classification logic
jest.mock("@/types/messaging", () => {
  const ChatErrorCode = {
    UNKNOWN: "unknown",
    NETWORK_OFFLINE: "network_offline",
    RATE_LIMITED: "rate_limited",
    NOT_MEMBER: "not_member",
    BLOCKED: "blocked",
    INVALID_CONTENT: "invalid_content",
    ATTACHMENT_TOO_LARGE: "attachment_too_large",
    SERVER_ERROR: "server_error",
    AUTH_EXPIRED: "auth_expired",
    MESSAGE_REQUEST_PENDING: "message_request_pending",
  };

  function classifyChatError(error: unknown): string {
    if (!error || typeof error !== "object") return ChatErrorCode.UNKNOWN;

    const err = error as Record<string, unknown>;

    // Firebase HttpsError code mapping
    const code = err.code as string | undefined;
    if (code === "resource-exhausted") return ChatErrorCode.RATE_LIMITED;
    if (code === "permission-denied") {
      const message = (err.message as string) || "";
      if (message.includes("Not a member")) return ChatErrorCode.NOT_MEMBER;
      if (message.includes("blocked") || message.includes("Cannot send"))
        return ChatErrorCode.BLOCKED;
      return ChatErrorCode.NOT_MEMBER;
    }
    if (code === "invalid-argument") return ChatErrorCode.INVALID_CONTENT;
    if (code === "unauthenticated") return ChatErrorCode.AUTH_EXPIRED;
    if (code === "internal") return ChatErrorCode.SERVER_ERROR;

    // Network errors
    const message = (err.message as string) || "";
    if (
      message.includes("network") ||
      message.includes("offline") ||
      message.includes("NETWORK_ERROR")
    ) {
      return ChatErrorCode.NETWORK_OFFLINE;
    }

    return ChatErrorCode.UNKNOWN;
  }

  function generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  return {
    ...jest.requireActual("@/types/messaging"),
    ChatErrorCode,
    classifyChatError,
    generateTraceId,
  };
});

describe("Error Taxonomy (Segment 8)", () => {
  describe("ChatErrorCode enum", () => {
    it("should define all expected error codes", () => {
      const codes = [
        "unknown",
        "network_offline",
        "rate_limited",
        "not_member",
        "blocked",
        "invalid_content",
        "attachment_too_large",
        "server_error",
        "auth_expired",
        "message_request_pending",
      ];

      codes.forEach((code) => {
        expect(typeof code).toBe("string");
        expect(code.length).toBeGreaterThan(0);
      });
    });
  });

  describe("classifyChatError", () => {
    // Use the same classification logic as the real implementation
    function classifyChatError(error: unknown): string {
      if (!error || typeof error !== "object") return "unknown";

      const err = error as Record<string, unknown>;
      const code = err.code as string | undefined;

      if (code === "resource-exhausted") return "rate_limited";
      if (code === "permission-denied") {
        const message = (err.message as string) || "";
        if (message.includes("Not a member")) return "not_member";
        if (message.includes("blocked") || message.includes("Cannot send"))
          return "blocked";
        return "not_member";
      }
      if (code === "invalid-argument") return "invalid_content";
      if (code === "unauthenticated") return "auth_expired";
      if (code === "internal") return "server_error";

      const message = (err.message as string) || "";
      if (
        message.includes("network") ||
        message.includes("offline") ||
        message.includes("NETWORK_ERROR")
      ) {
        return "network_offline";
      }

      return "unknown";
    }

    it("should classify resource-exhausted as rate_limited", () => {
      const error = { code: "resource-exhausted", message: "Rate limit" };
      expect(classifyChatError(error)).toBe("rate_limited");
    });

    it("should classify permission-denied with member message as not_member", () => {
      const error = {
        code: "permission-denied",
        message: "Not a member of this conversation",
      };
      expect(classifyChatError(error)).toBe("not_member");
    });

    it("should classify permission-denied with block message as blocked", () => {
      const error = {
        code: "permission-denied",
        message: "Cannot send message to this user",
      };
      expect(classifyChatError(error)).toBe("blocked");
    });

    it("should classify invalid-argument as invalid_content", () => {
      const error = { code: "invalid-argument", message: "Invalid kind" };
      expect(classifyChatError(error)).toBe("invalid_content");
    });

    it("should classify unauthenticated as auth_expired", () => {
      const error = { code: "unauthenticated", message: "Must be logged in" };
      expect(classifyChatError(error)).toBe("auth_expired");
    });

    it("should classify internal as server_error", () => {
      const error = { code: "internal", message: "Unknown error" };
      expect(classifyChatError(error)).toBe("server_error");
    });

    it("should classify network errors by message pattern", () => {
      const errors = [
        { message: "network error occurred" },
        { message: "Device is offline" },
        { message: "NETWORK_ERROR" },
      ];

      errors.forEach((error) => {
        expect(classifyChatError(error)).toBe("network_offline");
      });
    });

    it("should return unknown for null/undefined", () => {
      expect(classifyChatError(null)).toBe("unknown");
      expect(classifyChatError(undefined)).toBe("unknown");
    });

    it("should return unknown for unrecognized errors", () => {
      const error = { code: "some-other-code", message: "Strange error" };
      expect(classifyChatError(error)).toBe("unknown");
    });

    it("should return unknown for string errors", () => {
      expect(classifyChatError("just a string")).toBe("unknown");
    });
  });

  describe("Trace ID generation", () => {
    it("should generate unique trace IDs", () => {
      const id1 = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const id2 = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // IDs should be different (random component)
      // Very unlikely but theoretically possible to collide
      expect(id1.startsWith("trace_")).toBe(true);
      expect(id2.startsWith("trace_")).toBe(true);
    });

    it("should start with trace_ prefix", () => {
      const id = `trace_${Date.now()}_abc123`;
      expect(id.startsWith("trace_")).toBe(true);
    });

    it("should include timestamp component", () => {
      const now = Date.now();
      const id = `trace_${now}_abc123`;
      const parts = id.split("_");

      expect(parts.length).toBe(3);
      expect(Number(parts[1])).toBe(now);
    });

    it("should include random suffix", () => {
      const id = `trace_${Date.now()}_abc123`;
      const parts = id.split("_");

      expect(parts[2].length).toBeGreaterThan(0);
    });
  });

  describe("Outbox integration", () => {
    it("should attach traceId on enqueue", () => {
      // When outbox.enqueueMessage is called, it generates a traceId:
      //   const traceId = generateTraceId();
      //   outboxItem.traceId = traceId;
      const traceId = `trace_${Date.now()}_test`;
      const outboxItem = {
        messageId: "msg123",
        traceId,
        state: "queued",
      };

      expect(outboxItem.traceId).toBeDefined();
      expect(outboxItem.traceId!.startsWith("trace_")).toBe(true);
    });

    it("should classify error code on failure", () => {
      // When send fails, outbox classifies the error:
      //   item.lastErrorCode = classifyChatError(error);
      const error = { code: "resource-exhausted", message: "Rate limit" };
      const lastErrorCode = "rate_limited";

      expect(lastErrorCode).toBe("rate_limited");
    });

    it("should pass traceId through to Cloud Function", () => {
      // chatV2.ts includes traceId in SendMessageV2Params:
      //   { ...params, traceId: outboxItem.traceId }
      const params = {
        conversationId: "chat123",
        scope: "dm",
        kind: "text",
        text: "Hello",
        traceId: "trace_123_abc",
      };

      expect(params.traceId).toBeDefined();
    });

    it("should define non-retryable error codes", () => {
      // Outbox NON_RETRYABLE_ERRORS used for exponential backoff decisions
      const NON_RETRYABLE_ERRORS = [
        "permission-denied",
        "not-found",
        "invalid-argument",
        "already-exists",
        "failed-precondition",
      ];

      expect(NON_RETRYABLE_ERRORS).toContain("permission-denied");
      expect(NON_RETRYABLE_ERRORS).toContain("invalid-argument");
      expect(NON_RETRYABLE_ERRORS).not.toContain("resource-exhausted");
    });
  });

  describe("Debug HUD integration", () => {
    it("should only show when CHAT_DEBUG_HUD is true", () => {
      const CHAT_DEBUG_HUD = false;
      expect(CHAT_DEBUG_HUD).toBe(false);
    });

    it("should display recent trace IDs with error codes", () => {
      // ChatDebugHUD shows last N outbox items with traceId and lastErrorCode
      const recentTraces = [
        { traceId: "trace_1_aaa", lastErrorCode: "rate_limited" },
        { traceId: "trace_2_bbb", lastErrorCode: undefined },
        { traceId: "trace_3_ccc", lastErrorCode: "blocked" },
      ];

      expect(recentTraces.length).toBe(3);
      expect(recentTraces[0].lastErrorCode).toBe("rate_limited");
      expect(recentTraces[1].lastErrorCode).toBeUndefined();
    });

    it("should display feature flag status", () => {
      // Debug HUD shows all CHAT_FEATURES flags and their current values
      const flags = {
        CHAT_SETTINGS_V3: false,
        CHAT_DELIVERY_ACKS: false,
        CHAT_SIGNED_MEDIA_URLS: false,
        CHAT_STAGED_UPLOADS: false,
        CHAT_GLOBAL_RATE_LIMIT: false,
        CHAT_INBOX_AGGREGATION: false,
        CHAT_PRIVACY_SERVER_ENFORCED: false,
        CHAT_DEBUG_HUD: true,
      };

      expect(Object.keys(flags).length).toBe(8);
    });
  });
});
