/**
 * Games V4 — Realtime Errors
 *
 * Structured error types for the realtime client layer.
 *
 * @module gamesV4/realtime/errors
 */

/**
 * Base error class for realtime client errors.
 */
export class RealtimeError extends Error {
  readonly code: string;
  readonly isRetryable: boolean;

  constructor(message: string, code: string, isRetryable = false) {
    super(message);
    this.name = "RealtimeError";
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

/**
 * Thrown when room join fails due to authentication.
 */
export class RealtimeAuthError extends RealtimeError {
  constructor(message = "Authentication failed") {
    super(message, "AUTH_FAILED", false);
    this.name = "RealtimeAuthError";
  }
}

/**
 * Thrown when the session is not found or not in a joinable state.
 */
export class RealtimeSessionError extends RealtimeError {
  constructor(message = "Session not found or not joinable") {
    super(message, "SESSION_INVALID", false);
    this.name = "RealtimeSessionError";
  }
}

/**
 * Thrown when the room is full.
 */
export class RealtimeRoomFullError extends RealtimeError {
  constructor(message = "Room is full") {
    super(message, "ROOM_FULL", false);
    this.name = "RealtimeRoomFullError";
  }
}

/**
 * Thrown when connection to the server times out.
 */
export class RealtimeTimeoutError extends RealtimeError {
  constructor(message = "Connection timed out") {
    super(message, "TIMEOUT", true);
    this.name = "RealtimeTimeoutError";
  }
}

/**
 * Thrown when the server rejects a message.
 */
export class RealtimeMessageError extends RealtimeError {
  readonly messageType: string;

  constructor(messageType: string, message = "Message rejected by server") {
    super(message, "MESSAGE_REJECTED", false);
    this.name = "RealtimeMessageError";
    this.messageType = messageType;
  }
}

/**
 * Classify a Colyseus error code into a structured error.
 */
export function classifyConnectionError(
  code: number,
  message?: string,
): RealtimeError {
  switch (code) {
    case 4002:
      return new RealtimeAuthError(message);
    case 4001:
      return new RealtimeSessionError(message);
    case 4003:
      return new RealtimeRoomFullError(message);
    default:
      if (code >= 1001 && code <= 1015) {
        return new RealtimeTimeoutError(message);
      }
      return new RealtimeError(
        message ?? `Connection error (code ${code})`,
        "UNKNOWN",
        true,
      );
  }
}
