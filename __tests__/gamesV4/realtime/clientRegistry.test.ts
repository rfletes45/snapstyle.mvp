/**
 * Tests — Realtime Client Types & Registry (Client-Side)
 *
 * Tests for the client-side realtime type system and registry.
 */

import type { RealtimeClientDefinition } from "@/gamesV4/realtime/types";
import { DEFAULT_RECONNECT_CONFIG } from "@/gamesV4/realtime/types";

describe("RealtimeClientDefinition types", () => {
  it("creates a valid definition with required fields", () => {
    const def: RealtimeClientDefinition = {
      gameId: "sketch_party_game",
      roomName: "sketch_party",
      displayName: "Sketch Party",
      serverMessageTypes: ["state_sync", "stroke_begin", "chat"],
      initialState: { phase: "waiting" },
    };

    expect(def.gameId).toBe("sketch_party_game");
    expect(def.roomName).toBe("sketch_party");
    expect(def.serverMessageTypes).toHaveLength(3);
  });

  it("supports optional reconnect config", () => {
    const def: RealtimeClientDefinition = {
      gameId: "pong_game",
      roomName: "pong",
      displayName: "Pong",
      serverMessageTypes: ["state_sync"],
      initialState: {},
      reconnect: {
        maxAttempts: 10,
        baseDelayMs: 500,
      },
    };

    expect(def.reconnect?.maxAttempts).toBe(10);
    expect(def.reconnect?.baseDelayMs).toBe(500);
  });

  it("provides sensible default reconnect config", () => {
    expect(DEFAULT_RECONNECT_CONFIG.enabled).toBe(true);
    expect(DEFAULT_RECONNECT_CONFIG.maxAttempts).toBe(5);
    expect(DEFAULT_RECONNECT_CONFIG.baseDelayMs).toBe(1000);
    expect(DEFAULT_RECONNECT_CONFIG.maxDelayMs).toBe(15000);
  });
});

describe("Client Registry", () => {
  // Test the registry logic pattern (same as server-side pattern)
  const registry = new Map<string, RealtimeClientDefinition>();

  function register(def: RealtimeClientDefinition): void {
    registry.set(def.gameId, def);
  }

  function get(gameId: string): RealtimeClientDefinition | undefined {
    return registry.get(gameId);
  }

  function isRealtime(gameId: string): boolean {
    return registry.has(gameId);
  }

  beforeEach(() => {
    registry.clear();
  });

  it("registers and retrieves a definition", () => {
    register({
      gameId: "sketch_party_game",
      roomName: "sketch_party",
      displayName: "Sketch Party",
      serverMessageTypes: ["state_sync"],
      initialState: {},
    });

    expect(get("sketch_party_game")).toBeDefined();
    expect(get("sketch_party_game")?.roomName).toBe("sketch_party");
  });

  it("identifies realtime games", () => {
    register({
      gameId: "sketch_party_game",
      roomName: "sketch_party",
      displayName: "Sketch Party",
      serverMessageTypes: [],
      initialState: {},
    });

    expect(isRealtime("sketch_party_game")).toBe(true);
    expect(isRealtime("chess")).toBe(false);
  });
});
