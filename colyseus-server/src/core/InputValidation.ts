/**
 * Realtime Framework — Input Validation & Rate Limiting
 *
 * Provides typed message registration, payload validation, and
 * per-player rate limiting for Colyseus room messages.
 *
 * @module core/InputValidation
 */

import type { Client } from "colyseus";
import type { MessageDefinition, RoomPhase } from "./types";

// =============================================================================
// Rate Limiter
// =============================================================================

interface RateLimitEntry {
  timestamps: number[];
}

/**
 * Per-player, per-message-type rate limiter.
 */
export class RateLimiter {
  /** Map: uid -> message type -> rate limit entry */
  private limits = new Map<string, Map<string, RateLimitEntry>>();

  /**
   * Check if a message is allowed under rate limits.
   * Returns true if allowed, false if rate-limited.
   */
  check(uid: string, messageType: string, def: MessageDefinition): boolean {
    if (def.rateLimitMs <= 0) return true;

    const now = Date.now();
    const burstLimit = def.burstLimit ?? 1;

    let playerLimits = this.limits.get(uid);
    if (!playerLimits) {
      playerLimits = new Map();
      this.limits.set(uid, playerLimits);
    }

    let entry = playerLimits.get(messageType);
    if (!entry) {
      entry = { timestamps: [] };
      playerLimits.set(messageType, entry);
    }

    // Remove timestamps outside the window
    const windowStart = now - def.rateLimitMs;
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    // Check burst limit
    if (entry.timestamps.length >= burstLimit) {
      return false;
    }

    entry.timestamps.push(now);
    return true;
  }

  /**
   * Clear rate limit data for a player (e.g., on disconnect).
   */
  clearPlayer(uid: string): void {
    this.limits.delete(uid);
  }

  /**
   * Clear all rate limit data.
   */
  clearAll(): void {
    this.limits.clear();
  }
}

// =============================================================================
// Message Registry
// =============================================================================

/**
 * Manages message definitions, validation, and registration for a room.
 */
export class MessageRegistry {
  private definitions = new Map<string, MessageDefinition>();
  private rateLimiter = new RateLimiter();

  /**
   * Register a message definition.
   */
  register(def: MessageDefinition): void {
    if (this.definitions.has(def.type)) {
      throw new Error(`Message type "${def.type}" already registered.`);
    }
    this.definitions.set(def.type, def);
  }

  /**
   * Register multiple message definitions at once.
   */
  registerAll(defs: MessageDefinition[]): void {
    for (const def of defs) {
      this.register(def);
    }
  }

  /**
   * Get a message definition by type.
   */
  get(type: string): MessageDefinition | undefined {
    return this.definitions.get(type);
  }

  /**
   * Validate an incoming message.
   * Returns null if valid, or an error string if invalid.
   */
  validateMessage(
    type: string,
    payload: unknown,
    senderUid: string,
    isSpectator: boolean,
    currentPhase: RoomPhase,
  ): string | null {
    const def = this.definitions.get(type);
    if (!def) {
      return `Unknown message type: ${type}`;
    }

    // Check sender eligibility
    if (def.senderEligibility === "player" && isSpectator) {
      return "Spectators cannot send this message.";
    }
    if (def.senderEligibility === "spectator" && !isSpectator) {
      return "Only spectators can send this message.";
    }

    // Check phase restrictions
    if (def.allowedPhases !== "any") {
      if (!def.allowedPhases.includes(currentPhase)) {
        return `Message not allowed in phase: ${currentPhase}`;
      }
    }

    // Check rate limit
    if (!this.rateLimiter.check(senderUid, type, def)) {
      return "Rate limited. Slow down.";
    }

    // Validate payload
    const payloadError = def.validate(payload);
    if (payloadError) {
      return payloadError;
    }

    // Run custom pre-check if defined
    if (def.preCheck) {
      const preCheckError = def.preCheck(senderUid, payload, currentPhase);
      if (preCheckError) {
        return preCheckError;
      }
    }

    return null;
  }

  /**
   * Clear rate limit data for a player.
   */
  clearPlayerRateLimits(uid: string): void {
    this.rateLimiter.clearPlayer(uid);
  }

  /**
   * Clear all rate limit data.
   */
  clearAllRateLimits(): void {
    this.rateLimiter.clearAll();
  }

  /**
   * Get all registered message types.
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.definitions.keys());
  }
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Create a simple payload validator that checks for required fields.
 */
export function createPayloadValidator(
  schema: Record<string, "string" | "number" | "boolean" | "object" | "array">,
): (payload: unknown) => string | null {
  return (payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return "Payload must be an object.";
    }

    const obj = payload as Record<string, unknown>;

    for (const [key, expectedType] of Object.entries(schema)) {
      const value = obj[key];

      if (value === undefined || value === null) {
        return `Missing required field: ${key}`;
      }

      if (expectedType === "array") {
        if (!Array.isArray(value)) {
          return `Field "${key}" must be an array.`;
        }
      } else if (typeof value !== expectedType) {
        return `Field "${key}" must be of type ${expectedType}.`;
      }
    }

    return null;
  };
}

/**
 * Wrap a room's message handler with validation from the MessageRegistry.
 */
export function createValidatedHandler<T>(
  registry: MessageRegistry,
  messageType: string,
  getUid: (client: Client) => string | null,
  isSpectator: (uid: string) => boolean,
  getPhase: () => RoomPhase,
  handler: (client: Client, uid: string, payload: T) => void,
): (client: Client, payload: unknown) => void {
  return (client: Client, payload: unknown) => {
    const uid = getUid(client);
    if (!uid) return;

    const error = registry.validateMessage(
      messageType,
      payload,
      uid,
      isSpectator(uid),
      getPhase(),
    );

    if (error) {
      client.send("error", { message: error, messageType });
      return;
    }

    handler(client, uid, payload as T);
  };
}
