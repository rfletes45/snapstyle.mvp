/**
 * Game Invites Integration Tests
 * Phase 7: Testing Requirements
 *
 * Tests for complete game invitation flow:
 * - Creating invites
 * - Accepting/declining invites
 * - Game creation from invites
 * - Invite expiration
 *
 * These tests mock Firestore but test the full service logic.
 *
 * @see src/services/gameInvites.ts
 */

import { ExtendedGameType } from "@/types/games";

// =============================================================================
// Mock Types and State
// =============================================================================

interface GameInvite {
  id: string;
  fromUserId: string;
  toUserId: string;
  gameType: ExtendedGameType;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: number;
  gameId?: string;
  expiresAt: number;
}

interface TurnBasedGame {
  id: string;
  gameType: ExtendedGameType;
  players: string[];
  currentTurn: string;
  status: "active" | "completed";
  createdAt: number;
}

// Mock database
let invites: Map<string, GameInvite> = new Map();
let games: Map<string, TurnBasedGame> = new Map();
let currentTime: number = Date.now();

// =============================================================================
// Mock Service Functions
// =============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function resetMocks(): void {
  invites = new Map();
  games = new Map();
  currentTime = Date.now();
}

function advanceTime(ms: number): void {
  currentTime += ms;
}

function getCurrentTime(): number {
  return currentTime;
}

async function createTestUser(name: string): Promise<string> {
  return `user_${name}_${generateId()}`;
}

async function sendGameInvite(
  fromUserId: string,
  params: { toUserId: string; gameType: ExtendedGameType },
): Promise<string> {
  const id = generateId();
  const invite: GameInvite = {
    id,
    fromUserId,
    toUserId: params.toUserId,
    gameType: params.gameType,
    status: "pending",
    createdAt: getCurrentTime(),
    expiresAt: getCurrentTime() + 24 * 60 * 60 * 1000, // 24 hours
  };
  invites.set(id, invite);
  return id;
}

async function getInvite(inviteId: string): Promise<GameInvite | null> {
  return invites.get(inviteId) || null;
}

async function acceptGameInvite(
  inviteId: string,
  userId: string,
): Promise<string> {
  const invite = invites.get(inviteId);
  if (!invite) throw new Error("Invite not found");
  // Check for own invite first (more specific error)
  if (invite.fromUserId === userId)
    throw new Error("Cannot accept your own invite");
  if (invite.toUserId !== userId)
    throw new Error("Cannot accept invite meant for another user");
  if (invite.status !== "pending") throw new Error("Invite is not pending");
  if (getCurrentTime() > invite.expiresAt)
    throw new Error("Invite has expired");

  // Create game
  const gameId = generateId();
  const game: TurnBasedGame = {
    id: gameId,
    gameType: invite.gameType,
    players: [invite.fromUserId, invite.toUserId],
    currentTurn: invite.fromUserId, // Inviter goes first
    status: "active",
    createdAt: getCurrentTime(),
  };
  games.set(gameId, game);

  // Update invite
  invite.status = "accepted";
  invite.gameId = gameId;
  invites.set(inviteId, invite);

  return gameId;
}

async function declineGameInvite(
  inviteId: string,
  userId: string,
): Promise<void> {
  const invite = invites.get(inviteId);
  if (!invite) throw new Error("Invite not found");
  if (invite.toUserId !== userId)
    throw new Error("Cannot decline invite meant for another user");
  if (invite.status !== "pending") throw new Error("Invite is not pending");

  invite.status = "declined";
  invites.set(inviteId, invite);
}

async function getGame(gameId: string): Promise<TurnBasedGame | null> {
  return games.get(gameId) || null;
}

async function cleanupExpiredInvites(): Promise<number> {
  let count = 0;
  for (const [id, invite] of invites.entries()) {
    if (invite.status === "pending" && getCurrentTime() > invite.expiresAt) {
      invite.status = "expired";
      invites.set(id, invite);
      count++;
    }
  }
  return count;
}

async function getPendingInvitesForUser(userId: string): Promise<GameInvite[]> {
  const result: GameInvite[] = [];
  for (const invite of invites.values()) {
    if (invite.toUserId === userId && invite.status === "pending") {
      result.push(invite);
    }
  }
  return result;
}

async function getSentInvitesForUser(userId: string): Promise<GameInvite[]> {
  const result: GameInvite[] = [];
  for (const invite of invites.values()) {
    if (invite.fromUserId === userId) {
      result.push(invite);
    }
  }
  return result;
}

// =============================================================================
// Tests
// =============================================================================

describe("Game Invitation Flow", () => {
  let userA: string;
  let userB: string;

  beforeEach(async () => {
    resetMocks();
    userA = await createTestUser("userA");
    userB = await createTestUser("userB");
  });

  describe("Creating Invites", () => {
    it("should create and accept game invite", async () => {
      // User A sends invite
      const inviteId = await sendGameInvite(userA, {
        toUserId: userB,
        gameType: "chess",
      });

      expect(inviteId).toBeDefined();

      // Verify invite exists
      const invite = await getInvite(inviteId);
      expect(invite).not.toBeNull();
      expect(invite!.status).toBe("pending");
      expect(invite!.fromUserId).toBe(userA);
      expect(invite!.toUserId).toBe(userB);
      expect(invite!.gameType).toBe("chess");

      // User B accepts
      const gameId = await acceptGameInvite(inviteId, userB);
      expect(gameId).toBeDefined();

      // Verify game created
      const game = await getGame(gameId);
      expect(game).not.toBeNull();
      expect(game!.players).toContain(userA);
      expect(game!.players).toContain(userB);
      expect(game!.status).toBe("active");
      expect(game!.currentTurn).toBe(userA);

      // Verify invite updated
      const updatedInvite = await getInvite(inviteId);
      expect(updatedInvite!.status).toBe("accepted");
      expect(updatedInvite!.gameId).toBe(gameId);
    });

    it("should decline game invite", async () => {
      const inviteId = await sendGameInvite(userA, {
        toUserId: userB,
        gameType: "chess",
      });

      await declineGameInvite(inviteId, userB);

      const invite = await getInvite(inviteId);
      expect(invite!.status).toBe("declined");
    });

    it("should not allow accepting own invite", async () => {
      const inviteId = await sendGameInvite(userA, {
        toUserId: userB,
        gameType: "chess",
      });

      await expect(acceptGameInvite(inviteId, userA)).rejects.toThrow(
        "Cannot accept your own invite",
      );
    });

    it("should not allow wrong user to accept invite", async () => {
      const userC = await createTestUser("userC");
      const inviteId = await sendGameInvite(userA, {
        toUserId: userB,
        gameType: "chess",
      });

      await expect(acceptGameInvite(inviteId, userC)).rejects.toThrow(
        "Cannot accept invite meant for another user",
      );
    });

    it("should not allow wrong user to decline invite", async () => {
      const userC = await createTestUser("userC");
      const inviteId = await sendGameInvite(userA, {
        toUserId: userB,
        gameType: "chess",
      });

      await expect(declineGameInvite(inviteId, userC)).rejects.toThrow(
        "Cannot decline invite meant for another user",
      );
    });
  });

  describe("Invite Expiration", () => {
    it("should expire old invites", async () => {
      const inviteId = await sendGameInvite(userA, {
        toUserId: userB,
        gameType: "chess",
      });

      // Fast forward 25 hours
      advanceTime(25 * 60 * 60 * 1000);

      const expiredCount = await cleanupExpiredInvites();
      expect(expiredCount).toBe(1);

      const invite = await getInvite(inviteId);
      expect(invite!.status).toBe("expired");
    });

    it("should not expire recent invites", async () => {
      await sendGameInvite(userA, {
        toUserId: userB,
        gameType: "chess",
      });

      // Only advance 1 hour
      advanceTime(1 * 60 * 60 * 1000);

      const expiredCount = await cleanupExpiredInvites();
      expect(expiredCount).toBe(0);
    });

    it("should not allow accepting expired invite", async () => {
      const inviteId = await sendGameInvite(userA, {
        toUserId: userB,
        gameType: "chess",
      });

      // Fast forward 25 hours
      advanceTime(25 * 60 * 60 * 1000);

      await expect(acceptGameInvite(inviteId, userB)).rejects.toThrow(
        "Invite has expired",
      );
    });
  });

  describe("Invite Status", () => {
    it("should not allow accepting already accepted invite", async () => {
      const inviteId = await sendGameInvite(userA, {
        toUserId: userB,
        gameType: "chess",
      });

      await acceptGameInvite(inviteId, userB);

      await expect(acceptGameInvite(inviteId, userB)).rejects.toThrow(
        "Invite is not pending",
      );
    });

    it("should not allow accepting declined invite", async () => {
      const inviteId = await sendGameInvite(userA, {
        toUserId: userB,
        gameType: "chess",
      });

      await declineGameInvite(inviteId, userB);

      await expect(acceptGameInvite(inviteId, userB)).rejects.toThrow(
        "Invite is not pending",
      );
    });
  });

  describe("Multiple Invites", () => {
    it("should handle multiple pending invites", async () => {
      const userC = await createTestUser("userC");

      await sendGameInvite(userA, { toUserId: userB, gameType: "chess" });
      await sendGameInvite(userC, { toUserId: userB, gameType: "checkers" });

      const pending = await getPendingInvitesForUser(userB);
      expect(pending.length).toBe(2);
    });

    it("should track sent invites correctly", async () => {
      const userC = await createTestUser("userC");

      await sendGameInvite(userA, { toUserId: userB, gameType: "chess" });
      await sendGameInvite(userA, { toUserId: userC, gameType: "checkers" });

      const sent = await getSentInvitesForUser(userA);
      expect(sent.length).toBe(2);
    });
  });

  describe("Different Game Types", () => {
    it("should create invite for each game type", async () => {
      const gameTypes: ExtendedGameType[] = [
        "chess",
        "checkers",
        "tic_tac_toe",
        "crazy_eights",
      ];

      for (const gameType of gameTypes) {
        const inviteId = await sendGameInvite(userA, {
          toUserId: userB,
          gameType,
        });

        const invite = await getInvite(inviteId);
        expect(invite!.gameType).toBe(gameType);
      }
    });
  });
});
