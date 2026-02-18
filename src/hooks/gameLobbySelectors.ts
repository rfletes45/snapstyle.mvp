export interface ConnectionBannerInput {
  roomReconnecting: boolean;
  roomOpponentDisconnected: boolean;
  roomHealthStale: boolean;
  roomPhase: string | null;
}

export function getConnectionBannerForState(
  input: ConnectionBannerInput,
): string | null {
  if (input.roomReconnecting) return "Reconnecting to game server...";
  if (input.roomOpponentDisconnected)
    return "Opponent disconnected - waiting for reconnection...";
  if (input.roomHealthStale && input.roomPhase === "playing")
    return "Connection may be unstable...";
  return null;
}

export interface OverlayVisibilityInput {
  roomPhase: string | null;
  lobbyPhase: string;
  hasActiveError: boolean;
  watchdogStuck: boolean;
}

export function shouldShowLobbyOverlayForState(
  input: OverlayVisibilityInput,
): boolean {
  // Hide overlay when room is actively playing and no blocking errors
  if (
    (input.roomPhase === "playing" || input.roomPhase === "finished") &&
    input.lobbyPhase !== "error" &&
    !input.hasActiveError &&
    !input.watchdogStuck
  ) {
    return false;
  }
  // Show overlay when lobby hasn't resolved yet
  if (input.lobbyPhase !== "playing" && input.lobbyPhase !== "starting") {
    return true;
  }
  // Show overlay on error
  if (input.hasActiveError) return true;
  // Show overlay when watchdog detects stuck
  if (input.watchdogStuck) return true;
  return false;
}
