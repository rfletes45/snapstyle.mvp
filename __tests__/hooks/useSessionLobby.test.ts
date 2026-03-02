/**
 * useSessionLobby — Derived state & action guard tests
 *
 * These are pure-logic unit tests that exercise the derived values
 * (isInSession, isInvited, canStart, joinedPlayerCount) by constructing
 * mock session snapshots and asserting the expected booleans.
 *
 * Because the hook itself wraps Firestore subscriptions and Cloud Function
 * callables, we test the *derivation logic* that was the source of Bugs A & B
 * rather than rendering the hook in a provider tree.
 */

import type { SessionParticipant } from "../../shared/sessions/types";
import { isLobbyFull, isSessionTerminal } from "../../src/types/gameSessionV3";

// =============================================================================
// Helpers — mirrors the logic inside useSessionLobby after the fix
// =============================================================================

function deriveIsInSession(
  participants: SessionParticipant[],
  uid: string,
): boolean {
  const my = participants.find((p) => p.uid === uid);
  return !!my && my.status !== "invited" && my.status !== "left";
}

function deriveIsInvited(
  participants: SessionParticipant[],
  uid: string,
): boolean {
  const my = participants.find((p) => p.uid === uid);
  return !!my && my.status === "invited";
}

function joinedPlayerCount(participants: SessionParticipant[]): number {
  return participants.filter(
    (p) =>
      p.role !== "spectator" && p.status !== "invited" && p.status !== "left",
  ).length;
}

function makeParticipant(
  overrides: Partial<SessionParticipant> & { uid: string },
): SessionParticipant {
  return {
    displayName: overrides.displayName ?? "Player",
    avatarUrl: "",
    role: overrides.role ?? "player",
    status: overrides.status ?? "joined",
    joinedAt: Date.now(),
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("useSessionLobby derived state", () => {
  const HOST_UID = "host-uid";
  const INVITED_UID = "invited-uid";

  const host = makeParticipant({
    uid: HOST_UID,
    role: "host",
    status: "joined",
    displayName: "HostUser",
  });

  const invitedStub = makeParticipant({
    uid: INVITED_UID,
    role: "player",
    status: "invited",
    displayName: "",
    joinedAt: 0,
  });

  const joinedPlayer = makeParticipant({
    uid: INVITED_UID,
    role: "player",
    status: "joined",
    displayName: "InvitedUser",
  });

  // ── isInSession ─────────────────────────────────────────────────────
  describe("isInSession", () => {
    it("returns false for an invited stub (Bug B guardrail)", () => {
      expect(deriveIsInSession([host, invitedStub], INVITED_UID)).toBe(false);
    });

    it("returns true for a joined player", () => {
      expect(deriveIsInSession([host, joinedPlayer], INVITED_UID)).toBe(true);
    });

    it("returns false for a user who left", () => {
      const leftPlayer = makeParticipant({
        uid: INVITED_UID,
        status: "left",
      });
      expect(deriveIsInSession([host, leftPlayer], INVITED_UID)).toBe(false);
    });

    it("returns false if user is not in participants at all", () => {
      expect(deriveIsInSession([host], "unknown-uid")).toBe(false);
    });

    it("returns true for the host", () => {
      expect(deriveIsInSession([host], HOST_UID)).toBe(true);
    });
  });

  // ── isInvited ───────────────────────────────────────────────────────
  describe("isInvited", () => {
    it("returns true for an invited stub", () => {
      expect(deriveIsInvited([host, invitedStub], INVITED_UID)).toBe(true);
    });

    it("returns false after the user joins", () => {
      expect(deriveIsInvited([host, joinedPlayer], INVITED_UID)).toBe(false);
    });

    it("returns false if user is not present", () => {
      expect(deriveIsInvited([host], INVITED_UID)).toBe(false);
    });
  });

  // ── joinedPlayerCount (drives canStart) ────────────────────────────
  describe("joinedPlayerCount", () => {
    it("excludes invited stubs (Bug B guardrail)", () => {
      expect(joinedPlayerCount([host, invitedStub])).toBe(1);
    });

    it("counts both host and joined player", () => {
      expect(joinedPlayerCount([host, joinedPlayer])).toBe(2);
    });

    it("excludes left players", () => {
      const left = makeParticipant({ uid: "left", status: "left" });
      expect(joinedPlayerCount([host, left])).toBe(1);
    });

    it("excludes spectators", () => {
      const spec = makeParticipant({
        uid: "spec",
        role: "spectator",
        status: "joined",
      });
      expect(joinedPlayerCount([host, spec])).toBe(1);
    });
  });

  // ── isLobbyFull ────────────────────────────────────────────────────
  describe("isLobbyFull", () => {
    it("does not count invited stubs as filling a slot", () => {
      const session = {
        id: "s1",
        gameType: "ticTacToe",
        runtimeType: "realtime" as const,
        visibility: "private" as const,
        phase: "lobby" as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        hostUid: HOST_UID,
        participants: [host, invitedStub],
        maxParticipants: 2,
        maxSpectators: 5,
        participantUids: [HOST_UID, INVITED_UID],
      };
      expect(isLobbyFull(session)).toBe(false);
    });

    it("is full when all slots taken by joined players", () => {
      const session = {
        id: "s1",
        gameType: "ticTacToe",
        runtimeType: "realtime" as const,
        visibility: "private" as const,
        phase: "lobby" as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        hostUid: HOST_UID,
        participants: [host, joinedPlayer],
        maxParticipants: 2,
        maxSpectators: 5,
        participantUids: [HOST_UID, INVITED_UID],
      };
      expect(isLobbyFull(session)).toBe(true);
    });
  });

  // ── isSessionTerminal ──────────────────────────────────────────────
  describe("isSessionTerminal", () => {
    it.each(["resolved", "abandoned", "expired"] as const)(
      "returns true for %s",
      (phase) => {
        expect(isSessionTerminal(phase)).toBe(true);
      },
    );

    it.each(["lobby", "starting", "active"] as const)(
      "returns false for %s",
      (phase) => {
        expect(isSessionTerminal(phase)).toBe(false);
      },
    );
  });
});
