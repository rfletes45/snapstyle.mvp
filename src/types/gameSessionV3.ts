/**
 * Game Session V3 Types — Client Re-export & Helpers
 *
 * Re-exports the canonical shared types from `shared/sessions/` and adds
 * client-specific derived types / helpers.
 *
 * Client code should import from `@/types/gameSessionV3` — never directly
 * from `shared/sessions/` to keep import paths consistent.
 *
 * @module types/gameSessionV3
 */

// Re-export everything from the shared canonical types
export type {
  CreateSessionParams,
  CreateSessionResult,
  GameSessionV3,
  InviteToSessionParams,
  InviteToSessionResult,
  JoinSessionParams,
  JoinSessionResult,
  LeaveSessionParams,
  LeaveSessionResult,
  ResolveSessionParams,
  ResolveSessionResult,
  SessionOutcome,
  SessionParticipant,
  SessionResolution,
  StartSessionParams,
  StartSessionResult,
} from "../../shared/sessions/types";

export {
  canTransitionPhase,
  DEFAULT_MAX_PARTICIPANTS,
  DEFAULT_MAX_SPECTATORS,
  PARTICIPANT_ROLES,
  PARTICIPANT_STATUSES,
  SESSION_ACTIVE_TTL_MS,
  SESSION_ENTRY_SOURCES,
  SESSION_LOBBY_TTL_MS,
  SESSION_PHASE_TRANSITIONS,
  SESSION_PHASES,
  SESSION_VISIBILITIES,
  SESSIONS_COLLECTION,
  TERMINAL_PHASES,
} from "../../shared/sessions/constants";

export type {
  ParticipantRole,
  ParticipantStatus,
  SessionEntrySource,
  SessionPhase,
  SessionVisibility,
} from "../../shared/sessions/constants";

// =============================================================================
// Client-specific derived types
// =============================================================================

import type { SessionPhase } from "../../shared/sessions/constants";
import type {
  GameSessionV3,
  SessionParticipant,
} from "../../shared/sessions/types";

/**
 * Lightweight session summary for list rendering (InvitePillRow, etc.).
 * Projected from the full session doc to minimize re-renders.
 */
export interface SessionSummary {
  id: string;
  gameType: string;
  phase: SessionPhase;
  hostUid: string;
  hostDisplayName: string;
  participantCount: number;
  maxParticipants: number;
  createdAt: number;
  conversationId?: string;
  sourceInviteId?: string;
}

/**
 * Project a full session doc into a lightweight summary.
 */
export function toSessionSummary(session: GameSessionV3): SessionSummary {
  const host = session.participants.find((p) => p.role === "host");
  return {
    id: session.id,
    gameType: session.gameType,
    phase: session.phase,
    hostUid: session.hostUid,
    hostDisplayName: host?.displayName ?? "Unknown",
    participantCount: session.participants.filter((p) => p.role !== "spectator")
      .length,
    maxParticipants: session.maxParticipants,
    createdAt: session.createdAt,
    conversationId: session.conversationId,
    sourceInviteId: session.sourceInviteId,
  };
}

/**
 * Check if a user is an active participant (joined, not merely invited) in the session.
 */
export function isParticipant(session: GameSessionV3, uid: string): boolean {
  return session.participants.some(
    (p) => p.uid === uid && p.status !== "invited",
  );
}

/**
 * Get the participant record for a uid, if present.
 */
export function getParticipant(
  session: GameSessionV3,
  uid: string,
): SessionParticipant | undefined {
  return session.participants.find((p) => p.uid === uid);
}

/**
 * Check if the session lobby is full (non-spectator, non-invited slots).
 */
export function isLobbyFull(session: GameSessionV3): boolean {
  const activePlayers = session.participants.filter(
    (p) =>
      p.role !== "spectator" && p.status !== "invited" && p.status !== "left",
  );
  return activePlayers.length >= session.maxParticipants;
}

/**
 * Check if the session is in a terminal phase.
 */
export function isSessionTerminal(phase: SessionPhase): boolean {
  return phase === "resolved" || phase === "abandoned" || phase === "expired";
}
