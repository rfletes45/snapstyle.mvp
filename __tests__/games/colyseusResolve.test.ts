/**
 * Tests for resolveColyseusRoomName
 */

// Mock expo-constants before any imports that use it
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      hostUri: "localhost:8081",
    },
  },
}));

jest.mock("react-native", () => ({
  Platform: { select: (obj: any) => obj.default ?? "localhost", OS: "ios" },
}));

// ─── resolveColyseusRoomName ────────────────────────────────────────────────
import {
  getColyseusRoomName,
  resolveColyseusRoomName,
} from "@/config/colyseus";
import { GameErrorCode } from "@/types/gameErrors";

describe("resolveColyseusRoomName", () => {
  it("resolves a direct match (Colyseus key)", () => {
    expect(resolveColyseusRoomName("chess_game")).toBe("chess");
  });

  it("resolves when ExtendedGameType lacks _game suffix", () => {
    // "chess" → tries "chess_game" → "chess"
    expect(resolveColyseusRoomName("chess")).toBe("chess");
  });

  it("resolves keys that already end with _game in the map", () => {
    // "pong_game" maps directly
    expect(resolveColyseusRoomName("pong_game")).toBe("pong");
  });

  it("throws GameError for unknown game type", () => {
    try {
      resolveColyseusRoomName("nonexistent_foo");
      fail("Should have thrown");
    } catch (err: any) {
      expect(err.code).toBe(GameErrorCode.JOIN_ROOM_NOT_FOUND);
      expect(err.context.gameType).toBe("nonexistent_foo");
    }
  });

  it("existing getColyseusRoomName still returns null for unknown", () => {
    expect(getColyseusRoomName("nonexistent_foo")).toBeNull();
  });
});
