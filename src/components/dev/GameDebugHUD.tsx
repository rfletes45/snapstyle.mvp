/**
 * GameDebugHUD — Dev-only overlay for debugging multiplayer game state.
 *
 * Gated behind `__DEV__` — never rendered in production builds.
 *
 * Shows:
 *   - gameType, inviteId, firestoreGameId, roomId, traceId
 *   - lobby phase / room phase
 *   - current user uid + sessionId
 *   - players & ready flags
 *   - lastPatchAt / stale duration
 *   - watchdog state
 *
 * Provides a "Copy Debug Info" button that calls Share.share() with a
 * formatted JSON blob containing all visible state — useful for bug
 * reports and QA hand-offs.
 *
 * @module components/dev/GameDebugHUD
 */

import type { UseGameLobbyControllerReturn } from "@/hooks/useGameLobbyController";
import type { Room } from "@colyseus/sdk";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// =============================================================================
// Types
// =============================================================================

export interface GameDebugHUDProps {
  /** The lobby controller (provides most state). */
  controller: UseGameLobbyControllerReturn;
  /** The Colyseus room (for roomId, sessionId). */
  room?: Room | null;
  /** The game type (e.g. "chess_game"). */
  gameType: string;
  /** The invite's traceId (from invite doc). */
  traceId?: string | null;
  /** The game-session traceId (generated at join time). */
  sessionTraceId?: string | null;
  /** Firestore game document ID. */
  firestoreGameId?: string | null;
  /** Invite ID. */
  inviteId?: string | null;
  /** Additional context (arbitrary key-value pairs). */
  extra?: Record<string, unknown>;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Renders nothing in production. In dev, shows a collapsible debug overlay.
 */
export function GameDebugHUD(props: GameDebugHUDProps) {
  // Gate: never render in production
  if (!__DEV__) return null;
  return <GameDebugHUDInner {...props} />;
}

function GameDebugHUDInner({
  controller,
  room,
  gameType,
  traceId,
  sessionTraceId,
  firestoreGameId,
  inviteId,
  extra,
}: GameDebugHUDProps) {
  const [expanded, setExpanded] = useState(false);

  const { lobby, roomPhase, watchdog, activeError, connectionBanner } =
    controller;

  // Compute player list string
  const playersStr = useMemo(() => {
    if (!lobby.players || lobby.players.length === 0) return "(none)";
    return lobby.players
      .map(
        (p, i) =>
          `${i}: ${p.displayName || p.uid?.slice(0, 8) || "?"}${p.ready ? " ✓" : ""}${p.isHost ? " [host]" : ""}`,
      )
      .join("\n");
  }, [lobby.players]);

  // Build the full debug blob
  const debugBlob = useMemo(() => {
    const blob: Record<string, unknown> = {
      gameType,
      inviteId: inviteId ?? lobby.inviteId ?? null,
      firestoreGameId: firestoreGameId ?? lobby.effectiveGameId ?? null,
      roomId: room?.roomId ?? null,
      traceId: traceId ?? lobby.invite?.traceId ?? null,
      sessionTraceId: sessionTraceId ?? null,
      myUid: lobby.players?.[0]?.uid ?? null,
      mySessionId: room?.sessionId ?? null,
      lobbyPhase: lobby.phase,
      roomPhase: roomPhase ?? null,
      isHost: lobby.isHost,
      isSpectator: lobby.isSpectator,
      playerCount: lobby.players?.length ?? 0,
      players: lobby.players?.map((p) => ({
        uid: p.uid,
        name: p.displayName,
        ready: p.ready,
        isHost: p.isHost,
      })),
      watchdog: {
        isStuck: watchdog.isStuck,
        stuckDurationSec: watchdog.stuckDurationSec,
        lobbyStuck: watchdog.lobbyStuck,
        lobbyStuckDurationSec: watchdog.lobbyStuckDurationSec,
      },
      connectionBanner,
      activeError: activeError
        ? {
            code: activeError.code,
            message: activeError.message,
            recoveries: activeError.recoveries?.map((r) => r.id),
          }
        : null,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    };
    if (extra) {
      blob.extra = extra;
    }
    return blob;
  }, [
    gameType,
    inviteId,
    firestoreGameId,
    traceId,
    sessionTraceId,
    room,
    lobby,
    roomPhase,
    watchdog,
    connectionBanner,
    activeError,
    extra,
  ]);

  const handleCopy = useCallback(async () => {
    const text = JSON.stringify(debugBlob, null, 2);
    try {
      await Share.share({ message: text, title: "Game Debug Info" });
    } catch {
      Alert.alert("Debug Info", text);
    }
  }, [debugBlob]);

  if (!expanded) {
    return (
      <TouchableOpacity
        style={styles.collapsedPill}
        onPress={() => setExpanded(true)}
        accessibilityLabel="Expand debug HUD"
      >
        <Text style={styles.pillText}>🐛</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Debug HUD</Text>
        <TouchableOpacity onPress={() => setExpanded(false)}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* IDs */}
      <Section label="IDs">
        <Row label="gameType" value={gameType} />
        <Row label="inviteId" value={inviteId ?? lobby.inviteId} />
        <Row
          label="firestoreGameId"
          value={firestoreGameId ?? lobby.effectiveGameId}
        />
        <Row label="roomId" value={room?.roomId} />
        <Row
          label="traceId (invite)"
          value={traceId ?? lobby.invite?.traceId}
        />
        <Row label="traceId (session)" value={sessionTraceId} />
      </Section>

      {/* Phase / Status */}
      <Section label="Phase">
        <Row label="lobby" value={lobby.phase} />
        <Row label="room" value={roomPhase} />
        <Row label="isHost" value={String(lobby.isHost)} />
        <Row label="isSpectator" value={String(lobby.isSpectator)} />
      </Section>

      {/* Me */}
      <Section label="Me">
        <Row label="uid" value={lobby.players?.[0]?.uid} />
        <Row label="sessionId" value={room?.sessionId} />
      </Section>

      {/* Players */}
      <Section label={`Players (${lobby.players?.length ?? 0})`}>
        <Text style={styles.mono}>{playersStr}</Text>
      </Section>

      {/* Watchdog */}
      <Section label="Watchdog">
        <Row label="isStuck" value={String(watchdog.isStuck)} />
        <Row label="stuckSec" value={String(watchdog.stuckDurationSec)} />
        <Row label="lobbyStuck" value={String(watchdog.lobbyStuck)} />
        <Row
          label="lobbyStuckSec"
          value={String(watchdog.lobbyStuckDurationSec)}
        />
      </Section>

      {/* Error */}
      {activeError && (
        <Section label="Active Error">
          <Row label="code" value={activeError.code} />
          <Row label="msg" value={activeError.message} />
        </Section>
      )}

      {/* Banner */}
      {connectionBanner && (
        <Section label="Banner">
          <Text style={styles.mono}>{connectionBanner}</Text>
        </Section>
      )}

      {/* Copy button */}
      <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
        <Text style={styles.copyBtnText}>📋 Copy Debug Info</Text>
      </TouchableOpacity>
    </View>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}:</Text>
      <Text style={styles.rowValue} numberOfLines={1} ellipsizeMode="middle">
        {value ?? "—"}
      </Text>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  collapsedPill: {
    position: "absolute",
    top: 60,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  pillText: {
    fontSize: 16,
  },
  container: {
    position: "absolute",
    top: 60,
    right: 8,
    width: 280,
    maxHeight: 500,
    backgroundColor: "rgba(0,0,0,0.88)",
    borderRadius: 10,
    padding: 10,
    zIndex: 9999,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  headerText: {
    color: "#0f0",
    fontWeight: "bold",
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  closeBtn: {
    color: "#f55",
    fontSize: 16,
    fontWeight: "bold",
    paddingHorizontal: 6,
  },
  section: {
    marginBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)",
    paddingTop: 4,
  },
  sectionLabel: {
    color: "#8f8",
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 2,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1,
  },
  rowLabel: {
    color: "#aaa",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  rowValue: {
    color: "#fff",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    maxWidth: 160,
    textAlign: "right",
  },
  mono: {
    color: "#ccc",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  copyBtn: {
    marginTop: 8,
    backgroundColor: "#333",
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: "center",
  },
  copyBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
