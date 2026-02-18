/**
 * Tests for traceId propagation through the join pipeline.
 *
 * Verifies:
 *  - GameSessionContext with traceId is re-used by buildJoinOptions
 *  - GameSessionContext without traceId gets a fresh "gs-" traceId
 *  - buildJoinOptions copies traceId to GameJoinOptions
 */

// =============================================================================
// Mocks — must come BEFORE imports
// =============================================================================

jest.mock("firebase/auth", () => ({
  getAuth: () => ({
    currentUser: {
      getIdToken: jest.fn().mockResolvedValue("mock-firebase-token"),
    },
  }),
}));

jest.mock("@/types/gameProtocol", () => ({
  GAME_PROTOCOL_VERSION: 1,
  getClientBuildInfo: () => ({
    appVersion: "1.0.0",
    platform: "ios",
    protocolVersion: 1,
    commitHash: "test",
  }),
}));

// Real createTraceId import (it's pure — no side effects)
jest.mock("@/utils/trace", () => {
  const original = jest.requireActual("@/utils/trace");
  return {
    ...original,
    createTraceId: jest.fn(original.createTraceId),
  };
});

import { buildJoinOptions } from "@/services/colyseusJoin";
import type { GameSessionContext } from "@/types/gameSession";
import { createTraceId } from "@/utils/trace";

// =============================================================================
// Tests
// =============================================================================

describe("traceId propagation", () => {
  beforeEach(() => {
    (createTraceId as jest.Mock).mockClear();
  });

  it("should re-use invite traceId when present in GameSessionContext", async () => {
    const ctx: GameSessionContext = {
      gameType: "chess" as any,
      entryPoint: "play",
      mode: "colyseus",
      traceId: "inv-abc123-def456",
    };

    const opts = await buildJoinOptions(ctx);

    expect(opts.traceId).toBe("inv-abc123-def456");
    // createTraceId should NOT have been called (we re-used the invite's)
    expect(createTraceId).not.toHaveBeenCalled();
  });

  it("should generate a fresh 'gs-' traceId when GameSessionContext has no traceId", async () => {
    const ctx: GameSessionContext = {
      gameType: "chess" as any,
      entryPoint: "play",
      mode: "colyseus",
    };

    const opts = await buildJoinOptions(ctx);

    expect(opts.traceId).toMatch(/^gs-/);
    expect(createTraceId).toHaveBeenCalledWith("gs");
  });

  it("should generate fresh traceId when ctx.traceId is empty string", async () => {
    const ctx: GameSessionContext = {
      gameType: "chess" as any,
      entryPoint: "play",
      mode: "colyseus",
      traceId: "",
    };

    const opts = await buildJoinOptions(ctx);

    // Empty string is falsy, so should fall back to createTraceId("gs")
    expect(opts.traceId).toMatch(/^gs-/);
    expect(createTraceId).toHaveBeenCalledWith("gs");
  });

  it("should include firestoreGameId and inviteId in join options", async () => {
    const ctx: GameSessionContext = {
      gameType: "chess" as any,
      entryPoint: "play",
      mode: "colyseus",
      firestoreGameId: "game-123",
      inviteId: "inv-456",
      traceId: "inv-trace-xxx",
    };

    const opts = await buildJoinOptions(ctx);

    expect(opts.firestoreGameId).toBe("game-123");
    expect(opts.inviteId).toBe("inv-456");
    expect(opts.traceId).toBe("inv-trace-xxx");
  });

  it("should include protocol/build metadata in join options", async () => {
    const ctx: GameSessionContext = {
      gameType: "chess" as any,
      entryPoint: "play",
      mode: "colyseus",
    };

    const opts = await buildJoinOptions(ctx);

    expect(opts.token).toBe("mock-firebase-token");
    expect(opts.protocolVersion).toBe(1);
    expect(opts.buildInfo).toEqual(
      expect.objectContaining({
        appVersion: "1.0.0",
        protocolVersion: 1,
      }),
    );
    expect(opts.traceId).toMatch(/^gs-/);
  });
});
