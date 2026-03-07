/**
 * Games V4 — Firebase Callable Error Mapper
 *
 * Converts raw Firebase callable error objects into user-friendly strings.
 * Used by both the lobby and solo-launch flows so error messages stay
 * consistent across the entire game system.
 *
 * @module gamesV4/utils/mapCallableError
 */

/**
 * Map a Firebase callable error to a user-friendly message string.
 *
 * Firebase JS SDK callable errors carry `code` like "functions/internal"
 * and an optional `message` / `details.traceId`.  This helper normalizes
 * them into short, actionable sentences suitable for `Alert.alert()`.
 */
export function mapCallableError(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const e = err as {
      code?: string;
      message?: string;
      details?: { traceId?: string };
    };
    // Firebase JS SDK callable errors have code like "functions/resource-exhausted"
    const code = (e.code ?? "").replace("functions/", "");
    switch (code) {
      case "resource-exhausted":
        return "Please wait a moment before trying again.";
      case "failed-precondition":
        return e.message ?? "Action not allowed right now.";
      case "permission-denied":
        return "You don't have permission for this action.";
      case "not-found":
        return "This game session no longer exists.";
      case "unauthenticated":
        return "Please sign in to continue.";
      case "invalid-argument":
        return e.message ?? "Invalid request.";
      case "internal": {
        const traceId =
          e.details && typeof e.details === "object"
            ? (e.details as Record<string, unknown>).traceId
            : undefined;
        return traceId
          ? `Unexpected server error (trace: ${String(traceId).slice(0, 8)}…)`
          : "Unexpected server error. Please try again.";
      }
      default:
        return e.message ?? fallback;
    }
  }
  return fallback;
}

/**
 * Convenience wrapper for solo-game launch errors.
 */
export function mapSoloLaunchError(err: unknown): string {
  return mapCallableError(err, "Could not start game.");
}
