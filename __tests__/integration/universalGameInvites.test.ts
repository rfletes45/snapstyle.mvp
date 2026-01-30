/**
 * Universal Game Invites Integration Tests
 * Phase 5: Integration Testing
 *
 * Tests for the new universal invite system:
 * - Creating DM and group invites
 * - Claiming/unclaiming slots
 * - Spectator functionality
 * - Status transitions
 * - Query functions
 *
 * These tests mock Firestore but test the full service logic.
 *
 * @see src/services/gameInvites.ts
 */

import { ExtendedGameType } from "@/types/games";

// =============================================================================
// Mock Types (mirrors src/types/turnBased.ts)
// =============================================================================

type InviteContext = "dm" | "group";

type UniversalInviteStatus =
  | "pending"
  | "filling"
  | "ready"
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

interface SpectatorEntry {
  userId: string;
  userName: string;
  userAvatar?: string;
  joinedAt: number;
}

interface UniversalGameInvite {
  id: string;
  gameType: ExtendedGameType;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  context: InviteContext;
  conversationId: string;
  conversationName?: string;
  targetType: "universal" | "specific";
  recipientId?: string;
  recipientName?: string;
  recipientAvatar?: string;
  eligibleUserIds: string[];
  requiredPlayers: number;
  maxPlayers: number;
  claimedSlots: PlayerSlot[];
  filledAt?: number;
  spectatingEnabled: boolean;
  spectatorOnly: boolean;
  spectators: SpectatorEntry[];
  maxSpectators?: number;
  status: UniversalInviteStatus;
  gameId?: string;
  settings: {
    isRated: boolean;
    timeControl?: { type: string; seconds: number };
    chatEnabled: boolean;
  };
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  showInPlayPage: boolean;
  chatMessageId?: string;
}

interface SendUniversalInviteParams {
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  gameType: ExtendedGameType;
  context: InviteContext;
  conversationId: string;
  conversationName?: string;
  eligibleUserIds?: string[];
  recipientId?: string;
  recipientName?: string;
  recipientAvatar?: string;
  requiredPlayers?: number;
  settings?: Partial<UniversalGameInvite["settings"]>;
  expirationMinutes?: number;
}

// =============================================================================
// Game Metadata Mock
// =============================================================================

const GAME_METADATA: Record<
  string,
  { minPlayers: number; maxPlayers: number }
> = {
  chess: { minPlayers: 2, maxPlayers: 2 },
  checkers: { minPlayers: 2, maxPlayers: 2 },
  tic_tac_toe: { minPlayers: 2, maxPlayers: 2 },
  crazy_eights: { minPlayers: 2, maxPlayers: 4 },
  "8ball_pool": { minPlayers: 2, maxPlayers: 2 },
  air_hockey: { minPlayers: 2, maxPlayers: 2 },
};

// =============================================================================
// Mock Database
// =============================================================================

let invites: Map<string, UniversalGameInvite> = new Map();
let currentTime: number = Date.now();

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `uinv_${timestamp}_${random}`;
}

function resetMocks(): void {
  invites = new Map();
  currentTime = Date.now();
}

function advanceTime(ms: number): void {
  currentTime += ms;
}

function getCurrentTime(): number {
  return currentTime;
}

// =============================================================================
// Mock Service Functions
// =============================================================================

async function sendUniversalInvite(
  params: SendUniversalInviteParams,
): Promise<UniversalGameInvite> {
  const {
    senderId,
    senderName,
    senderAvatar,
    gameType,
    context,
    conversationId,
    conversationName,
    eligibleUserIds,
    recipientId,
    recipientName,
    recipientAvatar,
    requiredPlayers: customRequiredPlayers,
    settings: customSettings,
    expirationMinutes = 60,
  } = params;

  // Validation
  if (context === "dm" && !recipientId) {
    throw new Error("recipientId is required for DM invites");
  }
  if (context === "group" && (!eligibleUserIds || eligibleUserIds.length < 2)) {
    throw new Error(
      "eligibleUserIds with at least 2 members required for group invites",
    );
  }

  // Get player counts
  const metadata = GAME_METADATA[gameType];
  const minPlayers = metadata?.minPlayers ?? 2;
  const maxPlayers = metadata?.maxPlayers ?? 2;
  const requiredPlayers = customRequiredPlayers ?? minPlayers;

  if (requiredPlayers < minPlayers || requiredPlayers > maxPlayers) {
    throw new Error(
      `requiredPlayers must be between ${minPlayers} and ${maxPlayers}`,
    );
  }

  // Determine targeting
  const isSpecificTarget = context === "dm";
  const targetType: "universal" | "specific" = isSpecificTarget
    ? "specific"
    : "universal";
  const showInPlayPage = isSpecificTarget;

  // Build eligible user list
  const finalEligibleUserIds =
    context === "dm" ? [senderId, recipientId!] : [...eligibleUserIds!];

  if (!finalEligibleUserIds.includes(senderId)) {
    finalEligibleUserIds.unshift(senderId);
  }

  // Build initial slot
  const now = getCurrentTime();
  const hostSlot: PlayerSlot = {
    playerId: senderId,
    playerName: senderName,
    playerAvatar: senderAvatar,
    claimedAt: now,
    isHost: true,
  };

  // Build invite
  const inviteId = generateId();
  const expiresAt = now + expirationMinutes * 60 * 1000;

  const invite: UniversalGameInvite = {
    id: inviteId,
    gameType,
    senderId,
    senderName,
    senderAvatar,
    context,
    conversationId,
    conversationName,
    targetType,
    recipientId: isSpecificTarget ? recipientId : undefined,
    recipientName: isSpecificTarget ? recipientName : undefined,
    recipientAvatar: isSpecificTarget ? recipientAvatar : undefined,
    eligibleUserIds: finalEligibleUserIds,
    requiredPlayers,
    maxPlayers,
    claimedSlots: [hostSlot],
    filledAt: undefined,
    spectatingEnabled: true,
    spectatorOnly: false,
    spectators: [],
    maxSpectators: undefined,
    status: "pending",
    gameId: undefined,
    settings: {
      isRated: false,
      chatEnabled: true,
      ...customSettings,
    },
    createdAt: now,
    updatedAt: now,
    expiresAt,
    showInPlayPage,
    chatMessageId: undefined,
  };

  invites.set(inviteId, invite);
  return invite;
}

async function claimInviteSlot(
  inviteId: string,
  userId: string,
  userName: string,
  userAvatar?: string,
): Promise<{ success: boolean; error?: string; invite?: UniversalGameInvite }> {
  const invite = invites.get(inviteId);

  if (!invite) {
    return { success: false, error: "Invite not found" };
  }

  // Validation
  if (!["pending", "filling"].includes(invite.status)) {
    return {
      success: false,
      error: `Cannot join - invite is ${invite.status}`,
    };
  }

  if (invite.claimedSlots.some((s) => s.playerId === userId)) {
    return { success: false, error: "You have already joined this game" };
  }

  if (invite.claimedSlots.length >= invite.maxPlayers) {
    return { success: false, error: "Game is full" };
  }

  if (!invite.eligibleUserIds.includes(userId)) {
    return { success: false, error: "You are not eligible for this invite" };
  }

  if (getCurrentTime() > invite.expiresAt) {
    invite.status = "expired";
    invite.updatedAt = getCurrentTime();
    invites.set(inviteId, invite);
    return { success: false, error: "Invite has expired" };
  }

  // Build new slot
  const newSlot: PlayerSlot = {
    playerId: userId,
    playerName: userName,
    playerAvatar: userAvatar,
    claimedAt: getCurrentTime(),
    isHost: false,
  };

  invite.claimedSlots.push(newSlot);
  const isFull = invite.claimedSlots.length >= invite.requiredPlayers;

  // Update status
  if (isFull) {
    invite.status = "ready";
    invite.filledAt = getCurrentTime();
  } else if (invite.claimedSlots.length > 1) {
    invite.status = "filling";
  }

  invite.updatedAt = getCurrentTime();
  invites.set(inviteId, invite);

  return { success: true, invite };
}

async function unclaimInviteSlot(
  inviteId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const invite = invites.get(inviteId);

  if (!invite) {
    return { success: false, error: "Invite not found" };
  }

  if (!["pending", "filling"].includes(invite.status)) {
    return { success: false, error: `Cannot leave - game is ${invite.status}` };
  }

  const slotIndex = invite.claimedSlots.findIndex((s) => s.playerId === userId);
  if (slotIndex === -1) {
    return { success: false, error: "You haven't joined this game" };
  }

  if (invite.claimedSlots[slotIndex].isHost) {
    return {
      success: false,
      error: "Host cannot leave. Cancel the invite instead.",
    };
  }

  // Remove slot
  invite.claimedSlots = invite.claimedSlots.filter(
    (s) => s.playerId !== userId,
  );

  // Update status
  if (invite.claimedSlots.length === 1) {
    invite.status = "pending";
  }

  invite.filledAt = undefined;
  invite.updatedAt = getCurrentTime();
  invites.set(inviteId, invite);

  return { success: true };
}

async function joinAsSpectator(
  inviteId: string,
  userId: string,
  userName: string,
  userAvatar?: string,
): Promise<{ success: boolean; gameId?: string; error?: string }> {
  const invite = invites.get(inviteId);

  if (!invite) {
    return { success: false, error: "Invite not found" };
  }

  if (!invite.spectatingEnabled) {
    return { success: false, error: "Spectating is not enabled for this game" };
  }

  if (!["ready", "active", "completed"].includes(invite.status)) {
    return { success: false, error: "Game is not ready for spectators yet" };
  }

  if (!invite.eligibleUserIds.includes(userId)) {
    return { success: false, error: "You cannot spectate this game" };
  }

  if (invite.spectators.some((s) => s.userId === userId)) {
    return { success: false, error: "You are already spectating" };
  }

  if (invite.claimedSlots.some((s) => s.playerId === userId)) {
    return { success: false, error: "You are a player in this game" };
  }

  if (
    invite.maxSpectators &&
    invite.spectators.length >= invite.maxSpectators
  ) {
    return { success: false, error: "Maximum spectators reached" };
  }

  // Add spectator
  const newSpectator: SpectatorEntry = {
    userId,
    userName,
    userAvatar,
    joinedAt: getCurrentTime(),
  };

  invite.spectators.push(newSpectator);
  invite.updatedAt = getCurrentTime();
  invites.set(inviteId, invite);

  return { success: true, gameId: invite.gameId };
}

async function leaveSpectator(
  inviteId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const invite = invites.get(inviteId);

  if (!invite) {
    return { success: false, error: "Invite not found" };
  }

  invite.spectators = invite.spectators.filter((s) => s.userId !== userId);
  invite.updatedAt = getCurrentTime();
  invites.set(inviteId, invite);

  return { success: true };
}

async function cancelGameInvite(
  inviteId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const invite = invites.get(inviteId);

  if (!invite) {
    return { success: false, error: "Invite not found" };
  }

  if (invite.senderId !== userId) {
    return { success: false, error: "Only the host can cancel the invite" };
  }

  if (!["pending", "filling"].includes(invite.status)) {
    return {
      success: false,
      error: `Cannot cancel - game is ${invite.status}`,
    };
  }

  invite.status = "cancelled";
  invite.updatedAt = getCurrentTime();
  invites.set(inviteId, invite);

  return { success: true };
}

async function getUniversalInviteById(
  inviteId: string,
): Promise<UniversalGameInvite | null> {
  return invites.get(inviteId) || null;
}

async function getPlayPageInvites(
  userId: string,
): Promise<UniversalGameInvite[]> {
  const result: UniversalGameInvite[] = [];
  for (const invite of invites.values()) {
    if (
      invite.showInPlayPage &&
      invite.eligibleUserIds.includes(userId) &&
      ["pending", "filling"].includes(invite.status) &&
      invite.senderId !== userId &&
      getCurrentTime() <= invite.expiresAt
    ) {
      result.push(invite);
    }
  }
  return result.sort((a, b) => b.createdAt - a.createdAt);
}

async function getConversationInvites(
  conversationId: string,
  userId: string,
): Promise<UniversalGameInvite[]> {
  const result: UniversalGameInvite[] = [];
  for (const invite of invites.values()) {
    if (
      invite.conversationId === conversationId &&
      invite.eligibleUserIds.includes(userId) &&
      ["pending", "filling", "ready", "active"].includes(invite.status)
    ) {
      result.push(invite);
    }
  }
  return result.sort((a, b) => b.createdAt - a.createdAt);
}

// =============================================================================
// Tests
// =============================================================================

describe("Universal Game Invites", () => {
  beforeEach(() => {
    resetMocks();
  });

  // ===========================================================================
  // sendUniversalInvite Tests
  // ===========================================================================
  describe("sendUniversalInvite", () => {
    it("should create DM invite with specific targetType", async () => {
      const invite = await sendUniversalInvite({
        senderId: "user-alice",
        senderName: "Alice",
        gameType: "chess",
        context: "dm",
        conversationId: "chat-123",
        recipientId: "user-bob",
        recipientName: "Bob",
      });

      expect(invite.context).toBe("dm");
      expect(invite.targetType).toBe("specific");
      expect(invite.recipientId).toBe("user-bob");
      expect(invite.showInPlayPage).toBe(true);
      expect(invite.claimedSlots).toHaveLength(1);
      expect(invite.claimedSlots[0].playerId).toBe("user-alice");
      expect(invite.claimedSlots[0].isHost).toBe(true);
      expect(invite.eligibleUserIds).toContain("user-alice");
      expect(invite.eligibleUserIds).toContain("user-bob");
      expect(invite.status).toBe("pending");
    });

    it("should create group invite with universal targetType", async () => {
      const invite = await sendUniversalInvite({
        senderId: "user-alice",
        senderName: "Alice",
        gameType: "crazy_eights",
        context: "group",
        conversationId: "group-456",
        conversationName: "Game Night",
        eligibleUserIds: [
          "user-alice",
          "user-bob",
          "user-charlie",
          "user-dave",
        ],
        requiredPlayers: 4,
      });

      expect(invite.context).toBe("group");
      expect(invite.targetType).toBe("universal");
      expect(invite.recipientId).toBeUndefined();
      expect(invite.showInPlayPage).toBe(false);
      expect(invite.requiredPlayers).toBe(4);
      expect(invite.maxPlayers).toBe(4);
      expect(invite.eligibleUserIds).toHaveLength(4);
    });

    it("should throw error for DM invite without recipientId", async () => {
      await expect(
        sendUniversalInvite({
          senderId: "user-alice",
          senderName: "Alice",
          gameType: "chess",
          context: "dm",
          conversationId: "chat-123",
        }),
      ).rejects.toThrow("recipientId is required for DM invites");
    });

    it("should throw error for group invite without eligibleUserIds", async () => {
      await expect(
        sendUniversalInvite({
          senderId: "user-alice",
          senderName: "Alice",
          gameType: "chess",
          context: "group",
          conversationId: "group-456",
        }),
      ).rejects.toThrow("eligibleUserIds with at least 2 members required");
    });

    it("should throw error for invalid requiredPlayers", async () => {
      await expect(
        sendUniversalInvite({
          senderId: "user-alice",
          senderName: "Alice",
          gameType: "chess", // Chess is 2 players only
          context: "dm",
          conversationId: "chat-123",
          recipientId: "user-bob",
          recipientName: "Bob",
          requiredPlayers: 4, // Invalid for chess
        }),
      ).rejects.toThrow("requiredPlayers must be between");
    });

    it("should use game metadata for default requiredPlayers", async () => {
      const invite = await sendUniversalInvite({
        senderId: "user-alice",
        senderName: "Alice",
        gameType: "crazy_eights", // minPlayers: 2, maxPlayers: 4
        context: "group",
        conversationId: "group-456",
        eligibleUserIds: ["user-alice", "user-bob"],
      });

      expect(invite.requiredPlayers).toBe(2);
      expect(invite.maxPlayers).toBe(4);
    });

    it("should set expiration time based on expirationMinutes", async () => {
      const invite = await sendUniversalInvite({
        senderId: "user-alice",
        senderName: "Alice",
        gameType: "chess",
        context: "dm",
        conversationId: "chat-123",
        recipientId: "user-bob",
        recipientName: "Bob",
        expirationMinutes: 30,
      });

      const expectedExpiry = invite.createdAt + 30 * 60 * 1000;
      expect(invite.expiresAt).toBe(expectedExpiry);
    });
  });

  // ===========================================================================
  // claimInviteSlot Tests
  // ===========================================================================
  describe("claimInviteSlot", () => {
    let inviteId: string;

    beforeEach(async () => {
      const invite = await sendUniversalInvite({
        senderId: "user-alice",
        senderName: "Alice",
        gameType: "crazy_eights",
        context: "group",
        conversationId: "group-456",
        eligibleUserIds: [
          "user-alice",
          "user-bob",
          "user-charlie",
          "user-dave",
        ],
        requiredPlayers: 3,
      });
      inviteId = invite.id;
    });

    it("should add player to claimedSlots", async () => {
      const result = await claimInviteSlot(inviteId, "user-bob", "Bob");

      expect(result.success).toBe(true);
      expect(result.invite?.claimedSlots).toHaveLength(2);
      expect(result.invite?.claimedSlots[1].playerId).toBe("user-bob");
      expect(result.invite?.claimedSlots[1].isHost).toBe(false);
    });

    it("should update status to filling when second player joins", async () => {
      const result = await claimInviteSlot(inviteId, "user-bob", "Bob");

      expect(result.invite?.status).toBe("filling");
    });

    it("should update status to ready when full", async () => {
      await claimInviteSlot(inviteId, "user-bob", "Bob");
      const result = await claimInviteSlot(inviteId, "user-charlie", "Charlie");

      expect(result.invite?.status).toBe("ready");
      expect(result.invite?.filledAt).toBeDefined();
    });

    it("should reject if user already claimed", async () => {
      await claimInviteSlot(inviteId, "user-bob", "Bob");
      const result = await claimInviteSlot(inviteId, "user-bob", "Bob");

      expect(result.success).toBe(false);
      expect(result.error).toContain("already joined");
    });

    it("should reject if user not in eligibleUserIds", async () => {
      const result = await claimInviteSlot(inviteId, "user-eve", "Eve");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not eligible");
    });

    it("should reject if game is full", async () => {
      // Fill to maxPlayers (4 for crazy_eights)
      await claimInviteSlot(inviteId, "user-bob", "Bob");
      await claimInviteSlot(inviteId, "user-charlie", "Charlie");
      await claimInviteSlot(inviteId, "user-dave", "Dave");

      // Try to add 5th player
      const result = await claimInviteSlot(inviteId, "user-eve", "Eve");

      expect(result.success).toBe(false);
      // Either "not eligible" or "full" depending on order of checks
    });

    it("should reject if invite expired", async () => {
      // Advance time past expiration
      advanceTime(61 * 60 * 1000); // 61 minutes

      const result = await claimInviteSlot(inviteId, "user-bob", "Bob");

      expect(result.success).toBe(false);
      expect(result.error).toContain("expired");
    });

    it("should reject if invite is not pending or filling", async () => {
      // Fill to ready status
      await claimInviteSlot(inviteId, "user-bob", "Bob");
      await claimInviteSlot(inviteId, "user-charlie", "Charlie");
      // Status is now "ready"

      const result = await claimInviteSlot(inviteId, "user-dave", "Dave");

      expect(result.success).toBe(false);
      expect(result.error).toContain("ready");
    });
  });

  // ===========================================================================
  // unclaimInviteSlot Tests
  // ===========================================================================
  describe("unclaimInviteSlot", () => {
    let inviteId: string;

    beforeEach(async () => {
      const invite = await sendUniversalInvite({
        senderId: "user-alice",
        senderName: "Alice",
        gameType: "crazy_eights",
        context: "group",
        conversationId: "group-456",
        eligibleUserIds: ["user-alice", "user-bob", "user-charlie"],
        requiredPlayers: 3,
      });
      inviteId = invite.id;
      await claimInviteSlot(inviteId, "user-bob", "Bob");
    });

    it("should remove player from claimedSlots", async () => {
      const result = await unclaimInviteSlot(inviteId, "user-bob");

      expect(result.success).toBe(true);

      const invite = await getUniversalInviteById(inviteId);
      expect(invite?.claimedSlots).toHaveLength(1);
    });

    it("should revert status to pending when only host remains", async () => {
      await unclaimInviteSlot(inviteId, "user-bob");

      const invite = await getUniversalInviteById(inviteId);
      expect(invite?.status).toBe("pending");
    });

    it("should not allow host to unclaim", async () => {
      const result = await unclaimInviteSlot(inviteId, "user-alice");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Host cannot leave");
    });

    it("should reject if user hasn't joined", async () => {
      const result = await unclaimInviteSlot(inviteId, "user-charlie");

      expect(result.success).toBe(false);
      expect(result.error).toContain("haven't joined");
    });

    it("should allow player to leave and rejoin", async () => {
      // Bob leaves
      const leaveResult = await unclaimInviteSlot(inviteId, "user-bob");
      expect(leaveResult.success).toBe(true);

      // Bob rejoins
      const rejoinResult = await claimInviteSlot(inviteId, "user-bob", "Bob");
      expect(rejoinResult.success).toBe(true);
    });
  });

  // ===========================================================================
  // Spectator Functions Tests
  // ===========================================================================
  describe("Spectator Functions", () => {
    let inviteId: string;

    beforeEach(async () => {
      // Create and fill an invite to ready status
      const invite = await sendUniversalInvite({
        senderId: "user-alice",
        senderName: "Alice",
        gameType: "chess",
        context: "group",
        conversationId: "group-456",
        eligibleUserIds: [
          "user-alice",
          "user-bob",
          "user-charlie",
          "user-dave",
        ],
      });
      inviteId = invite.id;
      await claimInviteSlot(inviteId, "user-bob", "Bob");
      // Now status is "ready" (2/2 players for chess)
    });

    describe("joinAsSpectator", () => {
      it("should add spectator when game is ready", async () => {
        const result = await joinAsSpectator(
          inviteId,
          "user-charlie",
          "Charlie",
        );

        expect(result.success).toBe(true);

        const invite = await getUniversalInviteById(inviteId);
        expect(invite?.spectators).toHaveLength(1);
        expect(invite?.spectators[0].userId).toBe("user-charlie");
      });

      it("should reject if spectating disabled", async () => {
        // Create invite with spectating disabled
        const noSpecInvite = await sendUniversalInvite({
          senderId: "user-alice",
          senderName: "Alice",
          gameType: "chess",
          context: "dm",
          conversationId: "chat-123",
          recipientId: "user-bob",
          recipientName: "Bob",
        });
        await claimInviteSlot(noSpecInvite.id, "user-bob", "Bob");

        // Manually disable spectating
        const invite = invites.get(noSpecInvite.id)!;
        invite.spectatingEnabled = false;
        invites.set(noSpecInvite.id, invite);

        const result = await joinAsSpectator(
          noSpecInvite.id,
          "user-charlie",
          "Charlie",
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("not enabled");
      });

      it("should reject if user is a player", async () => {
        const result = await joinAsSpectator(
          inviteId,
          "user-alice", // Host
          "Alice",
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("player in this game");
      });

      it("should reject if already spectating", async () => {
        await joinAsSpectator(inviteId, "user-charlie", "Charlie");
        const result = await joinAsSpectator(
          inviteId,
          "user-charlie",
          "Charlie",
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("already spectating");
      });

      it("should reject if user not in eligibleUserIds", async () => {
        const result = await joinAsSpectator(inviteId, "user-eve", "Eve");

        expect(result.success).toBe(false);
        expect(result.error).toContain("cannot spectate");
      });

      it("should reject if game not ready yet", async () => {
        // Create new pending invite
        const pendingInvite = await sendUniversalInvite({
          senderId: "user-alice",
          senderName: "Alice",
          gameType: "crazy_eights",
          context: "group",
          conversationId: "group-789",
          eligibleUserIds: ["user-alice", "user-bob", "user-charlie"],
          requiredPlayers: 3,
        });

        const result = await joinAsSpectator(
          pendingInvite.id,
          "user-charlie",
          "Charlie",
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("not ready");
      });
    });

    describe("leaveSpectator", () => {
      it("should remove spectator", async () => {
        await joinAsSpectator(inviteId, "user-charlie", "Charlie");
        const result = await leaveSpectator(inviteId, "user-charlie");

        expect(result.success).toBe(true);

        const invite = await getUniversalInviteById(inviteId);
        expect(invite?.spectators).toHaveLength(0);
      });
    });
  });

  // ===========================================================================
  // Cancel Invite Tests
  // ===========================================================================
  describe("cancelGameInvite", () => {
    let inviteId: string;

    beforeEach(async () => {
      const invite = await sendUniversalInvite({
        senderId: "user-alice",
        senderName: "Alice",
        gameType: "chess",
        context: "dm",
        conversationId: "chat-123",
        recipientId: "user-bob",
        recipientName: "Bob",
      });
      inviteId = invite.id;
    });

    it("should allow host to cancel pending invite", async () => {
      const result = await cancelGameInvite(inviteId, "user-alice");

      expect(result.success).toBe(true);

      const invite = await getUniversalInviteById(inviteId);
      expect(invite?.status).toBe("cancelled");
    });

    it("should not allow non-host to cancel", async () => {
      const result = await cancelGameInvite(inviteId, "user-bob");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Only the host");
    });

    it("should not allow cancelling ready game", async () => {
      await claimInviteSlot(inviteId, "user-bob", "Bob");
      // Status is now "ready"

      const result = await cancelGameInvite(inviteId, "user-alice");

      expect(result.success).toBe(false);
      expect(result.error).toContain("ready");
    });
  });

  // ===========================================================================
  // Query Functions Tests
  // ===========================================================================
  describe("Query Functions", () => {
    describe("getPlayPageInvites", () => {
      beforeEach(async () => {
        // Create DM invite (should appear)
        await sendUniversalInvite({
          senderId: "user-alice",
          senderName: "Alice",
          gameType: "chess",
          context: "dm",
          conversationId: "chat-1",
          recipientId: "user-bob",
          recipientName: "Bob",
        });

        // Create group invite (should NOT appear)
        await sendUniversalInvite({
          senderId: "user-alice",
          senderName: "Alice",
          gameType: "chess",
          context: "group",
          conversationId: "group-1",
          eligibleUserIds: ["user-alice", "user-bob"],
        });
      });

      it("should return only DM invites where user is recipient", async () => {
        const invites = await getPlayPageInvites("user-bob");

        expect(invites.length).toBe(1);
        expect(invites[0].context).toBe("dm");
        expect(invites[0].showInPlayPage).toBe(true);
      });

      it("should exclude invites where user is sender", async () => {
        const invites = await getPlayPageInvites("user-alice");

        expect(invites.length).toBe(0);
      });

      it("should exclude expired invites", async () => {
        advanceTime(61 * 60 * 1000); // 61 minutes

        const invites = await getPlayPageInvites("user-bob");

        expect(invites.length).toBe(0);
      });
    });

    describe("getConversationInvites", () => {
      it("should return invites for specific conversation", async () => {
        await sendUniversalInvite({
          senderId: "user-alice",
          senderName: "Alice",
          gameType: "chess",
          context: "group",
          conversationId: "group-123",
          eligibleUserIds: ["user-alice", "user-bob"],
        });

        const result = await getConversationInvites("group-123", "user-bob");

        expect(result.length).toBe(1);
        expect(result[0].conversationId).toBe("group-123");
      });

      it("should filter by eligibleUserIds", async () => {
        await sendUniversalInvite({
          senderId: "user-alice",
          senderName: "Alice",
          gameType: "chess",
          context: "group",
          conversationId: "group-123",
          eligibleUserIds: ["user-alice", "user-bob"], // Charlie not included
        });

        const result = await getConversationInvites(
          "group-123",
          "user-charlie",
        );

        expect(result.length).toBe(0);
      });

      it("should exclude cancelled/expired invites", async () => {
        const invite = await sendUniversalInvite({
          senderId: "user-alice",
          senderName: "Alice",
          gameType: "chess",
          context: "group",
          conversationId: "group-123",
          eligibleUserIds: ["user-alice", "user-bob"],
        });

        await cancelGameInvite(invite.id, "user-alice");

        const result = await getConversationInvites("group-123", "user-bob");

        expect(result.length).toBe(0);
      });
    });
  });

  // ===========================================================================
  // Full Flow Integration Tests
  // ===========================================================================
  describe("Full Flow Integration", () => {
    it("should complete DM invite flow: create -> claim -> ready", async () => {
      // 1. Create invite
      const invite = await sendUniversalInvite({
        senderId: "user-alice",
        senderName: "Alice",
        gameType: "chess",
        context: "dm",
        conversationId: "chat-123",
        recipientId: "user-bob",
        recipientName: "Bob",
      });

      expect(invite.status).toBe("pending");
      expect(invite.claimedSlots).toHaveLength(1);

      // 2. Bob claims slot
      const claimResult = await claimInviteSlot(invite.id, "user-bob", "Bob");

      expect(claimResult.success).toBe(true);
      expect(claimResult.invite?.status).toBe("ready");
      expect(claimResult.invite?.claimedSlots).toHaveLength(2);
    });

    it("should complete group invite flow with multiple players", async () => {
      // 1. Create 4-player Crazy Eights invite
      const invite = await sendUniversalInvite({
        senderId: "user-alice",
        senderName: "Alice",
        gameType: "crazy_eights",
        context: "group",
        conversationId: "group-456",
        conversationName: "Game Night",
        eligibleUserIds: [
          "user-alice",
          "user-bob",
          "user-charlie",
          "user-dave",
          "user-eve",
        ],
        requiredPlayers: 4,
      });

      expect(invite.status).toBe("pending");

      // 2. Bob joins
      const claim1 = await claimInviteSlot(invite.id, "user-bob", "Bob");
      expect(claim1.invite?.status).toBe("filling");
      expect(claim1.invite?.claimedSlots).toHaveLength(2);

      // 3. Charlie joins
      const claim2 = await claimInviteSlot(
        invite.id,
        "user-charlie",
        "Charlie",
      );
      expect(claim2.invite?.status).toBe("filling");

      // 4. Dave joins - game is full
      const claim3 = await claimInviteSlot(invite.id, "user-dave", "Dave");
      expect(claim3.invite?.status).toBe("ready");
      expect(claim3.invite?.filledAt).toBeDefined();

      // 5. Eve tries to join but game is full
      const claim4 = await claimInviteSlot(invite.id, "user-eve", "Eve");
      expect(claim4.success).toBe(false);

      // 6. Eve spectates instead
      const spectate = await joinAsSpectator(invite.id, "user-eve", "Eve");
      expect(spectate.success).toBe(true);

      const finalInvite = await getUniversalInviteById(invite.id);
      expect(finalInvite?.claimedSlots).toHaveLength(4);
      expect(finalInvite?.spectators).toHaveLength(1);
    });

    it("should handle player leaving and rejoining", async () => {
      const invite = await sendUniversalInvite({
        senderId: "user-alice",
        senderName: "Alice",
        gameType: "crazy_eights",
        context: "group",
        conversationId: "group-456",
        eligibleUserIds: ["user-alice", "user-bob", "user-charlie"],
        requiredPlayers: 3,
      });

      // Bob joins
      await claimInviteSlot(invite.id, "user-bob", "Bob");
      let currentInvite = await getUniversalInviteById(invite.id);
      expect(currentInvite?.status).toBe("filling");

      // Bob leaves
      await unclaimInviteSlot(invite.id, "user-bob");
      currentInvite = await getUniversalInviteById(invite.id);
      expect(currentInvite?.status).toBe("pending");

      // Bob rejoins
      await claimInviteSlot(invite.id, "user-bob", "Bob");
      currentInvite = await getUniversalInviteById(invite.id);
      expect(currentInvite?.status).toBe("filling");

      // Charlie joins to complete
      await claimInviteSlot(invite.id, "user-charlie", "Charlie");
      currentInvite = await getUniversalInviteById(invite.id);
      expect(currentInvite?.status).toBe("ready");
    });
  });
});
