/**
 * InvitePillRow — Compact v3 Session Pill for Chat
 *
 * Replaces the tall `UniversalInviteCard` in chat with a ~48px pill row
 * showing game icon, game name, participant count, and a single CTA.
 *
 * Tapping the pill navigates to `SessionLobbyScreen` which handles all
 * join/start/spectate logic — the pill itself never auto-navigates.
 *
 * When more than 3 sessions are active, the overflow sessions are hidden
 * behind an "+N more" chip that opens `InviteListSheet`.
 *
 * Feature-gated behind `GAME_SESSIONS_V3.COMPACT_CHAT_PILLS`.
 *
 * @module components/chat/InvitePillRow
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import type { GameSessionV3 } from "@/types/gameSessionV3";
import { isLobbyFull, isParticipant } from "@/types/gameSessionV3";
import type { ExtendedGameType } from "@/types/games";
import { GAME_METADATA, isValidGameType } from "@/types/games";
import { createLogger } from "@/utils/log";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

const logger = createLogger("components/chat/InvitePillRow");

// =============================================================================
// Constants
// =============================================================================

/** Max pills shown before overflow chip */
const MAX_VISIBLE_PILLS = 3;

/** Fixed pill height for consistent row layout */
const PILL_HEIGHT = 48;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Detect whether an icon string is an emoji (as opposed to a
 * MaterialCommunityIcons name like "gamepad-square").
 *
 * Heuristic: MCI names are ASCII-only lowercase + hyphens.
 * Anything else (emoji, CJK, symbol) is treated as a text icon.
 */
function isEmojiIcon(icon: string): boolean {
  return !/^[a-z][a-z0-9-]*$/.test(icon);
}

// =============================================================================
// Props
// =============================================================================

export interface InvitePillRowProps {
  /** Active (non-terminal) sessions for this conversation */
  sessions: GameSessionV3[];
  /** Current user UID */
  currentUserId: string;
  /** Navigate to SessionLobbyScreen */
  onNavigateToLobby: (sessionId: string) => void;
  /** Open overflow sheet with all sessions */
  onShowMore?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function InvitePillRow({
  sessions,
  currentUserId,
  onNavigateToLobby,
  onShowMore,
}: InvitePillRowProps) {
  const theme = useTheme();

  if (sessions.length === 0) return null;

  logger.debug("[InvitePillRow] render", {
    sessionCount: sessions.length,
    ids: sessions.map((s) => s.id),
  });

  const visibleSessions = sessions.slice(0, MAX_VISIBLE_PILLS);
  const overflowCount = sessions.length - MAX_VISIBLE_PILLS;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.row} pointerEvents="box-none">
        {visibleSessions.map((session) => (
          <SessionPill
            key={session.id}
            session={session}
            currentUserId={currentUserId}
            onNavigateToLobby={onNavigateToLobby}
          />
        ))}

        {overflowCount > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.overflowChip,
              {
                backgroundColor: theme.colors.surfaceVariant,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={onShowMore}
          >
            <Text
              style={[
                styles.overflowText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              +{overflowCount} more
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// =============================================================================
// SessionPill Sub-Component
// =============================================================================

function SessionPill({
  session,
  currentUserId,
  onNavigateToLobby,
}: {
  session: GameSessionV3;
  currentUserId: string;
  onNavigateToLobby: (sessionId: string) => void;
}) {
  const theme = useTheme();

  const gameType = session.gameType;
  const gameName = isValidGameType(gameType)
    ? (GAME_METADATA[gameType as ExtendedGameType]?.name ?? gameType)
    : gameType;
  const rawIcon = isValidGameType(gameType)
    ? (GAME_METADATA[gameType as ExtendedGameType]?.icon ?? "")
    : "";
  const iconIsEmoji = !rawIcon || isEmojiIcon(rawIcon);

  const playerCount = session.participants.filter(
    (p) =>
      p.role !== "spectator" && p.status !== "invited" && p.status !== "left",
  ).length;
  const iAmIn = isParticipant(session, currentUserId);
  const full = isLobbyFull(session);

  // CTA label
  const ctaLabel = iAmIn
    ? session.phase === "active"
      ? "Resume"
      : "Open"
    : full
      ? "Watch"
      : "Join";

  // CTA color
  const ctaColor = iAmIn
    ? theme.colors.primary
    : full
      ? (theme.colors.tertiary ?? theme.colors.secondary)
      : theme.colors.primary;

  // --- Trace: render data --------------------------------------------------
  logger.debug("[SessionPill] render", {
    sessionId: session.id,
    gameType,
    iconIsEmoji,
    phase: session.phase,
    ctaLabel,
  });

  // --- Press handler with try/catch + trace --------------------------------
  const handlePress = useCallback(() => {
    try {
      logger.info("[InvitePillRow] press", {
        sessionId: session.id,
        gameType: session.gameType,
        phase: session.phase,
      });
      onNavigateToLobby(session.id);
    } catch (err) {
      logger.error("[InvitePillRow] press handler error", err);
    }
  }, [session.id, session.gameType, session.phase, onNavigateToLobby]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: iAmIn
            ? theme.colors.primaryContainer
            : theme.colors.surfaceVariant,
          borderColor: iAmIn ? theme.colors.primary : theme.colors.outline,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      onPress={handlePress}
      // Ensure the press target is reachable on both mobile & web
      accessibilityRole="button"
      accessibilityLabel={`${gameName} ${ctaLabel}`}
    >
      {/* ── Game icon (emoji text OR MCI vector icon) ── */}
      {iconIsEmoji ? (
        <Text style={styles.emojiIcon}>{rawIcon || "🎮"}</Text>
      ) : (
        <MaterialCommunityIcons
          name={rawIcon as any}
          size={18}
          color={theme.colors.primary}
        />
      )}
      <Text
        style={[styles.pillGameName, { color: theme.colors.onSurface }]}
        numberOfLines={1}
      >
        {gameName}
      </Text>
      <Text
        style={[styles.pillCount, { color: theme.colors.onSurfaceVariant }]}
      >
        {playerCount}/{session.maxParticipants}
      </Text>
      <View style={[styles.ctaBadge, { backgroundColor: ctaColor }]}>
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </View>
    </Pressable>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
    zIndex: 10,
    // Ensure the pill row is touchable and not covered by siblings
    ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    height: PILL_HEIGHT,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 6,
  },
  emojiIcon: {
    fontSize: 18,
    lineHeight: 22,
    textAlign: "center",
    width: 22,
  },
  pillGameName: {
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 100,
  },
  pillCount: {
    fontSize: 12,
    fontWeight: "500",
  },
  ctaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 2,
  },
  ctaText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  overflowChip: {
    height: PILL_HEIGHT,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  overflowText: {
    fontSize: 13,
    fontWeight: "600",
  },
});

export default InvitePillRow;
