/**
 * MultiplayerLobbyOverlay — Universal lobby UI for ALL multiplayer games.
 *
 * Renders a full-screen overlay on top of the game screen while the
 * match hasn't started yet, or when an error/reconnecting state is active.
 *
 * Delegates to the existing GameLobby component for player lists, queue
 * display, countdown, and error states.  Adds:
 *   - Connection banner ("Reconnecting…", "Opponent disconnected…")
 *   - Recovery action buttons (from GameError.recoveries)
 *   - Watchdog "stuck" indicator
 *
 * Usage:
 *   <MultiplayerLobbyOverlay controller={lobbyController}>
 *     {children — the actual game view}
 *   </MultiplayerLobbyOverlay>
 *
 * When the controller phase is "playing", the overlay is hidden and
 * children are rendered normally.
 *
 * @module components/games/MultiplayerLobbyOverlay
 */

import GameLobby from "@/components/games/GameLobby";
import type { UseGameLobbyControllerReturn } from "@/hooks/useGameLobbyController";
import type { GameRecoveryAction } from "@/types/gameErrors";
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

export interface MultiplayerLobbyOverlayProps {
  /** Controller hook return value. */
  controller: UseGameLobbyControllerReturn;
  /** Display title for the game (e.g. "Chess"). */
  gameTitle: string;
  /** Emoji icon (e.g. "♟️"). */
  gameIcon?: string;
  /** Called when the user wants to open the invite picker. */
  onInvitePress?: () => void;
  /** Called when the user leaves (navigates away). */
  onLeave: () => void;
  /** Optional custom settings UI (host-only). */
  renderSettings?: () => React.ReactNode;
  /** Whether to show the Ready button (some games auto-ready). */
  showReadyButton?: boolean;
  /** External ready handler (delegates to Colyseus hook). */
  onReadyPress?: () => void;
  /** Whether this player has sent a "ready" signal. */
  isReady?: boolean;
  /** Children: the actual game view (rendered when phase is "playing"). */
  children: React.ReactNode;
}

// =============================================================================
// Component
// =============================================================================

export function MultiplayerLobbyOverlay({
  controller,
  gameTitle,
  gameIcon = "🎮",
  onInvitePress,
  onLeave,
  renderSettings,
  showReadyButton = true,
  onReadyPress,
  isReady = false,
  children,
}: MultiplayerLobbyOverlayProps) {
  const { lobby, roomPhase, connectionBanner, watchdog, activeError } =
    controller;

  // ── Determine visibility ──────────────────────────────────────────────
  // Show the overlay when:
  //   1. Lobby phase is not yet "playing" (waiting, queue, countdown, etc.)
  //   2. An error is active that blocks gameplay
  //   3. Watchdog signals "stuck" (no Colyseus patch for too long)
  const lobbyPhase = lobby.phase;
  const showOverlay =
    lobbyPhase !== "playing" || activeError != null || watchdog.isStuck;

  // If phase is "playing" and no blockers, just render children
  if (!showOverlay) {
    return (
      <View style={styles.fill}>
        {/* Connection banner can persist as a thin bar during gameplay */}
        {connectionBanner && (
          <View style={styles.connectionBar}>
            <Text style={styles.connectionBarText}>{connectionBanner}</Text>
          </View>
        )}
        {children}
      </View>
    );
  }

  // ── Full overlay ─────────────────────────────────────────────────────
  return (
    <View style={styles.fill}>
      {/* Connection banner at top of lobby */}
      {connectionBanner && (
        <View style={styles.connectionBanner}>
          <ActivityIndicator size="small" color="#FFD54F" />
          <Text style={styles.connectionBannerText}>{connectionBanner}</Text>
        </View>
      )}

      {/* Watchdog stuck indicator */}
      {watchdog.isStuck && !activeError && (
        <View style={styles.watchdogBanner}>
          <Text style={styles.watchdogText}>
            ⏳ Waiting for server response ({watchdog.stuckDurationSec}s)…
          </Text>
        </View>
      )}

      {/* Error with recovery actions */}
      {activeError ? (
        <View style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorMessage}>{activeError.message}</Text>

            {/* Recovery action buttons */}
            {activeError.recoveries && activeError.recoveries.length > 0 && (
              <View style={styles.recoveryActions}>
                {activeError.recoveries.map((action: GameRecoveryAction) => (
                  <TouchableOpacity
                    key={action.id}
                    style={[
                      styles.recoveryButton,
                      action.id === "retry_join" || action.id === "rejoin_room"
                        ? styles.primaryRecovery
                        : styles.secondaryRecovery,
                    ]}
                    onPress={() => controller.handleRecoveryAction(action.id)}
                  >
                    <Text
                      style={[
                        styles.recoveryButtonText,
                        action.id === "retry_join" ||
                        action.id === "rejoin_room"
                          ? styles.primaryRecoveryText
                          : styles.secondaryRecoveryText,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Always show a Leave option */}
            <TouchableOpacity style={styles.leaveLink} onPress={onLeave}>
              <Text style={styles.leaveLinkText}>Leave Game</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Normal lobby (waiting / queue / countdown / initializing) */
        <GameLobby
          lobby={lobby}
          gameTitle={gameTitle}
          gameIcon={gameIcon}
          onInvitePress={onInvitePress}
          onLeave={onLeave}
          renderSettings={renderSettings}
          showReadyButton={showReadyButton}
          onReadyPress={onReadyPress}
          isReady={isReady}
        />
      )}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },

  // ── Connection banners ────────────────────────────────────────────────
  connectionBar: {
    backgroundColor: "#FF6F00",
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  connectionBarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  connectionBanner: {
    backgroundColor: "#33291A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  connectionBannerText: {
    color: "#FFD54F",
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Watchdog ──────────────────────────────────────────────────────────
  watchdogBanner: {
    backgroundColor: "#1A1A33",
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  watchdogText: {
    color: "#90CAF9",
    fontSize: 12,
    fontWeight: "500",
  },

  // ── Error ─────────────────────────────────────────────────────────────
  errorContainer: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorContent: {
    alignItems: "center",
    maxWidth: 320,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#AAAAAA",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  recoveryActions: {
    width: "100%",
    gap: 10,
    marginBottom: 16,
  },
  recoveryButton: {
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  primaryRecovery: {
    backgroundColor: "#BB86FC",
  },
  secondaryRecovery: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#333333",
  },
  recoveryButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  primaryRecoveryText: {
    color: "#000000",
  },
  secondaryRecoveryText: {
    color: "#BBBBBB",
  },
  leaveLink: {
    paddingVertical: 12,
  },
  leaveLinkText: {
    color: "#FF5252",
    fontSize: 14,
    fontWeight: "500",
  },
});

export default MultiplayerLobbyOverlay;
