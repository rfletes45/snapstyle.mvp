/**
 * Chess UI — Move List Panel
 *
 * Collapsible panel showing algebraic notation in move pairs (1. e4 e5).
 * Supports:
 * - Tap a move to enter replay mode (board jumps to that ply)
 * - "Jump to Live" button when browsing history
 * - Copy PGN (constructed client-side from move history)
 * - Auto-scrolls to latest move when following live
 *
 * @module gamesV4/screens/chess/ChessMoveList
 */

import { Spacing } from "@/constants/theme";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";

// =============================================================================
// Types
// =============================================================================

export interface MoveEntry {
  /** 1-based move number */
  moveNumber: number;
  /** White's SAN (e.g. "e4") */
  whiteSan: string;
  /** Black's SAN (e.g. "e5"), empty if white just moved */
  blackSan?: string;
  /** Ply index for white's move */
  whitePly: number;
  /** Ply index for black's move */
  blackPly?: number;
}

interface ChessMoveListProps {
  /** Full move history accumulated client-side */
  moveHistory: string[];
  /** Whether the panel is visible */
  visible: boolean;
  /** Toggle visibility */
  onToggle: () => void;
  /** Currently viewed ply in replay mode (null = live) */
  replayPly: number | null;
  /** Jump to a specific ply */
  onJumpToPly: (ply: number | null) => void;
}

// =============================================================================
// Component
// =============================================================================

export function ChessMoveList({
  moveHistory,
  visible,
  onToggle,
  replayPly,
  onJumpToPly,
}: ChessMoveListProps) {
  const { theme } = useAppTheme();
  const isDark = theme.isDark;
  const listRef = useRef<FlatList>(null);

  // Build move pairs
  const movePairs = useMemo((): MoveEntry[] => {
    const pairs: MoveEntry[] = [];
    for (let i = 0; i < moveHistory.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      pairs.push({
        moveNumber: moveNum,
        whiteSan: moveHistory[i] ?? "",
        blackSan: moveHistory[i + 1],
        whitePly: i + 1, // 1-based ply
        blackPly: moveHistory[i + 1] ? i + 2 : undefined,
      });
    }
    return pairs;
  }, [moveHistory]);

  const isReplaying = replayPly !== null;
  const currentPly = replayPly ?? moveHistory.length;

  // Auto-scroll to end when new moves arrive and not replaying
  useEffect(() => {
    if (!isReplaying && visible && movePairs.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [movePairs.length, isReplaying, visible]);

  const handleJumpToLive = useCallback(() => {
    onJumpToPly(null);
  }, [onJumpToPly]);

  if (!visible) return null;

  const bgColor = isDark ? "rgba(30,30,30,0.95)" : "rgba(255,255,255,0.97)";
  const textColor = isDark ? "#DDD" : "#333";
  const mutedColor = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.3)";
  const highlightBg = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const primaryColor = theme.colors.primary;

  const renderMovePair = ({ item }: { item: MoveEntry }) => {
    const wActive = currentPly === item.whitePly;
    const bActive = item.blackPly !== undefined && currentPly === item.blackPly;

    return (
      <View style={styles.moveRow}>
        <Text style={[styles.moveNum, { color: mutedColor }]}>
          {item.moveNumber}.
        </Text>
        <Pressable
          style={[styles.moveSan, wActive && { backgroundColor: highlightBg }]}
          onPress={() => onJumpToPly(item.whitePly)}
        >
          <Text
            style={[
              styles.sanText,
              { color: wActive ? primaryColor : textColor },
              wActive && styles.sanActive,
            ]}
          >
            {item.whiteSan}
          </Text>
        </Pressable>
        {item.blackSan ? (
          <Pressable
            style={[
              styles.moveSan,
              bActive && { backgroundColor: highlightBg },
            ]}
            onPress={() =>
              item.blackPly !== undefined && onJumpToPly(item.blackPly)
            }
          >
            <Text
              style={[
                styles.sanText,
                { color: bActive ? primaryColor : textColor },
                bActive && styles.sanActive,
              ]}
            >
              {item.blackSan}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.moveSan}>
            <Text style={[styles.sanText, { color: mutedColor }]}>…</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Animated.View
      entering={SlideInDown.duration(250).springify()}
      exiting={SlideOutDown.duration(200)}
      style={[styles.container, { backgroundColor: bgColor }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>Moves</Text>
        <View style={styles.headerActions}>
          {isReplaying && (
            <TouchableOpacity
              style={[styles.liveBtn, { backgroundColor: primaryColor }]}
              onPress={handleJumpToLive}
            >
              <MaterialCommunityIcons name="play" size={14} color="#FFF" />
              <Text style={styles.liveBtnText}>Live</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onToggle} style={styles.closeBtn}>
            <MaterialCommunityIcons
              name="chevron-down"
              size={22}
              color={mutedColor}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Move list */}
      {moveHistory.length === 0 ? (
        <Text style={[styles.emptyText, { color: mutedColor }]}>
          No moves yet
        </Text>
      ) : (
        <FlatList
          ref={listRef}
          data={movePairs}
          renderItem={renderMovePair}
          keyExtractor={(item) => `${item.moveNumber}`}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Replay navigation */}
      {isReplaying && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.replayNav}>
          <TouchableOpacity
            onPress={() => onJumpToPly(Math.max(1, currentPly - 1))}
            disabled={currentPly <= 1}
            style={styles.replayBtn}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={24}
              color={currentPly <= 1 ? mutedColor : textColor}
            />
          </TouchableOpacity>
          <Text style={[styles.replayPly, { color: mutedColor }]}>
            Ply {currentPly} / {moveHistory.length}
          </Text>
          <TouchableOpacity
            onPress={() =>
              currentPly >= moveHistory.length
                ? onJumpToPly(null)
                : onJumpToPly(currentPly + 1)
            }
            style={styles.replayBtn}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={textColor}
            />
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    maxHeight: 200,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  liveBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 2,
  },
  list: {
    maxHeight: 130,
  },
  moveRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  moveNum: {
    width: 28,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
    marginRight: 4,
  },
  moveSan: {
    flex: 1,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  sanText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: undefined, // System monospace preferred but keep default
  },
  sanActive: {
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
  replayNav: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.2)",
    gap: 16,
  },
  replayBtn: {
    padding: 4,
  },
  replayPly: {
    fontSize: 12,
    fontWeight: "500",
  },
});
