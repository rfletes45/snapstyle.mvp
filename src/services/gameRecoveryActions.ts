/**
 * Game Recovery Actions
 *
 * Implements the concrete backend operations behind each GameRecoveryActionId.
 * Called by useGameLobbyController.handleRecoveryAction after the UI button press.
 *
 * Each action receives a context bag and performs the actual mutation
 * (re-join room, cancel invite, submit bug report, etc.).
 *
 * @module services/gameRecoveryActions
 */

import { submitBugReport, type BugReportContext } from "@/services/bugReports";
import { colyseusService } from "@/services/colyseus";
import { cancelUniversalInvite } from "@/services/gameInvites";
import type { GameError, GameRecoveryActionId } from "@/types/gameErrors";
import type { GameSessionContext } from "@/types/gameSession";
import { createLogger } from "@/utils/log";
import { Alert } from "react-native";

const logger = createLogger("services/gameRecoveryActions");

// =============================================================================
// Types
// =============================================================================

export interface RecoveryContext {
  /** Game session context (gameType, firestoreGameId, etc.) */
  session?: Partial<GameSessionContext>;
  /** Colyseus room ID (if connected) */
  roomId?: string;
  /** The active error that triggered recovery */
  error?: GameError | null;
  /** Invite ID */
  inviteId?: string | null;
  /** Current user UID */
  uid?: string;
  /** Whether this user is the host */
  isHost?: boolean;
  /** Lobby phase */
  lobbyPhase?: string;
  /** Room phase */
  roomPhase?: string | null;
  /** Watchdog stale state */
  wasStale?: boolean;
  staleDurationSec?: number;
  /** Trace ID for correlation */
  traceId?: string;
  /** Callback to re-trigger the join flow */
  onRetryJoin?: () => void;
  /** Callback to leave room + rejoin from scratch */
  onRejoinRoom?: () => void;
  /** Callback to reset lobby state */
  onResetLobby?: () => void;
  /** Callback to switch transport mode */
  onSwitchMode?: () => void;
  /** Callback to leave / navigate away */
  onLeave?: () => void;
}

// =============================================================================
// Executor
// =============================================================================

/**
 * Execute a recovery action.
 *
 * This is the single dispatch point for all recovery actions.
 * Each action either calls a backend service or delegates to a callback.
 *
 * @returns true if the action was handled, false if unknown
 */
export async function executeRecoveryAction(
  actionId: GameRecoveryActionId,
  ctx: RecoveryContext,
): Promise<boolean> {
  logger.info(`[Recovery] Executing: ${actionId}`, {
    gameType: ctx.session?.gameType,
    roomId: ctx.roomId,
    inviteId: ctx.inviteId,
  });

  switch (actionId) {
    case "retry_join":
      return handleRetryJoin(ctx);

    case "rejoin_room":
      return handleRejoinRoom(ctx);

    case "reset_lobby":
      return handleResetLobby(ctx);

    case "switch_mode":
      return handleSwitchMode(ctx);

    case "cancel_invite":
      return handleCancelInvite(ctx);

    case "report_bug":
      return handleReportBug(ctx);

    default:
      logger.warn(`[Recovery] Unknown action: ${actionId}`);
      return false;
  }
}

// =============================================================================
// Action Handlers
// =============================================================================

/**
 * retry_join — Re-run the join flow from scratch.
 */
async function handleRetryJoin(ctx: RecoveryContext): Promise<boolean> {
  if (ctx.onRetryJoin) {
    ctx.onRetryJoin();
    return true;
  }
  logger.warn("[Recovery] retry_join: no onRetryJoin callback provided");
  return false;
}

/**
 * rejoin_room — Hard leave the current room, then rejoin.
 * This is the "Resync" action for stale connections.
 */
async function handleRejoinRoom(ctx: RecoveryContext): Promise<boolean> {
  if (ctx.onRejoinRoom) {
    // Leave existing room first
    try {
      await colyseusService.leaveRoom();
    } catch {
      // Ignore errors — room may already be dead
    }
    ctx.onRejoinRoom();
    return true;
  }
  logger.warn("[Recovery] rejoin_room: no onRejoinRoom callback provided");
  return false;
}

/**
 * reset_lobby — Cancel the invite (if host) and reset to waiting state.
 * Non-hosts just leave.
 */
async function handleResetLobby(ctx: RecoveryContext): Promise<boolean> {
  // Leave any active room
  try {
    await colyseusService.leaveRoom();
  } catch {
    // Ignore
  }

  if (ctx.onResetLobby) {
    ctx.onResetLobby();
    return true;
  }
  logger.warn("[Recovery] reset_lobby: no onResetLobby callback provided");
  return false;
}

/**
 * switch_mode — Switch transport (e.g. Colyseus → Firestore for turn-based).
 */
async function handleSwitchMode(ctx: RecoveryContext): Promise<boolean> {
  if (ctx.onSwitchMode) {
    ctx.onSwitchMode();
    return true;
  }
  logger.warn("[Recovery] switch_mode: no onSwitchMode callback provided");
  return false;
}

/**
 * cancel_invite — Host cancels the invite, both host and joiner leave.
 */
async function handleCancelInvite(ctx: RecoveryContext): Promise<boolean> {
  const inviteId = ctx.inviteId;
  const uid = ctx.uid;

  if (inviteId && uid && ctx.isHost) {
    try {
      await cancelUniversalInvite(inviteId, uid);
      logger.info(`[Recovery] Invite cancelled: ${inviteId}`);
    } catch (err: any) {
      logger.warn(`[Recovery] Failed to cancel invite: ${err.message}`);
    }
  }

  // Leave room
  try {
    await colyseusService.leaveRoom();
  } catch {
    // Ignore
  }

  ctx.onLeave?.();
  return true;
}

/**
 * report_bug — Collect context and submit to Firestore.
 * Shows a confirmation alert to the user.
 */
async function handleReportBug(ctx: RecoveryContext): Promise<boolean> {
  const bugContext: BugReportContext = {
    gameType: ctx.session?.gameType,
    firestoreGameId: ctx.session?.firestoreGameId,
    roomId: ctx.roomId,
    inviteId: ctx.inviteId ?? undefined,
    traceId: ctx.traceId,
    errorCode: ctx.error?.code,
    errorMessage: ctx.error?.message,
    roomPhase: ctx.roomPhase ?? undefined,
    lobbyPhase: ctx.lobbyPhase,
    wasStale: ctx.wasStale,
    staleDurationSec: ctx.staleDurationSec,
  };

  try {
    const reportId = await submitBugReport(bugContext);
    Alert.alert(
      "Bug Reported",
      `Thanks! We\u2019ll look into this.\n\nReport ID: ${reportId.slice(0, 8)}\u2026`,
      [{ text: "OK" }],
    );
    return true;
  } catch {
    Alert.alert("Error", "Failed to submit bug report. Please try again.");
    return false;
  }
}
