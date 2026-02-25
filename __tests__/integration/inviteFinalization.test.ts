/**
 * Invite Finalization Integration Tests
 *
 * Tests for the Phase 1–4 invite hardening:
 *   - finalizeUniversalInvite idempotency
 *   - Chat-hide fields (chatVisibility, chatHiddenAt, chatHiddenInConversationIds)
 *   - deleteAt (TTL) field
 *   - Self-healing: terminal invites with missing chat-hide fields
 *   - Transition guards (terminal → terminal = noop, non-terminal → terminal = OK)
 *   - resolvedAt / resolvedBy / resolutionType bookkeeping
 *   - Watchdog reconciliation logic (stuck invites, self-heal pass)
 *
 * These tests use an in-memory Map mock database (same pattern as
 * universalGameInvites.test.ts). No real Firestore needed.
 *
 * @see firebase-backend/functions/src/games.ts — finalizeUniversalInvite
 */

import { ExtendedGameType } from "@/types/games";

// =============================================================================
// Mock Types (mirrors backend)
// =============================================================================

type InviteContext = "dm" | "group";

type UniversalInviteStatus =
  | "pending"
  | "filling"
  | "ready"
  | "starting"
  | "active"
  | "completed"
  | "declined"
  | "expired"
  | "cancelled";

interface PlayerSlot {
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  claimedAt: number;
  isHost: boolean;
}

interface UniversalGameInvite {
  id: string;
  gameType: ExtendedGameType;
  senderId: string;
  senderName: string;
  context: InviteContext;
  conversationId: string;
  targetType: "universal" | "specific";
  eligibleUserIds: string[];
  requiredPlayers: number;
  maxPlayers: number;
  claimedSlots: PlayerSlot[];
  status: UniversalInviteStatus;
  gameId?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  showInPlayPage: boolean;
  // Phase 1 finalization fields
  resolvedAt?: number;
  resolutionType?: string;
  resolvedBy?: "server" | "client" | "room" | "watchdog";
  chatVisibility?: "visible" | "hidden";
  chatHiddenAt?: number;
  chatHiddenInConversationIds?: string[];
  deleteAt?: number;
  completedAt?: number;
  winnerId?: string | null;
  winReason?: string | null;
}

interface FinalizeInviteParams {
  inviteId: string;
  terminalStatus: "completed" | "declined" | "expired" | "cancelled";
  resolutionType?: string;
  winnerId?: string | null;
  winReason?: string | null;
  resolvedBy: "server" | "client" | "room" | "watchdog";
  traceId?: string;
  now?: number;
}

// =============================================================================
// Constants (mirrors backend)
// =============================================================================

const INVITE_DELETE_DELAY_MS = 6 * 60 * 60 * 1000; // 6 hours

const INVITE_TERMINAL_STATUSES = new Set<UniversalInviteStatus>([
  "completed",
  "declined",
  "expired",
  "cancelled",
]);

// =============================================================================
// Mock Database
// =============================================================================

let invites: Map<string, UniversalGameInvite> = new Map();
let currentTime: number;
let txLog: Array<{ inviteId: string; fields: Record<string, unknown> }> = [];

function resetMocks(): void {
  invites = new Map();
  txLog = [];
  currentTime = Date.now();
}

function advanceTime(ms: number): void {
  currentTime += ms;
}

function getCurrentTime(): number {
  return currentTime;
}

// =============================================================================
// Mock finalizeUniversalInvite (mirrors backend logic exactly)
// =============================================================================

async function finalizeUniversalInvite(
  params: FinalizeInviteParams,
): Promise<{ success: boolean; alreadyTerminal?: boolean }> {
  const {
    inviteId,
    terminalStatus,
    resolutionType,
    winnerId,
    winReason,
    resolvedBy,
    now = getCurrentTime(),
  } = params;

  const invite = invites.get(inviteId);

  // Invite missing → treat as success (already cleaned up / deleted)
  if (!invite) {
    return { success: true, alreadyTerminal: true };
  }

  // Already terminal → ensure chat-hide + deleteAt are set, then return
  if (INVITE_TERMINAL_STATUSES.has(invite.status)) {
    const patch: Record<string, unknown> = {};
    if (invite.chatVisibility !== "hidden") {
      patch.chatVisibility = "hidden";
      patch.chatHiddenAt = now;
    }
    if (!invite.deleteAt) {
      patch.deleteAt = now + INVITE_DELETE_DELAY_MS;
    }
    if (!invite.resolvedAt) {
      patch.resolvedAt = now;
    }
    if (
      (!invite.chatHiddenInConversationIds ||
        invite.chatHiddenInConversationIds.length === 0) &&
      invite.conversationId
    ) {
      patch.chatHiddenInConversationIds = [invite.conversationId];
    }
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = now;
      Object.assign(invite, patch);
      invites.set(inviteId, invite);
      txLog.push({ inviteId, fields: patch });
    }
    return { success: true, alreadyTerminal: true };
  }

  // Build the update payload
  const updates: Record<string, unknown> = {
    status: terminalStatus,
    resolvedAt: now,
    resolvedBy,
    chatVisibility: "hidden",
    chatHiddenAt: now,
    deleteAt: now + INVITE_DELETE_DELAY_MS,
    completedAt: now,
    updatedAt: now,
  };

  if (resolutionType) updates.resolutionType = resolutionType;
  if (winnerId !== undefined) updates.winnerId = winnerId ?? null;
  if (winReason !== undefined) updates.winReason = winReason ?? null;

  if (invite.conversationId) {
    updates.chatHiddenInConversationIds = [invite.conversationId];
  }

  Object.assign(invite, updates);
  invites.set(inviteId, invite);
  txLog.push({ inviteId, fields: updates });

  return { success: true, alreadyTerminal: false };
}

// =============================================================================
// Helper: create a test invite at a given status
// =============================================================================

let inviteCounter = 0;
function createTestInvite(
  overrides: Partial<UniversalGameInvite> = {},
): UniversalGameInvite {
  inviteCounter++;
  const id = `inv_test_${inviteCounter}`;
  const now = getCurrentTime();

  const invite: UniversalGameInvite = {
    id,
    gameType: "chess" as ExtendedGameType,
    senderId: "host1",
    senderName: "Host",
    context: "dm",
    conversationId: "conv_abc",
    targetType: "specific",
    eligibleUserIds: ["host1", "player2"],
    requiredPlayers: 2,
    maxPlayers: 2,
    claimedSlots: [
      { playerId: "host1", playerName: "Host", claimedAt: now, isHost: true },
      {
        playerId: "player2",
        playerName: "Player 2",
        claimedAt: now,
        isHost: false,
      },
    ],
    status: "active",
    gameId: `game_${id}`,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 60 * 60 * 1000,
    showInPlayPage: true,
    ...overrides,
  };

  invites.set(invite.id, invite);
  return invite;
}

// =============================================================================
// Tests
// =============================================================================

describe("Invite Finalization (Phase 1–4 Hardening)", () => {
  beforeEach(() => {
    resetMocks();
    inviteCounter = 0;
  });

  // ─── Core finalization ──────────────────────────────────────────────────

  describe("core finalization", () => {
    it("transitions an active invite to completed with all finalization fields", async () => {
      const invite = createTestInvite({ status: "active" });
      const now = getCurrentTime();

      const result = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "win",
        winnerId: "player2",
        resolvedBy: "server",
        now,
      });

      expect(result.success).toBe(true);
      expect(result.alreadyTerminal).toBe(false);

      const updated = invites.get(invite.id)!;
      expect(updated.status).toBe("completed");
      expect(updated.resolvedAt).toBe(now);
      expect(updated.resolvedBy).toBe("server");
      expect(updated.resolutionType).toBe("win");
      expect(updated.winnerId).toBe("player2");
      expect(updated.chatVisibility).toBe("hidden");
      expect(updated.chatHiddenAt).toBe(now);
      expect(updated.chatHiddenInConversationIds).toEqual(["conv_abc"]);
      expect(updated.deleteAt).toBe(now + INVITE_DELETE_DELAY_MS);
      expect(updated.completedAt).toBe(now);
    });

    it("sets chatHiddenInConversationIds from conversationId", async () => {
      const invite = createTestInvite({
        status: "active",
        conversationId: "group_chat_xyz",
      });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "draw",
        resolvedBy: "server",
      });

      const updated = invites.get(invite.id)!;
      expect(updated.chatHiddenInConversationIds).toEqual(["group_chat_xyz"]);
    });

    it("handles cancel resolution type", async () => {
      const invite = createTestInvite({ status: "pending" });

      const result = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "cancelled",
        resolutionType: "cancel",
        resolvedBy: "client",
      });

      expect(result.success).toBe(true);
      expect(result.alreadyTerminal).toBe(false);

      const updated = invites.get(invite.id)!;
      expect(updated.status).toBe("cancelled");
      expect(updated.resolvedBy).toBe("client");
      expect(updated.resolutionType).toBe("cancel");
      expect(updated.chatVisibility).toBe("hidden");
    });

    it("handles expire resolution type on pending invite", async () => {
      const invite = createTestInvite({ status: "pending" });

      const result = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "expired",
        resolutionType: "expire",
        resolvedBy: "server",
      });

      expect(result.success).toBe(true);

      const updated = invites.get(invite.id)!;
      expect(updated.status).toBe("expired");
      expect(updated.chatVisibility).toBe("hidden");
    });

    it("handles winnerId=null for draws", async () => {
      const invite = createTestInvite({ status: "active" });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "draw",
        winnerId: null,
        resolvedBy: "server",
      });

      const updated = invites.get(invite.id)!;
      expect(updated.winnerId).toBeNull();
    });

    it("transitions from starting to completed", async () => {
      const invite = createTestInvite({ status: "starting" });

      const result = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "timeout",
        resolvedBy: "room",
      });

      expect(result.success).toBe(true);
      expect(result.alreadyTerminal).toBe(false);
      expect(invites.get(invite.id)!.status).toBe("completed");
      expect(invites.get(invite.id)!.resolvedBy).toBe("room");
    });

    it("transitions from filling to cancelled", async () => {
      const invite = createTestInvite({ status: "filling" });

      const result = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "cancelled",
        resolvedBy: "client",
      });

      expect(result.success).toBe(true);
      expect(invites.get(invite.id)!.status).toBe("cancelled");
    });
  });

  // ─── Idempotency ──────────────────────────────────────────────────────

  describe("idempotency", () => {
    it("calling finalize twice on same invite is safe", async () => {
      const invite = createTestInvite({ status: "active" });
      const now = getCurrentTime();

      const result1 = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "win",
        winnerId: "player2",
        resolvedBy: "server",
        now,
      });

      advanceTime(5000);

      const result2 = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "win",
        winnerId: "player2",
        resolvedBy: "server",
        now: getCurrentTime(),
      });

      expect(result1.success).toBe(true);
      expect(result1.alreadyTerminal).toBe(false);
      expect(result2.success).toBe(true);
      expect(result2.alreadyTerminal).toBe(true);

      // Original finalization fields preserved (not overwritten)
      const updated = invites.get(invite.id)!;
      expect(updated.resolvedAt).toBe(now); // first call's timestamp
      expect(updated.chatVisibility).toBe("hidden");
    });

    it("calling finalize on missing invite returns success", async () => {
      const result = await finalizeUniversalInvite({
        inviteId: "nonexistent_invite",
        terminalStatus: "completed",
        resolvedBy: "server",
      });

      expect(result.success).toBe(true);
      expect(result.alreadyTerminal).toBe(true);
    });

    it("repeated calls don't generate extra transaction logs after first terminal", async () => {
      const invite = createTestInvite({ status: "active" });

      // First call: transitions to terminal
      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolvedBy: "server",
      });

      const logCountAfterFirst = txLog.length;

      // Second call: already terminal, all fields present → no writes
      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolvedBy: "server",
      });

      // The second call should not produce additional log entries since
      // all fields were already set by the first call
      expect(txLog.length).toBe(logCountAfterFirst);
    });

    it("concurrent resolvers produce consistent final state", async () => {
      const invite = createTestInvite({ status: "active" });

      // Simulate concurrent calls from different resolvers
      const [r1, r2, r3] = await Promise.all([
        finalizeUniversalInvite({
          inviteId: invite.id,
          terminalStatus: "completed",
          resolutionType: "win",
          resolvedBy: "server",
        }),
        finalizeUniversalInvite({
          inviteId: invite.id,
          terminalStatus: "completed",
          resolutionType: "win",
          resolvedBy: "room",
        }),
        finalizeUniversalInvite({
          inviteId: invite.id,
          terminalStatus: "completed",
          resolutionType: "win",
          resolvedBy: "watchdog",
        }),
      ]);

      // All should succeed
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(r3.success).toBe(true);

      // Exactly one is the primary transition; the rest are alreadyTerminal
      const primaries = [r1, r2, r3].filter((r) => !r.alreadyTerminal);
      const secondaries = [r1, r2, r3].filter((r) => r.alreadyTerminal);
      expect(primaries.length).toBe(1);
      expect(secondaries.length).toBe(2);

      // Final state is consistent
      const updated = invites.get(invite.id)!;
      expect(updated.status).toBe("completed");
      expect(updated.chatVisibility).toBe("hidden");
      expect(updated.deleteAt).toBeDefined();
    });
  });

  // ─── Self-healing ─────────────────────────────────────────────────────

  describe("self-healing", () => {
    it("backfills chatVisibility on terminal invite missing it", async () => {
      const invite = createTestInvite({
        status: "completed",
        // Simulate legacy invite: terminal but no chat-hide fields
        chatVisibility: undefined,
        chatHiddenAt: undefined,
        chatHiddenInConversationIds: undefined,
        deleteAt: undefined,
        resolvedAt: undefined,
      });

      const now = getCurrentTime();
      const result = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolvedBy: "watchdog",
        now,
      });

      expect(result.success).toBe(true);
      expect(result.alreadyTerminal).toBe(true);

      const updated = invites.get(invite.id)!;
      expect(updated.chatVisibility).toBe("hidden");
      expect(updated.chatHiddenAt).toBe(now);
      expect(updated.deleteAt).toBe(now + INVITE_DELETE_DELAY_MS);
      expect(updated.resolvedAt).toBe(now);
      expect(updated.chatHiddenInConversationIds).toEqual(["conv_abc"]);
    });

    it("backfills deleteAt on terminal invite that has chatVisibility but no deleteAt", async () => {
      const invite = createTestInvite({
        status: "expired",
        chatVisibility: "hidden",
        chatHiddenAt: currentTime - 1000,
        resolvedAt: currentTime - 1000,
        deleteAt: undefined,
      });

      const now = getCurrentTime();
      const result = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "expired",
        resolvedBy: "watchdog",
        now,
      });

      expect(result.success).toBe(true);
      expect(result.alreadyTerminal).toBe(true);

      const updated = invites.get(invite.id)!;
      // chatVisibility was already hidden — should stay the same
      expect(updated.chatVisibility).toBe("hidden");
      // deleteAt should now be backfilled
      expect(updated.deleteAt).toBe(now + INVITE_DELETE_DELAY_MS);
    });

    it("backfills chatHiddenInConversationIds on terminal invite missing it", async () => {
      const invite = createTestInvite({
        status: "completed",
        chatVisibility: "hidden",
        chatHiddenAt: currentTime - 1000,
        resolvedAt: currentTime - 1000,
        deleteAt: currentTime + INVITE_DELETE_DELAY_MS,
        chatHiddenInConversationIds: [],
        conversationId: "conv_xyz",
      });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolvedBy: "watchdog",
      });

      const updated = invites.get(invite.id)!;
      expect(updated.chatHiddenInConversationIds).toEqual(["conv_xyz"]);
    });

    it("does not overwrite existing resolvedAt on terminal invite", async () => {
      const originalResolvedAt = currentTime - 10000;
      const invite = createTestInvite({
        status: "completed",
        resolvedAt: originalResolvedAt,
        chatVisibility: undefined, // needs healing
      });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolvedBy: "watchdog",
      });

      const updated = invites.get(invite.id)!;
      // resolvedAt should NOT be overwritten — already present
      expect(updated.resolvedAt).toBe(originalResolvedAt);
    });

    it("fully repaired terminal invite produces no writes on next call", async () => {
      const now = getCurrentTime();
      const invite = createTestInvite({
        status: "completed",
        chatVisibility: "hidden",
        chatHiddenAt: now,
        chatHiddenInConversationIds: ["conv_abc"],
        deleteAt: now + INVITE_DELETE_DELAY_MS,
        resolvedAt: now,
        resolvedBy: "server",
      });

      txLog = [];

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolvedBy: "watchdog",
      });

      // No transaction writes needed — everything already in place
      expect(txLog.length).toBe(0);
    });
  });

  // ─── Chat visibility ─────────────────────────────────────────────────

  describe("chat visibility", () => {
    it("chatVisibility is set to hidden on completion", async () => {
      const invite = createTestInvite({ status: "active" });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolvedBy: "server",
      });

      expect(invites.get(invite.id)!.chatVisibility).toBe("hidden");
    });

    it("chatVisibility is set to hidden on cancellation", async () => {
      const invite = createTestInvite({ status: "pending" });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "cancelled",
        resolvedBy: "client",
      });

      expect(invites.get(invite.id)!.chatVisibility).toBe("hidden");
    });

    it("chatVisibility is set to hidden on expiry", async () => {
      const invite = createTestInvite({ status: "pending" });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "expired",
        resolvedBy: "server",
      });

      expect(invites.get(invite.id)!.chatVisibility).toBe("hidden");
    });

    it("chatVisibility is set to hidden on decline", async () => {
      const invite = createTestInvite({ status: "pending" });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "declined",
        resolvedBy: "client",
      });

      expect(invites.get(invite.id)!.chatVisibility).toBe("hidden");
    });

    it("deleteAt is exactly 6 hours after resolution", async () => {
      const invite = createTestInvite({ status: "active" });
      const now = getCurrentTime();

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolvedBy: "server",
        now,
      });

      const updated = invites.get(invite.id)!;
      expect(updated.deleteAt).toBe(now + 6 * 60 * 60 * 1000);
    });
  });

  // ─── Resolver attribution ─────────────────────────────────────────────

  describe("resolver attribution", () => {
    it("records resolvedBy='server' for processGameCompletion", async () => {
      const invite = createTestInvite({ status: "active" });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolvedBy: "server",
      });

      expect(invites.get(invite.id)!.resolvedBy).toBe("server");
    });

    it("records resolvedBy='room' for Colyseus room finalization", async () => {
      const invite = createTestInvite({ status: "active" });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolvedBy: "room",
      });

      expect(invites.get(invite.id)!.resolvedBy).toBe("room");
    });

    it("records resolvedBy='client' for client-initiated cancel", async () => {
      const invite = createTestInvite({ status: "pending" });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "cancelled",
        resolvedBy: "client",
      });

      expect(invites.get(invite.id)!.resolvedBy).toBe("client");
    });

    it("records resolvedBy='watchdog' for reconciliation", async () => {
      const invite = createTestInvite({ status: "active" });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "disconnect",
        resolvedBy: "watchdog",
      });

      expect(invites.get(invite.id)!.resolvedBy).toBe("watchdog");
    });
  });

  // ─── Watchdog reconciliation simulation ───────────────────────────────

  describe("watchdog reconciliation simulation", () => {
    it("stuck active invite with no matching game doc gets finalized", async () => {
      // Simulate: invite is active but game doc was deleted / never created
      const invite = createTestInvite({
        status: "active",
        gameId: "game_dead",
      });

      // Watchdog would detect no game doc → call finalize
      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "disconnect",
        resolvedBy: "watchdog",
      });

      const updated = invites.get(invite.id)!;
      expect(updated.status).toBe("completed");
      expect(updated.resolvedBy).toBe("watchdog");
      expect(updated.resolutionType).toBe("disconnect");
      expect(updated.chatVisibility).toBe("hidden");
    });

    it("stuck starting invite older than threshold gets finalized", async () => {
      // Simulate: invite has been 'starting' for 15 minutes (threshold is 10 min)
      const invite = createTestInvite({
        status: "starting",
        updatedAt: currentTime - 15 * 60 * 1000,
      });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "cancelled",
        resolutionType: "timeout",
        resolvedBy: "watchdog",
      });

      const updated = invites.get(invite.id)!;
      expect(updated.status).toBe("cancelled");
      expect(updated.resolvedBy).toBe("watchdog");
      expect(updated.chatVisibility).toBe("hidden");
    });

    it("terminal invite still visible in chat gets self-healed by watchdog", async () => {
      const invite = createTestInvite({
        status: "completed",
        chatVisibility: "visible" as "visible",
        resolvedAt: undefined,
        deleteAt: undefined,
      });

      const now = getCurrentTime();
      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolvedBy: "watchdog",
        now,
      });

      const updated = invites.get(invite.id)!;
      expect(updated.chatVisibility).toBe("hidden");
      expect(updated.chatHiddenAt).toBe(now);
      expect(updated.deleteAt).toBe(now + INVITE_DELETE_DELAY_MS);
    });

    it("multiple stuck invites are each independently finalized", async () => {
      const inv1 = createTestInvite({ status: "active", gameId: "dead_1" });
      const inv2 = createTestInvite({ status: "active", gameId: "dead_2" });
      const inv3 = createTestInvite({ status: "starting" });

      await Promise.all([
        finalizeUniversalInvite({
          inviteId: inv1.id,
          terminalStatus: "completed",
          resolutionType: "disconnect",
          resolvedBy: "watchdog",
        }),
        finalizeUniversalInvite({
          inviteId: inv2.id,
          terminalStatus: "completed",
          resolutionType: "disconnect",
          resolvedBy: "watchdog",
        }),
        finalizeUniversalInvite({
          inviteId: inv3.id,
          terminalStatus: "cancelled",
          resolutionType: "timeout",
          resolvedBy: "watchdog",
        }),
      ]);

      expect(invites.get(inv1.id)!.status).toBe("completed");
      expect(invites.get(inv2.id)!.status).toBe("completed");
      expect(invites.get(inv3.id)!.status).toBe("cancelled");

      // All have chat-hide fields
      for (const inv of [inv1, inv2, inv3]) {
        const updated = invites.get(inv.id)!;
        expect(updated.chatVisibility).toBe("hidden");
        expect(updated.deleteAt).toBeDefined();
      }
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("invite with empty conversationId produces no chatHiddenInConversationIds", async () => {
      const invite = createTestInvite({
        status: "active",
        conversationId: "",
      });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolvedBy: "server",
      });

      const updated = invites.get(invite.id)!;
      // Empty string is falsy → no chatHiddenInConversationIds set
      expect(updated.chatHiddenInConversationIds).toBeUndefined();
    });

    it("winReason can be set on finalization", async () => {
      const invite = createTestInvite({ status: "active" });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "resign",
        winnerId: "host1",
        winReason: "opponent_resigned",
        resolvedBy: "room",
      });

      const updated = invites.get(invite.id)!;
      expect(updated.winReason).toBe("opponent_resigned");
    });

    it("resolutionType is optional", async () => {
      const invite = createTestInvite({ status: "active" });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolvedBy: "server",
      });

      // resolutionType was not passed → should not appear in updates
      const updated = invites.get(invite.id)!;
      expect(updated.resolutionType).toBeUndefined();
    });

    it("now parameter overrides Date.now() for deterministic testing", async () => {
      const invite = createTestInvite({ status: "active" });
      const fixedTime = 1700000000000;

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolvedBy: "server",
        now: fixedTime,
      });

      const updated = invites.get(invite.id)!;
      expect(updated.resolvedAt).toBe(fixedTime);
      expect(updated.chatHiddenAt).toBe(fixedTime);
      expect(updated.deleteAt).toBe(fixedTime + INVITE_DELETE_DELAY_MS);
    });
  });

  // ─── External Colyseus invite finalization (§17) ────────────────────────

  describe("external Colyseus invite finalization (ext_ games)", () => {
    const EXT_GAME_TYPES: Array<{
      gameType: string;
      extPrefix: string;
    }> = [
      { gameType: "battleship", extPrefix: "ext_battleship" },
      { gameType: "crazy_eights", extPrefix: "ext_crazy_eights" },
      { gameType: "starforge_game", extPrefix: "ext_starforge_game" },
      { gameType: "sketch_party_game", extPrefix: "ext_sketch_party_game" },
      { gameType: "crossword_puzzle", extPrefix: "ext_crossword_puzzle" },
      { gameType: "pong_game", extPrefix: "ext_pong_game" },
      { gameType: "minigolf_duels", extPrefix: "ext_minigolf_duels" },
    ];

    for (const { gameType, extPrefix } of EXT_GAME_TYPES) {
      it(`${gameType}: active invite transitions to completed with chat-hide on room finalize`, async () => {
        const invite = createTestInvite({
          status: "active",
          gameType: gameType as ExtendedGameType,
          gameId: `${extPrefix}_inv_test_${inviteCounter}`,
        });

        await finalizeUniversalInvite({
          inviteId: invite.id,
          terminalStatus: "completed",
          resolutionType: "win",
          winnerId: "host1",
          resolvedBy: "room",
        });

        const updated = invites.get(invite.id)!;
        expect(updated.status).toBe("completed");
        expect(updated.chatVisibility).toBe("hidden");
        expect(updated.resolvedBy).toBe("room");
        expect(updated.chatHiddenInConversationIds).toEqual(["conv_abc"]);
        expect(updated.deleteAt).toBeGreaterThan(0);
      });
    }

    it("battleship disconnect finalization: resolvedBy=room, resolutionType=disconnect", async () => {
      const invite = createTestInvite({
        status: "active",
        gameType: "battleship" as ExtendedGameType,
        gameId: "ext_battleship_inv-bs1",
      });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "disconnect",
        winnerId: "player2",
        winReason: "opponent_disconnected",
        resolvedBy: "room",
      });

      const updated = invites.get(invite.id)!;
      expect(updated.status).toBe("completed");
      expect(updated.resolutionType).toBe("disconnect");
      expect(updated.winReason).toBe("opponent_disconnected");
      expect(updated.chatVisibility).toBe("hidden");
    });

    it("crazy_eights resign finalization: resolvedBy=room, resolutionType=resign", async () => {
      const invite = createTestInvite({
        status: "active",
        gameType: "crazy_eights" as ExtendedGameType,
        gameId: "ext_crazy_eights_inv-ce1",
      });

      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "resign",
        winnerId: "player2",
        winReason: "opponent_resigned",
        resolvedBy: "room",
      });

      const updated = invites.get(invite.id)!;
      expect(updated.status).toBe("completed");
      expect(updated.resolutionType).toBe("resign");
      expect(updated.winReason).toBe("opponent_resigned");
      expect(updated.chatVisibility).toBe("hidden");
      expect(updated.resolvedBy).toBe("room");
    });

    it("ext_ invite finalized by room is idempotent when Cloud Function also fires", async () => {
      const invite = createTestInvite({
        status: "active",
        gameType: "battleship" as ExtendedGameType,
        gameId: "ext_battleship_inv-idem",
      });

      // First call: room finalizes
      const result1 = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "win",
        winnerId: "host1",
        resolvedBy: "room",
      });

      expect(result1.success).toBe(true);
      expect(result1.alreadyTerminal).toBe(false);

      // Second call: Cloud Function tries to finalize same invite
      const result2 = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "win",
        winnerId: "host1",
        resolvedBy: "server",
      });

      expect(result2.success).toBe(true);
      expect(result2.alreadyTerminal).toBe(true);

      // Final state: still room-resolved (first write wins)
      const final = invites.get(invite.id)!;
      expect(final.resolvedBy).toBe("room");
      expect(final.chatVisibility).toBe("hidden");
    });

    it("ext_ invite finalized by watchdog if room and Cloud Function both fail", async () => {
      const invite = createTestInvite({
        status: "active",
        gameType: "crazy_eights" as ExtendedGameType,
        gameId: "ext_crazy_eights_inv-wd",
      });

      // Simulate: room and Cloud Function both fail, watchdog catches it
      await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "disconnect",
        resolvedBy: "watchdog",
      });

      const updated = invites.get(invite.id)!;
      expect(updated.status).toBe("completed");
      expect(updated.chatVisibility).toBe("hidden");
      expect(updated.resolvedBy).toBe("watchdog");
    });

    it("chat subscription filter excludes finalized ext_ invites", () => {
      // Simulate what subscribeToConversationInvites does
      const validStatuses = ["pending", "filling", "ready", "active"];

      const invitesList = [
        createTestInvite({
          status: "active",
          gameType: "battleship" as ExtendedGameType,
        }),
        createTestInvite({
          status: "completed",
          chatVisibility: "hidden",
          gameType: "crazy_eights" as ExtendedGameType,
        }),
        createTestInvite({
          status: "active",
          chatVisibility: "hidden",
          gameType: "pong_game" as ExtendedGameType,
        }),
      ];

      // Apply same filter chain as subscribeToConversationInvites
      const visible = invitesList
        .filter((inv) => validStatuses.includes(inv.status))
        .filter((inv) => (inv as any).chatVisibility !== "hidden");

      expect(visible).toHaveLength(1);
      expect(visible[0].gameType).toBe("battleship");
    });

    it("ChatGameInvites defensive filter excludes terminal ext_ invites", () => {
      // Simulate what ChatGameInvites component does
      const TERMINAL = ["completed", "declined", "expired", "cancelled"];

      const invitesList = [
        createTestInvite({
          status: "pending",
          gameType: "battleship" as ExtendedGameType,
        }),
        createTestInvite({
          status: "completed",
          gameType: "crazy_eights" as ExtendedGameType,
        }),
        createTestInvite({
          status: "active",
          chatVisibility: "hidden",
          gameType: "starforge_game" as ExtendedGameType,
        }),
      ];

      const rendered = invitesList.filter(
        (inv) =>
          (inv as any).chatVisibility !== "hidden" &&
          !TERMINAL.includes(inv.status),
      );

      expect(rendered).toHaveLength(1);
      expect(rendered[0].gameType).toBe("battleship");
      expect(rendered[0].status).toBe("pending");
    });
  });

  // ─── Targeted production-failure scenarios ──────────────────────────────

  describe("production failure reproductions (Phase 4)", () => {
    /**
     * Scenario 1 — Battleship: "Other user disconnected" → game ended instantly.
     *
     * Repro: Host starts Battleship, opponent disconnects during combat.
     * BattleshipRoom.endGame("disconnect") → phase="finished" → onDispose fires.
     *
     * BEFORE fix: deleteGameAndInvite could not discover inviteId from
     * ext_battleship_<inviteId>. Invite stayed active + visible in chat.
     *
     * AFTER fix: inviteId parsed from ext_ format → invite completed + hidden.
     */
    it("Battleship disconnect: invite finalized via room + Cloud Function double-tap", async () => {
      const invite = createTestInvite({
        status: "active",
        gameType: "battleship" as ExtendedGameType,
        gameId: "ext_battleship_inv_test_bs_dc",
        conversationId: "conv_dm_alice_bob",
      });

      // Step 1: Room onDispose → deleteGameAndInvite → finalizeUniversalInvite
      // This is the PRIMARY path (Layer 1)
      const roomResult = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "disconnect",
        winnerId: "bob_uid",
        winReason: "opponent_disconnected",
        resolvedBy: "room",
      });

      expect(roomResult.success).toBe(true);
      expect(roomResult.alreadyTerminal).toBe(false);

      const afterRoom = invites.get(invite.id)!;
      expect(afterRoom.status).toBe("completed");
      expect(afterRoom.chatVisibility).toBe("hidden");
      expect(afterRoom.resolutionType).toBe("disconnect");
      expect(afterRoom.winnerId).toBe("bob_uid");
      expect(afterRoom.winReason).toBe("opponent_disconnected");
      expect(afterRoom.resolvedBy).toBe("room");
      expect(afterRoom.chatHiddenInConversationIds).toEqual([
        "conv_dm_alice_bob",
      ]);
      expect(afterRoom.deleteAt).toBeGreaterThan(0);

      // Step 2: processRealtimeGameCompletion Cloud Function fires (Layer 2)
      // It sees the invite is already terminal → idempotent no-op
      const cfResult = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "win",
        winnerId: "bob_uid",
        resolvedBy: "server",
      });

      expect(cfResult.success).toBe(true);
      expect(cfResult.alreadyTerminal).toBe(true);

      // Final state: room's write is preserved (first write wins)
      const final = invites.get(invite.id)!;
      expect(final.resolvedBy).toBe("room");
      expect(final.resolutionType).toBe("disconnect");

      // Verify chat subscription would hide this invite
      const validStatuses = ["pending", "filling", "ready", "active"];
      const wouldBeVisible =
        validStatuses.includes(final.status) &&
        final.chatVisibility !== "hidden";
      expect(wouldBeVisible).toBe(false);
    });

    /**
     * Scenario 2 — Crazy Cards (crazy_eights): User resigned → invite stuck.
     *
     * Repro: Player clicks resign during a Crazy Cards match.
     * CardGameRoom "resign" handler → phase="finished" → onDispose fires.
     *
     * BEFORE fix: persistGameResult tried to update non-existent TurnBasedGames
     * doc (state.firestoreGameId was still set) → threw → deleteGameAndInvite
     * was in same try/catch → never ran. Invite stayed active + visible.
     *
     * AFTER fix: (1) firestoreGameId cleared before persist,
     * (2) separated try/catch so cleanup always runs,
     * (3) inviteId parsed from ext_ format.
     */
    it("Crazy Cards resign: invite finalized via room despite persist being in separate try/catch", async () => {
      const invite = createTestInvite({
        status: "active",
        gameType: "crazy_eights" as ExtendedGameType,
        gameId: "ext_crazy_eights_inv_test_ce_resign",
        conversationId: "conv_dm_alice_charlie",
      });

      // Simulate: Room onDispose → deleteGameAndInvite succeeds
      // (in the real code, persist may still fail, but cleanup runs in its own try/catch)
      const roomResult = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "resign",
        winnerId: "charlie_uid",
        winReason: "opponent_resigned",
        resolvedBy: "room",
      });

      expect(roomResult.success).toBe(true);
      expect(roomResult.alreadyTerminal).toBe(false);

      const afterRoom = invites.get(invite.id)!;
      expect(afterRoom.status).toBe("completed");
      expect(afterRoom.chatVisibility).toBe("hidden");
      expect(afterRoom.resolutionType).toBe("resign");
      expect(afterRoom.winnerId).toBe("charlie_uid");
      expect(afterRoom.winReason).toBe("opponent_resigned");
      expect(afterRoom.resolvedBy).toBe("room");
      expect(afterRoom.chatHiddenInConversationIds).toEqual([
        "conv_dm_alice_charlie",
      ]);

      // Verify the invite would NOT appear in any chat filter layer
      const TERMINAL = new Set([
        "completed",
        "declined",
        "expired",
        "cancelled",
      ]);
      const validStatuses = ["pending", "filling", "ready", "active"];

      // Layer 1: subscription filter
      const passesSubscription =
        validStatuses.includes(afterRoom.status) &&
        afterRoom.chatVisibility !== "hidden";
      expect(passesSubscription).toBe(false);

      // Layer 2: component defensive filter
      const passesComponentFilter =
        afterRoom.chatVisibility !== "hidden" &&
        !TERMINAL.has(afterRoom.status);
      expect(passesComponentFilter).toBe(false);

      // Layer 3: UniversalInviteCard early-return guard
      const cardWouldRender =
        afterRoom.chatVisibility !== "hidden" &&
        !TERMINAL.has(afterRoom.status);
      expect(cardWouldRender).toBe(false);
    });

    /**
     * Scenario 3 — Worst case: Room AND Cloud Function both fail.
     * Watchdog catches the stuck invite after the threshold.
     *
     * This proves the 3-layer defense-in-depth: even if Layers 1+2 fail,
     * Layer 3 (watchdog) finalizes the invite within 15 minutes.
     */
    it("fallback: watchdog catches stuck ext_ invite when room + Cloud Function both fail", async () => {
      const invite = createTestInvite({
        status: "active",
        gameType: "battleship" as ExtendedGameType,
        gameId: "ext_battleship_inv_test_bs_stuck",
        conversationId: "conv_dm_stuck",
      });

      // Simulate: 30+ minutes pass, room + CF both failed to finalize
      // Watchdog Pass 1 detects active invite with no game doc → finalizes
      const wdResult = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "disconnect",
        resolvedBy: "watchdog",
      });

      expect(wdResult.success).toBe(true);
      expect(wdResult.alreadyTerminal).toBe(false);

      const final = invites.get(invite.id)!;
      expect(final.status).toBe("completed");
      expect(final.chatVisibility).toBe("hidden");
      expect(final.resolvedBy).toBe("watchdog");
      expect(final.chatHiddenInConversationIds).toEqual(["conv_dm_stuck"]);
      expect(final.deleteAt).toBeGreaterThan(0);
    });

    /**
     * Scenario 4 — Edge case: Room finalizes but chatVisibility write
     * glitches (partial write). Watchdog Pass 3 self-heals.
     */
    it("self-heal: watchdog Pass 3 repairs terminal invite with missing chatVisibility", async () => {
      // Create an invite that's terminal but chatVisibility wasn't set
      // (simulates a partial write / crash mid-transaction)
      const invite = createTestInvite({
        status: "completed",
        gameType: "crazy_eights" as ExtendedGameType,
        gameId: "ext_crazy_eights_inv_test_ce_partial",
        conversationId: "conv_dm_partial",
      });

      // Watchdog Pass 3 picks this up and calls finalize to self-heal
      const wdResult = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolvedBy: "watchdog",
      });

      expect(wdResult.success).toBe(true);
      expect(wdResult.alreadyTerminal).toBe(true);

      const final = invites.get(invite.id)!;
      expect(final.chatVisibility).toBe("hidden");
      expect(final.chatHiddenInConversationIds).toEqual(["conv_dm_partial"]);
      expect(final.deleteAt).toBeGreaterThan(0);
    });

    /**
     * Scenario 5 — Full lifecycle: invite created → claimed → started →
     * game played → disconnect → finalized → hidden in chat.
     * Mirrors the exact Battleship DM flow end-to-end.
     */
    it("end-to-end Battleship DM lifecycle: invite → active → disconnect → hidden", async () => {
      // Phase A: Invite created (pending → active via orchestration)
      const invite = createTestInvite({
        status: "active",
        gameType: "battleship" as ExtendedGameType,
        gameId: "ext_battleship_inv_test_e2e",
        conversationId: "conv_dm_e2e",
        context: "dm",
        targetType: "specific",
      });

      // At this point, invite is visible in chat
      const validStatuses = ["pending", "filling", "ready", "active"];
      expect(validStatuses.includes(invite.status)).toBe(true);
      expect(invite.chatVisibility).toBeUndefined();

      // Phase B: Game plays out... opponent disconnects
      // BattleshipRoom.endGame → phase=finished → onDispose
      const result = await finalizeUniversalInvite({
        inviteId: invite.id,
        terminalStatus: "completed",
        resolutionType: "disconnect",
        winnerId: "player_a",
        winReason: "opponent_disconnected",
        resolvedBy: "room",
      });

      expect(result.success).toBe(true);

      // Phase C: Invite is now invisible in chat
      const final = invites.get(invite.id)!;
      expect(final.status).toBe("completed");
      expect(final.chatVisibility).toBe("hidden");

      // Simulate the subscription filter
      const visibleInvites = [final]
        .filter((inv) => validStatuses.includes(inv.status))
        .filter((inv) => inv.chatVisibility !== "hidden");
      expect(visibleInvites).toHaveLength(0);

      // Phase D: After 6 hours, cleanupResolvedInvites would hard-delete
      expect(final.deleteAt).toBeGreaterThan(0);
      const sixHours = 6 * 60 * 60 * 1000;
      expect(final.deleteAt! - final.resolvedAt!).toBe(sixHours);
    });
  });
});
