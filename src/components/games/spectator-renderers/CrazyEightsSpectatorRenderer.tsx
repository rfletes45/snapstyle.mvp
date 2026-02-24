import React from "react";

import { SimpleSpectatorCard } from "./SimpleSpectatorCard";
import type { SpectatorRendererProps } from "./types";

/**
 * Spectator renderer for Crazy Cards (UNO-inspired).
 * Displays game name, phase, turn, direction, and current color.
 * Internal key stays "crazy_eights" for routing stability.
 */
export function CrazyEightsSpectatorRenderer({
  gameState,
  width,
  score,
  level,
  lives,
}: SpectatorRendererProps) {
  const phase =
    typeof gameState.phase === "string"
      ? gameState.phase
      : typeof gameState.gameState === "string"
        ? gameState.gameState
        : "live";

  const turnLabel =
    typeof gameState.turnNumber === "number"
      ? `Turn ${gameState.turnNumber}`
      : typeof gameState.currentTurn === "number"
        ? `Turn ${gameState.currentTurn}`
        : "";

  // Direction indicator for UNO-style play
  const direction =
    typeof gameState.direction === "number"
      ? gameState.direction === 1
        ? "CW"
        : "CCW"
      : "";

  // Current active color
  const colorStr =
    typeof gameState.currentSuit === "string"
      ? (gameState.currentSuit.split("|")[0] ?? "")
      : "";
  const colorLabel = colorStr
    ? colorStr.charAt(0).toUpperCase() + colorStr.slice(1)
    : "";

  const parts = [phase, turnLabel, direction, colorLabel].filter(Boolean);
  const subtitle = parts.join(" | ");

  return (
    <SimpleSpectatorCard
      width={width}
      title="Crazy Cards"
      subtitle={subtitle}
      score={score}
      level={level}
      lives={lives}
    />
  );
}
