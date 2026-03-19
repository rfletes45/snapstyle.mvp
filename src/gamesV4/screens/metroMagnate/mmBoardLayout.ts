/**
 * Metro Magnate — Perimeter Board Layout
 *
 * Maps the 36-space linear board onto a square perimeter layout.
 * Computes sizing for corners, edges, and center panel based on
 * available screen width.
 *
 * Board orientation (Monopoly-like, clockwise movement):
 *
 *   [18] [19] [20] [21] [22] [23] [24] [25] [26] [27]
 *   [17]                                          [28]
 *   [16]                                          [29]
 *   [15]                                          [30]
 *   [14]              CENTER                      [31]
 *   [13]                                          [32]
 *   [12]                                          [33]
 *   [11]                                          [34]
 *   [10]                                          [35]
 *    [9]  [8]  [7]  [6]  [5]  [4]  [3]  [2]  [1]  [0]
 *
 * Corners: 0 (Central Terminal), 9, 18 (Grand Plaza), 27
 *
 * @module gamesV4/screens/metroMagnate/mmBoardLayout
 */

import { Dimensions } from "react-native";

// =============================================================================
// Constants
// =============================================================================

const EDGES_PER_SIDE = 8;

/** Indices that sit at board corners. */
export const CORNER_INDICES = [0, 9, 18, 27] as const;

/** Board side definitions — each lists space indices in render order. */
export type BoardSide = "top" | "right" | "bottom" | "left";

// Top row, left-to-right in layout: 18, 19, 20, 21, 22, 23, 24, 25, 26, 27
export const TOP_ROW: readonly number[] = [
  18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
];

// Right column, top-to-bottom in layout: 28, 29, 30, 31, 32, 33, 34, 35
export const RIGHT_COL: readonly number[] = [28, 29, 30, 31, 32, 33, 34, 35];

// Bottom row, left-to-right in layout: 9, 8, 7, 6, 5, 4, 3, 2, 1, 0
export const BOTTOM_ROW: readonly number[] = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

// Left column, top-to-bottom in layout: 17, 16, 15, 14, 13, 12, 11, 10
export const LEFT_COL: readonly number[] = [17, 16, 15, 14, 13, 12, 11, 10];

// =============================================================================
// Sizing
// =============================================================================

export interface BoardMetrics {
  /** Total board outer size (width = height). */
  boardSize: number;
  /** Corner tile side length. */
  cornerSize: number;
  /** Edge tile width (on top/bottom) or height (on left/right). */
  edgeThick: number;
  /** Edge tile length along the perimeter direction. */
  edgeThin: number;
  /** Center panel inner size (both dimensions). */
  centerSize: number;
}

/**
 * Compute board metrics from available width.
 * Call with `Dimensions.get("window").width` or a measured container width.
 */
export function computeBoardMetrics(availableWidth: number): BoardMetrics {
  const boardSize = Math.floor(availableWidth);
  // Corner size ~12% of board, minimum 36px
  const cornerSize = Math.max(36, Math.floor(boardSize * 0.115));
  // Edge thin dimension = (boardSize - 2 corners) / 8
  const edgeThin = Math.floor((boardSize - 2 * cornerSize) / EDGES_PER_SIDE);
  // Edge thick dimension = same as corner (depth of the perimeter ring)
  const edgeThick = cornerSize;
  // Center panel = what's left after both perimeter rings
  const centerSize = boardSize - 2 * cornerSize;

  return { boardSize, cornerSize, edgeThick, edgeThin, centerSize };
}

/** Default metrics based on screen width with small margin. */
export function getDefaultBoardMetrics(): BoardMetrics {
  const screenW = Dimensions.get("window").width;
  return computeBoardMetrics(screenW - 8);
}

// =============================================================================
// Abbreviated Names
// =============================================================================

const ABBREV: Record<number, string> = {
  0: "START",
  2: "City\nBrief",
  4: "Civic\nFee",
  5: "North\nLine",
  7: "Market\nShift",
  10: "HOLD",
  12: "Power\nCo.",
  14: "City\nBrief",
  16: "Cross\nLine",
  18: "PLAZA",
  20: "Market\nShift",
  22: "Civic\nFee",
  24: "South\nLine",
  27: "Water\nWorks",
  29: "Market\nShift",
  30: "City\nBrief",
  33: "DETOUR",
  35: "Express\nLine",
};

/** Short name for board tile (1-2 words). Falls back to first word of full name. */
export function getAbbrevName(index: number, fullName: string): string {
  if (ABBREV[index] != null) return ABBREV[index];
  // For districts: use first word
  const parts = fullName.split(" ");
  if (parts.length <= 2) return fullName;
  return parts[0];
}

// =============================================================================
// Space icon mapping
// =============================================================================

/** MaterialCommunityIcons name for special space types. */
export function getSpaceIcon(type: string): string | null {
  switch (type) {
    case "central_terminal":
      return "train";
    case "inspection_hold":
      return "shield-alert";
    case "detour_to_inspection":
      return "arrow-right-bold";
    case "plaza":
      return "bank";
    case "civic_fee":
      return "cash-minus";
    case "market_shift":
      return "chart-line";
    case "city_brief":
      return "file-document-outline";
    case "transit_line":
      return "subway-variant";
    case "service_node":
      return "flash";
    case "district":
      return "home-city";
    default:
      return null;
  }
}
