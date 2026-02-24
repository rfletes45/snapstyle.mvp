/**
 * OpponentBar & OpponentStrip — Displays opponent info at the top of the game
 *
 * OpponentBar: Single opponent (backward-compatible)
 * OpponentStrip: 1-4 opponents as compact chips in a horizontal row
 *
 * Each chip shows:
 * - Avatar (circle with initial)
 * - Truncated name
 * - Card count
 * - Turn indicator (glow)
 * - Challenge button (when they forgot to call UNO)
 * - Disconnected indicator
 */

import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { CARD_COLORS } from "@/games/crazyCards/CrazyCardsConfig";
import type { OpponentBarProps, OpponentStripProps } from "./CrazyCardsTypes";

// =============================================================================
// Constants
// =============================================================================

const AVATAR_SIZE = 36;
const CHIP_AVATAR_SIZE = 30;

// =============================================================================
// OpponentBar Component (single opponent — backward compatible)
// =============================================================================

export const OpponentBar = React.memo(function OpponentBar({
  name,
  avatarUrl,
  handSize,
  isTheirTurn,
  canChallenge,
  onChallenge,
}: OpponentBarProps) {
  const initial = name ? name.charAt(0).toUpperCase() : "?";

  return (
    <View style={[styles.container, isTheirTurn && styles.containerActive]}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
        {isTheirTurn && <View style={styles.turnDot} />}
      </View>

      {/* Name */}
      <View style={styles.nameContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {name || "Opponent"}
        </Text>
        {isTheirTurn && <Text style={styles.turnLabel}>Their turn</Text>}
      </View>

      {/* Card count */}
      <View style={styles.cardCount}>
        <Text style={styles.cardCountIcon}>🃏</Text>
        <Text style={styles.cardCountText}>{handSize}</Text>
      </View>

      {/* Challenge button */}
      {canChallenge && (
        <TouchableOpacity
          style={styles.challengeButton}
          onPress={onChallenge}
          activeOpacity={0.75}
        >
          <Text style={styles.challengeText}>CATCH!</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// =============================================================================
// OpponentChip — Compact opponent card for multi-player games
// =============================================================================

const OpponentChip = React.memo(function OpponentChip({
  displayName,
  avatarUrl,
  handSize,
  isTheirTurn,
  connected,
  canChallenge,
  onChallenge,
}: {
  displayName: string;
  avatarUrl: string;
  handSize: number;
  isTheirTurn: boolean;
  connected: boolean;
  canChallenge: boolean;
  onChallenge: () => void;
}) {
  const initial = displayName ? displayName.charAt(0).toUpperCase() : "?";

  return (
    <View
      style={[
        styles.chip,
        isTheirTurn && styles.chipActive,
        !connected && styles.chipDisconnected,
      ]}
    >
      {/* Avatar */}
      <View style={styles.chipAvatarWrap}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.chipAvatar} />
        ) : (
          <View style={styles.chipAvatarPlaceholder}>
            <Text style={styles.chipAvatarInitial}>{initial}</Text>
          </View>
        )}
        {isTheirTurn && <View style={styles.chipTurnDot} />}
        {!connected && <View style={styles.chipDisconnectDot} />}
      </View>

      {/* Name (truncated) */}
      <Text style={styles.chipName} numberOfLines={1}>
        {displayName || "Opponent"}
      </Text>

      {/* Card count */}
      <View style={styles.chipCardCount}>
        <Text style={styles.chipCardCountText}>{handSize}🃏</Text>
      </View>

      {/* Challenge */}
      {canChallenge && (
        <TouchableOpacity
          style={styles.chipChallengeBtn}
          onPress={onChallenge}
          activeOpacity={0.75}
        >
          <Text style={styles.chipChallengeText}>!</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

// =============================================================================
// OpponentStrip — Horizontal strip of 1-4 opponent chips
// =============================================================================

export const OpponentStrip = React.memo(function OpponentStrip({
  opponents,
  onChallenge,
}: OpponentStripProps) {
  if (opponents.length === 0) return null;

  // For 1 opponent, use the full-width OpponentBar for a richer look
  if (opponents.length === 1) {
    const opp = opponents[0];
    return (
      <OpponentBar
        name={opp.displayName}
        avatarUrl={opp.avatarUrl}
        handSize={opp.handSize}
        isTheirTurn={opp.isTheirTurn}
        canChallenge={opp.canChallenge}
        onChallenge={() => onChallenge(opp.sessionId)}
      />
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.stripContainer}
      style={styles.strip}
    >
      {opponents.map((opp) => (
        <OpponentChip
          key={opp.sessionId}
          displayName={opp.displayName}
          avatarUrl={opp.avatarUrl}
          handSize={opp.handSize}
          isTheirTurn={opp.isTheirTurn}
          connected={opp.connected}
          canChallenge={opp.canChallenge}
          onChallenge={() => onChallenge(opp.sessionId)}
        />
      ))}
    </ScrollView>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // ── Single opponent (OpponentBar) ──
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(27, 30, 43, 0.85)",
    borderRadius: 16,
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  containerActive: {
    borderColor: CARD_COLORS.yellow,
    shadowColor: CARD_COLORS.yellow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 10,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  turnDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: CARD_COLORS.green,
    borderWidth: 2,
    borderColor: "#1B1E2B",
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  turnLabel: {
    color: CARD_COLORS.yellow,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  cardCount: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  cardCountIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  cardCountText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  challengeButton: {
    marginLeft: 8,
    backgroundColor: "#FF4D5A",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  challengeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // ── Multi-opponent strip ──
  strip: {
    marginHorizontal: 8,
    maxHeight: 64,
  },
  stripContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },

  // ── Opponent chip ──
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(27, 30, 43, 0.85)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    minWidth: 100,
    maxWidth: 160,
  },
  chipActive: {
    borderColor: CARD_COLORS.yellow,
    shadowColor: CARD_COLORS.yellow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  chipDisconnected: {
    opacity: 0.5,
  },
  chipAvatarWrap: {
    position: "relative",
    marginRight: 6,
  },
  chipAvatar: {
    width: CHIP_AVATAR_SIZE,
    height: CHIP_AVATAR_SIZE,
    borderRadius: CHIP_AVATAR_SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  chipAvatarPlaceholder: {
    width: CHIP_AVATAR_SIZE,
    height: CHIP_AVATAR_SIZE,
    borderRadius: CHIP_AVATAR_SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  chipAvatarInitial: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  chipTurnDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CARD_COLORS.green,
    borderWidth: 1.5,
    borderColor: "#1B1E2B",
  },
  chipDisconnectDot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF4D5A",
    borderWidth: 1.5,
    borderColor: "#1B1E2B",
  },
  chipName: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 60,
  },
  chipCardCount: {
    marginLeft: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipCardCountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  chipChallengeBtn: {
    marginLeft: 4,
    backgroundColor: "#FF4D5A",
    borderRadius: 8,
    width: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  chipChallengeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
});

export default OpponentBar;
