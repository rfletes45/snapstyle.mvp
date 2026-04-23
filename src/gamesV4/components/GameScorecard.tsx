/**
 * Games V4 — Shared Scorecard Card.
 *
 * Rendered in two places:
 *
 *  1. `GameOverScreenV4` — off-screen via a `<ViewShot>` wrapper so the
 *     card can be captured to a PNG and shared via the system share sheet.
 *  2. Inline in group chats — when the backend auto-posts a scorecard
 *     message, the group renderer decodes it and mounts this component
 *     instead of the plain system chip.
 *
 * The visual language is intentionally simple and screenshot-friendly:
 * a tall card with the game title + icon, a dominant winner row, a
 * clean list of other players with their final scores, and a branded
 * footer. Colour is driven by whether the session ended in a win, draw
 * or abrupt termination.
 *
 * @module gamesV4/components/GameScorecard
 */

import UserAvatar from "@/gamesV4/components/UserAvatar";
import { GAME_METADATA, SCOREBOARD_DESCRIPTORS } from "@/gamesV4/constants";
import type { GameScorecardPayload } from "@/gamesV4/types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const CARD_WIDTH = 320;

export interface GameScorecardProps {
  payload: GameScorecardPayload;
  /** Optional colour theme override. Defaults to the outcome-based color. */
  accentColor?: string;
}

// Outcome colour system:
//   Solo  win  → green
//   Solo  loss → red
//   Multi win  → purple  (decisive competitive result)
//   Multi draw → yellow
const OUTCOME_COLORS = {
  soloWin: "#34C759",
  soloLoss: "#FF3B30",
  multiWin: "#AF52DE",
  draw: "#FFCC00",
} as const;

export const GameScorecard: React.FC<GameScorecardProps> = ({
  payload,
  accentColor,
}) => {
  const meta = GAME_METADATA[payload.gameId];
  const descriptor = SCOREBOARD_DESCRIPTORS[payload.gameId];
  const formatScore = (score: number) =>
    descriptor?.formatScore ? descriptor.formatScore(score) : String(score);

  const winnerIdSet = new Set(payload.winnerIds);
  const isSolo = payload.runtimeType === "solo";
  const soloPlayerWon =
    isSolo && (payload.resolutionType === "win" || winnerIdSet.size > 0);
  const isSoloLoss = isSolo && !soloPlayerWon;
  // Multiplayer draws only — solo never draws.
  const isDraw =
    !isSolo &&
    (payload.resolutionType === "draw" ||
      (winnerIdSet.size === 0 && payload.resolutionType !== "win"));

  const headlineColor =
    accentColor ??
    (isSolo
      ? soloPlayerWon
        ? OUTCOME_COLORS.soloWin
        : OUTCOME_COLORS.soloLoss
      : isDraw
        ? OUTCOME_COLORS.draw
        : OUTCOME_COLORS.multiWin);

  const ordered = [...payload.scoreboard].sort(
    (a, b) => (a.placement ?? 99) - (b.placement ?? 99),
  );
  const winnerEntry = ordered.find((e) => winnerIdSet.has(e.uid)) ?? null;
  // In solo, always highlight the player (one-entry scoreboard).
  const heroEntry = winnerEntry ?? (isSolo ? (ordered[0] ?? null) : null);
  const others = ordered.filter((e) => e.uid !== heroEntry?.uid);

  let headline: string;
  if (isSolo) {
    headline = soloPlayerWon ? "You Won!" : "You Lost";
  } else if (isDraw) {
    headline = "Draw";
  } else if (winnerEntry) {
    headline = `${winnerEntry.displayName} wins`;
  } else {
    headline = "Game Over";
  }

  // Solo subline shows the concrete outcome reason instead of duration.
  const isAbrupt =
    payload.resolutionType === "resign" ||
    payload.resolutionType === "disconnect" ||
    payload.resolutionType === "timeout";

  const subline = (() => {
    if (isSolo) {
      if (payload.resolutionType === "resign") return "Resigned";
      if (soloPlayerWon) return formatDuration(payload.durationMs) || "Cleared";
      return "Game Over";
    }
    if (isAbrupt) {
      return payload.resolutionType === "resign"
        ? "Match resolved by resignation"
        : payload.resolutionType === "disconnect"
          ? "Match resolved by disconnect"
          : "Match resolved by timeout";
    }
    return formatDuration(payload.durationMs);
  })();

  return (
    <View
      style={[styles.card, { borderColor: `${headlineColor}33` }]}
      testID="game-scorecard"
    >
      <View style={[styles.headerAccent, { backgroundColor: headlineColor }]} />

      <View style={styles.headerRow}>
        <View
          style={[styles.iconWrap, { backgroundColor: `${headlineColor}22` }]}
        >
          <MaterialCommunityIcons
            name={(meta?.icon as never) ?? "gamepad-variant"}
            size={24}
            color={headlineColor}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.gameTitle} numberOfLines={1}>
            {payload.gameTitle}
          </Text>
          {subline ? <Text style={styles.gameSubline}>{subline}</Text> : null}
        </View>
      </View>

      <Text
        style={[styles.headline, { color: headlineColor }]}
        numberOfLines={1}
      >
        {headline}
      </Text>

      {heroEntry ? (
        <View style={[styles.winnerRow, { borderColor: `${headlineColor}55` }]}>
          <View style={styles.avatarCol}>
            <UserAvatar
              uid={heroEntry.uid}
              displayName={heroEntry.displayName}
              profilePictureUrl={heroEntry.profilePictureUrl ?? null}
              size={48}
            />
            {winnerEntry && heroEntry.uid === winnerEntry.uid ? (
              <MaterialCommunityIcons
                name="crown"
                size={18}
                color="#FFD700"
                style={styles.crown}
              />
            ) : null}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.winnerName} numberOfLines={1}>
              {heroEntry.displayName}
            </Text>
            <Text style={styles.winnerLabel}>
              {isSolo
                ? soloPlayerWon
                  ? "Winner"
                  : "Final Score"
                : winnerEntry
                  ? "Winner"
                  : "Top Player"}
            </Text>
          </View>
          <Text style={[styles.winnerScore, { color: headlineColor }]}>
            {formatScore(heroEntry.score)}
          </Text>
        </View>
      ) : null}

      {others.length > 0 ? (
        <View style={styles.playersList}>
          {others.map((entry) => {
            const isDrawWinner = isDraw && winnerIdSet.has(entry.uid);
            return (
              <View key={entry.uid} style={styles.playerRow}>
                <UserAvatar
                  uid={entry.uid}
                  displayName={entry.displayName}
                  profilePictureUrl={entry.profilePictureUrl ?? null}
                  size={32}
                />
                <Text style={styles.playerName} numberOfLines={1}>
                  {entry.displayName}
                  {isDrawWinner ? " (Draw)" : ""}
                </Text>
                <Text style={styles.playerScore}>
                  {formatScore(entry.score)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.footer}>
        <MaterialCommunityIcons name="gamepad-variant" size={12} color="#999" />
        <Text style={styles.footerText}>SnapStyle • Games</Text>
      </View>
    </View>
  );
};

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s match`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem === 0 ? `${minutes}m match` : `${minutes}m ${rem}s match`;
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 0,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  headerAccent: {
    height: 6,
    marginHorizontal: -18,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  gameTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  gameSubline: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  headline: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  winnerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  avatarCol: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  crown: {
    position: "absolute",
    top: -8,
    right: -6,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  winnerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  winnerLabel: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  winnerScore: {
    fontSize: 20,
    fontWeight: "800",
  },
  playersList: {
    gap: 6,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  playerName: {
    flex: 1,
    fontSize: 14,
    color: "#3C3C43",
    fontWeight: "500",
  },
  playerScore: {
    fontSize: 14,
    color: "#1C1C1E",
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
  },
  footerText: {
    fontSize: 11,
    color: "#999",
    fontWeight: "500",
  },
});

export default GameScorecard;
