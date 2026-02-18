import { mapColyseusJoinError } from "@/services/colyseusErrorMap";
import { GameErrorCode } from "@/types/gameErrors";

describe("mapColyseusJoinError", () => {
  it("maps protocol mismatch errors", () => {
    expect(
      mapColyseusJoinError(new Error("Protocol version mismatch: update the app")),
    ).toBe(GameErrorCode.PROTOCOL_VERSION_MISMATCH);
  });

  it("maps full-room errors", () => {
    expect(mapColyseusJoinError(new Error("room full maxClients reached"))).toBe(
      GameErrorCode.JOIN_ROOM_FULL,
    );
  });

  it("maps auth/token errors", () => {
    expect(mapColyseusJoinError(new Error("invalid auth token"))).toBe(
      GameErrorCode.AUTH_TOKEN_INVALID,
    );
  });

  it("maps timeout errors", () => {
    expect(mapColyseusJoinError(new Error("request timed out"))).toBe(
      GameErrorCode.JOIN_TIMEOUT,
    );
  });

  it("maps room-not-found errors", () => {
    expect(mapColyseusJoinError(new Error("room not found"))).toBe(
      GameErrorCode.JOIN_ROOM_NOT_FOUND,
    );
  });

  it("falls back to JOIN_FAILED for unknown errors", () => {
    expect(mapColyseusJoinError(new Error("unexpected failure"))).toBe(
      GameErrorCode.JOIN_FAILED,
    );
    expect(mapColyseusJoinError("weird string")).toBe(GameErrorCode.JOIN_FAILED);
    expect(mapColyseusJoinError({})).toBe(GameErrorCode.JOIN_FAILED);
  });
});
