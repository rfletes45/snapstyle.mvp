/**
 * Hair Color Definitions
 *
 * 20 hair colors: 15 natural + 5 fantasy
 * Each color includes base, shadow, and highlight for gradient effects.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 3: Hair System
 */

import type { HairColorData, HairColorId } from "@/types/avatar";

/**
 * Complete hair color catalog
 * Organized by natural colors first, then fantasy colors
 */
export const HAIR_COLORS: HairColorData[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // NATURAL COLORS - DARK SPECTRUM
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "black",
    name: "Black",
    baseColor: "#1A1A1A",
    shadowColor: "#0D0D0D",
    highlightColor: "#333333",
    isFantasy: false,
  },
  {
    id: "dark_brown",
    name: "Dark Brown",
    baseColor: "#3D2314",
    shadowColor: "#2A180D",
    highlightColor: "#5D3A1A",
    isFantasy: false,
  },
  {
    id: "medium_brown",
    name: "Medium Brown",
    baseColor: "#6B4423",
    shadowColor: "#4A2F18",
    highlightColor: "#8B5A2B",
    isFantasy: false,
  },
  {
    id: "light_brown",
    name: "Light Brown",
    baseColor: "#A67B5B",
    shadowColor: "#8B6348",
    highlightColor: "#C49A6C",
    isFantasy: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NATURAL COLORS - RED/AUBURN SPECTRUM
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "auburn",
    name: "Auburn",
    baseColor: "#922724",
    shadowColor: "#6B1C1A",
    highlightColor: "#B5403D",
    isFantasy: false,
  },
  {
    id: "chestnut",
    name: "Chestnut",
    baseColor: "#954535",
    shadowColor: "#6E3328",
    highlightColor: "#B55D4C",
    isFantasy: false,
  },
  {
    id: "copper",
    name: "Copper",
    baseColor: "#B87333",
    shadowColor: "#8F5A28",
    highlightColor: "#D4894A",
    isFantasy: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NATURAL COLORS - BLONDE SPECTRUM
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "strawberry_blonde",
    name: "Strawberry Blonde",
    baseColor: "#D4A574",
    shadowColor: "#B88B5E",
    highlightColor: "#E8C49A",
    isFantasy: false,
  },
  {
    id: "golden_blonde",
    name: "Golden Blonde",
    baseColor: "#E6BE8A",
    shadowColor: "#CCA872",
    highlightColor: "#F5D4A8",
    isFantasy: false,
  },
  {
    id: "platinum_blonde",
    name: "Platinum Blonde",
    baseColor: "#E8E4C9",
    shadowColor: "#D4D0B5",
    highlightColor: "#F5F3E5",
    isFantasy: false,
  },
  {
    id: "dirty_blonde",
    name: "Dirty Blonde",
    baseColor: "#B89A6B",
    shadowColor: "#9A7F56",
    highlightColor: "#D4B88A",
    isFantasy: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NATURAL COLORS - GRAY/SILVER SPECTRUM
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "gray_dark",
    name: "Dark Gray",
    baseColor: "#606060",
    shadowColor: "#4A4A4A",
    highlightColor: "#787878",
    isFantasy: false,
  },
  {
    id: "gray_light",
    name: "Light Gray",
    baseColor: "#A0A0A0",
    shadowColor: "#888888",
    highlightColor: "#B8B8B8",
    isFantasy: false,
  },
  {
    id: "silver",
    name: "Silver",
    baseColor: "#C0C0C0",
    shadowColor: "#A8A8A8",
    highlightColor: "#D8D8D8",
    isFantasy: false,
  },
  {
    id: "white",
    name: "White",
    baseColor: "#F5F5F5",
    shadowColor: "#E0E0E0",
    highlightColor: "#FFFFFF",
    isFantasy: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FANTASY COLORS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "fantasy_blue",
    name: "Electric Blue",
    baseColor: "#4A90D9",
    shadowColor: "#3570B0",
    highlightColor: "#6AB0F5",
    isFantasy: true,
  },
  {
    id: "fantasy_purple",
    name: "Mystic Purple",
    baseColor: "#8B5CF6",
    shadowColor: "#6D3FD6",
    highlightColor: "#A87FFF",
    isFantasy: true,
  },
  {
    id: "fantasy_pink",
    name: "Hot Pink",
    baseColor: "#EC4899",
    shadowColor: "#C73680",
    highlightColor: "#F472B6",
    isFantasy: true,
  },
  {
    id: "fantasy_green",
    name: "Emerald Green",
    baseColor: "#22C55E",
    shadowColor: "#16A34A",
    highlightColor: "#4ADE80",
    isFantasy: true,
  },
  {
    id: "fantasy_red",
    name: "Fire Red",
    baseColor: "#EF4444",
    shadowColor: "#DC2626",
    highlightColor: "#F87171",
    isFantasy: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get hair color data by ID
 */
export function getHairColor(id: HairColorId): HairColorData | undefined {
  return HAIR_COLORS.find((color) => color.id === id);
}

/**
 * Get hair color with fallback to default (dark brown)
 */
export function getHairColorSafe(id: HairColorId): HairColorData {
  return getHairColor(id) ?? HAIR_COLORS[1]; // Default to dark_brown
}

/**
 * Get all natural hair colors
 */
export function getNaturalHairColors(): HairColorData[] {
  return HAIR_COLORS.filter((color) => !color.isFantasy);
}

/**
 * Get all fantasy hair colors
 */
export function getFantasyHairColors(): HairColorData[] {
  return HAIR_COLORS.filter((color) => color.isFantasy);
}

/**
 * Get hair colors for gradient definition
 * Returns an object with base, shadow, and highlight for SVG gradients
 */
export function getHairGradientColors(id: HairColorId): {
  base: string;
  shadow: string;
  highlight: string;
} {
  const color = getHairColorSafe(id);
  return {
    base: color.baseColor,
    shadow: color.shadowColor,
    highlight: color.highlightColor,
  };
}

/**
 * Default hair color ID for new avatars
 */
export const DEFAULT_HAIR_COLOR: HairColorId = "dark_brown";
