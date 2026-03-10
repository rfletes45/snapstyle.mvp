/**
 * Realtime Framework — Core Module Index
 *
 * Barrel exports for the generalized realtime game framework.
 *
 * @module core
 */

// Base room
export { BaseRealtimeRoom } from "./BaseRealtimeRoom";
export type { BaseAuthData } from "./BaseRealtimeRoom";

// Types
export type {
  DisconnectPolicy,
  LateJoinPolicy,
  MatchEndCondition,
  MatchStartPolicy,
  MessageDefinition,
  RealtimeGameDefinition,
  RealtimePlayerInfo,
  RealtimeResolutionPayload,
  RealtimeScoreboardEntry,
  RoomPhase,
  RuntimeSummary,
  SimulationProfile,
  SpectatorMode,
  TeamConfig,
  VisibilityScope,
} from "./types";

// Firebase session guard
export { verifyJoin } from "./FirebaseSessionGuard";
export type { JoinOptions, SessionGuardResult } from "./FirebaseSessionGuard";

// Resolution bridge
export {
  buildResolutionPayload,
  writeResolutionRequest,
} from "./ResolutionBridge";

// Runtime mirror
export { RuntimeMirror } from "./RuntimeMirror";

// Input validation
export {
  MessageRegistry,
  RateLimiter,
  createPayloadValidator,
  createValidatedHandler,
} from "./InputValidation";
