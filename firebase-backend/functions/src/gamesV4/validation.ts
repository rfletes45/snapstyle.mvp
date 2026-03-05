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

import * as functions from "firebase-functions";

// =============================================================================
// String sanitisation
// =============================================================================

/** Maximum field length for user-provided strings. */
const MAX_STRING_LENGTH = 512;

/** Maximum key length in user-provided objects. */
const MAX_KEY_LENGTH = 64;

/** Maximum nesting depth for user-provided objects. */
const MAX_OBJECT_DEPTH = 5;

/** Maximum array length in user-provided objects. */
const MAX_ARRAY_LENGTH = 100;

/** Maximum total keys in a user-provided object. */
const MAX_TOTAL_KEYS = 200;

/**
 * Sanitise a user-provided string:
 * - trims whitespace
 * - strips control characters (except newlines/tabs)
 * - enforces max length
 */
export function sanitiseString(
  value: unknown,
  maxLength = MAX_STRING_LENGTH,
): string {
  if (typeof value !== "string") return "";
  const stripped = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
  return stripped.slice(0, maxLength);
}

// =============================================================================
// Required-field extractors
// =============================================================================

/**
 * Extract a required non-empty string from an unknown payload.
 * Throws HttpsError "invalid-argument" on failure.
 */
export function requireString(
  data: Record<string, unknown>,
  field: string,
  maxLength = MAX_STRING_LENGTH,
): string {
  const raw = data[field];
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `"${field}" is required and must be a non-empty string.`,
    );
  }
  return sanitiseString(raw, maxLength);
}

/**
 * Extract an optional boolean, defaulting to the provided value.
 */
export function optionalBool(
  data: Record<string, unknown>,
  field: string,
  defaultValue = false,
): boolean {
  const raw = data[field];
  if (typeof raw === "boolean") return raw;
  return defaultValue;
}

/**
 * Extract an optional integer within a range.
 */
export function optionalInt(
  data: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
  defaultValue: number,
): number {
  const raw = data[field];
  if (typeof raw !== "number") return defaultValue;
  if (!Number.isInteger(raw)) return defaultValue;
  return Math.min(Math.max(raw, min), max);
}

// =============================================================================
// Object depth / size limiting
// =============================================================================

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

export function sanitisePayload(
  value: unknown,
  opts: SanitiseOptions = {},
): unknown {
  const maxDepth = opts.maxDepth ?? MAX_OBJECT_DEPTH;
  const maxArr = opts.maxArrayLength ?? MAX_ARRAY_LENGTH;
  const maxKeys = opts.maxTotalKeys ?? MAX_TOTAL_KEYS;
  return _sanitise(value, 0, maxDepth, { keys: 0 }, maxArr, maxKeys);
}

interface CountRef {
  keys: number;
}

function _sanitise(
  value: unknown,
  depth: number,
  maxDepth: number,
  count: CountRef,
  maxArr: number,
  maxKeys: number,
): unknown {
  if (depth > maxDepth) return undefined;

  if (value === null || value === undefined) return value;

  const t = typeof value;
  if (t === "boolean" || t === "number") return value;
  if (t === "string") return sanitiseString(value, MAX_STRING_LENGTH);

  if (Array.isArray(value)) {
    const limited = value.slice(0, maxArr);
    return limited.map((v) =>
      _sanitise(v, depth + 1, maxDepth, count, maxArr, maxKeys),
    );
  }

  if (t === "object") {
    // Pass through Firestore Timestamps / Date
    if (value instanceof Date) return value;
    if (typeof (value as Record<string, unknown>).toMillis === "function")
      return value;

    const result: Record<string, unknown> = {};
    const raw = value as Record<string, unknown>;
    for (const key of Object.keys(raw)) {
      if (count.keys >= maxKeys) break;
      const safeKey = key.slice(0, MAX_KEY_LENGTH);
      // Prevent prototype pollution
      if (safeKey === "__proto__" || safeKey === "constructor") continue;
      count.keys++;
      result[safeKey] = _sanitise(
        raw[key],
        depth + 1,
        maxDepth,
        count,
        maxArr,
        maxKeys,
      );
    }
    return result;
  }

  // Drop functions, symbols, etc.
  return undefined;
}

// =============================================================================
// Rate-limit helpers (Firestore-based cooldown)
// =============================================================================

/**
 * Firestore-based per-user cooldown check.
 * Writes timestamp to `Users/{uid}/RateLimits/{action}`.
 * If last write < cooldownMs ago, throws RESOURCE_EXHAUSTED.
 */
export async function enforceCooldown(
  db: FirebaseFirestore.Firestore,
  uid: string,
  action: string,
  cooldownMs: number,
): Promise<void> {
  const ref = db
    .collection("Users")
    .doc(uid)
    .collection("RateLimits")
    .doc(action);

  // Atomic check-and-set via transaction to prevent double-submit (R4 fix)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();

    if (snap.exists) {
      const lastMs = snap.data()?.lastAtMs ?? 0;
      if (now - lastMs < cooldownMs) {
        const retryAfterSec = Math.ceil((cooldownMs - (now - lastMs)) / 1000);
        throw new functions.https.HttpsError(
          "resource-exhausted",
          `Too many requests. Try again in ${retryAfterSec}s.`,
        );
      }
    }

    tx.set(ref, { lastAtMs: Date.now() }, { merge: true });
  });
}

/** Pre-defined cooldowns for V4 actions (milliseconds). */
export const COOLDOWNS = {
  CREATE_INVITE: 3_000, // 3 seconds between invite creations
  JOIN_LOBBY: 2_000, // 2 seconds between lobby joins
  LEAVE_LOBBY: 2_000, // 2 seconds between lobby leaves
  CANCEL_INVITE: 2_000, // 2 seconds between cancel attempts
  START_GAME: 2_000, // 2 seconds between game starts
  START_SOLO: 3_000, // 3 seconds between solo session starts
  SUBMIT_MOVE: 500, // 500ms between moves (anti-spam)
} as const;
