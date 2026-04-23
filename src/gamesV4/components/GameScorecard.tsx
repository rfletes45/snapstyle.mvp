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

import CosmeticImage from "@/components/CosmeticImage";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture/ProfilePictureWithDecoration";
import { getCosmeticAsset } from "@/cosmetics/assetRegistry";
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

  // Personalization: backgrounds differ by card type.
  //  • Solo  → sender's equipped background (the card *is* the sender's
  //           run, regardless of win/loss). Always read from the payload's
  //           `senderEquippedBackgroundId`.
  //  • Multi → winner's equipped background, when there's exactly one
  //           winner. Falls back to neutral surface for draws / ties.
  // In either branch, a missing/unresolved asset cleanly drops back to
  // the default white surface.
  const personalBgId = isSolo
    ? (payload.senderEquippedBackgroundId ?? null)
    : (payload.winnerEquippedBackgroundId ?? null);
  const personalBgSource = personalBgId
    ? getCosmeticAsset("background", personalBgId)
    : null;
  const hasBg = !!personalBgSource;

  // Text colors flip to white-on-scrim when a background image is present.
  const onBgPrimary = "#FFFFFF";
  const onBgSecondary = "rgba(255,255,255,0.85)";
  const onBgMuted = "rgba(255,255,255,0.7)";

  // Solo-mode border assignment (user-requested visual):
  //  • Top header box   → COLORED border (win/loss/draw headlineColor)
  //  • Bottom hero row  → GREY neutral border
  // For non-solo modes the header has no explicit border and we don't
  // want to introduce one, so we gate both overrides on `isSolo`.
  const headerBorderStyle = isSolo
    ? {
        borderWidth: 1.5,
        borderColor: `${headlineColor}88`,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingTop: 8,
        paddingBottom: 8,
        marginBottom: 10,
      }
    : null;
  const heroGreyBorder = hasBg ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)";

  return (
    <View
      style={[
        styles.card,
        hasBg
          ? { borderColor: `${headlineColor}55`, backgroundColor: "#1C1C1E" }
          : { borderColor: `${headlineColor}55` },
      ]}
      testID="game-scorecard"
    >
      {/* Personalized winner background (absolute fill, behind content). */}
      {hasBg ? (
        <>
          <CosmeticImage
            source={personalBgSource}
            style={StyleSheet.absoluteFillObject}
            debugLabel="scorecard-personal-bg"
            transition={0}
          />
          {/* Dark scrim for global legibility. */}
          <View style={styles.bgScrim} pointerEvents="none" />
        </>
      ) : null}

      {/* Glass panel behind the game text area (headline / title / duration). */}
      <View
        style={[
          hasBg ? styles.headerGlass : styles.headerPlain,
          headerBorderStyle,
        ]}
      >
        <Text
          style={[styles.headline, { color: headlineColor }]}
          numberOfLines={1}
        >
          {headline}
        </Text>

        {/* `{gameTitle} \u00B7 {statusText}` single line. */}
        <Text style={styles.titleLine} numberOfLines={1}>
          <Text
            style={[styles.titleGame, hasBg ? { color: onBgPrimary } : null]}
          >
            {payload.gameTitle}
          </Text>
          <Text
            style={[styles.titleDot, hasBg ? { color: onBgSecondary } : null]}
          >
            {" \u00B7 "}
          </Text>
          <Text style={[styles.titleStatus, { color: headlineColor }]}>
            {statusText}
          </Text>
        </Text>

        {durationText ? (
          <Text
            style={[
              styles.durationLine,
              hasBg ? { color: onBgMuted, marginBottom: 0 } : null,
            ]}
            numberOfLines={1}
          >
            {durationText}
          </Text>
        ) : null}
      </View>

      {/* Body — solo hero / 1v1 VS / multi-list fallback. */}
      {isSolo && heroEntry ? (
        <SoloHeroRow
          entry={heroEntry}
          color={headlineColor}
          borderColor={heroGreyBorder}
          won={!!soloPlayerWon}
          isWinner={!!winnerEntry && heroEntry.uid === winnerEntry.uid}
          formatScore={formatScore}
          hasBg={hasBg}
        />
      ) : isOneVOne ? (
        <VsLayout
          left={ordered[0]}
          right={ordered[1]}
          winnerIdSet={winnerIdSet}
          isDraw={isDraw}
          hasBg={hasBg}
        />
      ) : (
        <MultiListLayout
          entries={ordered}
          winnerIdSet={winnerIdSet}
          isDraw={isDraw}
          formatScore={formatScore}
          hasBg={hasBg}
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
  decorationId?: string | null;
  score: number;
  placement?: number;
}

/**
 * Small gold crown overlaid on top-right of a winner's profile picture.
 * Tilted so the bottom of the crown leans left — toward the center of
 * the pfp — matching the product spec (~250° visual reference).
 * Rendered above both the base pfp and its decoration overlay.
 */
const WinnerCrown: React.FC<{ size: number }> = ({ size }) => {
  const iconSize = Math.max(12, Math.round(size * 0.42));
  return (
    <View
      pointerEvents="none"
      style={[
        styles.winnerCrownWrap,
        {
          // Anchor just above/right of the pfp so the tilted crown sits
          // snugly at the corner with its bottom pointing toward center.
          top: -Math.round(iconSize * 0.45),
          right: -Math.round(iconSize * 0.2),
          transform: [{ rotate: "-20deg" }],
        },
      ]}
    >
      <MaterialCommunityIcons
        name="crown"
        size={iconSize}
        color="#FFD700"
        style={styles.winnerCrownIcon}
      />
    </View>
  );
};

const SoloHeroRow: React.FC<{
  entry: ScoreEntry;
  color: string;
  /** Grey/neutral border applied to the hero row frame (see solo-mode
   *  border split: top header = colored, bottom hero = grey). */
  borderColor: string;
  won: boolean;
  isWinner: boolean;
  formatScore: (n: number) => string;
  hasBg: boolean;
}> = ({ entry, color, borderColor, won, isWinner, formatScore, hasBg }) => {
  return (
    <View
      style={[hasBg ? styles.heroRowGlass : styles.heroRow, { borderColor }]}
    >
      <View style={styles.heroAvatarCol}>
        <ProfilePictureWithDecoration
          pictureUrl={entry.profilePictureUrl ?? null}
          name={entry.displayName}
          decorationId={entry.decorationId ?? null}
          size={40}
        />
        {isWinner ? <WinnerCrown size={40} /> : null}
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text
          style={[styles.heroName, hasBg ? { color: "#FFFFFF" } : null]}
          numberOfLines={1}
        >
          {entry.displayName}
        </Text>
        <Text
          style={[
            styles.heroLabel,
            hasBg ? { color: "rgba(255,255,255,0.75)" } : null,
          ]}
        >
          {won ? "Winner" : "Final Score"}
        </Text>
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
  hasBg: boolean;
}> = ({ left, right, winnerIdSet, isDraw, hasBg }) => {
  return (
    <View style={styles.vsRow}>
      <PlayerVsBox
        entry={left}
        winnerIdSet={winnerIdSet}
        isDraw={isDraw}
        hasBg={hasBg}
      />
      <View style={styles.vsTextWrap}>
        <Text style={styles.vsText}>VS</Text>
      </View>
      <PlayerVsBox
        entry={right}
        winnerIdSet={winnerIdSet}
        isDraw={isDraw}
        hasBg={hasBg}
      />
    </View>
  );
};

const PlayerVsBox: React.FC<{
  entry: ScoreEntry;
  winnerIdSet: Set<string>;
  isDraw: boolean;
  hasBg: boolean;
}> = ({ entry, winnerIdSet, isDraw, hasBg }) => {
  const won = winnerIdSet.has(entry.uid);
  const color = isDraw ? COLORS.draw : won ? COLORS.win : COLORS.loss;
  const label = isDraw ? "Draw" : won ? "Win" : "Loss";
  return (
    <View
      style={[hasBg ? styles.vsBoxGlass : styles.vsBox, { borderColor: color }]}
    >
      <View style={styles.vsAvatarCol}>
        <ProfilePictureWithDecoration
          pictureUrl={entry.profilePictureUrl ?? null}
          name={entry.displayName}
          decorationId={entry.decorationId ?? null}
          size={48}
        />
        {won && !isDraw ? <WinnerCrown size={48} /> : null}
      </View>
      <Text
        style={[styles.vsName, hasBg ? { color: "#FFFFFF" } : null]}
        numberOfLines={1}
      >
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
  hasBg: boolean;
}> = ({ entries, winnerIdSet, isDraw, formatScore, hasBg }) => {
  return (
    <View style={hasBg ? styles.playersListGlass : styles.playersList}>
      {entries.map((entry) => {
        const won = winnerIdSet.has(entry.uid);
        const color = isDraw && won ? COLORS.draw : won ? COLORS.win : null;
        return (
          <View key={entry.uid} style={styles.playerRow}>
            <View style={styles.playerAvatarCol}>
              <ProfilePictureWithDecoration
                pictureUrl={entry.profilePictureUrl ?? null}
                name={entry.displayName}
                decorationId={entry.decorationId ?? null}
                size={28}
              />
              {won && !isDraw ? <WinnerCrown size={28} /> : null}
            </View>
            <Text
              style={[styles.playerName, hasBg ? { color: "#FFFFFF" } : null]}
              numberOfLines={1}
            >
              {entry.displayName}
              {isDraw && won ? " (Draw)" : ""}
            </Text>
            <Text
              style={[
                styles.playerScore,
                hasBg ? { color: "#FFFFFF" } : null,
                color ? { color } : null,
              ]}
            >
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
  bgScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  // Translucent "glass" panel behind game text when a winner background is present.
  headerGlass: {
    backgroundColor: "rgba(20,20,20,0.72)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    marginBottom: 10,
  },
  // Plain (non-glass) header wrapper used when there is no winner background.
  // Zero padding/margin so the existing layout is byte-for-byte unchanged.
  headerPlain: {
    marginBottom: 0,
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
    // Always solid — must NOT inherit the winner background image.
    backgroundColor: "#FFFFFF",
  },
  // Solo hero, glass variant — matches `headerGlass` so the pfp/name/
  // score section visually pairs with the top text card when a
  // personalized profile background is painted behind the scorecard.
  heroRowGlass: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: 8,
    marginTop: 4,
    backgroundColor: "rgba(20,20,20,0.72)",
    borderWidth: 1.75,
    borderColor: "rgba(255,255,255,0.32)",
  },
  heroAvatarCol: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  vsAvatarCol: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  playerAvatarCol: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  winnerCrownWrap: {
    position: "absolute",
    zIndex: 20,
    elevation: 6,
  },
  winnerCrownIcon: {
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    // Always solid — user info boxes must remain solid surfaces and not
    // visually inherit the winner background.
    backgroundColor: "#FFFFFF",
  },
  // Glass variant applied when a winner background is painted behind
  // the card. Semi-transparent black backing keeps the text legible
  // over the background image.
  vsBoxGlass: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    backgroundColor: "rgba(20,20,20,0.72)",
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
    color: "#FFFFFF",
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // 3+ player fallback list
  playersList: {
    gap: 4,
    marginTop: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 8,
  },
  // Glass variant — semi-transparent black backing for legibility over
  // a personalized profile-background image.
  playersListGlass: {
    gap: 4,
    marginTop: 4,
    backgroundColor: "rgba(20,20,20,0.72)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 10,
    padding: 8,
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
