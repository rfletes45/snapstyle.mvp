import { GameErrorCode } from "@/types/gameErrors";

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "";
}

/**
 * Map a Colyseus SDK join error to a canonical game error code.
 */
export function mapColyseusJoinError(error: unknown): GameErrorCode {
  const msg = extractErrorMessage(error).toLowerCase();

  if (
    msg.includes("protocolversion") ||
    msg.includes("protocol version") ||
    msg.includes("update the app")
  ) {
    return GameErrorCode.PROTOCOL_VERSION_MISMATCH;
  }
  if (msg.includes("full") || msg.includes("maxclients")) {
    return GameErrorCode.JOIN_ROOM_FULL;
  }
  if (msg.includes("auth") || msg.includes("token")) {
    return GameErrorCode.AUTH_TOKEN_INVALID;
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return GameErrorCode.JOIN_TIMEOUT;
  }
  if (msg.includes("not found") || msg.includes("no available")) {
    return GameErrorCode.JOIN_ROOM_NOT_FOUND;
  }
  return GameErrorCode.JOIN_FAILED;
}
