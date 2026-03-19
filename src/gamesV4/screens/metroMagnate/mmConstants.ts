/**
 * Metro Magnate — Theme constants and shared helpers
 *
 * Sector colors match board data definitions.
 * Player colors are bright, distinct, and designed for dark backgrounds.
 *
 * @module gamesV4/screens/metroMagnate/mmConstants
 */

import type { MetroMagnatePublicState } from "@/gamesV4/adapters/metroMagnate/metroMagnateTypes";
import type { GameShellProps } from "@/gamesV4/components/GameScreenShell";

// =============================================================================
// Player Colors (2–6 players)
// =============================================================================

export const PLAYER_COLORS = [
  "#4ADE80", // green
  "#60A5FA", // blue
  "#FB923C", // orange
  "#F472B6", // pink
  "#A78BFA", // purple
  "#22D3EE", // cyan
];

// =============================================================================
// Space Accent Colors
// =============================================================================

export const SECTOR_COLORS: Record<string, string> = {
  arts_quarter: "#8B5CF6",
  harbor_ward: "#06B6D4",
  market_row: "#F59E0B",
  foundry_belt: "#EF4444",
  tech_heights: "#10B981",
  civic_square: "#3B82F6",
};

export const SPACE_TYPE_COLORS: Record<string, string> = {
  central_terminal: "#FFD700",
  inspection_hold: "#FF6B6B",
  detour_to_inspection: "#FF6B6B",
  plaza: "#4ECDC4",
  transit_line: "#94A3B8",
  service_node: "#C084FC",
  civic_fee: "#F87171",
  market_shift: "#FB923C",
  city_brief: "#38BDF8",
};

// =============================================================================
// Tile Category Background Colors — strong visual differentiation
// =============================================================================

/** Translucent background fills per tile category. */
export const TILE_BG_COLORS: Record<string, string> = {
  district: "rgba(255,255,255,0.02)",
  transit_line: "rgba(148,163,184,0.10)",
  service_node: "rgba(192,132,252,0.08)",
  market_shift: "rgba(251,146,60,0.14)",
  city_brief: "rgba(56,189,248,0.14)",
  civic_fee: "rgba(248,113,113,0.12)",
  central_terminal: "rgba(255,215,0,0.10)",
  inspection_hold: "rgba(255,107,107,0.10)",
  detour_to_inspection: "rgba(255,107,107,0.12)",
  plaza: "rgba(78,205,196,0.10)",
};

/** Border colors per tile category for extra differentiation. */
export const TILE_BORDER_COLORS: Record<string, string> = {
  district: "rgba(255,255,255,0.06)",
  transit_line: "rgba(148,163,184,0.25)",
  service_node: "rgba(192,132,252,0.20)",
  market_shift: "rgba(251,146,60,0.35)",
  city_brief: "rgba(56,189,248,0.35)",
  civic_fee: "rgba(248,113,113,0.30)",
  central_terminal: "rgba(255,215,0,0.25)",
  inspection_hold: "rgba(255,107,107,0.25)",
  detour_to_inspection: "rgba(255,107,107,0.25)",
  plaza: "rgba(78,205,196,0.25)",
};

// =============================================================================
// Helpers
// =============================================================================

export function getSpaceAccent(type: string, sectorId?: string): string {
  if (type === "district" && sectorId)
    return SECTOR_COLORS[sectorId] ?? "#6B7280";
  return SPACE_TYPE_COLORS[type] ?? "#6B7280";
}

/** Get the category background color for a tile type. */
export function getTileBg(type: string): string {
  return TILE_BG_COLORS[type] ?? "rgba(255,255,255,0.02)";
}

/** Get the category border color for a tile type. */
export function getTileBorder(type: string): string {
  return TILE_BORDER_COLORS[type] ?? "rgba(255,255,255,0.06)";
}

/** True if the tile type is a purchasable property. */
export function isPurchasable(type: string): boolean {
  return (
    type === "district" || type === "transit_line" || type === "service_node"
  );
}

/** Short type label for display on tiles. */
export function getTileTypeLabel(type: string): string | null {
  switch (type) {
    case "transit_line":
      return "TRANSIT";
    case "service_node":
      return "SERVICE";
    case "market_shift":
      return "EVENT";
    case "city_brief":
      return "EVENT";
    case "civic_fee":
      return "FEE";
    case "central_terminal":
      return "START";
    case "inspection_hold":
      return "HOLD";
    case "detour_to_inspection":
      return "DETOUR";
    case "plaza":
      return "BONUS";
    default:
      return null;
  }
}

export function getPlayerColor(uid: string, turnOrder: string[]): string {
  const idx = turnOrder.indexOf(uid);
  return PLAYER_COLORS[idx >= 0 ? idx % PLAYER_COLORS.length : 0];
}

export function getDisplayName(
  uid: string,
  players: GameShellProps["players"],
  myUid: string,
): string {
  if (uid === myUid) return "You";
  const p = players.find((x) => x.uid === uid);
  return p?.displayName ?? uid.slice(0, 6);
}

export function asState(
  ps: Record<string, unknown> | null,
): MetroMagnatePublicState | null {
  if (!ps) return null;
  return ps as unknown as MetroMagnatePublicState;
}

export function getSpaceOwner(
  state: MetroMagnatePublicState,
  idx: number,
): string | null {
  return (
    state.propertyOwnership.find((o) => o.spaceIndex === idx)?.ownerUid ?? null
  );
}

export function getImpLevel(
  state: MetroMagnatePublicState,
  idx: number,
): number {
  return (
    state.propertyImprovements.find((i) => i.spaceIndex === idx)?.level ?? 0
  );
}

export function isMortgagedProp(
  state: MetroMagnatePublicState,
  idx: number,
): boolean {
  return (
    state.propertyMortgages.find((m) => m.spaceIndex === idx)?.mortgaged ??
    false
  );
}

export function formatCash(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

/** Improvement level label */
export function impLabel(level: number): string {
  if (level === 0) return "Empty";
  if (level <= 4) return `${level} Storefront${level > 1 ? "s" : ""}`;
  return "Tower";
}
