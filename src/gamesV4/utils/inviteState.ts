import type { GameInviteV4 } from "@/gamesV4/types";

/**
 * Resolved invites without a session were cancelled or cleared before gameplay
 * ever produced a playable session.
 */
export function isCancelledInvite(
  invite: Pick<GameInviteV4, "status" | "sessionId">,
): boolean {
  return invite.status === "resolved" && !invite.sessionId;
}
