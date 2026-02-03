/**
 * Skin Tone Definitions
 *
 * 12 diverse skin tones with appropriate shading colors.
 * Colors are designed to work well with SVG gradients for 3D effect.
 */

import type { SkinToneData, SkinToneId } from "@/types/avatar";

/**
 * Complete skin tone catalog
 * Organized from lightest to deepest
 */
export const SKIN_TONES: SkinToneData[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // LIGHT SPECTRUM
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "skin_01",
    name: "Porcelain",
    baseColor: "#FFF0E6",
    shadowColor: "#E8D4C8",
    highlightColor: "#FFFAF7",
    blushColor: "#FFB5B5",
    undertone: "cool",
  },
  {
    id: "skin_02",
    name: "Fair",
    baseColor: "#FFE4D4",
    shadowColor: "#E5C8B8",
    highlightColor: "#FFF5EE",
    blushColor: "#FFACAC",
    undertone: "neutral",
  },
  {
    id: "skin_03",
    name: "Light",
    baseColor: "#F5DEB3",
    shadowColor: "#D9C49B",
    highlightColor: "#FFF8E7",
    blushColor: "#E8A0A0",
    undertone: "warm",
  },
  {
    id: "skin_04",
    name: "Light Medium",
    baseColor: "#E8C8A0",
    shadowColor: "#CCAE88",
    highlightColor: "#F5E0C8",
    blushColor: "#D89898",
    undertone: "warm",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIUM SPECTRUM
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "skin_05",
    name: "Medium Light",
    baseColor: "#D8B088",
    shadowColor: "#BC9670",
    highlightColor: "#E8C8A8",
    blushColor: "#C88888",
    undertone: "warm",
  },
  {
    id: "skin_06",
    name: "Medium",
    baseColor: "#C68642",
    shadowColor: "#A06832",
    highlightColor: "#D9A066",
    blushColor: "#D98080",
    undertone: "warm",
  },
  {
    id: "skin_07",
    name: "Medium Tan",
    baseColor: "#B07840",
    shadowColor: "#8E5E30",
    highlightColor: "#C89858",
    blushColor: "#B87878",
    undertone: "warm",
  },
  {
    id: "skin_08",
    name: "Olive",
    baseColor: "#A08050",
    shadowColor: "#806840",
    highlightColor: "#B89868",
    blushColor: "#A87070",
    undertone: "neutral",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DARK SPECTRUM
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "skin_09",
    name: "Tan",
    baseColor: "#8B6538",
    shadowColor: "#6B4D28",
    highlightColor: "#A88050",
    blushColor: "#986868",
    undertone: "warm",
  },
  {
    id: "skin_10",
    name: "Caramel",
    baseColor: "#6B4D30",
    shadowColor: "#4D3820",
    highlightColor: "#8B6848",
    blushColor: "#7D5555",
    undertone: "warm",
  },
  {
    id: "skin_11",
    name: "Brown",
    baseColor: "#5C4033",
    shadowColor: "#3E2B22",
    highlightColor: "#7A5845",
    blushColor: "#6B4848",
    undertone: "warm",
  },
  {
    id: "skin_12",
    name: "Deep",
    baseColor: "#4A3728",
    shadowColor: "#2E221A",
    highlightColor: "#6B4D3A",
    blushColor: "#5A4040",
    undertone: "warm",
  },
];

/**
 * Get skin tone data by ID
 */
export function getSkinTone(id: SkinToneId): SkinToneData {
  const skinTone = SKIN_TONES.find((s) => s.id === id);
  if (!skinTone) {
    console.warn(`Skin tone not found: ${id}, using default`);
    return SKIN_TONES[5]; // Default to medium (skin_06)
  }
  return skinTone;
}

/**
 * Get just the colors for a skin tone (for gradients)
 */
export function getSkinToneColors(id: SkinToneId): {
  base: string;
  shadow: string;
  highlight: string;
  blush: string;
} {
  const tone = getSkinTone(id);
  return {
    base: tone.baseColor,
    shadow: tone.shadowColor,
    highlight: tone.highlightColor,
    blush: tone.blushColor,
  };
}

/**
 * Default skin tone ID (medium)
 */
export const DEFAULT_SKIN_TONE: SkinToneId = "skin_06";
