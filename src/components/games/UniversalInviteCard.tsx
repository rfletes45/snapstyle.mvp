/**
 * UniversalInviteCard - OVERHAULED
 *
 * Unified game invite card with:
 * - Queue progress visualization
 * - Player slots display
 * - Host controls (start early, cancel)
 * - Join/Leave/Spectate actions
 *
 * REPLACES: Legacy GameInviteCard.tsx
 *
 * @file src/components/games/UniversalInviteCard.tsx
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Divider,
  Text,
  useTheme,
} from "react-native-paper";

import { BorderRadius, Spacing } from "@/constants/theme";
import { completeGameInvite } from "@/services/gameInvites";
import { GAME_METADATA, type ExtendedGameType } from "@/types/games";
import type { UniversalGameInvite } from "@/types/turnBased";
import { PlayerSlots } from "./PlayerSlots";
import { QueueProgressBar } from "./QueueProgressBar";

import { createLogger } from "@/utils/log";
const logger = createLogger("components/games/UniversalInviteCard");
// =============================================================================
// Types
// =============================================================================

export interface UniversalInviteCardProps {
  /** The invite to display */
  invite: UniversalGameInvite;
  /** Current user's ID */
  currentUserId: string;
  /** Join the game queue */
  onJoin: () => Promise<void>;
  /** Leave the game queue */
  onLeave: () => Promise<void>;
  /** Start game early (host only) - optional until Phase 3 */
  onStartEarly?: () => Promise<void>;
  /** Cancel the invite (host only) */
  onCancel: () => Promise<void>;
  /** Navigate to active game */
  onPlay?: (gameId: string, gameType: string, inviteId?: string) => void;
  /** Spectate an active game (Colyseus-based) */
  onSpectate?: () => void;
  /** Compact mode */
  compact?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getGameInfo(gameType: string): { name: string; icon: string } {
  const metadata = GAME_METADATA[gameType as ExtendedGameType];
  return metadata
    ? { name: metadata.name, icon: metadata.icon }
    : { name: gameType, icon: "🎮" };
}

function getStatusInfo(
  status: string,
  slotsRemaining: number,
): { text: string; color: string } {
  switch (status) {
    case "pending":
      return {
        text:
          slotsRemaining === 1 ? "1 spot left" : `${slotsRemaining} spots left`,
        color: "#FFA500",
      };
    case "filling":
      return { text: `${slotsRemaining} more needed`, color: "#FFA500" };
    case "ready":
      return { text: "Ready to start!", color: "#4CAF50" };
    case "starting":
      return { text: "Starting…", color: "#8BC34A" };
    case "active":
      return { text: "In Progress", color: "#2196F3" };
    case "completed":
      return { text: "Finished", color: "#9E9E9E" };
    case "expired":
      return { text: "Expired", color: "#F44336" };
    case "cancelled":
      return { text: "Cancelled", color: "#F44336" };
    default:
      return { text: status, color: "#9E9E9E" };
  }
}

// =============================================================================
// Component
// =============================================================================

export function UniversalInviteCard({
  invite,
  currentUserId,
  onJoin,
  onLeave,
  onStartEarly,
  onCancel,
  onPlay,
  onSpectate,
  compact = false,
}: UniversalInviteCardProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Phase 2 hardening: never render a terminal or chat-hidden invite
  // -------------------------------------------------------------------------
  const TERMINAL_STATUSES = ["completed", "declined", "expired", "cancelled"];
  if (
    TERMINAL_STATUSES.includes(invite.status) ||
    invite.chatVisibility === "hidden"
  ) {
    return null;
  }

  // -------------------------------------------------------------------------
  // Computed State
  // -------------------------------------------------------------------------
  const isHost = invite.claimedSlots[0]?.playerId === currentUserId;
  const hasJoined = invite.claimedSlots.some(
    (s) => s.playerId === currentUserId,
  );
  const isFull = invite.claimedSlots.length >= invite.requiredPlayers;
  const slotsRemaining = invite.requiredPlayers - invite.claimedSlots.length;
  const isExpired = Date.now() > invite.expiresAt;

  // Get game metadata for min players check
  const metadata = GAME_METADATA[invite.gameType as ExtendedGameType];
  const minPlayers = metadata?.minPlayers ?? 2;

  // Action availability
  const isStarting = invite.status === "starting";
  const canJoin =
    !hasJoined &&
    !isFull &&
    !isExpired &&
    !isStarting &&
    ["pending", "filling"].includes(invite.status);
  const canLeave =
    hasJoined &&
    !isHost &&
    !isStarting &&
    ["pending", "filling", "ready"].includes(invite.status);
  // Can start early if host and have minimum players, OR can start if game is ready
  const canStartEarly =
    isHost &&
    onStartEarly &&
    !isStarting &&
    ["pending", "filling"].includes(invite.status) &&
    invite.claimedSlots.length >= minPlayers;
  const canStartGame = isHost && onStartEarly && invite.status === "ready";
  const canCancel =
    isHost &&
    !isStarting &&
    ["pending", "filling", "ready"].includes(invite.status);
  const canPlay = hasJoined && invite.gameId && invite.status === "active";
  const canSpectate =
    !hasJoined &&
    onSpectate &&
    invite.spectatingEnabled &&
    invite.gameId &&
    invite.status === "active";

  // Game & status info
  const { name: gameName, icon: gameIcon } = getGameInfo(invite.gameType);
  const statusInfo = getStatusInfo(invite.status, slotsRemaining);

  // Phase 2: staleness detection — warn if invite is active for >1 hour
  const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
  const isStale =
    invite.status === "active" &&
    Date.now() - invite.createdAt > STALE_THRESHOLD_MS;

  // -------------------------------------------------------------------------
  // Auto-Navigation Effect (Phase 4: Chat Integration)
  // -------------------------------------------------------------------------
  // Track previous status to detect transitions
  const prevStatusRef = useRef(invite.status);

  // Auto-navigate when game becomes ready/active
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = invite.status;

    // Only auto-navigate if:
    // 1. User has joined the game
    // 2. Status just changed to 'active'
    // 3. We have a gameId (match was created)
    // 4. onPlay callback is provided
    if (
      hasJoined &&
      prevStatus !== "active" &&
      invite.status === "active" &&
      invite.gameId &&
      onPlay
    ) {
      // Small delay to ensure game document is ready in Firestore
      const timer = setTimeout(() => {
        logger.info(
          `[UniversalInviteCard] Auto-navigating to ${invite.gameType} game: ${invite.gameId}`,
        );
        onPlay(invite.gameId!, invite.gameType, invite.id);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [invite.status, invite.gameId, invite.gameType, hasJoined, onPlay]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleAction = useCallback(
    async (actionName: string, action: () => Promise<void>) => {
      setLoading(actionName);
      try {
        await action();
      } catch (error) {
        logger.error(`[UniversalInviteCard] ${actionName} failed:`, error);
      } finally {
        setLoading(null);
      }
    },
    [],
  );

  // Phase 2: DEV-only force-resolve for debugging stuck invites
  const handleForceResolve = useCallback(async () => {
    setLoading("force-resolve");
    try {
      logger.warn(
        `[UniversalInviteCard] DEV force-resolve triggered for invite ${invite.id}`,
      );
      const result = await completeGameInvite(invite.id);
      if (!result.success) {
        logger.error(
          `[UniversalInviteCard] Force-resolve failed: ${result.error}`,
        );
      }
    } catch (error) {
      logger.error(`[UniversalInviteCard] Force-resolve error:`, error);
    } finally {
      setLoading(null);
    }
  }, [invite.id]);

  // -------------------------------------------------------------------------
  // Compact Render
  // -------------------------------------------------------------------------
  if (compact) {
    return (
      <Card
        style={[styles.cardCompact, { backgroundColor: theme.colors.surface }]}
      >
        <View style={styles.compactContent}>
          <Text style={styles.gameIconCompact}>{gameIcon}</Text>

          <View style={styles.compactInfo}>
            <Text
              style={[
                styles.gameNameCompact,
                { color: theme.colors.onSurface },
              ]}
            >
              {gameName}
            </Text>
            <Text style={[styles.statusCompact, { color: statusInfo.color }]}>
              {invite.claimedSlots.length}/{invite.requiredPlayers} •{" "}
              {statusInfo.text}
            </Text>
          </View>

          <PlayerSlots
            slots={invite.claimedSlots}
            requiredPlayers={invite.requiredPlayers}
            maxPlayers={invite.maxPlayers}
            currentUserId={currentUserId}
            compact
          />

          {/* Action Buttons for Compact Mode */}
          <View style={styles.compactActions}>
            {/* Join Button */}
            {canJoin && (
              <Button
                mode="contained"
                compact
                onPress={() => handleAction("join", onJoin)}
                loading={loading === "join"}
                disabled={loading !== null}
              >
                Join
              </Button>
            )}

            {/* Leave Button (non-host) */}
            {canLeave && (
              <Button
                mode="outlined"
                compact
                onPress={() => handleAction("leave", onLeave)}
                loading={loading === "leave"}
                disabled={loading !== null}
              >
                Leave
              </Button>
            )}

            {/* Start Game Button (host, when ready) */}
            {canStartGame && onStartEarly && (
              <Button
                mode="contained"
                compact
                icon="play"
                onPress={() => handleAction("start", onStartEarly)}
                loading={loading === "start"}
                disabled={loading !== null}
              >
                Start
              </Button>
            )}

            {/* Start Early Button (host, when filling but min players met) */}
            {canStartEarly && !canStartGame && onStartEarly && (
              <Button
                mode="contained"
                compact
                onPress={() => handleAction("start", onStartEarly)}
                loading={loading === "start"}
                disabled={loading !== null}
              >
                Start
              </Button>
            )}

            {/* Cancel Button (host only) */}
            {canCancel && (
              <Button
                mode="outlined"
                compact
                textColor={theme.colors.error}
                onPress={() => handleAction("cancel", onCancel)}
                loading={loading === "cancel"}
                disabled={loading !== null}
              >
                Cancel
              </Button>
            )}

            {/* Play Button (when game is active) */}
            {canPlay && onPlay && (
              <Button
                mode="contained"
                compact
                onPress={() =>
                  onPlay(invite.gameId!, invite.gameType, invite.id)
                }
              >
                Play
              </Button>
            )}

            {/* Spectate Button (when game is active, user not playing) */}
            {canSpectate && (
              <Button mode="outlined" compact icon="eye" onPress={onSpectate}>
                Watch
              </Button>
            )}

            {/* Phase 2: DEV force-resolve (debug only) */}
            {__DEV__ && invite.status === "active" && (
              <Button
                mode="text"
                compact
                textColor="#F44336"
                onPress={handleForceResolve}
                loading={loading === "force-resolve"}
                disabled={loading !== null}
              >
                ⚠️ Resolve
              </Button>
            )}
          </View>
        </View>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Full Render
  // -------------------------------------------------------------------------
  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.gameInfo}>
            <Text style={styles.gameIcon}>{gameIcon}</Text>
            <View>
              <Text
                style={[styles.gameName, { color: theme.colors.onSurface }]}
              >
                {gameName}
              </Text>
              <Text
                style={[
                  styles.hostText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {isHost ? "You're the host" : `Hosted by ${invite.senderName}`}
              </Text>
            </View>
          </View>

          <Chip
            compact
            mode="flat"
            style={{ backgroundColor: statusInfo.color + "20" }}
            textStyle={{ color: statusInfo.color, fontSize: 11 }}
          >
            {statusInfo.text}
          </Chip>
        </View>

        {/* Queue Progress */}
        <View style={styles.queueSection}>
          <QueueProgressBar
            current={invite.claimedSlots.length}
            required={invite.requiredPlayers}
            max={invite.maxPlayers}
          />
        </View>

        {/* Player Slots */}
        <View style={styles.slotsSection}>
          <PlayerSlots
            slots={invite.claimedSlots}
            requiredPlayers={invite.requiredPlayers}
            maxPlayers={invite.maxPlayers}
            currentUserId={currentUserId}
          />
        </View>

        <Divider style={styles.divider} />

        {/* Actions */}
        <View style={styles.actions}>
          {canJoin && (
            <Button
              mode="contained"
              onPress={() => handleAction("join", onJoin)}
              loading={loading === "join"}
              disabled={loading !== null}
              style={styles.actionButton}
            >
              Join Game
            </Button>
          )}

          {canLeave && (
            <Button
              mode="outlined"
              onPress={() => handleAction("leave", onLeave)}
              loading={loading === "leave"}
              disabled={loading !== null}
              style={styles.actionButton}
            >
              Leave
            </Button>
          )}

          {canPlay && onPlay && (
            <Button
              mode="contained"
              icon="play"
              onPress={() => onPlay(invite.gameId!, invite.gameType, invite.id)}
              style={styles.actionButton}
            >
              Play Now
            </Button>
          )}

          {hasJoined && !canLeave && !canPlay && (
            <Text
              style={[
                styles.waitingText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Waiting for other players...
            </Text>
          )}

          {canSpectate && (
            <Button
              mode="outlined"
              icon="eye"
              onPress={onSpectate}
              style={styles.actionButton}
            >
              Spectate
            </Button>
          )}
        </View>

        {/* Phase 2: Staleness warning — invite active for >1 hour */}
        {isStale && (
          <View style={styles.stalenessWarning}>
            <Text style={styles.stalenessText}>
              ⚠️ This game may have ended — it’s been active for over an hour.
            </Text>
          </View>
        )}

        {/* Host Controls */}
        {isHost && ["pending", "filling", "ready"].includes(invite.status) && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.hostControls}>
              <Text
                style={[
                  styles.hostControlsLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Host Controls
              </Text>

              <View style={styles.hostActions}>
                {/* Start Game button when game is ready */}
                {canStartGame && onStartEarly && (
                  <Button
                    mode="contained"
                    icon="play"
                    onPress={() => handleAction("start", onStartEarly)}
                    loading={loading === "start"}
                    disabled={loading !== null}
                    style={styles.hostButton}
                  >
                    Start Game
                  </Button>
                )}

                {/* Start Early button when still filling but have min players */}
                {canStartEarly && !canStartGame && onStartEarly && (
                  <Button
                    mode="contained"
                    onPress={() => handleAction("start", onStartEarly)}
                    loading={loading === "start"}
                    disabled={loading !== null}
                    style={styles.hostButton}
                  >
                    Start Now ({invite.claimedSlots.length}/{minPlayers} min)
                  </Button>
                )}

                {onStartEarly &&
                  !canStartEarly &&
                  !canStartGame &&
                  ["pending", "filling"].includes(invite.status) && (
                    <Text
                      style={[
                        styles.minPlayersHint,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      Need {minPlayers - invite.claimedSlots.length} more to
                      start early
                    </Text>
                  )}

                {canCancel && (
                  <Button
                    mode="outlined"
                    textColor={theme.colors.error}
                    onPress={() => handleAction("cancel", onCancel)}
                    loading={loading === "cancel"}
                    disabled={loading !== null}
                  >
                    Cancel Game
                  </Button>
                )}
              </View>
            </View>
          </>
        )}

        {/* Phase 2: DEV force-resolve (debug only) */}
        {__DEV__ && invite.status === "active" && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.devSection}>
              <Text style={styles.devLabel}>🛠️ DEV Tools</Text>
              <Button
                mode="outlined"
                compact
                textColor="#F44336"
                onPress={handleForceResolve}
                loading={loading === "force-resolve"}
                disabled={loading !== null}
                style={styles.devButton}
              >
                Force Resolve Invite
              </Button>
              <Text style={styles.devHint}>ID: {invite.id}</Text>
            </View>
          </>
        )}
      </Card.Content>
    </Card>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  card: {
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  cardCompact: {
    marginVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  compactContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  compactInfo: {
    flex: 1,
  },
  compactActions: {
    flexDirection: "row",
    gap: Spacing.xs,
    flexWrap: "wrap",
  },
  gameIconCompact: {
    fontSize: 24,
  },
  gameNameCompact: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusCompact: {
    fontSize: 11,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  gameInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  gameIcon: {
    fontSize: 36,
  },
  gameName: {
    fontSize: 18,
    fontWeight: "600",
  },
  hostText: {
    fontSize: 12,
  },
  queueSection: {
    marginBottom: Spacing.md,
  },
  slotsSection: {
    marginBottom: Spacing.sm,
  },
  divider: {
    marginVertical: Spacing.sm,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    alignItems: "center",
  },
  actionButton: {
    minWidth: 100,
  },
  waitingText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  hostControls: {
    marginTop: Spacing.xs,
  },
  hostControlsLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  hostActions: {
    gap: Spacing.sm,
  },
  hostButton: {
    marginBottom: Spacing.xs,
  },
  minPlayersHint: {
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: Spacing.sm,
  },
  stalenessWarning: {
    backgroundColor: "#FFF3E0",
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.sm,
  },
  stalenessText: {
    fontSize: 12,
    color: "#E65100",
  },
  devSection: {
    marginTop: Spacing.xs,
    padding: Spacing.sm,
    backgroundColor: "#FFF8E1",
    borderRadius: BorderRadius.sm,
  },
  devLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#F57F17",
    marginBottom: Spacing.xs,
  },
  devButton: {
    borderColor: "#F44336",
    marginBottom: Spacing.xs,
  },
  devHint: {
    fontSize: 10,
    color: "#9E9E9E",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});

export default UniversalInviteCard;
