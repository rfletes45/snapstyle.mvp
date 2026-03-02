/**
 * Colyseus Join Options Builder
 *
 * Converts a client-side GameSessionContext into the canonical
 * GameJoinOptions payload sent over the wire to Colyseus.
 *
 * This centralises token retrieval, protocol versioning, build info,
 * and trace ID generation — no hook should assemble join options ad-hoc.
 *
 * Usage:
 *   import { buildJoinOptions } from "@/services/colyseusJoin";
 *   const opts = await buildJoinOptions(ctx);
 *   const room = await client.joinOrCreate(roomName, opts);
 *
 * @see src/types/gameSession.ts — GameSessionContext & GameJoinOptions
 */

import { GameErrorCode, createGameError } from "@/types/gameErrors";
import {
  GAME_PROTOCOL_VERSION,
  getClientBuildInfo,
} from "@/types/gameProtocol";
import {
  assertGameJoinOptions,
  type GameJoinOptions,
  type GameSessionContext,
} from "@/types/gameSession";
import { createLogger } from "@/utils/log";
import { createTraceId } from "@/utils/trace";
import { getAuth } from "firebase/auth";

const joinLogger = createLogger("services/colyseusJoin");

// =============================================================================
// Token helper
// =============================================================================

/**
 * Get the current Firebase user's ID token.
 *
 * @throws GameError with AUTH_NOT_SIGNED_IN / AUTH_TOKEN_MISSING
 */
async function getAuthToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) {
    throw createGameError(GameErrorCode.AUTH_NOT_SIGNED_IN, {
      message: "Not authenticated — cannot connect to game server",
    });
  }

  try {
    return await user.getIdToken();
  } catch (err: any) {
    throw createGameError(GameErrorCode.AUTH_TOKEN_MISSING, {
      message: `Failed to retrieve ID token: ${err?.message}`,
    });
  }
}

// =============================================================================
// Builder
// =============================================================================

/**
 * Build the canonical GameJoinOptions from a GameSessionContext.
 *
 * Always includes: token, protocolVersion, buildInfo, traceId.
 * Optionally includes: firestoreGameId, spectator, inviteId, conversationId.
 */
export async function buildJoinOptions(
  ctx: GameSessionContext,
): Promise<GameJoinOptions> {
  const token = await getAuthToken();
  const buildInfo = getClientBuildInfo();

  const opts: GameJoinOptions = {
    token,
    protocolVersion: GAME_PROTOCOL_VERSION,
    buildInfo,
    // Re-use the invite's traceId when available for end-to-end correlation;
    // otherwise generate a fresh session-scoped traceId.
    traceId: ctx.traceId || createTraceId("gs"),
  };

  // Optional routing fields — only set when present
  if (ctx.firestoreGameId) opts.firestoreGameId = ctx.firestoreGameId;
  if (ctx.spectator) opts.spectator = true;
  if (ctx.inviteId) opts.inviteId = ctx.inviteId;
  if (ctx.conversationId) opts.conversationId = ctx.conversationId;
  if (ctx.v3SessionId) opts.v3SessionId = ctx.v3SessionId;

  joinLogger.debug(
    `[colyseusJoin] COLYSEUS.JOIN.OPTIONS firestoreGameId=${opts.firestoreGameId ?? "none"} inviteId=${opts.inviteId ?? "none"} v3SessionId=${opts.v3SessionId ?? "none"} spectator=${opts.spectator ?? false} traceId=${opts.traceId}`,
  );

  // Defensive wire-boundary check to prevent malformed join payloads.
  assertGameJoinOptions(opts, "buildJoinOptions produced invalid join options");

  return opts;
}
