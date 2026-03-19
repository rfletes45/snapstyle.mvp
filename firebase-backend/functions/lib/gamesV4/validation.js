"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.COOLDOWNS = void 0;
exports.sanitiseString = sanitiseString;
exports.requireString = requireString;
exports.optionalBool = optionalBool;
exports.optionalInt = optionalInt;
exports.sanitisePayload = sanitisePayload;
exports.enforceCooldown = enforceCooldown;
const functions = __importStar(require("firebase-functions"));
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
function sanitiseString(value, maxLength = MAX_STRING_LENGTH) {
    if (typeof value !== "string")
        return "";
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
function requireString(data, field, maxLength = MAX_STRING_LENGTH) {
    const raw = data[field];
    if (typeof raw !== "string" || raw.trim().length === 0) {
        throw new functions.https.HttpsError("invalid-argument", `"${field}" is required and must be a non-empty string.`);
    }
    return sanitiseString(raw, maxLength);
}
/**
 * Extract an optional boolean, defaulting to the provided value.
 */
function optionalBool(data, field, defaultValue = false) {
    const raw = data[field];
    if (typeof raw === "boolean")
        return raw;
    return defaultValue;
}
/**
 * Extract an optional integer within a range.
 */
function optionalInt(data, field, min, max, defaultValue) {
    const raw = data[field];
    if (typeof raw !== "number")
        return defaultValue;
    if (!Number.isInteger(raw))
        return defaultValue;
    return Math.min(Math.max(raw, min), max);
}
function sanitisePayload(value, opts = {}) {
    const maxDepth = opts.maxDepth ?? MAX_OBJECT_DEPTH;
    const maxArr = opts.maxArrayLength ?? MAX_ARRAY_LENGTH;
    const maxKeys = opts.maxTotalKeys ?? MAX_TOTAL_KEYS;
    return _sanitise(value, 0, maxDepth, { keys: 0 }, maxArr, maxKeys);
}
function _sanitise(value, depth, maxDepth, count, maxArr, maxKeys) {
    if (depth > maxDepth)
        return undefined;
    if (value === null || value === undefined)
        return value;
    const t = typeof value;
    if (t === "boolean" || t === "number")
        return value;
    if (t === "string")
        return sanitiseString(value, MAX_STRING_LENGTH);
    if (Array.isArray(value)) {
        const limited = value.slice(0, maxArr);
        return limited.map((v) => _sanitise(v, depth + 1, maxDepth, count, maxArr, maxKeys));
    }
    if (t === "object") {
        // Pass through Firestore Timestamps / Date
        if (value instanceof Date)
            return value;
        if (typeof value.toMillis === "function")
            return value;
        const result = {};
        const raw = value;
        for (const key of Object.keys(raw)) {
            if (count.keys >= maxKeys)
                break;
            const safeKey = key.slice(0, MAX_KEY_LENGTH);
            // Prevent prototype pollution
            if (safeKey === "__proto__" || safeKey === "constructor")
                continue;
            count.keys++;
            result[safeKey] = _sanitise(raw[key], depth + 1, maxDepth, count, maxArr, maxKeys);
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
async function enforceCooldown(db, uid, action, cooldownMs) {
    const ref = db
        .collection("Users")
        .doc(uid)
        .collection("RateLimits")
        .doc(action);
    // PERF: Non-transactional read + fire-and-forget write. The previous
    // transaction-based approach added a full Firestore tx round-trip
    // (~200-500ms) on every single callable. Since the main operation already
    // has its own idempotency guard (e.g. participantIds.includes(uid)),
    // a best-effort cooldown is sufficient to prevent rapid re-taps.
    const snap = await ref.get();
    const now = Date.now();
    if (snap.exists) {
        const lastMs = snap.data()?.lastAtMs ?? 0;
        if (now - lastMs < cooldownMs) {
            const retryAfterSec = Math.ceil((cooldownMs - (now - lastMs)) / 1000);
            throw new functions.https.HttpsError("resource-exhausted", `Too many requests. Try again in ${retryAfterSec}s.`);
        }
    }
    // Stamp the cooldown non-blocking — don't hold up the response.
    ref
        .set({ lastAtMs: now }, { merge: true })
        .catch((err) => console.warn(`[gamesV4] Cooldown stamp write failed for ${action}:`, err));
}
/** Pre-defined cooldowns for V4 actions (milliseconds). */
exports.COOLDOWNS = {
    CREATE_INVITE: 3_000, // 3 seconds between invite creations
    JOIN_LOBBY: 2_000, // 2 seconds between lobby joins
    LEAVE_LOBBY: 2_000, // 2 seconds between lobby leaves
    CANCEL_INVITE: 2_000, // 2 seconds between cancel attempts
    START_GAME: 2_000, // 2 seconds between game starts
    START_SOLO: 3_000, // 3 seconds between solo session starts
    SUBMIT_MOVE: 500, // 500ms between moves (anti-spam)
};
//# sourceMappingURL=validation.js.map