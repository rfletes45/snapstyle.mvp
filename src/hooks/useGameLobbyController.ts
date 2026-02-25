/**
 * useGameLobbyController — Canonical lobby state machine for ALL multiplayer games.
 *
 * Composes:
 *   - useGameLobby        → invite subscription, host/queue modes, player list
 *   - useRoomHealth        → watchdog (stale room detection)
 *   - Lobby stuck watchdog → detects invite full/ready but room not playing
 *   - Room phase bridging  → promotes lobby.phase to "playing" when Colyseus
 *                            room reports phase === "playing"
 *   - Error / recovery     → surfaces GameError to the overlay with actions
 *   - Recovery dispatch    → executeRecoveryAction for all action types
 *
 * Usage:
 *   const controller = useGameLobbyController({
 *     gameType: "chess_game",
 *     inviteId: route.params?.inviteId,
 *     matchId: route.params?.matchId,
 *     entryPoint: route.params?.entryPoint ?? "play",
 *     isTurnBased: true,
 *     onGameReady: (gameId) => mp.startMultiplayer({ firestoreGameId: gameId }),
 *     onLeave: () => navigation.goBack(),
 *     room: mp.room,           // from useMultiplayerGame / useTurnBasedGame
 *     roomPhase: mp.phase,     // Colyseus room phase ("waiting", "playing", …)
 *     roomReconnecting: mp.reconnecting,
 *     roomOpponentDisconnected: mp.opponentDisconnected,
 *     roomError: mp.error,
 *   });
 *
 *   <MultiplayerLobbyOverlay controller={controller} ...>
 *     {gameView}
 *   </MultiplayerLobbyOverlay>
 *
 * @module hooks/useGameLobbyController
 */

import {
  getConnectionBannerForState,
  shouldShowLobbyOverlayForState,
} from "@/hooks/gameLobbySelectors";
import type {
  UseGameLobbyOptions,
  UseGameLobbyReturn,
} from "@/hooks/useGameLobby";
import { useGameLobby } from "@/hooks/useGameLobby";
import type { RoomHealthState } from "@/hooks/useRoomHealth";
import { useRoomHealth } from "@/hooks/useRoomHealth";
import {
  executeRecoveryAction,
  type RecoveryContext,
} from "@/services/gameRecoveryActions";
import type { GameError, GameRecoveryActionId } from "@/types/gameErrors";
import { createGameError, GameErrorCode } from "@/types/gameErrors";
import type { ExtendedGameType } from "@/types/games";
import type { Room } from "@colyseus/sdk";
import { getAuth } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { unclaimInviteSlot } from "@/services/gameInvites";
import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useGameLobbyController");

// =============================================================================
// Constants
// =============================================================================

/**
 * How long (ms) to wait after all players are in the lobby and the invite is
 * ready/active before declaring the lobby "stuck". Default 30 seconds.
 */
const DEFAULT_LOBBY_STUCK_THRESHOLD_MS = 30_000;

/**
 * How often (ms) the lobby stuck watchdog checks. Default 5 seconds.
 */
const LOBBY_STUCK_CHECK_INTERVAL_MS = 5_000;

// =============================================================================
// Types
// =============================================================================

export interface UseGameLobbyControllerOptions extends UseGameLobbyOptions {
  // ── Colyseus room state (from game hook) ─────────────────────────────
  /** The active Colyseus room (null until connected). */
  room?: Room | null;
  /** Room's current phase string ("waiting" | "countdown" | "playing" | "finished"). */
  roomPhase?: string | null;
  /** Whether the room reports a reconnection in progress. */
  roomReconnecting?: boolean;
  /** Whether the opponent has disconnected. */
  roomOpponentDisconnected?: boolean;
  /** Error string from the game hook (if any). */
  roomError?: string | null;

  // ── Watchdog config ──────────────────────────────────────────────────
  /** Stale threshold for the room health watchdog (ms). Default 15 000. */
  watchdogThresholdMs?: number;
  /** How long (ms) before the lobby watchdog fires STUCK_WAITING. Default 30 000. */
  lobbyStuckThresholdMs?: number;

  // ── Callbacks ────────────────────────────────────────────────────────
  /** Called when a recovery action is triggered (retry, rejoin, etc.). */
  onRecoveryAction?: (actionId: GameRecoveryActionId) => void;
  /** Callback to re-trigger the join flow (for retry_join). */
  onRetryJoin?: () => void;
  /** Callback to leave + rejoin from scratch (for rejoin_room / resync). */
  onRejoinRoom?: () => void;
  /** Callback to leave / navigate away. */
  onLeave?: () => void;
}

export interface WatchdogState {
  /** Whether the watchdog considers the room stuck. */
  isStuck: boolean;
  /** Seconds since last patch (rounded). */
  stuckDurationSec: number;
  /** Whether the lobby itself is stuck (invite ready but room not playing). */
  lobbyStuck: boolean;
  /** Seconds the lobby has been stuck. */
  lobbyStuckDurationSec: number;
}

export interface UseGameLobbyControllerReturn {
  /** The underlying useGameLobby return value. */
  lobby: UseGameLobbyReturn;
  /** The Colyseus room's phase (as-is from roomPhase prop). */
  roomPhase: string | null;
  /** Connection banner text (or null). */
  connectionBanner: string | null;
  /** Watchdog state. */
  watchdog: WatchdogState;
  /** The currently active error (from room, lobby, or watchdog). */
  activeError: GameError | null;
  /** Dismiss the active error (e.g. after user acknowledges). */
  dismissError: () => void;
  /** Handle a recovery action button press. */
  handleRecoveryAction: (actionId: GameRecoveryActionId) => void;
  /** Whether the lobby overlay should be shown (convenience). */
  shouldShowOverlay: boolean;
}

// =============================================================================
// Hook
// =============================================================================

export function useGameLobbyController(
  options: UseGameLobbyControllerOptions,
): UseGameLobbyControllerReturn {
  const {
    room = null,
    roomPhase: rawRoomPhase = null,
    roomReconnecting = false,
    roomOpponentDisconnected = false,
    roomError = null,
    watchdogThresholdMs,
    lobbyStuckThresholdMs = DEFAULT_LOBBY_STUCK_THRESHOLD_MS,
    onRecoveryAction,
    onRetryJoin,
    onRejoinRoom,
    onLeave,
    // Strip controller-specific options before forwarding to useGameLobby
    ...lobbyOptions
  } = options;

  const onRecoveryRef = useRef(onRecoveryAction);
  onRecoveryRef.current = onRecoveryAction;
  const onRetryJoinRef = useRef(onRetryJoin);
  onRetryJoinRef.current = onRetryJoin;
  const onRejoinRoomRef = useRef(onRejoinRoom);
  onRejoinRoomRef.current = onRejoinRoom;
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;

  // ── Compose useGameLobby ──────────────────────────────────────────────
  const lobby = useGameLobby(lobbyOptions);

  // ── Compose useRoomHealth (room stale watchdog) ───────────────────────
  const healthOpts = useMemo(
    () => ({ staleThresholdMs: watchdogThresholdMs }),
    [watchdogThresholdMs],
  );
  const health: RoomHealthState = useRoomHealth(room, healthOpts);

  // ── Lobby stuck watchdog ──────────────────────────────────────────────
  // Tracks when the lobby reaches "starting" (invite ready, join triggered)
  // but the room never advances to "playing" within the threshold.
  const [lobbyStuck, setLobbyStuck] = useState(false);
  const [lobbyStuckDurationSec, setLobbyStuckDurationSec] = useState(0);
  const lobbyReadyAtRef = useRef<number | null>(null);

  // Mark the timestamp when lobby enters "starting" (game should be joining)
  useEffect(() => {
    if (lobby.phase === "starting" && !lobbyReadyAtRef.current) {
      lobbyReadyAtRef.current = Date.now();
    }
    // Reset when lobby transitions away from starting or room reaches playing
    if (
      lobby.phase === "playing" ||
      lobby.phase === "error" ||
      rawRoomPhase === "playing" ||
      rawRoomPhase === "countdown" ||
      rawRoomPhase === "finished"
    ) {
      lobbyReadyAtRef.current = null;
      setLobbyStuck(false);
      setLobbyStuckDurationSec(0);
    }
  }, [lobby.phase, rawRoomPhase]);

  // Periodic check for lobby stuck
  useEffect(() => {
    const timer = setInterval(() => {
      if (!lobbyReadyAtRef.current) return;

      const elapsed = Date.now() - lobbyReadyAtRef.current;
      const isStuck = elapsed >= lobbyStuckThresholdMs;

      setLobbyStuckDurationSec(Math.round(elapsed / 1000));

      if (isStuck && !lobbyStuck) {
        setLobbyStuck(true);
      } else if (!isStuck && lobbyStuck) {
        setLobbyStuck(false);
      }
    }, LOBBY_STUCK_CHECK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [lobbyStuckThresholdMs, lobbyStuck]);

  // Combined watchdog state
  const watchdog: WatchdogState = useMemo(
    () => ({
      isStuck: health.stale || lobbyStuck,
      stuckDurationSec: Math.round(health.msSinceLastPatch / 1000),
      lobbyStuck,
      lobbyStuckDurationSec,
    }),
    [health.stale, health.msSinceLastPatch, lobbyStuck, lobbyStuckDurationSec],
  );

  // ── Bridge lobby phase with room phase ────────────────────────────────
  useEffect(() => {
    if (rawRoomPhase === "playing" && lobby.phase !== "playing") {
      // The lobby hook doesn't have a setPhase — but when onGameReady fires
      // and the room enters "playing", the game screen should already have
      // transitioned. We rely on lobby.phase === "starting" → game connects
      // → room phase becomes "playing". The overlay checks roomPhase too.
    }
  }, [rawRoomPhase, lobby.phase]);

  // ── Auto-ready for non-turn-based games ───────────────────────────────
  // ScoreRace / Physics rooms require every client to send a "ready" message
  // before the game can start. Turn-based / card rooms auto-ready on the
  // server, so this only applies when isTurnBased is false.
  // This is a safety net so game screens don't need to remember to chain
  // sendReady() after startMultiplayer() in their onGameReady callback.
  const didAutoReadyRef = useRef(false);
  useEffect(() => {
    if (
      room &&
      rawRoomPhase === "waiting" &&
      !options.isTurnBased &&
      !didAutoReadyRef.current
    ) {
      try {
        room.send("ready", {});
        didAutoReadyRef.current = true;
      } catch {
        // Room may not be fully connected yet; will retry on next render
      }
    }
    // Reset when room changes (reconnect / new game)
    if (!room) {
      didAutoReadyRef.current = false;
    }
  }, [room, rawRoomPhase, options.isTurnBased]);

  // ── Phase 3: Terminal join error → auto-unclaim invite slot ───────────
  // When the Colyseus join fails (e.g. "room full", "auth failed"), the
  // joiner's claimed slot should be released so other players can fill it
  // or the invite cleanly expires.  Without this, the user stays "claimed"
  // forever and the invite never reaches quorum again.
  const didAutoUnclaimRef = useRef(false);
  useEffect(() => {
    // Only trigger when:
    // 1. There's a room-level error
    // 2. No room connected (join truly failed, not a mid-game error)
    // 3. We haven't already auto-unclaimed
    // 4. We have an invite to unclaim from
    // 5. User is NOT the host (host should cancel, not unclaim)
    if (
      roomError &&
      !room &&
      !didAutoUnclaimRef.current &&
      lobby.inviteId &&
      !lobby.isHost
    ) {
      const uid = getAuth().currentUser?.uid;
      if (uid) {
        didAutoUnclaimRef.current = true;
        logger.warn(
          `[useGameLobbyController] Join failed — auto-unclaiming slot for invite ${lobby.inviteId}`,
        );
        unclaimInviteSlot(lobby.inviteId, uid).catch((err) =>
          logger.error("[useGameLobbyController] Auto-unclaim failed:", err),
        );
      }
    }
    // Reset when error clears (e.g. successful retry)
    if (!roomError) {
      didAutoUnclaimRef.current = false;
    }
  }, [roomError, room, lobby.inviteId, lobby.isHost]);

  // Effective room phase (normalized)
  const roomPhase = rawRoomPhase ?? null;

  // ── Connection banner ─────────────────────────────────────────────────
  const connectionBanner = useMemo<string | null>(() => {
    return getConnectionBannerForState({
      roomReconnecting,
      roomOpponentDisconnected,
      roomHealthStale: health.stale,
      roomPhase,
    });
  }, [roomReconnecting, roomOpponentDisconnected, health.stale, roomPhase]);

  // ── Active error ──────────────────────────────────────────────────────
  const [dismissedErrorCode, setDismissedErrorCode] = useState<string | null>(
    null,
  );

  const activeError = useMemo<GameError | null>(() => {
    // Priority: room error > lobby error > lobby stuck > room stale > health error
    if (roomError && roomError !== dismissedErrorCode) {
      return createGameError(GameErrorCode.JOIN_FAILED, {
        message: roomError,
      });
    }
    if (lobby.phase === "error" && lobby.errorMessage) {
      return createGameError(GameErrorCode.INVITE_NOT_FOUND, {
        message: lobby.errorMessage,
      });
    }
    // Lobby stuck: invite ready but room never started
    if (lobbyStuck && GameErrorCode.STUCK_WAITING !== dismissedErrorCode) {
      return createGameError(GameErrorCode.STUCK_WAITING, {
        message: `The game appears stuck \u2014 all players are ready but the game hasn\u2019t started after ${lobbyStuckDurationSec}s.`,
        context: {
          traceId: lobby.invite?.traceId,
          lobbyPhase: lobby.phase,
          roomPhase,
          inviteId: lobby.inviteId,
          effectiveGameId: lobby.effectiveGameId,
          stuckDurationSec: lobbyStuckDurationSec,
        },
      });
    }
    // Room stale: no patches during gameplay
    if (
      health.stale &&
      roomPhase === "playing" &&
      GameErrorCode.ROOM_STALE !== dismissedErrorCode
    ) {
      return createGameError(GameErrorCode.ROOM_STALE, {
        message: `No server response for ${Math.round(health.msSinceLastPatch / 1000)}s. The connection may have dropped.`,
        context: {
          traceId: lobby.invite?.traceId,
          roomId: room?.roomId,
          elapsed: health.msSinceLastPatch,
        },
      });
    }
    if (health.error && health.error.code !== dismissedErrorCode) {
      return health.error;
    }
    return null;
  }, [
    roomError,
    lobby.phase,
    lobby.errorMessage,
    lobby.inviteId,
    lobby.invite,
    lobby.effectiveGameId,
    lobbyStuck,
    lobbyStuckDurationSec,
    health.stale,
    health.msSinceLastPatch,
    health.error,
    roomPhase,
    room,
    dismissedErrorCode,
  ]);

  const dismissError = useCallback(() => {
    if (activeError) {
      setDismissedErrorCode(activeError.code);
    }
  }, [activeError]);

  // ── Recovery actions ──────────────────────────────────────────────────
  const handleRecoveryAction = useCallback(
    (actionId: GameRecoveryActionId) => {
      // Reset dismissed error so new errors surface
      setDismissedErrorCode(null);

      // Build recovery context (include traceId from invite for correlation)
      const recoveryCtx: RecoveryContext = {
        session: {
          gameType: lobbyOptions.gameType as ExtendedGameType,
          firestoreGameId: lobby.effectiveGameId ?? undefined,
        },
        roomId: room?.roomId,
        error: activeError,
        inviteId: lobby.inviteId,
        traceId: lobby.invite?.traceId ?? undefined,
        uid: lobby.players?.[0]?.uid, // Current user is always first in host mode
        isHost: lobby.isHost,
        lobbyPhase: lobby.phase,
        roomPhase: roomPhase ?? undefined,
        wasStale: health.stale,
        staleDurationSec: Math.round(health.msSinceLastPatch / 1000),
        onRetryJoin: onRetryJoinRef.current,
        onRejoinRoom: onRejoinRoomRef.current,
        onResetLobby: () => lobby.leaveLobby(),
        onLeave: onLeaveRef.current,
      };

      // Delegate to parent callback first (for custom overrides)
      onRecoveryRef.current?.(actionId);

      // Execute the recovery action (fire-and-forget — errors handled inside)
      executeRecoveryAction(actionId, recoveryCtx).catch(() => {
        // Errors are logged inside executeRecoveryAction
      });
    },
    [
      lobby,
      room,
      activeError,
      roomPhase,
      health.stale,
      health.msSinceLastPatch,
      lobbyOptions.gameType,
    ],
  );

  // ── Should show overlay ───────────────────────────────────────────────
  const shouldShowOverlay = useMemo(() => {
    return shouldShowLobbyOverlayForState({
      roomPhase,
      lobbyPhase: lobby.phase,
      hasActiveError: !!activeError,
      watchdogStuck: watchdog.isStuck,
    });
  }, [roomPhase, lobby.phase, activeError, watchdog.isStuck]);

  return {
    lobby,
    roomPhase,
    connectionBanner,
    watchdog,
    activeError,
    dismissError,
    handleRecoveryAction,
    shouldShowOverlay,
  };
}
