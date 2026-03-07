/**
 * Mini Golf — Score HUD Component
 *
 * Compact top-bar showing hole info, par, and per-player strokes.
 *
 * @module gamesV4/games/miniGolf/ui/ScoreHUD
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { MiniGolfPublicState } from "../types";

interface ScoreHUDProps {
  state: MiniGolfPublicState;
  turnOrder: string[];
  currentTurnIndex: number;
  myUid: string;
  playerNames: Record<string, string>;
  holeName?: string;
}

const BALL_COLORS = ["#FFFFFF", "#FFD700", "#FF69B4", "#00BFFF"];

const ScoreHUD: React.FC<ScoreHUDProps> = ({
  state,
  turnOrder,
  currentTurnIndex,
  myUid,
  playerNames,
  holeName,
}) => {
  const currentTurnUid = turnOrder[currentTurnIndex % turnOrder.length];

  return (
    <View style={styles.container}>
      {/* Hole info row */}
      <View style={styles.holeRow}>
        <Text style={styles.holeName}>
          {holeName || state.holeId.replace("pigeon_", "Hole ")}
        </Text>
        <Text style={styles.holeInfo}>
          {state.holeIndex + 1}/{state.holeCount} · Par {state.holePar}
        </Text>
        <View
          style={[
            styles.phaseBadge,
            state.phase === "rolling" && styles.phaseBadgeRolling,
          ]}
        >
          <Text style={styles.phaseText}>
            {state.phase === "aim"
              ? "AIM"
              : state.phase === "rolling"
                ? "ROLLING"
                : state.phase === "between_holes"
                  ? "NEXT HOLE"
                  : "FINISHED"}
          </Text>
        </View>
      </View>

      {/* Player scores row */}
      <View style={styles.scoresRow}>
        {turnOrder.map((uid, i) => {
          const isCurrentTurn = uid === currentTurnUid;
          const isMe = uid === myUid;
          const strokes = state.strokesTotalByUid[uid] || 0;
          const holeStrokes = state.strokesThisHoleByUid[uid] || 0;
          const sunk = state.ballSunkByUid[uid] || false;

          return (
            <View
              key={uid}
              style={[
                styles.playerCard,
                isCurrentTurn && styles.playerCardActive,
                isMe && styles.playerCardMe,
              ]}
            >
              <View style={styles.playerHeader}>
                <View
                  style={[
                    styles.ballDot,
                    { backgroundColor: BALL_COLORS[i % BALL_COLORS.length] },
                  ]}
                />
                <Text
                  style={[
                    styles.playerName,
                    isCurrentTurn && styles.playerNameActive,
                  ]}
                  numberOfLines={1}
                >
                  {(playerNames[uid] || (isMe ? "You" : `P${i + 1}`)).slice(
                    0,
                    10,
                  )}
                </Text>
              </View>
              <Text style={styles.strokesTotal}>{strokes}</Text>
              <Text style={styles.strokesHole}>
                {sunk ? "⛳" : `(${holeStrokes})`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  holeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  holeName: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "700",
  },
  holeInfo: {
    color: "#ccc",
    fontSize: 12,
    fontWeight: "500",
  },
  phaseBadge: {
    backgroundColor: "rgba(76,175,80,0.3)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  phaseBadgeRolling: {
    backgroundColor: "rgba(255,152,0,0.3)",
  },
  phaseText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  scoresRow: {
    flexDirection: "row",
    gap: 8,
  },
  playerCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  playerCardActive: {
    backgroundColor: "rgba(255,215,0,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.4)",
  },
  playerCardMe: {
    borderLeftWidth: 2,
    borderLeftColor: "#4CAF50",
  },
  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  ballDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.3)",
  },
  playerName: {
    color: "#ccc",
    fontSize: 11,
    fontWeight: "600",
  },
  playerNameActive: {
    color: "#FFD700",
  },
  strokesTotal: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  strokesHole: {
    color: "#aaa",
    fontSize: 10,
    fontWeight: "500",
  },
});

export default React.memo(ScoreHUD);
