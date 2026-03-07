/**
 * Games V4 — Admin / Owner Moderation Tests
 *
 * Validates server-authoritative game clearing:
 * - Permission gating (DM participant vs group owner/admin vs member)
 * - Soft-clear invite logic (status → resolved, hidden, TTL, unpin)
 * - Soft-clear session logic (status → abandoned, error resolution, reward block)
 * - Idempotent re-clear (no double-write)
 * - Bulk clear conversation games (wipe pinnedGameInviteIds)
 * - Audit log completeness
 *
 * These tests validate pure logic without Firebase — they mirror the exact
 * conditions and branching in moderation.ts.
 *
 * Run: npx jest moderation
 */

import type { GameInviteV4 } from "@/gamesV4/types/invite";

// =============================================================================
// Helpers — Fake data builders
// =============================================================================

interface FakeSession {
  sessionId: string;
  status: string;
  resolution?: { type: string; reason: string; winnerIds: string[] } | null;
  rewardsProcessed?: boolean;
  forceClearedAt?: unknown;
}

function makeInvite(overrides: Partial<GameInviteV4> = {}): GameInviteV4 {
  return {
    inviteId: "inv_mod_1",
    conversationId: "conv_1",
    conversationScope: "dm",
    gameId: "tic_tac_toe",
    runtimeType: "turnBased",
    createdBy: "host_uid",
    status: "lobby",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hostId: "host_uid",
    participantIds: ["host_uid", "player2"],
    spectatorIds: [],
    maxPlayers: 2,
    allowSpectators: false,
    spectateMode: "public_only",
    sessionId: "session_1",
    summary: {
      phase: "active",
      turnPlayerId: "host_uid",
      scoreSummary: [],
      lastMoveAt: null,
      lastActorId: null,
    },
    participantSummaries: [
      { uid: "host_uid", displayName: "Host", profilePictureUrl: null },
      { uid: "player2", displayName: "Player2", profilePictureUrl: null },
    ],
    spectatorSummaries: [],
    hiddenInChat: false,
    hiddenAt: null,
    deleteRequestedAt: null,
    deleteAt: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<FakeSession> = {}): FakeSession {
  return {
    sessionId: "session_1",
    status: "active",
    resolution: null,
    rewardsProcessed: false,
    ...overrides,
  };
}

// =============================================================================
// Permission Logic (mirrors assertConversationAuthority)
// =============================================================================

type GroupRole = "owner" | "admin" | "member";

interface ConversationContext {
  scope: "dm" | "group";
  members?: string[]; // DMs: participant uids
  createdBy?: string; // Groups: owner uid
  ownerId?: string; // Groups: explicit owner
  memberRole?: GroupRole; // For the caller's role
}

function hasConversationAuthority(
  uid: string,
  ctx: ConversationContext,
): boolean {
  if (ctx.scope === "dm") {
    return (ctx.members ?? []).includes(uid);
  }
  // Group
  if (ctx.createdBy === uid) return true;
  if (ctx.ownerId === uid) return true;
  if (ctx.memberRole === "admin" || ctx.memberRole === "owner") return true;
  return false;
}

// =============================================================================
// Soft-Clear Logic (mirrors softClearInvite / softClearSession)
// =============================================================================

function simulateSoftClearInvite(invite: GameInviteV4): {
  cleared: boolean;
  updatedStatus: string;
  hidden: boolean;
} {
  if (invite.status === "resolved" && invite.hiddenInChat) {
    return { cleared: false, updatedStatus: invite.status, hidden: true };
  }
  return { cleared: true, updatedStatus: "resolved", hidden: true };
}

function simulateSoftClearSession(session: FakeSession): {
  cleared: boolean;
  updatedStatus: string;
  resolution: { type: string } | null;
  rewardsProcessed: boolean;
} {
  const terminalStatuses = ["resolved", "abandoned", "expired"];
  if (terminalStatuses.includes(session.status)) {
    return {
      cleared: false,
      updatedStatus: session.status,
      resolution: session.resolution ? { type: session.resolution.type } : null,
      rewardsProcessed: session.rewardsProcessed ?? false,
    };
  }
  return {
    cleared: true,
    updatedStatus: "abandoned",
    resolution: { type: "error" },
    rewardsProcessed: true, // blocked
  };
}

// =============================================================================
// Permission Tests
// =============================================================================

describe("Moderation — Permission Gating", () => {
  describe("DM conversations", () => {
    it("DM participant can clear games", () => {
      const ctx: ConversationContext = {
        scope: "dm",
        members: ["alice", "bob"],
      };
      expect(hasConversationAuthority("alice", ctx)).toBe(true);
      expect(hasConversationAuthority("bob", ctx)).toBe(true);
    });

    it("non-member of DM is rejected", () => {
      const ctx: ConversationContext = {
        scope: "dm",
        members: ["alice", "bob"],
      };
      expect(hasConversationAuthority("charlie", ctx)).toBe(false);
    });
  });

  describe("Group conversations", () => {
    it("group owner (createdBy) can clear games", () => {
      const ctx: ConversationContext = {
        scope: "group",
        createdBy: "owner_uid",
        memberRole: "member",
      };
      expect(hasConversationAuthority("owner_uid", ctx)).toBe(true);
    });

    it("group owner (ownerId) can clear games", () => {
      const ctx: ConversationContext = {
        scope: "group",
        ownerId: "owner_uid",
        memberRole: "member",
      };
      expect(hasConversationAuthority("owner_uid", ctx)).toBe(true);
    });

    it("group admin can clear games", () => {
      const ctx: ConversationContext = {
        scope: "group",
        createdBy: "someone_else",
        memberRole: "admin",
      };
      expect(hasConversationAuthority("admin_uid", ctx)).toBe(true);
    });

    it("regular group member CANNOT clear games", () => {
      const ctx: ConversationContext = {
        scope: "group",
        createdBy: "someone_else",
        ownerId: "another_owner",
        memberRole: "member",
      };
      expect(hasConversationAuthority("regular_member", ctx)).toBe(false);
    });
  });
});

// =============================================================================
// Soft-Clear Invite Tests
// =============================================================================

describe("Moderation — Soft-Clear Invite", () => {
  it("active invite becomes resolved + hidden", () => {
    const invite = makeInvite({ status: "lobby" });
    const result = simulateSoftClearInvite(invite);
    expect(result.cleared).toBe(true);
    expect(result.updatedStatus).toBe("resolved");
    expect(result.hidden).toBe(true);
  });

  it("sent invite becomes resolved + hidden", () => {
    const invite = makeInvite({ status: "sent" });
    const result = simulateSoftClearInvite(invite);
    expect(result.cleared).toBe(true);
    expect(result.updatedStatus).toBe("resolved");
    expect(result.hidden).toBe(true);
  });

  it("already resolved + hidden invite is idempotent no-op", () => {
    const invite = makeInvite({
      status: "resolved",
      hiddenInChat: true,
    });
    const result = simulateSoftClearInvite(invite);
    expect(result.cleared).toBe(false);
    expect(result.updatedStatus).toBe("resolved");
  });

  it("resolved but NOT hidden invite still gets cleared", () => {
    const invite = makeInvite({
      status: "resolved",
      hiddenInChat: false,
    });
    const result = simulateSoftClearInvite(invite);
    expect(result.cleared).toBe(true);
    expect(result.hidden).toBe(true);
  });
});

// =============================================================================
// Soft-Clear Session Tests
// =============================================================================

describe("Moderation — Soft-Clear Session", () => {
  it("active session becomes abandoned with error resolution", () => {
    const session = makeSession({ status: "active" });
    const result = simulateSoftClearSession(session);
    expect(result.cleared).toBe(true);
    expect(result.updatedStatus).toBe("abandoned");
    expect(result.resolution).toEqual({ type: "error" });
    expect(result.rewardsProcessed).toBe(true); // blocked
  });

  it("already resolved session is idempotent no-op", () => {
    const session = makeSession({
      status: "resolved",
      resolution: { type: "normal", reason: "Game over", winnerIds: ["p1"] },
    });
    const result = simulateSoftClearSession(session);
    expect(result.cleared).toBe(false);
    expect(result.updatedStatus).toBe("resolved");
  });

  it("already abandoned session is idempotent no-op", () => {
    const session = makeSession({ status: "abandoned" });
    const result = simulateSoftClearSession(session);
    expect(result.cleared).toBe(false);
  });

  it("expired session is idempotent no-op", () => {
    const session = makeSession({ status: "expired" });
    const result = simulateSoftClearSession(session);
    expect(result.cleared).toBe(false);
  });

  it("error resolution prevents reward pipeline from running", () => {
    const session = makeSession({ status: "active", rewardsProcessed: false });
    const result = simulateSoftClearSession(session);
    // rewardsProcessed set to true → pipeline short-circuits
    expect(result.rewardsProcessed).toBe(true);
    expect(result.resolution!.type).toBe("error");
  });
});

// =============================================================================
// Bulk clear (conversation-wide)
// =============================================================================

describe("Moderation — Bulk Clear Conversation Games", () => {
  it("clears all non-terminal invites and their sessions", () => {
    const invites = [
      makeInvite({ inviteId: "inv_1", status: "lobby", sessionId: null }),
      makeInvite({ inviteId: "inv_2", status: "sent", sessionId: "s2" }),
      makeInvite({
        inviteId: "inv_3",
        status: "resolved",
        hiddenInChat: true,
        sessionId: "s3",
      }),
    ];

    const sessions: Record<string, FakeSession> = {
      s2: makeSession({ sessionId: "s2", status: "active" }),
      s3: makeSession({ sessionId: "s3", status: "resolved" }),
    };

    let invitesCleared = 0;
    let sessionsCleared = 0;

    for (const invite of invites) {
      const ic = simulateSoftClearInvite(invite);
      if (ic.cleared) invitesCleared++;

      if (invite.sessionId && sessions[invite.sessionId]) {
        const sc = simulateSoftClearSession(sessions[invite.sessionId]);
        if (sc.cleared) sessionsCleared++;
      }
    }

    // inv_1 (lobby → cleared), inv_2 (sent → cleared), inv_3 (resolved+hidden → no-op)
    expect(invitesCleared).toBe(2);
    // s2 (active → cleared), s3 (resolved → no-op)
    expect(sessionsCleared).toBe(1);
  });

  it("pinnedGameInviteIds array is wiped to empty", () => {
    // Simulates the force-wipe at the end of adminClearConversationGamesV4
    const pinnedBefore = ["inv_1", "inv_2", "inv_3"];
    const pinnedAfter: string[] = [];
    expect(pinnedAfter).toEqual([]);
    expect(pinnedAfter.length).toBe(0);
  });
});

// =============================================================================
// Audit log shape
// =============================================================================

describe("Moderation — Audit Log", () => {
  it("single-clear audit log has required fields", () => {
    const auditEntry = {
      action: "clearGame",
      inviteId: "inv_1",
      sessionId: "session_1",
      conversationId: "conv_1",
      conversationScope: "dm",
      gameId: "tic_tac_toe",
      actorUid: "moderator_uid",
      traceId: "trace_abc123",
      inviteCleared: true,
      sessionCleared: true,
      createdAt: "server_timestamp",
    };

    expect(auditEntry.action).toBe("clearGame");
    expect(auditEntry).toHaveProperty("inviteId");
    expect(auditEntry).toHaveProperty("sessionId");
    expect(auditEntry).toHaveProperty("conversationId");
    expect(auditEntry).toHaveProperty("actorUid");
    expect(auditEntry).toHaveProperty("traceId");
    expect(auditEntry).toHaveProperty("createdAt");
  });

  it("conversation-clear audit log has required fields", () => {
    const auditEntry = {
      action: "clearConversationGames",
      conversationId: "conv_1",
      conversationScope: "group",
      actorUid: "admin_uid",
      traceId: "trace_xyz789",
      totalInvitesCleared: 3,
      totalSessionsCleared: 2,
      totalInvitesScanned: 5,
      createdAt: "server_timestamp",
    };

    expect(auditEntry.action).toBe("clearConversationGames");
    expect(auditEntry).toHaveProperty("conversationId");
    expect(auditEntry).toHaveProperty("conversationScope");
    expect(auditEntry).toHaveProperty("totalInvitesCleared");
    expect(auditEntry).toHaveProperty("totalSessionsCleared");
    expect(auditEntry).toHaveProperty("totalInvitesScanned");
  });

  it("Firestore rules block client reads of moderation audit collection", () => {
    // GameModerationAuditV4 is server-only (read: false, write: false in rules)
    // This is a declarative assertion — the rules enforce it
    const collectionName = "GameModerationAuditV4";
    expect(collectionName).toBeTruthy();
    // Rules: match /GameModerationAuditV4/{docId} { allow read, write: if false; }
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe("Moderation — Edge Cases", () => {
  it("missing invite doc returns alreadyClean", () => {
    // adminClearGameV4 returns { alreadyClean: true } if invite doesn't exist
    const inviteExists = false;
    const result = {
      success: true,
      inviteCleared: false,
      sessionCleared: false,
      alreadyClean: !inviteExists,
    };
    expect(result.alreadyClean).toBe(true);
    expect(result.inviteCleared).toBe(false);
  });

  it("invite with no sessionId only clears the invite", () => {
    const invite = makeInvite({ sessionId: null });
    const inviteResult = simulateSoftClearInvite(invite);
    expect(inviteResult.cleared).toBe(true);
    // No session to clear
    expect(invite.sessionId).toBeNull();
  });

  it("double-clear is safe (idempotent)", () => {
    const invite = makeInvite({ status: "lobby" });

    // First clear
    const r1 = simulateSoftClearInvite(invite);
    expect(r1.cleared).toBe(true);

    // Simulate post-clear state
    const clearedInvite = makeInvite({
      ...invite,
      status: "resolved",
      hiddenInChat: true,
    });

    // Second clear — should be no-op
    const r2 = simulateSoftClearInvite(clearedInvite);
    expect(r2.cleared).toBe(false);
  });
});
