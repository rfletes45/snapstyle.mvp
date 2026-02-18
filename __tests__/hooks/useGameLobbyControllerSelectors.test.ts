import {
  getConnectionBannerForState,
  shouldShowLobbyOverlayForState,
} from "@/hooks/gameLobbySelectors";

describe("useGameLobbyController selectors", () => {
  describe("getConnectionBannerForState", () => {
    it("prioritizes reconnecting over all other states", () => {
      const banner = getConnectionBannerForState({
        roomReconnecting: true,
        roomOpponentDisconnected: true,
        roomHealthStale: true,
        roomPhase: "playing",
      });

      expect(banner).toBe("Reconnecting to game server...");
    });

    it("shows opponent disconnected banner", () => {
      const banner = getConnectionBannerForState({
        roomReconnecting: false,
        roomOpponentDisconnected: true,
        roomHealthStale: false,
        roomPhase: "playing",
      });

      expect(banner).toBe("Opponent disconnected - waiting for reconnection...");
    });

    it("shows stale banner only during active play", () => {
      expect(
        getConnectionBannerForState({
          roomReconnecting: false,
          roomOpponentDisconnected: false,
          roomHealthStale: true,
          roomPhase: "playing",
        }),
      ).toBe("Connection may be unstable...");

      expect(
        getConnectionBannerForState({
          roomReconnecting: false,
          roomOpponentDisconnected: false,
          roomHealthStale: true,
          roomPhase: "waiting",
        }),
      ).toBeNull();
    });

    it("returns null for healthy room state", () => {
      const banner = getConnectionBannerForState({
        roomReconnecting: false,
        roomOpponentDisconnected: false,
        roomHealthStale: false,
        roomPhase: "playing",
      });

      expect(banner).toBeNull();
    });
  });

  describe("shouldShowLobbyOverlayForState", () => {
    it("hides overlay while room is playing with no blocking state", () => {
      const show = shouldShowLobbyOverlayForState({
        roomPhase: "playing",
        lobbyPhase: "playing",
        hasActiveError: false,
        watchdogStuck: false,
      });

      expect(show).toBe(false);
    });

    it("shows overlay while lobby is unresolved", () => {
      const show = shouldShowLobbyOverlayForState({
        roomPhase: "waiting",
        lobbyPhase: "waiting",
        hasActiveError: false,
        watchdogStuck: false,
      });

      expect(show).toBe(true);
    });

    it("shows overlay when an active error exists", () => {
      const show = shouldShowLobbyOverlayForState({
        roomPhase: "playing",
        lobbyPhase: "playing",
        hasActiveError: true,
        watchdogStuck: false,
      });

      expect(show).toBe(true);
    });

    it("shows overlay when watchdog marks session stuck", () => {
      const show = shouldShowLobbyOverlayForState({
        roomPhase: "playing",
        lobbyPhase: "playing",
        hasActiveError: false,
        watchdogStuck: true,
      });

      expect(show).toBe(true);
    });
  });
});
