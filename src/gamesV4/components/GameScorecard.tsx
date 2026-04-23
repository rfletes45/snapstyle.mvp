/**
 * Games V4 — Shared Scorecard Card.
 *
 * Rendered in two contexts:
 *
 *  1. `GameOverScreenV4` — off-screen via a `<ViewShot>` wrapper so the
 *     card can be captured to a PNG and shared via the system share sheet.
 *  2. Inline in chats — wrapped by `ChatScorecardMessage`, which gives
 *     the card the full message frame (avatar, sender name, timestamp,
 *     alignment) so it reads as a true authored message in the
 *     transcript and respects bubble vs stacked display mode.
 *
 * Visual language (redesign 2026-04-22 v2):
 *  - Compact footprint (CARD_WIDTH 280, tighter paddings).
 *  - Uniform 1px border on all sides — no thick top accent bar.
 *  - No game icon / image.
 *  - Top: large outcome emphasis ("You Won!" / "You Lost" / etc.).
 *  - Below: `{gameTitle} \u00B7 {statusText}` single line.
 *  - Solo: compact hero row.
 *  - Multiplayer 1v1: two side-by-side rounded "VS" boxes — pfp on top,
 *    username, then Win/Loss text. Border + status text colored
 *    per-player (green = winner, red = loser).
 *  - Multiplayer 3+: compact list (scalable fallback).
 *  - No "SnapStyle Games" footer.
 *
 * @module gamesV4/components/GameScorecard
 */

import UserAvatar from "@/gamesV4/components/UserAvatar";
import { SCOREBOARD_DESCRIPTORS } from "@/gamesV4/constants";
import type { GameScorecardPayload } from "@/gamesV4/types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

const CARD_WIDTH = 280;

export interface GameScorecardProps {
  payload: GameScorecardPayload;
  /** Optional colour theme override. Defaults to the outcome-based color. */
  accentColor?: string;
}

// Outcome / per-player colour system.
const COLORS = {
  win: "#34C759", // green — winner
  loss: "#FF3B30", // red — loser
  multi: "#AF52DE", // purple — multiplayer headline accent
  draw: "#FFCC00", // yellow — draw
} as const;

export const GameScorecard: React.FC<GameScorecardProps> = ({
  payload,
  accentColor,
}) => {
  const descriptor = SCOREBOARD_DESCRIPTORS[payload.gameId];
  const formatScore = (score: number) =>
    descriptor?.formatScore ? descriptor.formatScore(score) : String(score);

  const winnerIdSet = new Set(payload.winnerIds);
  const isSolo = payload.runtimeType === "solo";
  const soloPlayerWon =
    isSolo && (payload.resolutionType === "win" || winnerIdSet.size > 0);
  const isDraw =
    !isSolo &&
    (payload.resolutionType === "draw" ||
      (winnerIdSet.size === 0 && payload.resolutionType !== "win"));

  const headlineColor =
    accentColor ??
    (isSolo
      ? soloPlayerWon
        ? COLORS.win
        : COLORS.loss
      : isDraw
        ? COLORS.draw
        : COLORS.multi);

  const ordered = [...payload.scoreboard].sort(
    (a, b) => (a.placement ?? 99) - (b.placement ?? 99),
  );
  const winnerEntry = ordered.find((e) => winnerIdSet.has(e.uid)) ?? null;
  const heroEntry = winnerEntry ?? (isSolo ? (ordered[0] ?? null) : null);

  // Headline (large outcome emphasis).
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

  const statusText = (() => {
    switch (payload.resolutionType) {
      case "win":
        return isSolo || winnerEntry ? "Victory" : "Game Over";
      case "loss":
        return "Defeat";
      case "draw":
        return "Draw";
      case "resign":
        return "Resigned";
      case "disconnect":
        return "Disconnected";
      case "timeout":
        return "Time Out";
      default:
        return isDraw ? "Draw" : soloPlayerWon ? "Victory" : "Game Over";
    }
  })();

  const durationText = formatDuration(payload.durationMs);

  // Multiplayer 1v1 → VS layout. Multiplayer 3+ → compact list fallback.
  const isOneVOne = !isSolo && ordered.length === 2;

  return (
    <View
      style={[styles.card, { borderColor: `${headlineColor}55` }]}
      testID="game-scorecard"
    >
      {/* Top: large outcome emphasis. */}
      <Text
        style={[styles.headline, { color: headlineColor }]}
        numberOfLines={1}
      >
        {headline}
      </Text>

      {/* `{gameTitle} \u00B7 {statusText}` single line. */}
      <Text style={styles.titleLine} numberOfLines={1}>
        <Text style={styles.titleGame}>{payload.gameTitle}</Text>
        <Text style={styles.titleDot}>{" \u00B7 "}</Text>
        <Text style={[styles.titleStatus, { color: headlineColor }]}>
          {statusText}
        </Text>
      </Text>

      {durationText ? (
        <Text style={styles.durationLine} numberOfLines={1}>
          {durationText}
        </Text>
      ) : null}

      {/* Body — solo hero / 1v1 VS / multi-list fallback. */}
      {isSolo && heroEntry ? (
        <SoloHeroRow
          entry={heroEntry}
          color={headlineColor}
          won={!!soloPlayerWon}
          isWinner={!!winnerEntry && heroEntry.uid === winnerEntry.uid}
          formatScore={formatScore}
        />
      ) : isOneVOne ? (
        <VsLayout
          left={ordered[0]}
          right={ordered[1]}
          winnerIdSet={winnerIdSet}
          isDraw={isDraw}
        />
      ) : (
        <MultiListLayout
          entries={ordered}
          winnerIdSet={winnerIdSet}
          isDraw={isDraw}
          formatScore={formatScore}
        />
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Sub-layouts
// ---------------------------------------------------------------------------

interface ScoreEntry {
  uid: string;
  displayName: string;
  profilePictureUrl?: string | null;
  score: number;
  placement?: number;
}

const SoloHeroRow: React.FC<{
  entry: ScoreEntry;
  color: string;
  won: boolean;
  isWinner: boolean;
  formatScore: (n: number) => string;
}> = ({ entry, color, won, isWinner, formatScore }) => {
  return (
    <View style={[styles.heroRow, { borderColor: `${color}55` }]}>
      <View style={styles.heroAvatarCol}>
        <UserAvatar
          uid={entry.uid}
          displayName={entry.displayName}
          profilePictureUrl={entry.profilePictureUrl ?? null}
          size={40}
        />
        {isWinner ? (
          <MaterialCommunityIcons
            name="crown"
            size={14}
            color="#FFD700"
            style={styles.crown}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.heroName} numberOfLines={1}>
          {entry.displayName}
        </Text>
        <Text style={styles.heroLabel}>{won ? "Winner" : "Final Score"}</Text>
      </View>
      <Text style={[styles.heroScore, { color }]}>
        {formatScore(entry.score)}
      </Text>
    </View>
  );
};

const VsLayout: React.FC<{
  left: ScoreEntry;
  right: ScoreEntry;
  winnerIdSet: Set<string>;
  isDraw: boolean;
}> = ({ left, right, winnerIdSet, isDraw }) => {
  return (
    <View style={styles.vsRow}>
      <PlayerVsBox entry={left} winnerIdSet={winnerIdSet} isDraw={isDraw} />
      <View style={styles.vsTextWrap}>
        <Text style={styles.vsText}>VS</Text>
      </View>
      <PlayerVsBox entry={right} winnerIdSet={winnerIdSet} isDraw={isDraw} />
    </View>
  );
};

const PlayerVsBox: React.FC<{
  entry: ScoreEntry;
  winnerIdSet: Set<string>;
  isDraw: boolean;
}> = ({ entry, winnerIdSet, isDraw }) => {
  const won = winnerIdSet.has(entry.uid);
  const color = isDraw ? COLORS.draw : won ? COLORS.win : COLORS.loss;
  const label = isDraw ? "Draw" : won ? "Win" : "Loss";
  return (
    <View style={[styles.vsBox, { borderColor: color }]}>
      <UserAvatar
        uid={entry.uid}
        displayName={entry.displayName}
        profilePictureUrl={entry.profilePictureUrl ?? null}
        size={48}
      />
      <Text style={styles.vsName} numberOfLines={1}>
        {entry.displayName}
      </Text>
      <Text style={[styles.vsResult, { color }]}>{label}</Text>
    </View>
  );
};

const MultiListLayout: React.FC<{
  entries: ScoreEntry[];
  winnerIdSet: Set<string>;
  isDraw: boolean;
  formatScore: (n: number) => string;
}> = ({ entries, winnerIdSet, isDraw, formatScore }) => {
  return (
    <View style={styles.playersList}>
      {entries.map((entry) => {
        const won = winnerIdSet.has(entry.uid);
        const color = isDraw && won ? COLORS.draw : won ? COLORS.win : null;
        return (
          <View key={entry.uid} style={styles.playerRow}>
            <UserAvatar
              uid={entry.uid}
              displayName={entry.displayName}
              profilePictureUrl={entry.profilePictureUrl ?? null}
              size={28}
            />
            <Text style={styles.playerName} numberOfLines={1}>
              {entry.displayName}
              {isDraw && won ? " (Draw)" : ""}
            </Text>
            <Text style={[styles.playerScore, color ? { color } : null]}>
              {formatScore(entry.score)}
            </Text>
          </View>
        );
      })}
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    // Uniform 1px border on ALL sides.
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  headline: {
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 2,
  },
  titleLine: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  titleGame: {
    color: "#1C1C1E",
    fontWeight: "700",
  },
  titleDot: {
    color: "#8E8E93",
    fontWeight: "700",
  },
  titleStatus: {
    fontWeight: "700",
  },
  durationLine: {
    fontSize: 11,
    color: "#8E8E93",
    marginBottom: 10,
  },

  // Solo hero
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 8,
    marginTop: 4,
  },
  heroAvatarCol: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  crown: {
    position: "absolute",
    top: -6,
    right: -4,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  heroLabel: {
    fontSize: 11,
    color: "#8E8E93",
    marginTop: 1,
  },
  heroScore: {
    fontSize: 17,
    fontWeight: "800",
  },

  // 1v1 VS layout
  vsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  vsBox: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.015)",
  },
  vsName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1C1C1E",
    marginTop: 6,
    maxWidth: "100%",
  },
  vsResult: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
    letterSpacing: 0.3,
  },
  vsTextWrap: {
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  vsText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#8E8E93",
    letterSpacing: 1,
  },

  // 3+ player fallback list
  playersList: {
    gap: 4,
    marginTop: 4,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  playerName: {
    flex: 1,
    fontSize: 13,
    color: "#3C3C43",
    fontWeight: "500",
  },
  playerScore: {
    fontSize: 13,
    color: "#1C1C1E",
    fontWeight: "700",
  },
});

export default GameScorecard;
