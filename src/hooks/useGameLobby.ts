/**
 * useGameLobby – Shared lobby/queue state management for ALL multiplayer games.
 *
 * This hook encapsulates the lobby pattern used by MiniGolfDuels and SketchParty
 * and makes it reusable across every multiplayer game screen.
 *
 * Two entry modes:
 *   1. **Host mode** (no inviteId, no matchId): generates a hostRoomKey,
 *      auto-joins the Colyseus room, enters "waiting" phase.
 *   2. **Queue mode** (has inviteId): subscribes to Firestore invite doc,
 *      waits for status → "active" + gameId, then joins the Colyseus room.
 *
 * @module hooks/useGameLobby
 */

import {
  cancelUniversalInvite,
  sendUniversalInvite,
  startGameEarly,
  subscribeToUniversalInvite,
  unclaimInviteSlot,
} from "@/services/gameInvites";
import { GAME_METADATA, type ExtendedGameType } from "@/types/games";
import type {
  SendUniversalInviteParams,
  UniversalGameInvite,
} from "@/types/turnBased";
import { createLogger } from "@/utils/log";
import { getAuth } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const logger = createLogger("hooks/useGameLobby");

// =============================================================================
// Types
// =============================================================================

export interface LobbyPlayer {
  uid: string;
  displayName: string;
  avatarUrl?: string;
  isHost: boolean;
  ready: boolean;
}

export interface GameLobbyState {
  /** Current lobby phase */
  phase:
    | "initializing"
    | "waiting"
    | "queue"
    | "countdown"
    | "starting"
    | "playing"
    | "error";
  /** Whether this user is the lobby host */
  isHost: boolean;
  /** Players currently in the lobby */
  players: LobbyPlayer[];
  /** Countdown value (3, 2, 1, 0) */
  countdown: number;
  /** Error message if phase === "error" */
  errorMessage: string | null;
  /** The resolved game/room ID to connect to Colyseus */
  effectiveGameId: string | null;
  /** Whether the lobby is in queue mode (waiting for invite resolution) */
  isQueueMode: boolean;
  /** The invite data (if in queue mode or after sending) */
  invite: UniversalGameInvite | null;
  /** The invite ID (used for queue subscription) */
  inviteId: string | null;
  /** Whether the user is a spectator */
  isSpectator: boolean;
}

export interface UseGameLobbyOptions {
  /** The game type key (e.g. "chess", "tic_tac_toe") */
  gameType: string;
  /** Route param: existing match/room ID to join */
  matchId?: string;
  /** Route param: invite ID to subscribe to */
  inviteId?: string;
  /** Route param: whether joining as spectator */
  spectator?: boolean;
  /** Route param: entry point for navigation */
  entryPoint?: string;
  /**
   * Callback when the lobby resolves a game ID and is ready for Colyseus join.
   * The game screen should call its Colyseus join logic here.
   */
  onGameReady?: (gameId: string) => void;
  /**
   * Callback when the user leaves the lobby (before Colyseus join).
   * The game screen should navigate away.
   */
  onLeaveLobby?: () => void;
  /**
   * Whether the game is turn-based (affects vacancy timer: 2 days vs 10 min).
   */
  isTurnBased?: boolean;
  /**
   * Room key prefix for host-generated IDs (e.g. "chess", "ttt", "c4").
   * Defaults to first 3 chars of gameType.
   */
  roomKeyPrefix?: string;
  /**
   * True when entering from the game recovery flow (crash/kill resume).
   * Skips unmount cleanup (cancel/unclaim) since the game is already active.
   */
  fromRecovery?: boolean;
}

export interface UseGameLobbyReturn extends GameLobbyState {
  /** Send a ready signal — game screens call this when the user presses "Ready" */
  sendReady: () => void;
  /** Start the game early (host only, when enough players) */
  startGame: () => Promise<void>;
  /** Leave the lobby/queue */
  leaveLobby: () => Promise<void>;
  /** Send an invite to a friend (DM context) */
  sendFriendInvite: (
    friendUid: string,
    friendName: string,
    friendAvatar?: string,
  ) => Promise<void>;
  /** Send an invite to a group */
  sendGroupInvite: (
    groupId: string,
    groupName: string,
    memberUids: string[],
  ) => Promise<void>;
  /** The hostRoomKey (for invite settings) */
  hostRoomKey: string | null;
  /** Whether the lobby has minimum players to start */
  canStart: boolean;
  /** Minimum players required */
  minPlayers: number;
}

// =============================================================================
// Hook
// =============================================================================

export function useGameLobby(options: UseGameLobbyOptions): UseGameLobbyReturn {
  const {
    gameType,
    matchId,
    inviteId: routeInviteId,
    spectator = false,
    entryPoint,
    onGameReady,
    onLeaveLobby,
    isTurnBased = false,
    roomKeyPrefix,
    fromRecovery = false,
  } = options;

  // ── Stable callback refs ───────────────────────────────────────────
  // Callbacks are stored in refs so that effects never re-fire when the
  // consumer passes an inline lambda (which is a new ref every render).
  // This prevents the infinite subscribe→setState→re-render→subscribe
  // loop that caused "Maximum update depth exceeded".
  const onGameReadyRef = useRef(onGameReady);
  onGameReadyRef.current = onGameReady;
  const onLeaveLobbyRef = useRef(onLeaveLobby);
  onLeaveLobbyRef.current = onLeaveLobby;

  // ── Refs for unmount cleanup (read latest values without triggering re-runs) ──
  const inviteIdRef = useRef<string | null>(null);
  const isHostRef = useRef(false);
  const uidRef = useRef("");

  // ── Auth ───────────────────────────────────────────────────────────────
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const uid = currentUser?.uid ?? "";
  uidRef.current = uid;
  const displayName =
    currentUser?.displayName || currentUser?.email || "Player";

  // ── Stable host room key (generated once) ─────────────────────────────
  const prefix = roomKeyPrefix || gameType.slice(0, 3);
  const [hostRoomKey] = useState<string | null>(() => {
    // If we have a matchId already, don't generate a new key
    if (matchId || routeInviteId) return null;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  });

  // ── Core state ─────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<GameLobbyState["phase"]>("initializing");
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [countdown, setCountdown] = useState(3);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invite, setInvite] = useState<UniversalGameInvite | null>(null);
  const [inviteId, setInviteId] = useState<string | null>(
    routeInviteId ?? null,
  );
  const [resolvedMatchId, setResolvedMatchId] = useState<string | null>(
    matchId ?? null,
  );
  const didJoinRef = useRef(false);

  // ── Derived state ──────────────────────────────────────────────────────
  const isQueueMode = !!routeInviteId && !matchId;
  const isHost = useMemo(() => {
    if (!invite) return !isQueueMode; // If no invite yet, host = whoever launched directly
    return invite.claimedSlots?.[0]?.playerId === uid;
  }, [invite, uid, isQueueMode]);

  // Keep cleanup refs in sync with latest values every render
  inviteIdRef.current = inviteId;
  isHostRef.current = isHost;

  const effectiveGameId = resolvedMatchId || hostRoomKey;

  const gameMeta = GAME_METADATA[gameType as ExtendedGameType];
  const minPlayers = gameMeta?.minPlayers ?? 2;
  const canStart = players.length >= minPlayers;

  // ── Queue mode: subscribe to invite doc ────────────────────────────────
  useEffect(() => {
    if (!isQueueMode || !routeInviteId) return;

    setPhase("queue");

    const unsubscribe = subscribeToUniversalInvite(routeInviteId, (inv) => {
      if (!inv) {
        setPhase("error");
        setErrorMessage("Invite not found or expired.");
        return;
      }

      setInvite(inv);

      // Map claimed slots to lobby players
      const lobbyPlayers: LobbyPlayer[] = (inv.claimedSlots || []).map(
        (slot: any) => ({
          uid: slot.playerId,
          displayName: slot.playerName || "Player",
          avatarUrl: slot.playerAvatar,
          isHost: slot.isHost === true,
          ready: false, // Ready state comes from Colyseus, not invite
        }),
      );
      setPlayers(lobbyPlayers);

      // Handle terminal states
      if (["cancelled", "expired", "declined"].includes(inv.status)) {
        setPhase("error");
        setErrorMessage(
          inv.status === "cancelled"
            ? "The host cancelled this invite."
            : inv.status === "expired"
              ? "This invite has expired."
              : "This invite was declined.",
        );
        return;
      }

      // Invite became active with a game ID → resolve and join
      if (inv.status === "active" && inv.gameId && !didJoinRef.current) {
        didJoinRef.current = true;
        // Always use inv.gameId as the firestoreGameId for Colyseus join.
        // For turn-based games this is the TurnBasedGames doc ID.
        // For external Colyseus games this is the ext_<type>_<inviteId> ID
        // set by the Cloud Function — critical for invite finalization
        // (Layer 1: deleteGameAndInvite needs the ext_ format to extract
        // inviteId; Layer 2: processRealtimeGameCompletion needs it too).
        // The legacy colyseusRoomKey fallback is no longer used because it
        // produced a random key that broke all finalization layers.
        const resolvedId = inv.gameId;
        setResolvedMatchId(resolvedId);
        setPhase("starting");
        logger.info(
          `[useGameLobby] Invite resolved → joining room: ${resolvedId}`,
        );
        onGameReadyRef.current?.(resolvedId);
      }
    });

    return () => unsubscribe();
  }, [isQueueMode, routeInviteId, isTurnBased]);

  // ── Host mode: subscribe to invite doc after sending invite ────────────
  // Once the host sends an invite, we subscribe to that invite doc so we
  // can detect when the Cloud Function transitions it to "active" + gameId.
  // This mirrors the queue-mode subscription but for the host.
  useEffect(() => {
    // Only run for host who has sent an invite (inviteId set dynamically)
    if (isQueueMode) return; // Joiners use queue-mode sub above
    if (!inviteId || inviteId === routeInviteId) return; // No invite sent yet, or came from route
    if (didJoinRef.current) return;

    logger.info(`[useGameLobby] Host subscribing to invite: ${inviteId}`);

    const unsubscribe = subscribeToUniversalInvite(inviteId, (inv) => {
      if (!inv) return;

      setInvite(inv);

      // Update players list from claimed slots
      const lobbyPlayers: LobbyPlayer[] = (inv.claimedSlots || []).map(
        (slot: any) => ({
          uid: slot.playerId,
          displayName: slot.playerName || "Player",
          avatarUrl: slot.playerAvatar,
          isHost: slot.isHost === true,
          ready: false,
        }),
      );
      setPlayers(lobbyPlayers);

      // Invite resolved → Cloud Function created the game
      if (inv.status === "active" && inv.gameId && !didJoinRef.current) {
        didJoinRef.current = true;
        // Always use inv.gameId — see queue-mode comment for rationale.
        const resolvedId = inv.gameId;
        setResolvedMatchId(resolvedId);
        setPhase("starting");
        logger.info(
          `[useGameLobby] Host invite resolved → joining room: ${resolvedId}`,
        );
        onGameReadyRef.current?.(resolvedId);
      }
    });

    return () => unsubscribe();
  }, [inviteId, routeInviteId, isQueueMode, isTurnBased]);

  // ── Host mode: set up immediately ──────────────────────────────────────
  useEffect(() => {
    if (isQueueMode || spectator) return;
    if (!hostRoomKey && !matchId) return;

    // If we have a matchId (direct join / resume), go straight to starting
    if (matchId) {
      setPhase("starting");
      onGameReadyRef.current?.(matchId);
      return;
    }

    // Host mode: waiting for players
    setPhase("waiting");
    setPlayers([
      {
        uid,
        displayName,
        isHost: true,
        ready: false,
      },
    ]);
  }, [hostRoomKey, matchId, isQueueMode, spectator, uid, displayName]);

  // ── Unmount cleanup: cancel (host) or unclaim (joiner) the invite ─────
  // Uses refs so the cleanup ONLY fires on true unmount — not when
  // inviteId/isHost change mid-render (which was causing premature cancellation).
  useEffect(() => {
    return () => {
      // Don't clean up if the game already started
      if (didJoinRef.current) return;

      // Don't clean up if we entered from recovery — the game is active
      // and the user simply navigated away from the recovery screen.
      if (fromRecovery) return;

      const targetInviteId = inviteIdRef.current || routeInviteId;
      const currentUid = uidRef.current;
      if (!targetInviteId || !currentUid) return;

      // Fire-and-forget — we're unmounting so we can't await
      if (isHostRef.current) {
        cancelUniversalInvite(targetInviteId, currentUid).catch((err) =>
          logger.warn("[useGameLobby] Unmount: error cancelling invite:", err),
        );
      } else {
        unclaimInviteSlot(targetInviteId, currentUid).catch((err) =>
          logger.warn("[useGameLobby] Unmount: error unclaiming slot:", err),
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeInviteId, fromRecovery]);

  // ── Actions ────────────────────────────────────────────────────────────

  const sendReady = useCallback(() => {
    // This is a no-op at the lobby level — the actual "ready" message
    // is sent to the Colyseus room by the game-specific hook.
    // The lobby updates when Colyseus state syncs back.
    logger.info("[useGameLobby] sendReady (delegated to Colyseus hook)");
  }, []);

  const startGame = useCallback(async () => {
    if (!inviteId && !routeInviteId) {
      // Host mode without invite — game is already ready via Colyseus
      logger.info(
        "[useGameLobby] startGame: host mode, already in Colyseus room",
      );
      return;
    }

    const targetInviteId = inviteId || routeInviteId;
    if (!targetInviteId || !uid) return;

    try {
      setPhase("starting");
      const result = await startGameEarly(targetInviteId, uid);
      if (!result.success) {
        setPhase("error");
        setErrorMessage(result.error || "Failed to start game.");
      }
      // The invite subscription will pick up the status change and call onGameReady
    } catch (err: any) {
      setPhase("error");
      setErrorMessage(err.message || "Failed to start game.");
    }
  }, [inviteId, routeInviteId, uid]);

  const leaveLobby = useCallback(async () => {
    const targetInviteId = inviteId || routeInviteId;
    if (targetInviteId && uid) {
      try {
        if (isHost) {
          // Host leaving cancels the invite for everyone
          await cancelUniversalInvite(targetInviteId, uid);
          logger.info(
            `[useGameLobby] Host cancelled invite on leave: ${targetInviteId}`,
          );
        } else {
          await unclaimInviteSlot(targetInviteId, uid);
        }
      } catch (err) {
        logger.warn("[useGameLobby] Error cleaning up invite on leave:", err);
      }
    }
    onLeaveLobbyRef.current?.();
  }, [inviteId, routeInviteId, uid, isHost]);

  const sendFriendInvite = useCallback(
    async (friendUid: string, friendName: string, friendAvatar?: string) => {
      if (!uid || !effectiveGameId) return;

      try {
        const result = await sendUniversalInvite({
          senderId: uid,
          senderName: displayName,
          gameType: gameType as SendUniversalInviteParams["gameType"],
          context: "dm",
          recipientId: friendUid,
          recipientName: friendName,
          recipientAvatar: friendAvatar,
          conversationId: [uid, friendUid].sort().join("_"),
          settings: {
            isRated: true,
            chatEnabled: true,
            colyseusRoomKey: effectiveGameId,
          },
        });
        if (result?.id) {
          setInviteId(result.id);
          setInvite(result);
        }
      } catch (err) {
        logger.error("[useGameLobby] Error sending friend invite:", err);
      }
    },
    [uid, displayName, gameType, effectiveGameId],
  );

  const sendGroupInvite = useCallback(
    async (groupId: string, groupName: string, memberUids: string[]) => {
      if (!uid || !effectiveGameId) return;

      try {
        const result = await sendUniversalInvite({
          senderId: uid,
          senderName: displayName,
          gameType: gameType as SendUniversalInviteParams["gameType"],
          context: "group",
          conversationId: groupId,
          conversationName: groupName,
          eligibleUserIds: [...new Set([uid, ...memberUids])],
          settings: {
            isRated: true,
            chatEnabled: true,
            colyseusRoomKey: effectiveGameId,
          },
        });
        if (result?.id) {
          setInviteId(result.id);
          setInvite(result);
        }
      } catch (err) {
        logger.error("[useGameLobby] Error sending group invite:", err);
      }
    },
    [uid, displayName, gameType, effectiveGameId],
  );

  return {
    // State
    phase,
    isHost,
    players,
    countdown,
    errorMessage,
    effectiveGameId,
    isQueueMode,
    invite,
    inviteId,
    isSpectator: spectator,
    // Actions
    sendReady,
    startGame,
    leaveLobby,
    sendFriendInvite,
    sendGroupInvite,
    hostRoomKey,
    canStart,
    minPlayers,
  };
}
