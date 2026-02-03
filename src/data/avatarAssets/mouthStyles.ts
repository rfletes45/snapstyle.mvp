/**
 * Mouth Style Definitions
 *
 * Mouth shapes and lip colors for avatar rendering.
 */

import type {
  LipColorData,
  LipColorId,
  MouthStyleData,
  MouthStyleId,
} from "@/types/avatar";

/**
 * Mouth style definitions
 * SVG paths are designed to be centered at (0, 0)
 */
export const MOUTH_STYLES: MouthStyleData[] = [
  {
    id: "mouth_smile",
    name: "Smile",
    upperLipPath: "M-15,0 Q-8,-4 0,-2 Q8,-4 15,0 Q8,2 0,1 Q-8,2 -15,0 Z",
    lowerLipPath: "M-15,0 Q-8,2 0,1 Q8,2 15,0 Q8,8 0,10 Q-8,8 -15,0 Z",
    expression: "smile",
  },
  {
    id: "mouth_big_smile",
    name: "Big Smile",
    upperLipPath: "M-18,0 Q-10,-5 0,-3 Q10,-5 18,0 Q10,2 0,1 Q-10,2 -18,0 Z",
    lowerLipPath: "M-18,0 Q-10,2 0,1 Q10,2 18,0 Q10,12 0,14 Q-10,12 -18,0 Z",
    teethPath: "M-14,1 L14,1 L14,6 Q0,5 -14,6 Z",
    expression: "smile",
  },
  {
    id: "mouth_slight_smile",
    name: "Slight Smile",
    upperLipPath: "M-12,0 Q-6,-2 0,-1 Q6,-2 12,0 Q6,1 0,0 Q-6,1 -12,0 Z",
    lowerLipPath: "M-12,0 Q-6,1 0,0 Q6,1 12,0 Q6,5 0,6 Q-6,5 -12,0 Z",
    expression: "smile",
  },
  {
    id: "mouth_neutral",
    name: "Neutral",
    upperLipPath: "M-12,0 Q-6,-1 0,0 Q6,-1 12,0 Q6,1 0,1 Q-6,1 -12,0 Z",
    lowerLipPath: "M-12,0 Q-6,1 0,1 Q6,1 12,0 Q6,4 0,5 Q-6,4 -12,0 Z",
    expression: "neutral",
  },
  {
    id: "mouth_smirk",
    name: "Smirk",
    upperLipPath: "M-12,2 Q-6,-1 0,0 Q6,-2 14,-3 Q8,0 0,1 Q-6,2 -12,2 Z",
    lowerLipPath: "M-12,2 Q-6,2 0,1 Q8,0 14,-3 Q10,4 0,6 Q-6,6 -12,2 Z",
    expression: "smirk",
  },
  {
    id: "mouth_open",
    name: "Open",
    upperLipPath: "M-14,-2 Q-7,-5 0,-4 Q7,-5 14,-2 Q7,0 0,-1 Q-7,0 -14,-2 Z",
    lowerLipPath: "M-14,6 Q-7,4 0,5 Q7,4 14,6 Q7,10 0,11 Q-7,10 -14,6 Z",
    teethPath: "M-12,-1 L12,-1 L12,4 L-12,4 Z",
    expression: "open",
  },
  {
    id: "mouth_laugh",
    name: "Laugh",
    upperLipPath: "M-16,-2 Q-8,-6 0,-4 Q8,-6 16,-2 Q8,0 0,-1 Q-8,0 -16,-2 Z",
    lowerLipPath: "M-16,8 Q-8,5 0,6 Q8,5 16,8 Q8,14 0,16 Q-8,14 -16,8 Z",
    teethPath: "M-14,-1 L14,-1 L14,6 Q0,4 -14,6 Z",
    expression: "open",
  },
  {
    id: "mouth_pout",
    name: "Pout",
    upperLipPath: "M-10,0 Q-5,-3 0,-2 Q5,-3 10,0 Q5,2 0,2 Q-5,2 -10,0 Z",
    lowerLipPath: "M-10,0 Q-5,2 0,2 Q5,2 10,0 Q5,8 0,10 Q-5,8 -10,0 Z",
    expression: "neutral",
  },
  {
    id: "mouth_frown",
    name: "Frown",
    upperLipPath: "M-12,2 Q-6,0 0,1 Q6,0 12,2 Q6,3 0,3 Q-6,3 -12,2 Z",
    lowerLipPath: "M-12,2 Q-6,3 0,3 Q6,3 12,2 Q6,6 0,7 Q-6,6 -12,2 Z",
    expression: "frown",
  },
  {
    id: "mouth_kissy",
    name: "Kissy",
    upperLipPath: "M-6,-2 Q-3,-5 0,-4 Q3,-5 6,-2 Q3,0 0,0 Q-3,0 -6,-2 Z",
    lowerLipPath: "M-6,2 Q-3,0 0,0 Q3,0 6,2 Q3,6 0,7 Q-3,6 -6,2 Z",
    expression: "neutral",
  },
];

/**
 * Lip color definitions
 */
export const LIP_COLORS: LipColorData[] = [
  {
    id: "lip_natural_light",
    name: "Natural Light",
    color: "#E8C4B8",
    glossy: false,
  },
  {
    id: "lip_natural_medium",
    name: "Natural Medium",
    color: "#C4A484",
    glossy: false,
  },
  {
    id: "lip_natural_dark",
    name: "Natural Dark",
    color: "#8B6B5A",
    glossy: false,
  },
  {
    id: "lip_pink_soft",
    name: "Soft Pink",
    color: "#FFB6C1",
    glossy: true,
  },
  {
    id: "lip_pink_bright",
    name: "Bright Pink",
    color: "#FF69B4",
    glossy: true,
  },
  {
    id: "lip_rose",
    name: "Rose",
    color: "#FF007F",
    glossy: true,
  },
  {
    id: "lip_red_classic",
    name: "Classic Red",
    color: "#DC143C",
    glossy: true,
  },
  {
    id: "lip_red_dark",
    name: "Dark Red",
    color: "#8B0000",
    glossy: true,
  },
  {
    id: "lip_berry",
    name: "Berry",
    color: "#8B008B",
    glossy: true,
  },
  {
    id: "lip_nude",
    name: "Nude",
    color: "#D8B4A0",
    glossy: false,
  },
];

/**
 * Get mouth style data by ID
 */
export function getMouthStyle(id: MouthStyleId): MouthStyleData {
  const style = MOUTH_STYLES.find((s) => s.id === id);
  if (!style) {
    console.warn(`Mouth style not found: ${id}, using default`);
    return MOUTH_STYLES[0]; // Default to smile
  }
  return style;
}

/**
 * Get lip color data by ID
 */
export function getLipColor(id: LipColorId): LipColorData {
  const color = LIP_COLORS.find((c) => c.id === id);
  if (!color) {
    console.warn(`Lip color not found: ${id}, using default`);
    return LIP_COLORS[1]; // Default to natural medium
  }
  return color;
}

/**
 * Default mouth style ID
 */
export const DEFAULT_MOUTH_STYLE: MouthStyleId = "mouth_smile";

/**
 * Default lip color ID
 */
export const DEFAULT_LIP_COLOR: LipColorId = "lip_natural_medium";
