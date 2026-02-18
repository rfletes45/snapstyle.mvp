/**
 * GameLobby – Unified reusable lobby/queue component for ALL multiplayer games.
 *
 * Follows the same visual patterns as MiniGolfDuels and SketchParty lobbies.
 * Provides:
 *   - Player list with ready indicators
 *   - Host controls (start game, invite)
 *   - Queue mode display (waiting for invite resolution)
 *   - Countdown overlay
 *   - Error state with "Go Back" action
 *
 * Usage:
 *   <GameLobby
 *     lobby={lobbyHook}
 *     gameTitle="Chess"
 *     gameIcon="♟️"
 *     onInvitePress={() => setShowInvitePicker(true)}
 *     onLeave={handleBack}
 *   />
 *
 * @module components/games/GameLobby
 */

import type { UseGameLobbyReturn } from "@/hooks/useGameLobby";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// =============================================================================
// Types
// =============================================================================

interface GameLobbyProps {
  /** The lobby hook return value */
  lobby: UseGameLobbyReturn;
  /** Display title for the game */
  gameTitle: string;
  /** Emoji icon for the game */
  gameIcon?: string;
  /** Called when the user wants to open the invite picker */
  onInvitePress?: () => void;
  /** Called when the user wants to leave the lobby */
  onLeave: () => void;
  /** Optional: render custom settings UI (host-only settings, difficulty, etc.) */
  renderSettings?: () => React.ReactNode;
  /** Optional: render custom content above the player list */
  renderHeader?: () => React.ReactNode;
  /** Whether to show the "Ready" button (some games auto-ready) */
  showReadyButton?: boolean;
  /** External ready handler (delegates to Colyseus hook) */
  onReadyPress?: () => void;
  /** Whether this player is ready (from Colyseus state) */
  isReady?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function GameLobby({
  lobby,
  gameTitle,
  gameIcon = "🎮",
  onInvitePress,
  onLeave,
  renderSettings,
  renderHeader,
  showReadyButton = true,
  onReadyPress,
  isReady = false,
}: GameLobbyProps) {
  const {
    phase,
    isHost,
    players,
    countdown,
    errorMessage,
    isQueueMode,
    canStart,
    minPlayers,
  } = lobby;

  // ── Error state ─────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>
            {errorMessage || "Something went wrong."}
          </Text>
          <TouchableOpacity style={styles.leaveButton} onPress={onLeave}>
            <Text style={styles.leaveButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Initializing / Starting (brief transition) ─────────────────────────
  if (phase === "initializing" || phase === "starting") {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#BB86FC" />
          <Text style={styles.statusText}>
            {phase === "starting" ? "Starting game..." : "Setting up..."}
          </Text>
        </View>
      </View>
    );
  }

  // ── Countdown ───────────────────────────────────────────────────────────
  if (phase === "countdown") {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.countdownNumber}>{countdown}</Text>
          <Text style={styles.statusText}>Get ready!</Text>
        </View>
      </View>
    );
  }

  // ── Queue mode (waiting for invite to resolve) ──────────────────────────
  if (phase === "queue") {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.gameIcon}>{gameIcon}</Text>
          <Text style={styles.gameTitle}>{gameTitle}</Text>
          <Text style={styles.subtitle}>Waiting for game to start...</Text>
        </View>

        {renderHeader?.()}

        {/* Player slots from invite */}
        <View style={styles.playerList}>
          <Text style={styles.sectionTitle}>Players</Text>
          {players.map((p) => (
            <View key={p.uid} style={styles.playerRow}>
              <Text style={styles.playerName}>
                {p.isHost ? "👑 " : ""}
                {p.displayName}
              </Text>
              <Text style={styles.playerStatus}>Joined</Text>
            </View>
          ))}
          {players.length < minPlayers && (
            <View style={styles.playerRow}>
              <Text style={styles.emptySlot}>
                Waiting for {minPlayers - players.length} more...
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {lobby.isHost && canStart && (
            <TouchableOpacity
              style={styles.startButton}
              onPress={lobby.startGame}
            >
              <Text style={styles.startButtonText}>Start Game</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.leaveButton} onPress={onLeave}>
            <Text style={styles.leaveButtonText}>Leave Queue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Waiting (lobby) ─────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.gameIcon}>{gameIcon}</Text>
        <Text style={styles.gameTitle}>{gameTitle}</Text>
        <Text style={styles.subtitle}>Waiting for opponent...</Text>
      </View>

      {renderHeader?.()}

      {/* Host settings */}
      {isHost && renderSettings?.()}

      {/* Player list */}
      <View style={styles.playerList}>
        <Text style={styles.sectionTitle}>Players</Text>
        {players.map((p) => (
          <View key={p.uid} style={styles.playerRow}>
            <Text style={styles.playerName}>
              {p.isHost ? "👑 " : ""}
              {p.displayName}
            </Text>
            <Text
              style={[
                styles.playerStatus,
                p.ready ? styles.readyStatus : styles.notReadyStatus,
              ]}
            >
              {p.ready ? "Ready ✓" : "Not Ready"}
            </Text>
          </View>
        ))}
        {players.length < minPlayers && (
          <View style={styles.playerRow}>
            <Text style={styles.emptySlot}>
              Waiting for {minPlayers - players.length} more player
              {minPlayers - players.length > 1 ? "s" : ""}...
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {showReadyButton && !isReady && (
          <TouchableOpacity
            style={styles.readyButton}
            onPress={onReadyPress || lobby.sendReady}
          >
            <Text style={styles.readyButtonText}>Ready</Text>
          </TouchableOpacity>
        )}
        {showReadyButton && isReady && (
          <View style={styles.readyIndicator}>
            <Text style={styles.readyIndicatorText}>✓ You&apos;re Ready</Text>
          </View>
        )}

        {onInvitePress && (
          <TouchableOpacity style={styles.inviteButton} onPress={onInvitePress}>
            <Text style={styles.inviteButtonText}>📨 Invite</Text>
          </TouchableOpacity>
        )}

        {isHost && canStart && (
          <TouchableOpacity
            style={styles.startButton}
            onPress={lobby.startGame}
          >
            <Text style={styles.startButtonText}>Start Game</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.leaveButton} onPress={onLeave}>
          <Text style={styles.leaveButtonText}>Leave</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 20,
  },
  gameIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  gameTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#AAAAAA",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  playerList: {
    marginTop: 20,
    marginBottom: 20,
  },
  playerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  playerName: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  playerStatus: {
    fontSize: 13,
    fontWeight: "600",
  },
  readyStatus: {
    color: "#4CAF50",
  },
  notReadyStatus: {
    color: "#888888",
  },
  emptySlot: {
    fontSize: 14,
    color: "#666666",
    fontStyle: "italic",
  },
  actions: {
    marginTop: "auto",
    gap: 10,
    paddingBottom: 20,
  },
  readyButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  readyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  readyIndicator: {
    backgroundColor: "#1B5E20",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  readyIndicatorText: {
    color: "#81C784",
    fontSize: 16,
    fontWeight: "600",
  },
  inviteButton: {
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333333",
  },
  inviteButtonText: {
    color: "#BB86FC",
    fontSize: 16,
    fontWeight: "600",
  },
  startButton: {
    backgroundColor: "#BB86FC",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  startButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "bold",
  },
  leaveButton: {
    backgroundColor: "transparent",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444444",
  },
  leaveButtonText: {
    color: "#FF5252",
    fontSize: 14,
    fontWeight: "600",
  },
  countdownNumber: {
    fontSize: 72,
    fontWeight: "bold",
    color: "#BB86FC",
  },
  statusText: {
    fontSize: 16,
    color: "#AAAAAA",
    marginTop: 12,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: "#FF5252",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
});

export default GameLobby;
