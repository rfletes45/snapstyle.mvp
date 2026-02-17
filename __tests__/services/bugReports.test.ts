/**
 * Tests for bugReports service — recordBugReport convenience wrapper.
 *
 * Verifies:
 *  - recordBugReport delegates to submitBugReport
 *  - Maps code/userMessage/context correctly
 *  - Falls back when fields are missing
 */

import { recordBugReport } from "@/services/bugReports";

// =============================================================================
// Mocks
// =============================================================================

// Mock the Firestore and Auth dependencies used by submitBugReport
jest.mock("@/services/firebase", () => ({
  getFirestoreInstance: jest.fn(() => ({})),
  getAuthInstance: jest.fn(() => ({
    currentUser: { uid: "testuser", displayName: "Test User", email: null },
  })),
}));

jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn().mockResolvedValue({ id: "report-001" }),
  collection: jest.fn(),
  serverTimestamp: jest.fn(() => "SERVER_TS"),
}));

jest.mock("@/types/gameProtocol", () => ({
  getClientBuildInfo: () => ({
    appVersion: "1.0.0",
    platform: "ios",
    protocolVersion: 1,
    commitHash: "abc123",
  }),
}));

// =============================================================================
// Tests
// =============================================================================

describe("bugReports service", () => {
  describe("recordBugReport", () => {
    it("should return a report ID", async () => {
      const id = await recordBugReport({
        code: "JOIN_TIMEOUT",
        userMessage: "Stuck loading",
        context: {
          gameType: "chess_game",
          roomId: "room-1",
          traceId: "inv-abc",
        },
      });

      expect(id).toBe("report-001");
    });

    it("should pass code as errorCode to submitBugReport", async () => {
      // We test this indirectly — addDoc should be called with errorCode
      const { addDoc } = require("firebase/firestore");
      (addDoc as jest.Mock).mockClear();

      await recordBugReport({
        code: "ROOM_STALE",
        context: { roomId: "r1" },
      });

      expect(addDoc).toHaveBeenCalledTimes(1);
      const docData = (addDoc as jest.Mock).mock.calls[0][1];
      expect(docData.errorCode).toBe("ROOM_STALE");
    });

    it("should pass userMessage as both errorMessage and userNote", async () => {
      const { addDoc } = require("firebase/firestore");
      (addDoc as jest.Mock).mockClear();

      await recordBugReport({
        code: "STUCK_WAITING",
        userMessage: "Everything is frozen",
      });

      const docData = (addDoc as jest.Mock).mock.calls[0][1];
      expect(docData.userNote).toBe("Everything is frozen");
      expect(docData.errorMessage).toBe("Everything is frozen");
    });

    it("should spread context fields into the report", async () => {
      const { addDoc } = require("firebase/firestore");
      (addDoc as jest.Mock).mockClear();

      await recordBugReport({
        context: {
          gameType: "chess_game",
          roomId: "room-x",
          traceId: "inv-trace-123",
          roomPhase: "playing",
          lobbyPhase: "starting",
        },
      });

      const docData = (addDoc as jest.Mock).mock.calls[0][1];
      expect(docData.gameType).toBe("chess_game");
      expect(docData.roomId).toBe("room-x");
      expect(docData.traceId).toBe("inv-trace-123");
      expect(docData.roomPhase).toBe("playing");
      expect(docData.lobbyPhase).toBe("starting");
    });

    it("should handle missing fields gracefully", async () => {
      const id = await recordBugReport({});
      expect(id).toBe("report-001");
    });
  });
});
