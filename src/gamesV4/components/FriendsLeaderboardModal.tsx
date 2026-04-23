/**
 * Games V4 — Friends Leaderboard Modal
 *
 * A reusable modal that renders a friends-only leaderboard for a single
 * game. Used by:
 *   - `GameScreenShell` (in-game overlay button, available in every game)
 *   - Game Detail Screen (future reuse hook)
 *   - Any other future entry point (stats, hub, etc.)
 *
 * Per-game metric handling:
 *   - Minesweeper : best time per difficulty (three boards, user-selectable)
 *   - Wins-based  : total wins
 *   - Best-score  : encoded/raw best score
 *
 * Friends with no qualifying entry for the selected board are never
 * shown (the service layer filters them out); this mirrors the backend
 * beat-your-score notification filter exactly.
 *
 * @module gamesV4/components/FriendsLeaderboardModal
 */

import { GAME_METADATA, LEADERBOARD_DESCRIPTORS } from "@/gamesV4/constants";
import {
  fetchFriendsLeaderboard,
  type LeaderboardEntryV4,
  type MinesweeperLeaderboardVariant,
} from "@/gamesV4/services/gameServiceV4";
import type { GameId } from "@/gamesV4/types/common";
import { getCachedProfile } from "@/services/cache/profileCache";
import { getFriends } from "@/services/friends";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// =============================================================================
// Props
// =============================================================================

export interface FriendsLeaderboardModalProps {
  visible: boolean;
  gameId: GameId;
  onClose: () => void;
}

interface ResolvedEntry extends LeaderboardEntryV4 {
  profilePictureUrl?: string | null;
  isMe: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

const MINESWEEPER_TIERS: MinesweeperLeaderboardVariant[] = [
  "easy",
  "intermediate",
  "expert",
];

function formatMinesweeperTime(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// =============================================================================
// Component
// =============================================================================

export function FriendsLeaderboardModal({
  visible,
  gameId,
  onClose,
}: FriendsLeaderboardModalProps) {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid ?? "";

  const meta = GAME_METADATA[gameId];
  const descriptor = LEADERBOARD_DESCRIPTORS[gameId];
  const isMinesweeper = gameId === "minesweeper";

  const [difficulty, setDifficulty] =
    useState<MinesweeperLeaderboardVariant>("easy");
  const [entries, setEntries] = useState<ResolvedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load board data when modal opens or difficulty changes ──────────
  useEffect(() => {
    if (!visible || !uid) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const friends = await getFriends(uid);
        const friendUids = friends
          .map((f) => f.users.find((u: string) => u !== uid))
          .filter((id): id is string => Boolean(id));

        const raw = await fetchFriendsLeaderboard(uid, friendUids, gameId, {
          minesweeperDifficulty: isMinesweeper ? difficulty : undefined,
        });

        const resolved: ResolvedEntry[] = await Promise.all(
          raw.map(async (e) => {
            const profile = await getCachedProfile(e.uid).catch(() => null);
            return {
              ...e,
              displayName:
                profile?.displayName || profile?.username || "Player",
              profilePictureUrl: profile?.profilePictureUrl ?? null,
              isMe: e.uid === uid,
            };
          }),
        );

        if (!cancelled) setEntries(resolved);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load leaderboard",
          );
          setEntries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, uid, gameId, difficulty, isMinesweeper]);

  const formatValue = useCallback(
    (score: number): string => {
      if (isMinesweeper) return formatMinesweeperTime(score);
      if (descriptor) return descriptor.formatValue(score);
      return String(score);
    },
    [descriptor, isMinesweeper],
  );

  const metricLabel = useMemo(() => {
    if (isMinesweeper) return "Best Time";
    return descriptor?.label ?? "Score";
  }, [descriptor, isMinesweeper]);

  const title = `${meta?.displayName ?? "Game"} — Friends`;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: theme.isDark ? "#1C1C1E" : "#FFF",
              borderColor: theme.isDark ? "#2C2C2E" : "#E5E5EA",
            },
          ]}
          // Swallow backdrop taps inside the card
          onPress={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <Text
              style={[styles.title, { color: theme.isDark ? "#FFF" : "#111" }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.closeBtn}
            >
              <Ionicons
                name="close"
                size={22}
                color={theme.isDark ? "#FFF" : "#111"}
              />
            </TouchableOpacity>
          </View>

          {/* ── Minesweeper difficulty tabs ── */}
          {isMinesweeper && (
            <View style={styles.tabsRow}>
              {MINESWEEPER_TIERS.map((tier) => {
                const active = tier === difficulty;
                return (
                  <TouchableOpacity
                    key={tier}
                    style={[
                      styles.tab,
                      active && {
                        backgroundColor: theme.colors.primary,
                        borderColor: theme.colors.primary,
                      },
                      !active && {
                        borderColor: theme.isDark ? "#3A3A3C" : "#D1D1D6",
                      },
                    ]}
                    onPress={() => setDifficulty(tier)}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        {
                          color: active
                            ? "#FFF"
                            : theme.isDark
                              ? "#FFF"
                              : "#111",
                        },
                      ]}
                    >
                      {tier[0].toUpperCase() + tier.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Metric header ── */}
          <View style={styles.metricRow}>
            <Text
              style={[
                styles.metricLabel,
                { color: theme.isDark ? "#8E8E93" : "#6C6C70" },
              ]}
            >
              {metricLabel}
            </Text>
          </View>

          {/* ── Body ── */}
          <View style={styles.body}>
            {loading && (
              <View style={styles.emptyWrap}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            )}

            {!loading && error && (
              <View style={styles.emptyWrap}>
                <Text
                  style={[
                    styles.emptyText,
                    { color: theme.isDark ? "#FF453A" : "#FF3B30" },
                  ]}
                >
                  {error}
                </Text>
              </View>
            )}

            {!loading && !error && entries.length === 0 && (
              <View style={styles.emptyWrap}>
                <Ionicons
                  name="trophy-outline"
                  size={28}
                  color={theme.isDark ? "#48484A" : "#C7C7CC"}
                />
                <Text
                  style={[
                    styles.emptyText,
                    { color: theme.isDark ? "#8E8E93" : "#6C6C70" },
                  ]}
                >
                  No friends have a score on this board yet.
                </Text>
              </View>
            )}

            {!loading && !error && entries.length > 0 && (
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              >
                {entries.map((e, idx) => {
                  const rank = idx + 1;
                  return (
                    <View
                      key={e.uid}
                      style={[
                        styles.row,
                        e.isMe && {
                          backgroundColor: theme.isDark
                            ? "rgba(10, 132, 255, 0.15)"
                            : "rgba(0, 122, 255, 0.08)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rank,
                          {
                            color:
                              rank === 1
                                ? "#FFD60A"
                                : rank === 2
                                  ? "#C7C7CC"
                                  : rank === 3
                                    ? "#FF9F0A"
                                    : theme.isDark
                                      ? "#8E8E93"
                                      : "#6C6C70",
                          },
                        ]}
                      >
                        #{rank}
                      </Text>

                      {e.profilePictureUrl ? (
                        <Image
                          source={{ uri: e.profilePictureUrl }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View
                          style={[
                            styles.avatar,
                            {
                              backgroundColor: theme.isDark
                                ? "#2C2C2E"
                                : "#E5E5EA",
                              alignItems: "center",
                              justifyContent: "center",
                            },
                          ]}
                        >
                          <Ionicons
                            name="person"
                            size={16}
                            color={theme.isDark ? "#8E8E93" : "#6C6C70"}
                          />
                        </View>
                      )}

                      <Text
                        style={[
                          styles.name,
                          { color: theme.isDark ? "#FFF" : "#111" },
                        ]}
                        numberOfLines={1}
                      >
                        {e.displayName}
                        {e.isMe ? "  (You)" : ""}
                      </Text>

                      <Text
                        style={[
                          styles.value,
                          { color: theme.isDark ? "#FFF" : "#111" },
                        ]}
                        numberOfLines={1}
                      >
                        {formatValue(e.score)}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 4,
    paddingRight: 6,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  body: {
    minHeight: 140,
    maxHeight: 420,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingVertical: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rank: {
    width: 32,
    fontSize: 14,
    fontWeight: "700",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  value: {
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  emptyWrap: {
    flex: 1,
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
  },
});
