import React from "react";

import { SimpleSpectatorCard } from "./SimpleSpectatorCard";
import type { SpectatorRendererProps } from "./types";

export function TapTapSpectatorRenderer({
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

  const subtitle = turnLabel ? `${phase} | ${turnLabel}` : `Phase: ${phase}`;

  return (
    <SimpleSpectatorCard
      width={width}
      title="Tap Tap"
      subtitle={subtitle}
      score={score}
      level={level}
      lives={lives}
    />
  );
}