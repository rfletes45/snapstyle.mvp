/**
 * OpponentHandsArea — Shows opponent hands as card-back fans (like GamePigeon)
 *
 * Layout:
 * - 1 opponent: centered at top
 * - 2 opponents: left + right at top
 * - 3 opponents: left, center-top, right
 * - 4 opponents: top-left, top-right, left, right
 *
 * Each opponent area shows:
 * - Fanned card backs (capped at 8 visual cards + "+N" badge)
 * - Avatar + truncated name
 * - Turn glow indicator
 * - Challenge button (UNO catch)
 *
 * NEVER renders opponent card faces — only backs.
 */

import React, { useMemo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import {
  CARD_COLORS,
  CARD_HEIGHT,
  CARD_RADIUS,
  CARD_WIDTH,
} from "@/games/crazyCards/CrazyCardsConfig";
import type { OpponentInfo } from "@/hooks/useCardGame";

// =============================================================================
// Constants
// =============================================================================

/** Scaled-down card back for opponent display */
const OPP_CARD_SCALE = 0.38;
const OPP_CARD_W = Math.round(CARD_WIDTH * OPP_CARD_SCALE);
const OPP_CARD_H = Math.round(CARD_HEIGHT * OPP_CARD_SCALE);
const OPP_CARD_R = Math.round(CARD_RADIUS * OPP_CARD_SCALE);
const OPP_CARD_OVERLAP = Math.round(OPP_CARD_W * 0.55);
const MAX_VISIBLE_BACKS = 7;
const AVATAR_SIZE = 32;

// =============================================================================
// Mini CardBack — small face-down card
// =============================================================================

const MiniCardBack = React.memo(function MiniCardBack({
  index,
  total,
  rotation,
}: {
  index: number;
  total: number;
  rotation: number;
}) {
  // Fan effect: slight rotation for each card
  const marginLeft = index === 0 ? 0 : -OPP_CARD_OVERLAP;

  return (
    <View
      style={[
        styles.miniCardBack,
        {
          width: OPP_CARD_W,
          height: OPP_CARD_H,
          borderRadius: OPP_CARD_R,
          marginLeft,
          transform: [{ rotate: `${rotation}deg` }],
          zIndex: index,
        },
      ]}
    >
      <View style={styles.miniCardInner}>
        <Text style={styles.miniCardSymbol}>✦</Text>
      </View>
    </View>
  );
});

// =============================================================================
// OpponentHandDisplay — single opponent's card backs + info
// =============================================================================

const OpponentHandDisplay = React.memo(function OpponentHandDisplay({
  opponent,
  isTheirTurn,
  canChallenge,
  onChallenge,
  compact,
}: {
  opponent: OpponentInfo;
  isTheirTurn: boolean;
  canChallenge: boolean;
  onChallenge: () => void;
  compact?: boolean;
}) {
  const { handSize, displayName, avatarUrl } = opponent;
  const initial = displayName ? displayName.charAt(0).toUpperCase() : "?";

  const visibleCount = Math.min(handSize, MAX_VISIBLE_BACKS);
  const overflow = handSize - visibleCount;

  // Calculate fan rotations centered around 0
  const fanCards = useMemo(() => {
    const cards = [];
    const fanSpread = compact ? 3 : 4; // degrees per card
    const startAngle = -((visibleCount - 1) * fanSpread) / 2;
    for (let i = 0; i < visibleCount; i++) {
      cards.push({
        index: i,
        rotation: startAngle + i * fanSpread,
      });
    }
    return cards;
  }, [visibleCount, compact]);

  return (
    <View
      style={[styles.oppContainer, isTheirTurn && styles.oppContainerActive]}
    >
      {/* Avatar + Name row */}
      <View style={styles.oppInfoRow}>
        <View style={styles.oppAvatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.oppAvatar} />
          ) : (
            <View style={styles.oppAvatarPlaceholder}>
              <Text style={styles.oppAvatarInitial}>{initial}</Text>
            </View>
          )}
          {isTheirTurn && <View style={styles.oppTurnDot} />}
        </View>
        <Text style={styles.oppName} numberOfLines={1}>
          {displayName || "Opponent"}
        </Text>
        {canChallenge && (
          <TouchableOpacity
            style={styles.oppChallengeBtn}
            onPress={onChallenge}
            activeOpacity={0.75}
          >
            <Text style={styles.oppChallengeText}>UNO!</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Card backs fan */}
      <View style={styles.oppCardsRow}>
        {fanCards.map((fc) => (
          <MiniCardBack
            key={fc.index}
            index={fc.index}
            total={visibleCount}
            rotation={fc.rotation}
          />
        ))}
        {overflow > 0 && (
          <View style={styles.overflowBadge}>
            <Text style={styles.overflowText}>+{overflow}</Text>
          </View>
        )}
        {/* Card count */}
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{handSize}</Text>
        </View>
      </View>
    </View>
  );
});

// =============================================================================
// OpponentHandsArea — layout wrapper for 1-4 opponents
// =============================================================================

interface OpponentHandsAreaProps {
  opponents: OpponentInfo[];
  onChallenge: (sessionId: string) => void;
  unoChallengeTarget: string | null;
}

export const OpponentHandsArea = React.memo(function OpponentHandsArea({
  opponents,
  onChallenge,
  unoChallengeTarget,
}: OpponentHandsAreaProps) {
  if (opponents.length === 0) return null;

  const count = opponents.length;

  // For 1-2 opponents: single top row
  if (count <= 2) {
    return (
      <View style={styles.topRow}>
        {opponents.map((opp) => (
          <OpponentHandDisplay
            key={opp.sessionId}
            opponent={opp}
            isTheirTurn={opp.isTheirTurn}
            canChallenge={unoChallengeTarget === opp.sessionId}
            onChallenge={() => onChallenge(opp.sessionId)}
          />
        ))}
      </View>
    );
  }

  // For 3-4 opponents: top row (first 2) + side slots or second row
  const topOpps = opponents.slice(0, 2);
  const sideOpps = opponents.slice(2);

  return (
    <View>
      <View style={styles.topRow}>
        {topOpps.map((opp) => (
          <OpponentHandDisplay
            key={opp.sessionId}
            opponent={opp}
            isTheirTurn={opp.isTheirTurn}
            canChallenge={unoChallengeTarget === opp.sessionId}
            onChallenge={() => onChallenge(opp.sessionId)}
            compact
          />
        ))}
      </View>
      {sideOpps.length > 0 && (
        <View style={styles.sideRow}>
          {sideOpps.map((opp) => (
            <OpponentHandDisplay
              key={opp.sessionId}
              opponent={opp}
              isTheirTurn={opp.isTheirTurn}
              canChallenge={unoChallengeTarget === opp.sessionId}
              onChallenge={() => onChallenge(opp.sessionId)}
              compact
            />
          ))}
        </View>
      )}
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // ── Layout rows ──
  topRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-start",
    paddingHorizontal: 8,
    paddingTop: 4,
    gap: 8,
  },
  sideRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-start",
    paddingHorizontal: 8,
    paddingTop: 2,
    gap: 8,
  },

  // ── Single opponent container ──
  oppContainer: {
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderWidth: 1.5,
    borderColor: "transparent",
    minWidth: 80,
    maxWidth: 180,
  },
  oppContainerActive: {
    borderColor: CARD_COLORS.yellow,
    shadowColor: CARD_COLORS.yellow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },

  // ── Info row ──
  oppInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  oppAvatarWrap: {
    position: "relative",
  },
  oppAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  oppAvatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  oppAvatarInitial: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  oppTurnDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: CARD_COLORS.green,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.3)",
  },
  oppName: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    maxWidth: 70,
  },
  oppChallengeBtn: {
    backgroundColor: "#FF4D5A",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 2,
  },
  oppChallengeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // ── Card backs row ──
  oppCardsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
    paddingBottom: 2,
  },

  // ── Mini card back ──
  miniCardBack: {
    backgroundColor: "#1B1E2B",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  miniCardInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  miniCardSymbol: {
    color: "rgba(255,255,255,0.12)",
    fontSize: OPP_CARD_W * 0.45,
    fontWeight: "900",
  },

  // ── Badges ──
  overflowBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 4,
  },
  overflowText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  countBadge: {
    backgroundColor: "rgba(27, 30, 43, 0.9)",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  countText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});

export default OpponentHandsArea;
