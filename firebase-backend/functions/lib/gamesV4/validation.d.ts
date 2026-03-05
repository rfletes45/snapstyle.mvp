/**
 * Games V4 — Input Validation & Sanitisation Utilities
 *
 * Shared validation helpers for all V4 callables.
 * Centralises the patterns for:
 * - String sanitisation (trim, length, no control characters)
 * - Object depth limiting (prevents deeply nested payloads)
 * - Typed extraction from `unknown` payloads
 * - Rate-limit preflight markers (Firestore-based cooldowns)
 *
 * @module gamesV4/validation
 */
/**
 * Sanitise a user-provided string:
 * - trims whitespace
 * - strips control characters (except newlines/tabs)
 * - enforces max length
 */
export declare function sanitiseString(value: unknown, maxLength?: number): string;
/**
 * Extract a required non-empty string from an unknown payload.
 * Throws HttpsError "invalid-argument" on failure.
 */
export declare function requireString(data: Record<string, unknown>, field: string, maxLength?: number): string;
/**
 * Extract an optional boolean, defaulting to the provided value.
 */
export declare function optionalBool(data: Record<string, unknown>, field: string, defaultValue?: boolean): boolean;
/**
 * Extract an optional integer within a range.
 */
export declare function optionalInt(data: Record<string, unknown>, field: string, min: number, max: number, defaultValue: number): number;
/**
 * Deep-clone a user-provided object, capping depth, key count, and array size.
 * This prevents payload bombs and prototype pollution.
 *
 * Note: Firestore Timestamp / Date objects are passed through as-is.
 */
export interface SanitiseOptions {
    maxDepth?: number;
    maxArrayLength?: number;
    maxTotalKeys?: number;
}
export declare function sanitisePayload(value: unknown, opts?: SanitiseOptions): unknown;
/**
 * Firestore-based per-user cooldown check.
 * Writes timestamp to `Users/{uid}/RateLimits/{action}`.
 * If last write < cooldownMs ago, throws RESOURCE_EXHAUSTED.
 */
export declare function enforceCooldown(db: FirebaseFirestore.Firestore, uid: string, action: string, cooldownMs: number): Promise<void>;
/** Pre-defined cooldowns for V4 actions (milliseconds). */
export declare const COOLDOWNS: {
    readonly CREATE_INVITE: 3000;
    readonly JOIN_LOBBY: 2000;
    readonly LEAVE_LOBBY: 2000;
    readonly CANCEL_INVITE: 2000;
    readonly START_GAME: 2000;
    readonly START_SOLO: 3000;
    readonly SUBMIT_MOVE: 500;
};
