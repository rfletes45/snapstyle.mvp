import React from "react";

import { SimpleSpectatorCard } from "./SimpleSpectatorCard";
import type { SpectatorRendererProps } from "./types";

export function GolfDuelsSpectatorRenderer({
  gameState,
  width,
  score,
  level,
  lives,
}: SpectatorRendererProps) {
  const phase = typeof gameState.phase === "string" ? gameState.phase : "live";

  const holeNumber =
    typeof gameState.holeNumber === "number" ? gameState.holeNumber : null;

  const p1HolesWon =
    typeof (gameState as Record<string, unknown>).p1HolesWon === "number"
      ? (gameState as Record<string, unknown>).p1HolesWon
      : null;
  const p2HolesWon =
    typeof (gameState as Record<string, unknown>).p2HolesWon === "number"
      ? (gameState as Record<string, unknown>).p2HolesWon
      : null;

  const parts: string[] = [];
  if (phase) parts.push(phase);
  if (holeNumber !== null) parts.push(`Hole ${holeNumber}`);
  if (p1HolesWon !== null && p2HolesWon !== null) {
    parts.push(`${p1HolesWon} – ${p2HolesWon}`);
  }

  const subtitle = parts.join(" | ") || "In progress";

  return (
    <SimpleSpectatorCard
      width={width}
      title="Golf Duels ⛳"
      subtitle={subtitle}
      score={score}
      level={level}
      lives={lives}
    />
  );
}
