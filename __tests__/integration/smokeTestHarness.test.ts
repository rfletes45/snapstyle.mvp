/**
 * Smoke Test Harness — Invite Lifecycle + Room Flow
 * Segment 10: QA / Smoke Test Harness
 *
 * Exercises the critical path end-to-end (with mocked Firestore/Colyseus):
 *   1. Create invite (DM + group)
 *   2. Claim slot
 *   3. Start early
 *   4. Join room → ready → countdown → playing
 *   5. Disconnect / reconnect simulation
 *   6. Finish match → verify invite completion update
 *
 * Each step logs a traceId and reports pass/fail.
 *
 * @see src/services/gameInvites.ts
 * @see docs/06_GAMES.md  — Release Checklist
 */

import { ExtendedGameType } from "@/types/games";

// =============================================================================
// Trace Logger
// =============================================================================

interface TraceEntry {
  step: string;
  traceId: string;
  status: "pass" | "fail";
  detail?: string;
  durationMs: number;
}

const traceLog: TraceEntry[] = [];

function generateTraceId(): string {
  return `smoke_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function logStep(
  step: string,
  traceId: string,
  status: "pass" | "fail",
  durationMs: number,
  detail?: string,
): void {
  traceLog.push({ step, traceId, status, durationMs, detail });
}

// =============================================================================
// Mock Types (mirrors src/types/turnBased.ts)
// =============================================================================

type InviteContext = "dm" | "group";

type UniversalInviteStatus =
  | "pending"
  | "filling"
  | "ready"
  | "starting"
  | "active"
  | "completed"
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
  conversationName?: string;
  targetType: "universal" | "specific";
  recipientId?: string;
  recipientName?: string;
  eligibleUserIds: string[];
  requiredPlayers: number;
  maxPlayers: number;
  claimedSlots: PlayerSlot[];
  filledAt?: number;
  status: UniversalInviteStatus;
  gameId?: string;
  traceId?: string;
  completedAt?: number;
  winnerId?: string;
  winReason?: string;
  settings: {
    isRated: boolean;
    timeControl?: { type: string; seconds: number };
    chatEnabled: boolean;
  };
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  showInPlayPage: boolean;
}

// =============================================================================
// Mock Room State
// =============================================================================

type RoomPhase = "waiting" | "countdown" | "playing" | "finished";

interface MockPlayer {
  uid: string;
  sessionId: string;
  displayName: string;
  connected: boolean;
  ready: boolean;
  score: number;
}

interface MockRoom {
  id: string;
  firestoreGameId: string;
  gameType: string;
  phase: RoomPhase;
  players: Map<string, MockPlayer>;
  countdownTimer: ReturnType<typeof setTimeout> | null;
  winnerId: string;
  winReason: string;
  disposed: boolean;
}

// =============================================================================
// Mock Database & Services
// =============================================================================

let invites: Map<string, UniversalGameInvite>;
let rooms: Map<string, MockRoom>;
let currentTime: number;
let nextSessionCounter: number;

function resetAll(): void {
  invites = new Map();
  rooms = new Map();
  currentTime = Date.now();
  nextSessionCounter = 0;
  traceLog.length = 0;
}

function advanceTime(ms: number): void {
  currentTime += ms;
}

function generateInviteId(): string {
  return `uinv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateRoomId(): string {
  return `room_${Math.random().toString(36).slice(2, 10)}`;
}

function generateSessionId(): string {
  return `sess_${(++nextSessionCounter).toString().padStart(3, "0")}`;
}

// ---- Invite Service Mocks ----

async function sendUniversalInvite(params: {
  senderId: string;
  senderName: string;
  gameType: ExtendedGameType;
  context: InviteContext;
  conversationId: string;
  conversationName?: string;
  recipientId?: string;
  recipientName?: string;
  eligibleUserIds?: string[];
  requiredPlayers?: number;
  settings?: Partial<UniversalGameInvite["settings"]>;
  traceId?: string;
}): Promise<UniversalGameInvite> {
  const now = currentTime;
  const id = generateInviteId();
  const traceId = params.traceId ?? generateTraceId();

  const isSpecific = params.context === "dm";
  const eligibleUserIds =
    params.context === "dm"
      ? [params.senderId, params.recipientId!]
      : (params.eligibleUserIds ?? []);

  if (!eligibleUserIds.includes(params.senderId)) {
    eligibleUserIds.unshift(params.senderId);
  }

  const requiredPlayers = params.requiredPlayers ?? 2;

  const invite: UniversalGameInvite = {
    id,
    gameType: params.gameType,
    senderId: params.senderId,
    senderName: params.senderName,
    context: params.context,
    conversationId: params.conversationId,
    conversationName: params.conversationName,
    targetType: isSpecific ? "specific" : "universal",
    recipientId: isSpecific ? params.recipientId : undefined,
    recipientName: isSpecific ? params.recipientName : undefined,
    eligibleUserIds,
    requiredPlayers,
    maxPlayers: requiredPlayers,
    claimedSlots: [
      {
        playerId: params.senderId,
        playerName: params.senderName,
        claimedAt: now,
        isHost: true,
      },
    ],
    status: "pending",
    traceId,
    settings: {
      isRated: params.settings?.isRated ?? true,
      timeControl: params.settings?.timeControl ?? {
        type: "per_turn",
        seconds: 86400,
      },
      chatEnabled: params.settings?.chatEnabled ?? true,
    },
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 60 * 60 * 1000,
    showInPlayPage: isSpecific,
  };

  invites.set(id, invite);
  return invite;
}

async function claimInviteSlot(
  inviteId: string,
  userId: string,
  userName: string,
): Promise<{ success: boolean; error?: string; invite?: UniversalGameInvite }> {
  const invite = invites.get(inviteId);
  if (!invite) return { success: false, error: "Invite not found" };
  if (invite.status !== "pending" && invite.status !== "filling") {
    return {
      success: false,
      error: `Cannot claim: status is ${invite.status}`,
    };
  }
  if (!invite.eligibleUserIds.includes(userId)) {
    return { success: false, error: "User not eligible" };
  }
  if (invite.claimedSlots.some((s) => s.playerId === userId)) {
    return { success: false, error: "Already claimed" };
  }
  if (invite.claimedSlots.length >= invite.maxPlayers) {
    return { success: false, error: "All slots full" };
  }

  invite.claimedSlots.push({
    playerId: userId,
    playerName: userName,
    claimedAt: currentTime,
    isHost: false,
  });
  invite.updatedAt = currentTime;

  if (invite.claimedSlots.length >= invite.requiredPlayers) {
    invite.status = "ready";
    invite.filledAt = currentTime;
  } else if (invite.claimedSlots.length > 1) {
    invite.status = "filling";
  }

  return { success: true, invite };
}

async function startGameEarly(
  inviteId: string,
  hostId: string,
): Promise<{ success: boolean; gameId?: string; error?: string }> {
  const invite = invites.get(inviteId);
  if (!invite) return { success: false, error: "Invite not found" };
  if (invite.senderId !== hostId)
    return { success: false, error: "Not the host" };
  if (invite.status !== "ready" && invite.status !== "filling") {
    return {
      success: false,
      error: `Cannot start: status is ${invite.status}`,
    };
  }
  if (invite.claimedSlots.length < 2) {
    return { success: false, error: "Need at least 2 players" };
  }

  invite.status = "starting";
  invite.updatedAt = currentTime;

  // Create a game ID (simulates Firestore createMatch)
  const gameId = `game_${Math.random().toString(36).slice(2, 10)}`;
  invite.gameId = gameId;
  invite.status = "active";
  invite.updatedAt = currentTime;

  return { success: true, gameId };
}

async function completeGameInvite(
  inviteId: string,
  winnerId?: string,
  winReason?: string,
): Promise<{ success: boolean; error?: string }> {
  const invite = invites.get(inviteId);
  if (!invite) return { success: false, error: "Invite not found" };
  if (invite.status !== "active") {
    return {
      success: false,
      error: `Cannot complete: status is ${invite.status}`,
    };
  }

  invite.status = "completed";
  invite.completedAt = currentTime;
  invite.winnerId = winnerId;
  invite.winReason = winReason;
  invite.updatedAt = currentTime;

  return { success: true };
}

async function cancelUniversalInvite(
  inviteId: string,
  hostId: string,
): Promise<{ success: boolean; error?: string }> {
  const invite = invites.get(inviteId);
  if (!invite) return { success: false, error: "Invite not found" };
  if (invite.senderId !== hostId)
    return { success: false, error: "Not the host" };

  invite.status = "cancelled";
  invite.updatedAt = currentTime;
  return { success: true };
}

// ---- Room Service Mocks ----

function joinOrCreateRoom(
  gameType: string,
  firestoreGameId: string,
  uid: string,
  displayName: string,
): MockRoom {
  // Find existing room with same firestoreGameId (filterBy simulation)
  let room: MockRoom | undefined;
  for (const r of rooms.values()) {
    if (r.firestoreGameId === firestoreGameId && !r.disposed) {
      room = r;
      break;
    }
  }

  if (!room) {
    room = {
      id: generateRoomId(),
      firestoreGameId,
      gameType,
      phase: "waiting",
      players: new Map(),
      countdownTimer: null,
      winnerId: "",
      winReason: "",
      disposed: false,
    };
    rooms.set(room.id, room);
  }

  const sessionId = generateSessionId();
  room.players.set(sessionId, {
    uid,
    sessionId,
    displayName,
    connected: true,
    ready: false,
    score: 0,
  });

  return room;
}

function sendReady(room: MockRoom, sessionId: string): void {
  const player = room.players.get(sessionId);
  if (!player) throw new Error(`Player ${sessionId} not in room`);
  player.ready = true;

  // Check if all players ready
  const allReady = Array.from(room.players.values()).every((p) => p.ready);
  if (allReady && room.players.size >= 2) {
    room.phase = "countdown";
  }
}

function advanceCountdown(room: MockRoom): void {
  if (room.phase !== "countdown") throw new Error("Not in countdown");
  room.phase = "playing";
}

function simulateDisconnect(room: MockRoom, sessionId: string): void {
  const player = room.players.get(sessionId);
  if (!player) throw new Error(`Player ${sessionId} not in room`);
  player.connected = false;
}

function simulateReconnect(room: MockRoom, oldSessionId: string): string {
  const player = room.players.get(oldSessionId);
  if (!player) throw new Error(`Player ${oldSessionId} not in room`);

  // Reconnection: same session ID restored, connected = true
  player.connected = true;
  return oldSessionId;
}

function finishGame(room: MockRoom, winnerId: string, winReason: string): void {
  if (room.phase !== "playing") throw new Error("Not playing");
  room.phase = "finished";
  room.winnerId = winnerId;
  room.winReason = winReason;
}

function disposeRoom(room: MockRoom): void {
  room.disposed = true;
}

// =============================================================================
// Helper: timed step runner
// =============================================================================

async function runStep<T>(
  stepName: string,
  traceId: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    logStep(stepName, traceId, "pass", performance.now() - start);
    return result;
  } catch (err: any) {
    logStep(stepName, traceId, "fail", performance.now() - start, err.message);
    throw err;
  }
}

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
  resetAll();
});

afterEach(() => {
  // Print trace log for debugging (visible in --verbose)
  if (traceLog.length > 0) {
    const summary = traceLog
      .map(
        (e) =>
          `  [${e.status.toUpperCase()}] ${e.step} (${e.durationMs.toFixed(1)}ms) traceId=${e.traceId}${e.detail ? ` — ${e.detail}` : ""}`,
      )
      .join("\n");
    // eslint-disable-next-line no-console
    console.log(`\n  Smoke Test Trace Log:\n${summary}\n`);
  }
});

// ---------------------------------------------------------------------------
// SMOKE 1: DM invite → full lifecycle
// ---------------------------------------------------------------------------
describe("Smoke Test: DM Invite Full Lifecycle", () => {
  const alice = { uid: "alice_001", name: "Alice" };
  const bob = { uid: "bob_001", name: "Bob" };
  const gameType: ExtendedGameType = "chess";

  it("completes the full DM invite → room → finish → completion flow", async () => {
    const traceId = generateTraceId();

    // Step 1: Create DM invite
    const invite = await runStep("create_dm_invite", traceId, () =>
      sendUniversalInvite({
        senderId: alice.uid,
        senderName: alice.name,
        gameType,
        context: "dm",
        conversationId: "conv_alice_bob",
        recipientId: bob.uid,
        recipientName: bob.name,
        traceId,
      }),
    );

    expect(invite.status).toBe("pending");
    expect(invite.claimedSlots).toHaveLength(1);
    expect(invite.traceId).toBe(traceId);

    // Step 2: Bob claims slot
    const claimResult = await runStep("claim_slot", traceId, () =>
      claimInviteSlot(invite.id, bob.uid, bob.name),
    );

    expect(claimResult.success).toBe(true);
    expect(claimResult.invite!.status).toBe("ready");
    expect(claimResult.invite!.claimedSlots).toHaveLength(2);

    // Step 3: Alice starts the game
    const startResult = await runStep("start_early", traceId, () =>
      startGameEarly(invite.id, alice.uid),
    );

    expect(startResult.success).toBe(true);
    expect(startResult.gameId).toBeTruthy();
    const gameId = startResult.gameId!;

    // Verify invite is now active
    const activeInvite = invites.get(invite.id)!;
    expect(activeInvite.status).toBe("active");
    expect(activeInvite.gameId).toBe(gameId);

    // Step 4: Both players join the Colyseus room
    const roomAlice = await runStep("alice_join_room", traceId, () =>
      joinOrCreateRoom(gameType, gameId, alice.uid, alice.name),
    );

    const roomBob = await runStep("bob_join_room", traceId, () =>
      joinOrCreateRoom(gameType, gameId, bob.uid, bob.name),
    );

    // Both should be in the same room (filterBy simulation)
    expect(roomAlice.id).toBe(roomBob.id);
    expect(roomAlice.players.size).toBe(2);
    expect(roomAlice.phase).toBe("waiting");

    // Step 5: Both send ready → countdown → playing
    const sessions = Array.from(roomAlice.players.keys());
    const aliceSession = sessions[0];
    const bobSession = sessions[1];

    await runStep("alice_ready", traceId, () =>
      sendReady(roomAlice, aliceSession),
    );
    await runStep("bob_ready", traceId, () => sendReady(roomAlice, bobSession));

    expect(roomAlice.phase).toBe("countdown");

    await runStep("countdown_complete", traceId, () =>
      advanceCountdown(roomAlice),
    );

    expect(roomAlice.phase).toBe("playing");

    // Step 6: Disconnect / reconnect simulation
    await runStep("bob_disconnect", traceId, () =>
      simulateDisconnect(roomAlice, bobSession),
    );

    const bobPlayer = roomAlice.players.get(bobSession)!;
    expect(bobPlayer.connected).toBe(false);

    await runStep("bob_reconnect", traceId, () =>
      simulateReconnect(roomAlice, bobSession),
    );

    expect(bobPlayer.connected).toBe(true);

    // Step 7: Finish match
    await runStep("finish_match", traceId, () =>
      finishGame(roomAlice, alice.uid, "checkmate"),
    );

    expect(roomAlice.phase).toBe("finished");
    expect(roomAlice.winnerId).toBe(alice.uid);

    // Step 8: Complete invite
    const completeResult = await runStep("complete_invite", traceId, () =>
      completeGameInvite(invite.id, alice.uid, "checkmate"),
    );

    expect(completeResult.success).toBe(true);

    const completedInvite = invites.get(invite.id)!;
    expect(completedInvite.status).toBe("completed");
    expect(completedInvite.winnerId).toBe(alice.uid);
    expect(completedInvite.winReason).toBe("checkmate");

    // Step 9: Dispose room
    await runStep("dispose_room", traceId, () => disposeRoom(roomAlice));
    expect(roomAlice.disposed).toBe(true);

    // Verify all steps passed
    const allPassed = traceLog.every((e) => e.status === "pass");
    expect(allPassed).toBe(true);
    expect(traceLog.length).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// SMOKE 2: Group invite → full lifecycle
// ---------------------------------------------------------------------------
describe("Smoke Test: Group Invite Full Lifecycle", () => {
  const host = { uid: "host_001", name: "Host" };
  const player2 = { uid: "p2_001", name: "Player2" };
  const player3 = { uid: "p3_001", name: "Player3" };
  const gameType: ExtendedGameType = "crazy_eights";

  it("completes a group invite → room → finish flow", async () => {
    const traceId = generateTraceId();

    // Step 1: Create group invite (3 players)
    const invite = await runStep("create_group_invite", traceId, () =>
      sendUniversalInvite({
        senderId: host.uid,
        senderName: host.name,
        gameType,
        context: "group",
        conversationId: "group_abc",
        conversationName: "Game Night",
        eligibleUserIds: [host.uid, player2.uid, player3.uid],
        requiredPlayers: 3,
        traceId,
      }),
    );

    expect(invite.status).toBe("pending");
    expect(invite.context).toBe("group");
    expect(invite.requiredPlayers).toBe(3);

    // Step 2: Player2 claims
    const claim2 = await runStep("player2_claim", traceId, () =>
      claimInviteSlot(invite.id, player2.uid, player2.name),
    );

    expect(claim2.success).toBe(true);
    expect(claim2.invite!.status).toBe("filling");

    // Step 3: Player3 claims → ready
    const claim3 = await runStep("player3_claim", traceId, () =>
      claimInviteSlot(invite.id, player3.uid, player3.name),
    );

    expect(claim3.success).toBe(true);
    expect(claim3.invite!.status).toBe("ready");

    // Step 4: Host starts game
    const startResult = await runStep("start_game", traceId, () =>
      startGameEarly(invite.id, host.uid),
    );

    expect(startResult.success).toBe(true);
    const gameId = startResult.gameId!;

    // Step 5: All three join room
    const room = await runStep("all_join_room", traceId, () => {
      const r1 = joinOrCreateRoom(gameType, gameId, host.uid, host.name);
      joinOrCreateRoom(gameType, gameId, player2.uid, player2.name);
      joinOrCreateRoom(gameType, gameId, player3.uid, player3.name);
      return r1;
    });

    expect(room.players.size).toBe(3);

    // Step 6: All ready → countdown → playing
    const sessions = Array.from(room.players.keys());
    await runStep("all_ready", traceId, () => {
      sessions.forEach((s) => sendReady(room, s));
    });

    expect(room.phase).toBe("countdown");
    advanceCountdown(room);
    expect(room.phase).toBe("playing");

    // Step 7: Finish
    await runStep("finish_match", traceId, () =>
      finishGame(room, player2.uid, "last_card"),
    );

    expect(room.phase).toBe("finished");

    // Step 8: Complete invite
    const completeResult = await runStep("complete_invite", traceId, () =>
      completeGameInvite(invite.id, player2.uid, "last_card"),
    );

    expect(completeResult.success).toBe(true);
    expect(invites.get(invite.id)!.status).toBe("completed");

    const allPassed = traceLog.every((e) => e.status === "pass");
    expect(allPassed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SMOKE 3: Status transition edge cases
// ---------------------------------------------------------------------------
describe("Smoke Test: Status Transition Guards", () => {
  const alice = { uid: "alice_002", name: "Alice" };
  const bob = { uid: "bob_002", name: "Bob" };

  it("rejects claim on cancelled invite", async () => {
    const invite = await sendUniversalInvite({
      senderId: alice.uid,
      senderName: alice.name,
      gameType: "tic_tac_toe",
      context: "dm",
      conversationId: "conv_1",
      recipientId: bob.uid,
      recipientName: bob.name,
    });

    await cancelUniversalInvite(invite.id, alice.uid);
    const result = await claimInviteSlot(invite.id, bob.uid, bob.name);
    expect(result.success).toBe(false);
    expect(result.error).toContain("cancelled");
  });

  it("rejects start from non-host", async () => {
    const invite = await sendUniversalInvite({
      senderId: alice.uid,
      senderName: alice.name,
      gameType: "chess",
      context: "dm",
      conversationId: "conv_2",
      recipientId: bob.uid,
      recipientName: bob.name,
    });

    await claimInviteSlot(invite.id, bob.uid, bob.name);
    const result = await startGameEarly(invite.id, bob.uid);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Not the host");
  });

  it("rejects duplicate claim", async () => {
    const invite = await sendUniversalInvite({
      senderId: alice.uid,
      senderName: alice.name,
      gameType: "crazy_eights",
      context: "group",
      conversationId: "conv_3",
      eligibleUserIds: [alice.uid, bob.uid, "charlie_001"],
      requiredPlayers: 3,
    });

    await claimInviteSlot(invite.id, bob.uid, bob.name);
    // Status is now "filling" (2/3), so duplicate claim hits "Already claimed"
    const result = await claimInviteSlot(invite.id, bob.uid, bob.name);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Already claimed");
  });

  it("rejects claim from ineligible user", async () => {
    const invite = await sendUniversalInvite({
      senderId: alice.uid,
      senderName: alice.name,
      gameType: "chess",
      context: "dm",
      conversationId: "conv_4",
      recipientId: bob.uid,
      recipientName: bob.name,
    });

    const result = await claimInviteSlot(invite.id, "random_user", "Random");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not eligible");
  });

  it("rejects completing a non-active invite", async () => {
    const invite = await sendUniversalInvite({
      senderId: alice.uid,
      senderName: alice.name,
      gameType: "chess",
      context: "dm",
      conversationId: "conv_5",
      recipientId: bob.uid,
      recipientName: bob.name,
    });

    const result = await completeGameInvite(invite.id, alice.uid);
    expect(result.success).toBe(false);
    expect(result.error).toContain("pending");
  });
});

// ---------------------------------------------------------------------------
// SMOKE 4: Room filterBy simulation — same firestoreGameId → same room
// ---------------------------------------------------------------------------
describe("Smoke Test: Room FilterBy Routing", () => {
  it("routes two players to the same room via firestoreGameId", () => {
    const gameId = "game_shared";
    const r1 = joinOrCreateRoom("chess", gameId, "u1", "User1");
    const r2 = joinOrCreateRoom("chess", gameId, "u2", "User2");

    expect(r1.id).toBe(r2.id);
    expect(r1.players.size).toBe(2);
  });

  it("creates separate rooms for different firestoreGameIds", () => {
    const r1 = joinOrCreateRoom("chess", "game_a", "u1", "User1");
    const r2 = joinOrCreateRoom("chess", "game_b", "u2", "User2");

    expect(r1.id).not.toBe(r2.id);
  });
});

// ---------------------------------------------------------------------------
// SMOKE 5: Disconnect window + reconnect restores state
// ---------------------------------------------------------------------------
describe("Smoke Test: Disconnect / Reconnect", () => {
  it("player disconnects and reconnects during playing phase", () => {
    const room = joinOrCreateRoom("chess", "game_dc", "alice", "Alice");
    joinOrCreateRoom("chess", "game_dc", "bob", "Bob");

    const sessions = Array.from(room.players.keys());
    sessions.forEach((s) => sendReady(room, s));
    advanceCountdown(room);

    expect(room.phase).toBe("playing");

    // Disconnect bob
    simulateDisconnect(room, sessions[1]);
    expect(room.players.get(sessions[1])!.connected).toBe(false);

    // Game still playing (reconnection window)
    expect(room.phase).toBe("playing");

    // Reconnect
    simulateReconnect(room, sessions[1]);
    expect(room.players.get(sessions[1])!.connected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SMOKE 6: Full multi-game type sweep
// ---------------------------------------------------------------------------
describe("Smoke Test: Multi-Game Type Sweep", () => {
  const gameTypes: ExtendedGameType[] = [
    "chess",
    "checkers",
    "tic_tac_toe",
    "connect_four",
    "gomoku_master",
    "reversi_game",
    "sketch_party_game",
  ];

  it.each(gameTypes)(
    "creates invite, claims, starts, and completes for %s",
    async (gt) => {
      const invite = await sendUniversalInvite({
        senderId: "host",
        senderName: "Host",
        gameType: gt,
        context: "dm",
        conversationId: `conv_${gt}`,
        recipientId: "guest",
        recipientName: "Guest",
      });

      const claim = await claimInviteSlot(invite.id, "guest", "Guest");
      expect(claim.success).toBe(true);

      const start = await startGameEarly(invite.id, "host");
      expect(start.success).toBe(true);

      const complete = await completeGameInvite(invite.id, "host", "winner");
      expect(complete.success).toBe(true);
      expect(invites.get(invite.id)!.status).toBe("completed");
    },
  );
});
