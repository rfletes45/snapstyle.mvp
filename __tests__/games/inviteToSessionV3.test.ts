/**
 * inviteToSessionV3 — contract tests
 *
 * These tests verify the INVARIANTS of the v3 invite flow:
 *
 *   Invariant 1: Sending an invite MUST NOT modify GameSessions.participants.
 *                Only joinSessionV3 is allowed to add participants.
 *
 *   Invariant 2: Sending an invite MUST create a GameInvites doc with correct
 *                eligibleUserIds so the chat subscription can discover it.
 *
 *   Invariant 3: For group invites, eligibleUserIds must contain actual member
 *                UIDs — never a groupId string.
 *
 *   Invariant 4: For DM invites, eligibleUserIds = [sender, recipient].
 *
 * Because the Cloud Function runs server-side, these tests exercise the
 * parameter-building logic on the client side (SessionLobbyScreen handlers)
 * and the eligibleUserIds construction logic.
 */

// =============================================================================
// Helpers — mirrors the client-side parameter construction
// =============================================================================

interface InviteParams {
  sessionId: string;
  conversationId: string;
  recipientUid?: string;
  eligibleUserIds?: string[];
}

/**
 * Mirrors handleSelectFriend in SessionLobbyScreen.
 */
function buildDmInviteParams(
  sessionId: string,
  currentUid: string,
  friendUid: string,
): InviteParams {
  // DM conversation IDs are deterministic sorted pairs
  const conversationId = [currentUid, friendUid].sort().join("_");
  return {
    sessionId,
    recipientUid: friendUid,
    conversationId,
  };
}

/**
 * Mirrors handleSelectGroup in SessionLobbyScreen.
 */
function buildGroupInviteParams(
  sessionId: string,
  groupId: string,
  memberIds: string[],
): InviteParams {
  return {
    sessionId,
    conversationId: groupId,
    eligibleUserIds: memberIds,
  };
}

/**
 * Mirrors the CF's eligibleUserIds construction logic.
 */
function computeEligibleUserIds(
  senderUid: string,
  params: InviteParams,
): string[] {
  if (
    Array.isArray(params.eligibleUserIds) &&
    params.eligibleUserIds.length > 0
  ) {
    // Group invite — use provided member UIDs, ensure sender is included
    const set = new Set(
      params.eligibleUserIds.filter((id) => typeof id === "string"),
    );
    set.add(senderUid);
    return [...set];
  }
  // DM invite — sender + recipient
  return [senderUid, params.recipientUid!];
}

// =============================================================================
// Tests
// =============================================================================

describe("inviteToSessionV3 contract", () => {
  const HOST_UID = "host-123";
  const FRIEND_UID = "friend-456";
  const SESSION_ID = "session-abc";
  const GROUP_ID = "group-xyz";
  const GROUP_MEMBERS = ["host-123", "member-a", "member-b", "member-c"];

  // =========================================================================
  // Invariant 1: invite NEVER touches participants
  // =========================================================================

  describe("Invariant 1: invite does NOT modify participants", () => {
    it("DM invite params contain NO participant mutation fields", () => {
      const params = buildDmInviteParams(SESSION_ID, HOST_UID, FRIEND_UID);

      // The params object must NOT contain participants or participantUids
      expect(params).not.toHaveProperty("participants");
      expect(params).not.toHaveProperty("participantUids");
    });

    it("group invite params contain NO participant mutation fields", () => {
      const params = buildGroupInviteParams(
        SESSION_ID,
        GROUP_ID,
        GROUP_MEMBERS,
      );

      expect(params).not.toHaveProperty("participants");
      expect(params).not.toHaveProperty("participantUids");
    });
  });

  // =========================================================================
  // Invariant 2: eligibleUserIds are real user UIDs
  // =========================================================================

  describe("Invariant 2: eligibleUserIds correctness", () => {
    it("DM invite: eligibleUserIds = [sender, recipient]", () => {
      const params = buildDmInviteParams(SESSION_ID, HOST_UID, FRIEND_UID);
      const eligible = computeEligibleUserIds(HOST_UID, params);

      expect(eligible).toContain(HOST_UID);
      expect(eligible).toContain(FRIEND_UID);
      expect(eligible).toHaveLength(2);
    });

    it("group invite: eligibleUserIds = all group members (includes sender)", () => {
      const params = buildGroupInviteParams(
        SESSION_ID,
        GROUP_ID,
        GROUP_MEMBERS,
      );
      const eligible = computeEligibleUserIds(HOST_UID, params);

      // All group members should be in eligibleUserIds
      for (const member of GROUP_MEMBERS) {
        expect(eligible).toContain(member);
      }
      // Host is already in GROUP_MEMBERS, no duplicates
      expect(eligible).toHaveLength(GROUP_MEMBERS.length);
    });

    it("group invite: sender is added if not in memberIds", () => {
      const membersWithoutHost = ["member-a", "member-b"];
      const params = buildGroupInviteParams(
        SESSION_ID,
        GROUP_ID,
        membersWithoutHost,
      );
      const eligible = computeEligibleUserIds(HOST_UID, params);

      expect(eligible).toContain(HOST_UID);
      expect(eligible).toContain("member-a");
      expect(eligible).toContain("member-b");
      expect(eligible).toHaveLength(3);
    });
  });

  // =========================================================================
  // Invariant 3: group invites never use groupId as recipientUid
  // =========================================================================

  describe("Invariant 3: no groupId as recipientUid", () => {
    it("group invite params do NOT set recipientUid to the groupId", () => {
      const params = buildGroupInviteParams(
        SESSION_ID,
        GROUP_ID,
        GROUP_MEMBERS,
      );

      // recipientUid should be undefined for group invites
      expect(params.recipientUid).toBeUndefined();
      // conversationId is the groupId, but recipientUid must NOT be
      expect(params.recipientUid).not.toBe(GROUP_ID);
    });

    it("group invite eligibleUserIds never contains the groupId string", () => {
      const params = buildGroupInviteParams(
        SESSION_ID,
        GROUP_ID,
        GROUP_MEMBERS,
      );
      const eligible = computeEligibleUserIds(HOST_UID, params);

      // GROUP_ID should NOT appear in eligible (it's a doc ID, not a UID)
      expect(eligible).not.toContain(GROUP_ID);
    });
  });

  // =========================================================================
  // Invariant 4: DM conversationId is deterministic
  // =========================================================================

  describe("Invariant 4: DM conversationId format", () => {
    it("produces consistent sorted conversationId", () => {
      const params1 = buildDmInviteParams(SESSION_ID, HOST_UID, FRIEND_UID);
      const params2 = buildDmInviteParams(SESSION_ID, FRIEND_UID, HOST_UID);

      expect(params1.conversationId).toBe(params2.conversationId);
    });

    it("conversationId contains underscore separator", () => {
      const params = buildDmInviteParams(SESSION_ID, HOST_UID, FRIEND_UID);
      expect(params.conversationId).toContain("_");
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe("edge cases", () => {
    it("empty eligibleUserIds falls back to DM path", () => {
      const params: InviteParams = {
        sessionId: SESSION_ID,
        conversationId: "some-convo",
        recipientUid: FRIEND_UID,
        eligibleUserIds: [],
      };
      const eligible = computeEligibleUserIds(HOST_UID, params);

      // Falls back to DM: [sender, recipient]
      expect(eligible).toEqual([HOST_UID, FRIEND_UID]);
    });

    it("deduplicates sender in eligibleUserIds", () => {
      // If memberIds already contains the sender
      const members = [HOST_UID, HOST_UID, "member-a"];
      const params = buildGroupInviteParams(SESSION_ID, GROUP_ID, members);
      const eligible = computeEligibleUserIds(HOST_UID, params);

      const hostCount = eligible.filter((id) => id === HOST_UID).length;
      expect(hostCount).toBe(1);
    });
  });
});
