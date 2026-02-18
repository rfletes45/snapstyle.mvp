import { executeRecoveryAction, type RecoveryContext } from "@/services/gameRecoveryActions";
import { submitBugReport } from "@/services/bugReports";
import { colyseusService } from "@/services/colyseus";
import { cancelUniversalInvite } from "@/services/gameInvites";
import { GameErrorCode } from "@/types/gameErrors";
import { Alert } from "react-native";

jest.mock("@/services/bugReports", () => ({
  submitBugReport: jest.fn(),
}));

jest.mock("@/services/colyseus", () => ({
  colyseusService: {
    leaveRoom: jest.fn(),
  },
}));

jest.mock("@/services/gameInvites", () => ({
  cancelUniversalInvite: jest.fn(),
}));

jest.mock("@/utils/log", () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe("executeRecoveryAction", () => {
  const baseContext: RecoveryContext = {
    session: { gameType: "chess" },
    roomId: "room-1",
    inviteId: "invite-1",
    uid: "user-1",
    isHost: true,
    lobbyPhase: "starting",
    roomPhase: "waiting",
    traceId: "inv-abc123",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles retry_join via callback", async () => {
    const onRetryJoin = jest.fn();

    const ok = await executeRecoveryAction("retry_join", {
      ...baseContext,
      onRetryJoin,
    });

    expect(ok).toBe(true);
    expect(onRetryJoin).toHaveBeenCalledTimes(1);
  });

  it("handles rejoin_room by leaving then invoking callback", async () => {
    const onRejoinRoom = jest.fn();

    const ok = await executeRecoveryAction("rejoin_room", {
      ...baseContext,
      onRejoinRoom,
    });

    expect(ok).toBe(true);
    expect(colyseusService.leaveRoom).toHaveBeenCalledTimes(1);
    expect(onRejoinRoom).toHaveBeenCalledTimes(1);
  });

  it("handles reset_lobby by leaving room and resetting lobby callback", async () => {
    const onResetLobby = jest.fn();

    const ok = await executeRecoveryAction("reset_lobby", {
      ...baseContext,
      onResetLobby,
    });

    expect(ok).toBe(true);
    expect(colyseusService.leaveRoom).toHaveBeenCalledTimes(1);
    expect(onResetLobby).toHaveBeenCalledTimes(1);
  });

  it("handles cancel_invite for host and invokes leave callback", async () => {
    const onLeave = jest.fn();

    const ok = await executeRecoveryAction("cancel_invite", {
      ...baseContext,
      onLeave,
      isHost: true,
    });

    expect(ok).toBe(true);
    expect(cancelUniversalInvite).toHaveBeenCalledWith("invite-1", "user-1");
    expect(colyseusService.leaveRoom).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("handles cancel_invite for non-host without cancelling", async () => {
    const onLeave = jest.fn();

    const ok = await executeRecoveryAction("cancel_invite", {
      ...baseContext,
      onLeave,
      isHost: false,
    });

    expect(ok).toBe(true);
    expect(cancelUniversalInvite).not.toHaveBeenCalled();
    expect(colyseusService.leaveRoom).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("handles report_bug success path", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
    (submitBugReport as jest.Mock).mockResolvedValue("report-123456789");

    const ok = await executeRecoveryAction("report_bug", {
      ...baseContext,
      wasStale: true,
      staleDurationSec: 17,
      error: {
        code: GameErrorCode.ROOM_STALE,
        message: "Room stale",
      },
    });

    expect(ok).toBe(true);
    expect(submitBugReport).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      "Bug Reported",
      expect.stringContaining("Report ID:"),
      [{ text: "OK" }],
    );
  });

  it("handles report_bug failure path", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
    (submitBugReport as jest.Mock).mockRejectedValue(new Error("network"));

    const ok = await executeRecoveryAction("report_bug", {
      ...baseContext,
    });

    expect(ok).toBe(false);
    expect(alertSpy).toHaveBeenCalledWith(
      "Error",
      "Failed to submit bug report. Please try again.",
    );
  });

  it("returns false for unknown actions", async () => {
    const ok = await executeRecoveryAction(
      "invalid_action" as unknown as Parameters<typeof executeRecoveryAction>[0],
      baseContext,
    );

    expect(ok).toBe(false);
  });
});
