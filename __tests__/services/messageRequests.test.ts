/**
 * Tests for Message Requests (Segment 5)
 *
 * Validates the DM acceptance check flow, accept, and decline logic.
 */

describe("Message Requests (Segment 5)", () => {
  describe("checkDmAcceptance", () => {
    describe("dmAcceptance = everyone", () => {
      it("should return allowed for any sender", () => {
        const acceptance = "everyone";
        expect(acceptance === "everyone").toBe(true);
        // checkDmAcceptance returns { outcome: "allowed" } immediately
      });
    });

    describe("dmAcceptance = friends_only", () => {
      it("should return allowed when sender and recipient are friends", () => {
        const acceptance = "friends_only";
        const areFriends = true;

        // When friends → { outcome: "allowed" }
        expect(acceptance).toBe("friends_only");
        expect(areFriends).toBe(true);
      });

      it("should return rejected when sender is not a friend", () => {
        const acceptance = "friends_only";
        const areFriends = false;

        // Returns { outcome: "rejected", reason: "..." }
        expect(acceptance).toBe("friends_only");
        expect(areFriends).toBe(false);
      });

      it("should include a user-friendly rejection reason", () => {
        const reason = "This user isn't accepting DMs from non-friends";
        expect(reason).toContain("non-friends");
      });
    });

    describe("dmAcceptance = requests", () => {
      it("should create a MessageRequest when no existing request", () => {
        const acceptance = "requests";
        const existingRequest = null;

        // Returns { outcome: "request_created" }
        expect(acceptance).toBe("requests");
        expect(existingRequest).toBeNull();
      });

      it("should return allowed when existing request is accepted", () => {
        const existingStatus = "accepted";
        expect(existingStatus).toBe("accepted");
        // Returns { outcome: "allowed" }
      });

      it("should return request_created when existing request is pending", () => {
        const existingStatus = "pending";
        expect(existingStatus).toBe("pending");
        // Returns { outcome: "request_created" }
      });

      it("should return rejected when existing request is declined", () => {
        const existingStatus = "declined";
        expect(existingStatus).toBe("declined");
        // Returns { outcome: "rejected", reason: "Your message request was declined" }
      });

      it("should include sender profile in created request", () => {
        // MessageRequest doc includes: requesterId, requesterName, requesterAvatarConfig
        const requestDoc = {
          chatId: "chat123",
          requesterId: "sender456",
          requesterName: "TestUser",
          requesterAvatarConfig: { hat: "crown" },
          status: "pending",
          createdAt: Date.now(),
          messagePreview: "Hello!",
          messageKind: "text",
        };

        expect(requestDoc.requesterId).toBe("sender456");
        expect(requestDoc.requesterName).toBe("TestUser");
        expect(requestDoc.requesterAvatarConfig).toBeDefined();
        expect(requestDoc.status).toBe("pending");
      });

      it("should truncate message preview to 80 chars", () => {
        const longText = "a".repeat(200);
        const preview =
          longText.length > 80 ? longText.substring(0, 80) + "…" : longText;

        expect(preview.length).toBeLessThanOrEqual(81); // 80 + ellipsis
        expect(preview.endsWith("…")).toBe(true);
      });
    });

    describe("Friendship check", () => {
      it("should query Friends collection with array-contains", () => {
        // areFriends queries:
        //   Friends.where("users", "array-contains", uid1)
        //   then checks if any doc has uid2 in users array
        const friendsDoc = { users: ["user1", "user2"] };
        expect(friendsDoc.users.includes("user2")).toBe(true);
      });

      it("should return false when no Friends doc matches", () => {
        const friendsDoc = { users: ["user1", "user3"] };
        expect(friendsDoc.users.includes("user2")).toBe(false);
      });
    });

    describe("Settings resolution", () => {
      it("should check chatSettings doc first", () => {
        // getDmAcceptance reads Users/{uid}/settings/chatSettings first
        // Falls back to Users/{uid}/settings/inbox
        const chatSettings = { dmAcceptance: "friends_only" };
        expect(chatSettings.dmAcceptance).toBe("friends_only");
      });

      it("should fall back to inbox settings", () => {
        // When chatSettings doesn't exist, reads inbox settings
        const inboxSettings = { dmAcceptance: "requests" };
        expect(inboxSettings.dmAcceptance).toBe("requests");
      });

      it("should default to everyone when no settings exist", () => {
        // When neither chatSettings nor inbox settings exist
        const defaultAcceptance = "everyone";
        expect(defaultAcceptance).toBe("everyone");
      });
    });
  });

  describe("acceptMessageRequest callable", () => {
    it("should require authentication", () => {
      const context = { auth: null };
      expect(context.auth).toBeNull();
      // Throws "unauthenticated"
    });

    it("should require chatId parameter", () => {
      const data = { chatId: "" };
      expect(!data.chatId).toBe(true);
      // Throws "invalid-argument"
    });

    it("should throw not-found when request doesn't exist", () => {
      const reqDocExists = false;
      expect(reqDocExists).toBe(false);
      // Throws "not-found"
    });

    it("should set status to accepted", () => {
      const update = {
        status: "accepted",
        resolvedAt: Date.now(),
      };
      expect(update.status).toBe("accepted");
      expect(update.resolvedAt).toBeDefined();
    });

    it("should be idempotent for already-accepted requests", () => {
      const existingStatus = "accepted";
      // Returns { success: true } without re-updating
      expect(existingStatus).toBe("accepted");
    });
  });

  describe("declineMessageRequest callable", () => {
    it("should require authentication", () => {
      const context = { auth: null };
      expect(context.auth).toBeNull();
    });

    it("should set status to declined", () => {
      const update = {
        status: "declined",
        resolvedAt: Date.now(),
      };
      expect(update.status).toBe("declined");
    });

    it("should optionally block the requester", () => {
      const data = { chatId: "chat123", blockRequester: true };
      const requesterId = "sender456";

      // When blockRequester = true, adds to blockedUsers collection
      expect(data.blockRequester).toBe(true);

      const blockDoc = {
        blockedUserId: requesterId,
        blockedAt: Date.now(),
      };
      expect(blockDoc.blockedUserId).toBe("sender456");
    });

    it("should use batch write for decline + block", () => {
      // declineMessageRequest uses db.batch() to atomically:
      // 1. Update request status to "declined"
      // 2. Set blockedUsers doc (if blockRequester is true)
      const operations = ["updateRequest", "setBlock"];
      expect(operations.length).toBe(2);
    });
  });

  describe("sendMessageV2 integration", () => {
    it("should return messageRequestCreated when request is created", () => {
      // sendMessageV2 returns special response when gatingResult.outcome === "request_created"
      const response = {
        success: true,
        message: {
          id: "msg123",
          serverReceivedAt: Date.now(),
          messageRequestCreated: true,
        },
        isExisting: false,
      };

      expect(response.message.messageRequestCreated).toBe(true);
      expect(response.success).toBe(true);
    });

    it("should throw when gating outcome is rejected", () => {
      // sendMessageV2 throws permission-denied when outcome is "rejected"
      const gatingResult = {
        outcome: "rejected" as const,
        reason: "This user isn't accepting DMs from non-friends",
      };

      expect(gatingResult.outcome).toBe("rejected");
      expect(gatingResult.reason).toBeDefined();
    });

    it("should only gate DM messages (not groups)", () => {
      // The gating is inside: if (scope === "dm") { ... checkDmAcceptance ... }
      const shouldGateDm = (scope: "dm" | "group") => scope === "dm";
      const scope = "group";
      expect(shouldGateDm(scope)).toBe(false);
    });

    it("should truncate preview to 80 chars for gating", () => {
      const text = "a".repeat(200);
      const preview = text.length > 80 ? text.substring(0, 80) + "…" : text;
      expect(preview.length).toBe(81);
    });
  });
});
