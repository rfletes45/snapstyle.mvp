/**
 * Games V4 — Type Barrel Export
 *
 * Re-exports all V4 game system types from a single entry point.
 *
 * @module gamesV4/types
 */

// Common types
export type {
  GameId,
  GameRuntimeType,
  IntegrityEnvelope,
  InviteSummary,
  ParticipantSummary,
  PlayerSlot,
  ScoreSummaryEntry,
  SoloMode,
  SpectateMode,
  SpectatorSlot,
  TimestampLike,
} from "./common";

// Invite types
export {
  GAME_INVITE_STATUS_TRANSITIONS,
  canTransitionInviteStatus,
} from "./invite";
export type { GameInviteStatus, GameInviteV4 } from "./invite";

// Session types
export type {
  GameSessionV4,
  MoveDoc,
  PrivateStateDoc,
  PublicStateDoc,
  ResolutionType,
  SessionResolution,
  SessionStatus,
} from "./session";

// Result types
export type {
  AchievementUnlock,
  FinalScoreboardEntry,
  GameResultV4,
  LeaderboardUpdate,
  XPAward,
} from "./result";

// PB types
export type { GamePBV4 } from "./pb";

// Adapter types
export type {
  GameAdapterV4,
  GameOutcome,
  MoveValidationResult,
  SettingsFieldDef,
} from "./adapter";

