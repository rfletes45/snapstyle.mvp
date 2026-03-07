/**
 * Chess UI — HUD Components
 *
 * Player info bar, captured pieces with material advantage, status pills.
 * Designed to be compact and readable at a glance on small phones.
 *
 * @module gamesV4/screens/chess/ChessHUD
 */

import { Spacing } from "@/constants/theme";
import type {
  ChessPublicStateV1,
  Piece,
  Side,
} from "@/gamesV4/adapters/chess/chessTypes";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { ChessBoardTheme } from "./chessThemes";
import { PIECE_ICONS, PIECE_VALUES } from "./constants";

// =============================================================================
// Status Pill
// =============================================================================

interface StatusPillProps {
  label: string;
  color: string;
  bgColor: string;
  icon?: string;
}

export function StatusPill({ label, color, bgColor, icon }: StatusPillProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[styles.pill, { backgroundColor: bgColor }]}
    >
      {icon && (
        <MaterialCommunityIcons
          name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={12}
          color={color}
        />
      )}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </Animated.View>
  );
}

// =============================================================================
// Captured Pieces Row with Material Advantage
// =============================================================================

interface CapturedRowProps {
  pieces: Piece[];
  side: Side;
  materialAdvantage: number; // positive = this side is ahead
  boardTheme: ChessBoardTheme;
}

export const CapturedPiecesRow = React.memo(function CapturedPiecesRow({
  pieces,
  side,
  materialAdvantage,
  boardTheme,
}: CapturedRowProps) {
  const { theme } = useAppTheme();
  const isDark = theme.isDark;

  // Sort by value descending
  const sorted = useMemo(() => {
    return [...pieces].sort((a, b) => {
      return (PIECE_VALUES[b[1]] ?? 0) - (PIECE_VALUES[a[1]] ?? 0);
    });
  }, [pieces]);

  const pieceColor =
    side === "w" ? boardTheme.whitePiece : boardTheme.blackPiece;

  const mutedColor = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)";

  return (
    <View style={styles.capturedRow}>
      <View style={styles.capturedPieces}>
        {sorted.length === 0 ? (
          <Text style={[styles.noCapturesText, { color: mutedColor }]}>—</Text>
        ) : (
          sorted.map((p, i) => {
            const iconName = PIECE_ICONS[
              p
            ] as keyof typeof MaterialCommunityIcons.glyphMap;
            return (
              <MaterialCommunityIcons
                key={`${p}-${i}`}
                name={iconName}
                size={16}
                color={isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)"}
                style={styles.capturedIcon}
              />
            );
          })
        )}
      </View>
      {materialAdvantage > 0 && (
        <View style={styles.advantageChip}>
          <Text
            style={[
              styles.advantageText,
              { color: isDark ? "#8BC34A" : "#4CAF50" },
            ]}
          >
            +{materialAdvantage}
          </Text>
        </View>
      )}
    </View>
  );
});

// =============================================================================
// Player Info Bar
// =============================================================================

interface PlayerBarProps {
  displayName: string;
  side: Side;
  isActive: boolean;
  avatarUrl?: string | null;
  captured: Piece[];
  materialAdvantage: number;
  boardTheme: ChessBoardTheme;
}

export const PlayerBar = React.memo(function PlayerBar({
  displayName,
  side,
  isActive,
  avatarUrl,
  captured,
  materialAdvantage,
  boardTheme,
}: PlayerBarProps) {
  const { theme } = useAppTheme();
  const isDark = theme.isDark;

  const sideLabel = side === "w" ? "White" : "Black";
  const sideIcon = side === "w" ? "chess-king" : "chess-king";
  const sideColor =
    side === "w" ? boardTheme.whitePiece : boardTheme.blackPiece;

  const activeColor = isActive
    ? theme.colors.primary
    : isDark
      ? "rgba(255,255,255,0.4)"
      : "rgba(0,0,0,0.35)";

  const bgColor = isActive
    ? isDark
      ? "rgba(255,255,255,0.08)"
      : "rgba(0,0,0,0.04)"
    : "transparent";

  return (
    <View style={[styles.playerBar, { backgroundColor: bgColor }]}>
      <View style={styles.playerInfo}>
        <View
          style={[
            styles.playerPip,
            {
              backgroundColor: side === "w" ? "#F5F5F5" : "#2A2A2A",
              borderColor: isActive ? theme.colors.primary : "transparent",
            },
          ]}
        >
          <MaterialCommunityIcons
            name="chess-king"
            size={14}
            color={side === "w" ? "#333" : "#DDD"}
          />
        </View>
        <Text
          style={[styles.playerName, { color: activeColor }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {displayName || sideLabel}
        </Text>
        {isActive && (
          <View
            style={[
              styles.activeDot,
              { backgroundColor: theme.colors.primary },
            ]}
          />
        )}
      </View>
      <CapturedPiecesRow
        pieces={captured}
        side={side === "w" ? "b" : "w"}
        materialAdvantage={materialAdvantage}
        boardTheme={boardTheme}
      />
    </View>
  );
});

// =============================================================================
// Check / Status Pills Bar
// =============================================================================

interface StatusBarProps {
  state: ChessPublicStateV1;
  isMyTurn: boolean;
  isSpectator: boolean;
  myUid: string;
  kingInCheck: boolean;
}

export function ChessStatusPills({
  state,
  isMyTurn,
  isSpectator,
  myUid,
  kingInCheck,
}: StatusBarProps) {
  const { theme } = useAppTheme();
  const pills: React.ReactElement[] = [];

  if (kingInCheck && !state.terminal) {
    pills.push(
      <StatusPill
        key="check"
        label="CHECK"
        color="#FFF"
        bgColor="#E53935"
        icon="alert-circle"
      />,
    );
  }

  if (state.pendingDrawOfferByUid && !state.terminal) {
    const isMyOffer = state.pendingDrawOfferByUid === myUid;
    pills.push(
      <StatusPill
        key="draw"
        label={isMyOffer ? "DRAW OFFERED" : "DRAW OFFERED TO YOU"}
        color="#FFF"
        bgColor="#FF9800"
        icon="handshake"
      />,
    );
  }

  if (
    isMyTurn &&
    !state.terminal &&
    (state.repetitionCounts[state.positionHash] ?? 0) >= 3
  ) {
    pills.push(
      <StatusPill
        key="threefold"
        label="CLAIM DRAW"
        color="#FFF"
        bgColor="#2196F3"
        icon="refresh"
      />,
    );
  }

  if (isMyTurn && !state.terminal && state.halfmoveClock >= 100) {
    pills.push(
      <StatusPill
        key="fifty"
        label="50-MOVE DRAW"
        color="#FFF"
        bgColor="#2196F3"
        icon="numeric-50-box"
      />,
    );
  }

  if (isSpectator) {
    pills.push(
      <StatusPill
        key="watching"
        label="WATCHING"
        color="#FFF"
        bgColor="rgba(0,0,0,0.55)"
        icon="eye"
      />,
    );
  }

  if (pills.length === 0) return null;

  return <View style={styles.pillsRow}>{pills}</View>;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
  },
  capturedRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 20,
    gap: 4,
  },
  capturedPieces: {
    flexDirection: "row",
    flexWrap: "wrap",
    flex: 1,
  },
  capturedIcon: {
    marginRight: -2,
  },
  noCapturesText: {
    fontSize: 14,
    letterSpacing: 2,
  },
  advantageChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: "rgba(139, 195, 74, 0.15)",
  },
  advantageText: {
    fontSize: 12,
    fontWeight: "700",
  },
  playerBar: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 2,
  },
  playerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  playerPip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
  },
  playerName: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
