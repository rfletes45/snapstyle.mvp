/**
 * Games V4 — Lobby Management
 *
 * Callables:
 * - joinInviteLobbyV4: join as player or spectator
 * - leaveInviteLobbyV4: leave an invite lobby before game starts
 * - cancelGameInviteV4: host cancels an invite (resolves it)
 * - updateLobbySettingsV4: host-only settings patch
 * - startGameFromInviteV4: host starts the game, creating a GameSessionV4
 *
 * @module gamesV4/lobby
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { secureCallableRuntime } from "../callableSecurity";
import { createInitialState, getAdapter, hasAdapter } from "./adapters";
import {
    assertAuth,
    assertConversationMember,
    generateTraceId,
    getDb,
    getUserProfile,
    unpinInviteFromConversation,
} from "./helpers";
import { notifyPlayerJoinedLobby } from "./notifications";
import { startServerTrace } from "./perfTrace";
import type {
    GameInviteV4,
    GameSessionV4,
    PlayerSlot,
    ScoreSummaryEntry,
} from "./types";
import {
    COLLECTIONS,
    MAX_PLAYERS,
    RESOLVED_INVITE_TTL_MS,
    canTransitionInviteStatus,
} from "./types";
import { COOLDOWNS, enforceCooldown, sanitisePayload } from "./validation";

// =============================================================================
// Callable: joinInviteLobbyV4
// =============================================================================

export const joinInviteLobbyV4 = secureCallableRuntime().https.onCall(
  async (data, context) => {
    const uid = assertAuth(context);
    const trace = startServerTrace("joinLobbyV4", uid);
    const { inviteId, asSpectator } = data as {
      inviteId: string;
      asSpectator?: boolean;
    };

    if (!inviteId || typeof inviteId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "inviteId is required.",
      );
    }

    const db = getDb();
    const inviteRef = db.collection(COLLECTIONS.GAME_INVITES).doc(inviteId);

    // PERF: Run cooldown, invite pre-read, and profile fetch in parallel.
    // These are independent — no need to wait for each one serially.
    trace.mark("pre_reads_start");
    const [, invitePreSnap, joinerProfile] = await Promise.all([
      enforceCooldown(db, uid, "joinLobbyV4", COOLDOWNS.JOIN_LOBBY),
      inviteRef.get(),
      getUserProfile(uid),
    ]);
    trace.mark("pre_reads_done");

    if (!invitePreSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Invite not found.");
    }
    const invitePre = invitePreSnap.data() as GameInviteV4;

    // Conversation membership check depends on invite data
    await assertConversationMember(
      uid,
      invitePre.conversationId,
      invitePre.conversationScope,
    );
    trace.mark("membership_checked");

    trace.mark("tx_start");
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(inviteRef);
      if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Invite not found.");
      }

      const invite = snap.data() as GameInviteV4;

      // Must be sent or lobby status
      if (invite.status !== "sent" && invite.status !== "lobby") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Cannot join invite in status '${invite.status}'.`,
        );
      }

      // Build compact summary for the joiner
      const joinerSummary = {
        uid,
        displayName: joinerProfile?.displayName ?? "Unknown",
        profilePictureUrl: joinerProfile?.profilePictureUrl ?? null,
      };

      if (asSpectator) {
        // Spectator join
        if (!invite.allowSpectators) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "This game does not allow spectators.",
          );
        }

        if (invite.spectatorIds.includes(uid)) {
          return { alreadyJoined: true, role: "spectator" };
        }

        const updatedSpectatorIds = [...invite.spectatorIds, uid];
        const updatedSpectatorSummaries = [
          ...(invite.spectatorSummaries ?? []),
          joinerSummary,
        ];
        const newStatus =
          invite.status === "sent" && canTransitionInviteStatus("sent", "lobby")
            ? "lobby"
            : invite.status;

        tx.update(inviteRef, {
          spectatorIds: updatedSpectatorIds,
          spectatorSummaries: updatedSpectatorSummaries,
          status: newStatus,
          updatedAt: admin.firestore.Timestamp.now(),
        });

        return { alreadyJoined: false, role: "spectator" };
      } else {
        // Player join
        if (invite.participantIds.includes(uid)) {
          return { alreadyJoined: true, role: "player" };
        }

        if (invite.participantIds.length >= invite.maxPlayers) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Lobby is full.",
          );
        }

        if (invite.participantIds.length >= MAX_PLAYERS) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Maximum player limit reached.",
          );
        }

        const updatedParticipantIds = [...invite.participantIds, uid];
        const updatedParticipantSummaries = [
          ...(invite.participantSummaries ?? []),
          joinerSummary,
        ];
        const newStatus =
          invite.status === "sent" && canTransitionInviteStatus("sent", "lobby")
            ? "lobby"
            : invite.status;

        tx.update(inviteRef, {
          participantIds: updatedParticipantIds,
          participantSummaries: updatedParticipantSummaries,
          status: newStatus,
          updatedAt: admin.firestore.Timestamp.now(),
        });

        return { alreadyJoined: false, role: "player" };
      }
    });
    trace.mark("tx_committed");

    // PERF: Fire notification async — don't block the join response.
    if (!result.alreadyJoined && result.role === "player") {
      notifyPlayerJoinedLobby(
        invitePre,
        joinerProfile?.displayName ?? "Someone",
      ).catch((err) =>
        console.error("[gamesV4] Failed to notify lobby join:", err),
      );
    }

    console.log(`[gamesV4] ${uid} joined invite ${inviteId} as ${result.role}`);
    trace.end();

    return { success: true, role: result.role };
  },
);

// =============================================================================
// Callable: updateLobbySettingsV4
// =============================================================================

export const updateLobbySettingsV4 = secureCallableRuntime().https.onCall(
  async (data, context) => {
    const uid = assertAuth(context);
    const { inviteId, settingsPatch } = data as {
      inviteId: string;
      settingsPatch: Record<string, unknown>;
    };

    if (!inviteId || typeof inviteId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "inviteId is required.",
      );
    }

    if (!settingsPatch || typeof settingsPatch !== "object") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "settingsPatch must be an object.",
      );
    }

    // Sanitise user-provided settings to cap depth/size
    const sanitised = sanitisePayload(settingsPatch) as Record<string, unknown>;

    const db = getDb();
    const inviteRef = db.collection(COLLECTIONS.GAME_INVITES).doc(inviteId);

    const validatedSettings = await db.runTransaction(async (tx) => {
      const snap = await tx.get(inviteRef);
      if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Invite not found.");
      }

      const invite = snap.data() as GameInviteV4;

      // Host-only
      if (invite.hostId !== uid) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Only the host can update lobby settings.",
        );
      }

      // Must be in Lobby or Sent status
      if (invite.status !== "sent" && invite.status !== "lobby") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Cannot update settings in status '${invite.status}'.`,
        );
      }

      // Validate against adapter's settingsSchema if available
      const adapter = getAdapter(invite.gameId);
      let finalSettings: Record<string, unknown>;

      if (adapter?.validateSettings) {
        try {
          finalSettings = adapter.validateSettings(sanitised);
        } catch (err) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            `Invalid settings: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } else if (adapter?.defaultSettings) {
        // No validateSettings but has defaults — merge with whitelisting
        const defaults = adapter.defaultSettings as Record<string, unknown>;
        finalSettings = { ...defaults };
        for (const key of Object.keys(defaults)) {
          if (key in sanitised) {
            finalSettings[key] = sanitised[key];
          }
        }
      } else {
        // No adapter or no defaults — store sanitised patch as-is
        finalSettings = sanitised;
      }

      // Persist settings on the invite doc so all lobby participants
      // can see the current configuration in real-time.
      tx.update(inviteRef, {
        lobbySettings: finalSettings,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      return finalSettings;
    });

    console.log(
      `[gamesV4] Host ${uid} updated settings for invite ${inviteId}:`,
      JSON.stringify(validatedSettings).slice(0, 200),
    );
    return { success: true, settings: validatedSettings };
  },
);

// =============================================================================
// Callable: startGameFromInviteV4
// =============================================================================

export const startGameFromInviteV4 = secureCallableRuntime().https.onCall(
  async (data, context) => {
    const uid = assertAuth(context);
    const trace = startServerTrace("startGameV4", uid);

    const raw = data as Record<string, unknown>;
    const { inviteId } = raw as {
      inviteId: string;
      settings?: Record<string, unknown>;
    };
    // Sanitise user-provided settings to cap depth/size
    const settings = raw.settings
      ? (sanitisePayload(raw.settings) as Record<string, unknown>)
      : undefined;

    if (!inviteId || typeof inviteId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "inviteId is required.",
      );
    }

    const db = getDb();
    const inviteRef = db.collection(COLLECTIONS.GAME_INVITES).doc(inviteId);

    // ─── Pre-read: fetch invite + profiles before transaction ──────
    trace.mark("pre_reads_start");
    const invitePreSnap = await inviteRef.get();
    trace.mark("pre_reads_done");

    if (!invitePreSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Invite not found.");
    }
    const invitePre = invitePreSnap.data() as GameInviteV4;

    if (invitePre.hostId !== uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only the host can start the game.",
      );
    }

    if (invitePre.status === "active" && invitePre.sessionId) {
      trace.end();
      return { sessionId: invitePre.sessionId };
    }

    await enforceCooldown(db, uid, "startGameV4", COOLDOWNS.START_GAME);

    // ─── Implemented-game gating ──────────────────────────────────
    // Reject start for games without a server-side adapter/implementation.
    if (!hasAdapter(invitePre.gameId)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `"${invitePre.gameId}" is not yet playable. Coming soon!`,
      );
    }

    // Batch-fetch profiles OUTSIDE the transaction to avoid holding the
    // transaction open for N external reads. Safe because profiles are
    // essentially immutable during the short start-game window.
    const profileMap = new Map<
      string,
      {
        displayName: string;
        avatarConfig?: Record<string, unknown>;
        profilePictureUrl?: string | null;
        decorationId?: string | null;
      }
    >();
    await Promise.all(
      invitePre.participantIds.map(async (pUid) => {
        const profile = await getUserProfile(pUid);
        if (profile) {
          profileMap.set(pUid, profile);
        }
      }),
    );

    // Generate a traceId early so it's available in error handlers
    const startTraceId = generateTraceId();

    try {
      // ─── Transaction: validate + create session + update invite ──────
      trace.mark("tx_start");
      const sessionId = await db.runTransaction(async (tx) => {
        const inviteSnap = await tx.get(inviteRef);
        if (!inviteSnap.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            "Invite not found.",
          );
        }

        const invite = inviteSnap.data() as GameInviteV4;

        // Host-only
        if (invite.hostId !== uid) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "Only the host can start the game.",
          );
        }

        if (invite.status === "active" && invite.sessionId) {
          return invite.sessionId;
        }

        // Must be in sent or lobby status
        if (invite.status !== "sent" && invite.status !== "lobby") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `Cannot start game from status '${invite.status}'.`,
          );
        }

        // Check minimum players
        const minRequired = invitePre.runtimeType === "solo" ? 1 : 2;
        if (invite.participantIds.length < minRequired) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `Need at least ${minRequired} player(s) to start.`,
          );
        }

        // Generate session ID
        const sessionRef = db.collection(COLLECTIONS.GAME_SESSIONS).doc();
        const sId = sessionRef.id;
        const now = admin.firestore.Timestamp.now();
        const traceId = generateTraceId();

        const players: PlayerSlot[] = invite.participantIds.map((pUid, idx) => {
          const profile = profileMap.get(pUid);
          const slot: PlayerSlot = {
            uid: pUid,
            slotIndex: idx,
            displayName: profile?.displayName ?? "Player",
            profilePictureUrl: profile?.profilePictureUrl ?? null,
            decorationId: profile?.decorationId ?? null,
          };
          // Only include avatarConfig when defined — Firestore rejects `undefined`.
          if (profile?.avatarConfig) slot.avatarConfig = profile.avatarConfig;
          return slot;
        });

        // Determine turn order (random shuffle for fairness)
        const turnOrder = shuffleArray([...invite.participantIds]);
        const firstPlayer = turnOrder[0];

        // Build initial scoreboard summary
        const scoreboardSummary: ScoreSummaryEntry[] = players.map((p) => ({
          uid: p.uid,
          displayName: p.displayName ?? "Player",
          score: 0,
        }));

        // Build spectator data
        const spectators = invite.spectatorIds.map((sUid) => ({
          uid: sUid,
          joinedAt: now,
        }));

        // Create session document
        const session: GameSessionV4 = {
          sessionId: sId,
          inviteId: invite.inviteId,
          conversationId: invite.conversationId,
          conversationScope: invite.conversationScope,
          gameId: invite.gameId,
          runtimeType: invite.runtimeType,
          status: "active",
          hostId: invite.hostId,
          players,
          spectatorsAllowed: invite.allowSpectators,
          spectateMode: invite.spectateMode,
          spectators,
          settings:
            settings ??
            ((invite as unknown as Record<string, unknown>).lobbySettings as
              | Record<string, unknown>
              | undefined) ??
            ({} as Record<string, unknown>),
          turnOrder,
          currentTurnIndex: 0,
          currentTurnPlayerId:
            invite.runtimeType === "turnBased" ? firstPlayer : null,
          scoreboardSummary,
          createdAt: now,
          startedAt: now,
          resolvedAt: null,
          resolution: null,
          integrity: {
            version: 1,
            schemaVersion: 1,
            traceId,
          },
          rewardsProcessed: false,
          participantUids: [...invite.participantIds],
          spectatorUids: [...invite.spectatorIds],
        };

        // Create initial public state subcollection doc (adapter-driven)
        const publicStateRef = sessionRef
          .collection(COLLECTIONS.PUBLIC_STATE)
          .doc("state");

        let initialPublicState: Record<string, unknown> = {};
        if (hasAdapter(invite.gameId)) {
          // Use the resolved session settings (which already include
          // lobbySettings fallback) for adapter initialization.
          const effectiveSettings = session.settings as Record<string, unknown>;
          const initResult = createInitialState(
            invite.gameId,
            players.map((p) => ({ uid: p.uid, slotIndex: p.slotIndex })),
            effectiveSettings,
          );
          initialPublicState = initResult.publicState;

          // If the adapter specifies a first-turn player (e.g. team-based
          // games like Dead Drop where the active spymaster is determined
          // by adapter logic, not by round-robin turnOrder), prefer it over
          // the generic shuffled firstPlayer.
          const adapterFirstPlayer = initialPublicState.currentTurnPlayerId as
            | string
            | undefined;
          if (adapterFirstPlayer && adapterFirstPlayer !== firstPlayer) {
            console.log(
              `[gamesV4] Adapter overrides firstPlayer: ${firstPlayer} → ${adapterFirstPlayer} (game: ${invite.gameId})`,
            );
            session.currentTurnPlayerId = adapterFirstPlayer;
            const patchIdx = session.turnOrder.indexOf(adapterFirstPlayer);
            if (patchIdx !== -1) session.currentTurnIndex = patchIdx;
          }

          // Write per-player private state docs if produced
          for (const [pUid, privState] of Object.entries(
            initResult.privateStateByPlayer,
          )) {
            const privRef = sessionRef
              .collection(COLLECTIONS.PRIVATE_STATE)
              .doc(pUid);
            tx.set(privRef, privState);
          }
        }

        // Write session AFTER adapter init so currentTurnPlayerId is correct
        tx.set(sessionRef, session);

        tx.set(publicStateRef, {
          ...initialPublicState,
          _meta: {
            gameId: invite.gameId,
            version: 1,
            updatedAt: now,
          },
        });

        // Transition invite → active
        tx.update(inviteRef, {
          status: "active",
          sessionId: sId,
          updatedAt: now,
          "summary.phase": "active",
          "summary.turnPlayerId":
            invite.runtimeType === "turnBased"
              ? session.currentTurnPlayerId
              : null,
        });

        return sId;
      });
      trace.mark("tx_committed");

      console.log(
        `[gamesV4] Game started: session ${sessionId} from invite ${inviteId} by host ${uid} (trace: ${startTraceId})`,
      );
      trace.end();

      return { sessionId };
    } catch (err) {
      // Re-throw typed HttpsErrors as-is (client can parse code/message)
      if (err instanceof functions.https.HttpsError) throw err;

      // Unexpected error — log full details, return a safe message + traceId
      console.error(
        `[gamesV4] startGameFromInviteV4 UNEXPECTED ERROR (trace: ${startTraceId}):`,
        err,
      );
      throw new functions.https.HttpsError(
        "internal",
        "Unexpected server error. Please try again.",
        { traceId: startTraceId },
      );
    }
  },
);

// =============================================================================
// Callable: leaveInviteLobbyV4
// =============================================================================

export const leaveInviteLobbyV4 = secureCallableRuntime().https.onCall(
  async (data, context) => {
    const uid = assertAuth(context);
    const { inviteId } = data as { inviteId: string };

    if (!inviteId || typeof inviteId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "inviteId is required.",
      );
    }

    const db = getDb();

    // Rate-limit
    await enforceCooldown(db, uid, "leaveLobbyV4", COOLDOWNS.LEAVE_LOBBY);

    const inviteRef = db.collection(COLLECTIONS.GAME_INVITES).doc(inviteId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(inviteRef);
      if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Invite not found.");
      }

      const invite = snap.data() as GameInviteV4;

      // Can only leave from pre-game statuses
      if (invite.status !== "sent" && invite.status !== "lobby") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Cannot leave after the game has started.",
        );
      }

      // Host cannot leave — they should cancel instead
      if (invite.hostId === uid) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "The host cannot leave. Cancel the invite instead.",
        );
      }

      const isPlayer = invite.participantIds.includes(uid);
      const isSpectator = invite.spectatorIds.includes(uid);

      if (!isPlayer && !isSpectator) {
        return; // Not in lobby — idempotent
      }

      const updates: Record<string, unknown> = {
        updatedAt: admin.firestore.Timestamp.now(),
      };

      if (isPlayer) {
        updates.participantIds = invite.participantIds.filter(
          (id) => id !== uid,
        );
        updates.participantSummaries = (
          invite.participantSummaries ?? []
        ).filter((s) => s.uid !== uid);
      }

      if (isSpectator) {
        updates.spectatorIds = invite.spectatorIds.filter((id) => id !== uid);
        updates.spectatorSummaries = (invite.spectatorSummaries ?? []).filter(
          (s) => s.uid !== uid,
        );
      }

      tx.update(inviteRef, updates);
    });

    console.log(`[gamesV4] ${uid} left invite ${inviteId}`);
    return { success: true };
  },
);

// =============================================================================
// Callable: cancelGameInviteV4
// =============================================================================

export const cancelGameInviteV4 = secureCallableRuntime().https.onCall(
  async (data, context) => {
    const uid = assertAuth(context);
    const { inviteId } = data as { inviteId: string };

    if (!inviteId || typeof inviteId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "inviteId is required.",
      );
    }

    const db = getDb();

    // Rate-limit
    await enforceCooldown(db, uid, "cancelInviteV4", COOLDOWNS.CANCEL_INVITE);

    const inviteRef = db.collection(COLLECTIONS.GAME_INVITES).doc(inviteId);

    const invite = await db.runTransaction(async (tx) => {
      const snap = await tx.get(inviteRef);
      if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Invite not found.");
      }

      const inv = snap.data() as GameInviteV4;

      // Only host can cancel
      if (inv.hostId !== uid) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Only the host can cancel an invite.",
        );
      }

      // Can only cancel from pre-game statuses
      if (inv.status !== "sent" && inv.status !== "lobby") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Cannot cancel an invite that is already active or resolved.",
        );
      }

      const now = admin.firestore.Timestamp.now();

      tx.update(inviteRef, {
        status: "resolved",
        updatedAt: now,
        "summary.phase": "resolved",
        deleteRequestedAt: now,
        deleteAt: admin.firestore.Timestamp.fromMillis(
          now.toMillis() + RESOLVED_INVITE_TTL_MS,
        ),
      });

      return inv;
    });

    // Unpin from conversation (outside transaction — idempotent)
    try {
      await unpinInviteFromConversation(
        invite.conversationId,
        invite.conversationScope,
        inviteId,
      );
    } catch (err) {
      console.error("[gamesV4] Failed to unpin cancelled invite:", err);
    }

    console.log(`[gamesV4] Host ${uid} cancelled invite ${inviteId}`);
    return { success: true };
  },
);

// =============================================================================
// Utility: Shuffle array (Fisher-Yates)
// =============================================================================

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
