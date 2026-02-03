/**
 * Eye Style Definitions
 *
 * Eye styles, colors, eyebrow, and eyelash data for avatar rendering.
 */

import type {
  EyeColorData,
  EyeColorId,
  EyeStyleData,
  EyeStyleId,
  EyebrowStyleData,
  EyebrowStyleId,
  EyelashStyleData,
  EyelashStyleId,
} from "@/types/avatar";

/**
 * Eye style definitions
 * SVG paths are designed for individual eye rendering
 */
export const EYE_STYLES: EyeStyleData[] = [
  {
    id: "eye_natural",
    name: "Natural",
    svgPath:
      "M0,-8 C8,-12 16,-12 24,-8 C28,-4 28,4 24,8 C16,12 8,12 0,8 C-4,4 -4,-4 0,-8 Z",
    scleraPath:
      "M0,-7 C7,-10 15,-10 22,-7 C25,-4 25,3 22,6 C15,9 7,9 0,6 C-3,3 -3,-4 0,-7 Z",
    pupilPosition: { x: 12, y: 0 },
    irisSize: 8,
    pupilSize: 3.5,
  },
  {
    id: "eye_round",
    name: "Round",
    svgPath:
      "M0,-9 C9,-13 18,-13 27,-9 C31,-5 31,5 27,9 C18,13 9,13 0,9 C-4,5 -4,-5 0,-9 Z",
    scleraPath:
      "M1,-8 C9,-11 17,-11 25,-8 C28,-5 28,4 25,7 C17,10 9,10 1,7 C-2,4 -2,-5 1,-8 Z",
    pupilPosition: { x: 13, y: 0 },
    irisSize: 9,
    pupilSize: 4,
  },
  {
    id: "eye_almond",
    name: "Almond",
    svgPath:
      "M-2,-6 C8,-11 18,-11 28,-6 C32,-2 30,4 26,7 C16,11 6,10 -2,6 C-5,3 -5,-3 -2,-6 Z",
    scleraPath:
      "M-1,-5 C8,-9 17,-9 26,-5 C29,-2 28,3 24,5 C15,8 6,8 -1,5 C-3,3 -3,-2 -1,-5 Z",
    pupilPosition: { x: 12, y: 0 },
    irisSize: 7.5,
    pupilSize: 3.2,
  },
  {
    id: "eye_hooded",
    name: "Hooded",
    svgPath:
      "M0,-5 C8,-8 16,-8 24,-5 C27,-2 27,4 24,7 C16,10 8,10 0,7 C-3,4 -3,-2 0,-5 Z",
    scleraPath:
      "M1,-4 C8,-6 15,-6 22,-4 C24,-2 24,3 22,5 C15,7 8,7 1,5 C-1,3 -1,-2 1,-4 Z",
    pupilPosition: { x: 12, y: 0 },
    irisSize: 7,
    pupilSize: 3,
  },
  {
    id: "eye_monolid",
    name: "Monolid",
    svgPath:
      "M0,-6 C10,-9 20,-9 30,-6 C33,-3 32,3 28,6 C18,9 8,9 0,6 C-3,3 -3,-3 0,-6 Z",
    scleraPath:
      "M1,-5 C10,-7 19,-7 28,-5 C30,-3 29,2 26,4 C17,6 8,6 1,4 C-1,2 -1,-3 1,-5 Z",
    pupilPosition: { x: 14, y: 0 },
    irisSize: 7,
    pupilSize: 3,
  },
  {
    id: "eye_upturned",
    name: "Upturned",
    svgPath:
      "M0,-6 C8,-10 16,-12 24,-10 C28,-6 28,2 24,6 C16,10 8,10 0,6 C-4,2 -4,-2 0,-6 Z",
    scleraPath:
      "M1,-5 C8,-8 15,-9 22,-8 C25,-5 25,1 22,4 C15,7 8,7 1,4 C-2,1 -2,-2 1,-5 Z",
    pupilPosition: { x: 12, y: -1 },
    irisSize: 7.5,
    pupilSize: 3.2,
  },
  {
    id: "eye_downturned",
    name: "Downturned",
    svgPath:
      "M0,-10 C8,-12 16,-10 24,-6 C28,-2 28,4 24,8 C16,10 8,8 0,6 C-4,2 -4,-6 0,-10 Z",
    scleraPath:
      "M1,-8 C8,-10 15,-8 22,-5 C25,-2 25,3 22,6 C15,8 8,6 1,4 C-2,2 -2,-5 1,-8 Z",
    pupilPosition: { x: 12, y: 1 },
    irisSize: 7.5,
    pupilSize: 3.2,
  },
  {
    id: "eye_wide_set",
    name: "Wide Set",
    svgPath:
      "M0,-7 C7,-11 14,-11 21,-7 C24,-4 24,3 21,6 C14,10 7,10 0,6 C-3,3 -3,-4 0,-7 Z",
    scleraPath:
      "M1,-6 C7,-9 13,-9 19,-6 C21,-4 21,2 19,4 C13,7 7,7 1,4 C-1,2 -1,-4 1,-6 Z",
    pupilPosition: { x: 10, y: 0 },
    irisSize: 7,
    pupilSize: 3,
  },
  {
    id: "eye_close_set",
    name: "Close Set",
    svgPath:
      "M0,-8 C9,-12 18,-12 27,-8 C30,-4 30,4 27,8 C18,12 9,12 0,8 C-3,4 -3,-4 0,-8 Z",
    scleraPath:
      "M1,-7 C9,-10 17,-10 25,-7 C27,-4 27,3 25,6 C17,9 9,9 1,6 C-1,3 -1,-4 1,-7 Z",
    pupilPosition: { x: 13, y: 0 },
    irisSize: 8,
    pupilSize: 3.5,
  },
  {
    id: "eye_deep_set",
    name: "Deep Set",
    svgPath:
      "M2,-6 C9,-9 16,-9 23,-6 C26,-3 26,3 23,6 C16,9 9,9 2,6 C-1,3 -1,-3 2,-6 Z",
    scleraPath:
      "M3,-5 C9,-7 15,-7 21,-5 C23,-3 23,2 21,4 C15,6 9,6 3,4 C1,2 1,-3 3,-5 Z",
    pupilPosition: { x: 12, y: 0 },
    irisSize: 6.5,
    pupilSize: 2.8,
  },
];

/**
 * Eye color definitions with iris gradient colors
 */
export const EYE_COLORS: EyeColorData[] = [
  {
    id: "brown_dark",
    name: "Dark Brown",
    irisColors: {
      outer: "#3D2314",
      middle: "#5D3A1A",
      inner: "#8B4513",
    },
    pupilColor: "#000000",
    highlight: "#FFFFFF",
  },
  {
    id: "brown_light",
    name: "Light Brown",
    irisColors: {
      outer: "#6B4423",
      middle: "#8B5A2B",
      inner: "#A67B5B",
    },
    pupilColor: "#000000",
    highlight: "#FFFFFF",
  },
  {
    id: "hazel_gold",
    name: "Hazel Gold",
    irisColors: {
      outer: "#5D4E37",
      middle: "#8E7618",
      inner: "#C4A82A",
    },
    pupilColor: "#000000",
    highlight: "#FFFFFF",
  },
  {
    id: "hazel_green",
    name: "Hazel Green",
    irisColors: {
      outer: "#4A5D3A",
      middle: "#6B8E4A",
      inner: "#8BAA5B",
    },
    pupilColor: "#000000",
    highlight: "#FFFFFF",
  },
  {
    id: "green_forest",
    name: "Forest Green",
    irisColors: {
      outer: "#1E4D2B",
      middle: "#228B22",
      inner: "#32CD32",
    },
    pupilColor: "#000000",
    highlight: "#FFFFFF",
  },
  {
    id: "green_light",
    name: "Light Green",
    irisColors: {
      outer: "#3A7D44",
      middle: "#5DA87E",
      inner: "#90EE90",
    },
    pupilColor: "#000000",
    highlight: "#FFFFFF",
  },
  {
    id: "green_gray",
    name: "Gray Green",
    irisColors: {
      outer: "#4A5D50",
      middle: "#6B8E7A",
      inner: "#8FAF9A",
    },
    pupilColor: "#000000",
    highlight: "#FFFFFF",
  },
  {
    id: "blue_deep",
    name: "Deep Blue",
    irisColors: {
      outer: "#1E3A5F",
      middle: "#2E5A8F",
      inner: "#4A90D9",
    },
    pupilColor: "#000000",
    highlight: "#FFFFFF",
  },
  {
    id: "blue_light",
    name: "Light Blue",
    irisColors: {
      outer: "#4169E1",
      middle: "#6495ED",
      inner: "#87CEEB",
    },
    pupilColor: "#000000",
    highlight: "#FFFFFF",
  },
  {
    id: "blue_gray",
    name: "Blue Gray",
    irisColors: {
      outer: "#4A5A6A",
      middle: "#6B8399",
      inner: "#9AAFBF",
    },
    pupilColor: "#000000",
    highlight: "#FFFFFF",
  },
  {
    id: "gray_dark",
    name: "Dark Gray",
    irisColors: {
      outer: "#3A3A3A",
      middle: "#5A5A5A",
      inner: "#7A7A7A",
    },
    pupilColor: "#000000",
    highlight: "#FFFFFF",
  },
  {
    id: "gray_light",
    name: "Light Gray",
    irisColors: {
      outer: "#6A6A6A",
      middle: "#8A8A8A",
      inner: "#AAAAAA",
    },
    pupilColor: "#000000",
    highlight: "#FFFFFF",
  },
  {
    id: "amber",
    name: "Amber",
    irisColors: {
      outer: "#B8860B",
      middle: "#DAA520",
      inner: "#FFD700",
    },
    pupilColor: "#000000",
    highlight: "#FFFFFF",
  },
];

/**
 * Get eye style data by ID
 */
export function getEyeStyle(id: EyeStyleId): EyeStyleData {
  const style = EYE_STYLES.find((s) => s.id === id);
  if (!style) {
    console.warn(`Eye style not found: ${id}, using default`);
    return EYE_STYLES[0]; // Default to natural
  }
  return style;
}

/**
 * Get eye color data by ID
 */
export function getEyeColor(id: EyeColorId): EyeColorData {
  const color = EYE_COLORS.find((c) => c.id === id);
  if (!color) {
    console.warn(`Eye color not found: ${id}, using default`);
    return EYE_COLORS[0]; // Default to dark brown
  }
  return color;
}

/**
 * Default eye style ID
 */
export const DEFAULT_EYE_STYLE: EyeStyleId = "eye_natural";

/**
 * Default eye color ID
 */
export const DEFAULT_EYE_COLOR: EyeColorId = "brown_dark";

// =============================================================================
// EYEBROW STYLES
// =============================================================================

/**
 * Eyebrow style definitions
 * SVG paths designed for a single eyebrow (mirrored for left side)
 */
export const EYEBROW_STYLES: EyebrowStyleData[] = [
  {
    id: "brow_natural",
    name: "Natural",
    svgPath: "M-14,0 Q-7,-4 0,-3 Q7,-2 14,1",
    thickness: 1.0,
    arch: 0.4,
    tailLength: 1.0,
  },
  {
    id: "brow_thick",
    name: "Thick",
    svgPath: "M-15,0 Q-8,-5 0,-4 Q8,-2 15,2",
    thickness: 1.5,
    arch: 0.5,
    tailLength: 1.0,
  },
  {
    id: "brow_thin",
    name: "Thin",
    svgPath: "M-13,0 Q-6,-3 0,-2 Q6,-1 13,1",
    thickness: 0.6,
    arch: 0.35,
    tailLength: 0.9,
  },
  {
    id: "brow_arched_high",
    name: "High Arch",
    svgPath: "M-14,2 Q-7,-6 0,-5 Q7,-2 14,3",
    thickness: 1.0,
    arch: 0.8,
    tailLength: 1.0,
  },
  {
    id: "brow_arched_soft",
    name: "Soft Arch",
    svgPath: "M-14,1 Q-7,-3 0,-3 Q7,-1 14,2",
    thickness: 1.0,
    arch: 0.5,
    tailLength: 1.0,
  },
  {
    id: "brow_straight",
    name: "Straight",
    svgPath: "M-14,0 Q-7,-1 0,-1 Q7,-1 14,0",
    thickness: 1.0,
    arch: 0.1,
    tailLength: 1.0,
  },
  {
    id: "brow_angled",
    name: "Angled",
    svgPath: "M-14,3 L-2,-4 Q5,-2 14,2",
    thickness: 1.0,
    arch: 0.7,
    tailLength: 1.1,
  },
  {
    id: "brow_rounded",
    name: "Rounded",
    svgPath: "M-14,1 C-10,-3 -5,-4 0,-4 C5,-4 10,-2 14,2",
    thickness: 1.1,
    arch: 0.45,
    tailLength: 1.0,
  },
  {
    id: "brow_bushy",
    name: "Bushy",
    svgPath: "M-16,0 Q-8,-5 0,-4 Q8,-3 16,1",
    thickness: 1.8,
    arch: 0.5,
    tailLength: 1.15,
  },
];

/**
 * Get eyebrow style data by ID
 */
export function getEyebrowStyle(id: EyebrowStyleId): EyebrowStyleData {
  const style = EYEBROW_STYLES.find((s) => s.id === id);
  if (!style) {
    console.warn(`Eyebrow style not found: ${id}, using default`);
    return EYEBROW_STYLES[0]; // Default to natural
  }
  return style;
}

/**
 * Default eyebrow style ID
 */
export const DEFAULT_EYEBROW_STYLE: EyebrowStyleId = "brow_natural";

// =============================================================================
// EYELASH STYLES
// =============================================================================

/**
 * Eyelash style definitions
 * SVG paths for upper lash line (rendered above eye)
 */
export const EYELASH_STYLES: EyelashStyleData[] = [
  {
    id: "none",
    name: "None",
    svgPath: "",
    density: 0,
    length: 0,
    curl: 0,
  },
  {
    id: "natural",
    name: "Natural",
    svgPath:
      "M-10,-2 L-11,-5 M-6,-3 L-7,-7 M-2,-3 L-2,-8 M2,-3 L3,-7 M6,-3 L8,-5 M10,-2 L12,-4",
    density: 0.6,
    length: 1.0,
    curl: 0.3,
  },
  {
    id: "long",
    name: "Long",
    svgPath:
      "M-11,-2 L-13,-7 M-8,-3 L-10,-9 M-4,-3 L-5,-11 M0,-3 L0,-12 M4,-3 L5,-11 M8,-3 L10,-9 M11,-2 L14,-7",
    density: 0.8,
    length: 1.5,
    curl: 0.4,
  },
  {
    id: "dramatic",
    name: "Dramatic",
    svgPath:
      "M-12,-2 L-16,-8 M-9,-3 L-13,-11 M-6,-3 L-8,-13 M-3,-3 L-4,-14 M0,-3 L0,-15 M3,-3 L4,-14 M6,-3 L8,-13 M9,-3 L13,-11 M12,-2 L16,-8",
    density: 1.0,
    length: 2.0,
    curl: 0.5,
  },
  {
    id: "wispy",
    name: "Wispy",
    svgPath:
      "M-10,-2 L-12,-6 M-5,-3 L-6,-9 M0,-3 L0,-10 M5,-3 L7,-9 M10,-2 L13,-6",
    density: 0.4,
    length: 1.2,
    curl: 0.6,
  },
];

/**
 * Get eyelash style data by ID
 */
export function getEyelashStyle(id: EyelashStyleId): EyelashStyleData {
  const style = EYELASH_STYLES.find((s) => s.id === id);
  if (!style) {
    console.warn(`Eyelash style not found: ${id}, using default`);
    return EYELASH_STYLES[0]; // Default to none
  }
  return style;
}

/**
 * Default eyelash style ID
 */
export const DEFAULT_EYELASH_STYLE: EyelashStyleId = "none";
