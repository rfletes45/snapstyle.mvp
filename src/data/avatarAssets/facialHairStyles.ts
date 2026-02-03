/**
 * Facial Hair Style Definitions
 *
 * 10 facial hair styles for avatar customization.
 * Each style includes main path, shadow path, and positioning data.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 3: Hair System
 */

import type { FacialHairStyleData, FacialHairStyleId } from "@/types/avatar";

/**
 * Complete facial hair style catalog
 */
export const FACIAL_HAIR_STYLES: FacialHairStyleData[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // NO FACIAL HAIR
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "none",
    name: "Clean Shaven",
    mainPath: "",
    shadowPath: "",
    anchorOffset: { x: 0, y: 0 },
    hasMustache: false,
    hasBeard: false,
    thickness: 1.0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STUBBLE & LIGHT FACIAL HAIR
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "stubble",
    name: "Stubble",
    // Light stubble pattern across chin and jaw
    mainPath: `
      M65,145 Q70,148 75,146 Q80,149 85,147 Q90,150 95,148 Q100,151 105,148 Q110,150 115,147 Q120,149 125,146 Q130,148 135,145
      M62,152 Q68,155 74,153 Q80,156 86,154 Q92,157 98,155 Q104,157 110,154 Q116,156 122,153 Q128,155 135,152
      M65,160 Q72,163 78,161 Q85,164 92,162 Q100,165 108,162 Q115,164 122,161 Q128,163 135,160
      M70,168 Q78,171 86,169 Q94,172 100,170 Q106,172 114,169 Q122,171 130,168
    `,
    shadowPath: `
      M68,147 Q75,150 82,148 Q90,151 97,149 Q105,152 112,149 Q120,151 127,148
      M70,155 Q78,158 86,156 Q94,159 102,157 Q110,159 118,156 Q126,158 132,155
    `,
    anchorOffset: { x: 0, y: 0 },
    hasMustache: true,
    hasBeard: true,
    thickness: 0.5,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GOATEE STYLES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "goatee",
    name: "Goatee",
    // Chin beard with optional mustache connection
    mainPath: `
      M85,140 Q88,138 92,139 Q96,137 100,138 Q104,137 108,139 Q112,138 115,140
      Q118,145 120,155 Q122,165 118,175 Q115,185 100,190 Q85,185 82,175 Q78,165 80,155 Q82,145 85,140 Z
      M88,145 Q92,143 96,144 Q100,142 104,144 Q108,143 112,145
    `,
    shadowPath: `
      M88,160 Q94,158 100,160 Q106,158 112,160
      Q115,168 112,178 Q108,185 100,188 Q92,185 88,178 Q85,168 88,160 Z
    `,
    anchorOffset: { x: 0, y: 0 },
    hasMustache: true,
    hasBeard: true,
    thickness: 1.0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MUSTACHE STYLES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "mustache",
    name: "Mustache",
    // Classic mustache under nose
    mainPath: `
      M70,138 Q75,135 82,136 Q88,133 94,135 Q100,132 106,135 Q112,133 118,136 Q125,135 130,138
      Q128,142 122,145 Q115,148 108,146 Q100,150 92,146 Q85,148 78,145 Q72,142 70,138 Z
    `,
    shadowPath: `
      M75,139 Q82,137 90,138 Q98,136 106,138 Q114,137 122,139
      Q120,142 114,144 Q106,146 100,145 Q94,146 86,144 Q80,142 75,139 Z
    `,
    anchorOffset: { x: 0, y: -5 },
    hasMustache: true,
    hasBeard: false,
    thickness: 1.0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BEARD STYLES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "full_beard",
    name: "Full Beard",
    // Complete beard covering chin and cheeks
    mainPath: `
      M55,130 Q60,125 70,128 Q80,125 90,128 Q100,124 110,128 Q120,125 130,128 Q140,125 145,130
      Q150,145 148,160 Q145,175 140,190 Q130,210 100,215 Q70,210 60,190 Q55,175 52,160 Q50,145 55,130 Z
      M70,138 Q80,135 90,137 Q100,133 110,137 Q120,135 130,138
      Q128,142 120,145 Q110,148 100,150 Q90,148 80,145 Q72,142 70,138 Z
    `,
    shadowPath: `
      M60,145 Q65,140 75,143 Q85,140 95,143 Q105,140 115,143 Q125,140 135,143
      Q140,158 138,175 Q132,195 100,200 Q68,195 62,175 Q60,158 60,145 Z
    `,
    anchorOffset: { x: 0, y: 0 },
    hasMustache: true,
    hasBeard: true,
    thickness: 1.2,
  },
  {
    id: "short_beard",
    name: "Short Beard",
    // Trimmed, close-cropped beard
    mainPath: `
      M60,135 Q68,130 78,133 Q88,130 98,133 Q108,130 118,133 Q128,130 135,135
      Q140,148 138,162 Q135,178 125,188 Q115,198 100,200 Q85,198 75,188 Q65,178 62,162 Q60,148 60,135 Z
      M72,140 Q82,137 92,139 Q100,136 108,139 Q118,137 128,140
      Q126,144 118,147 Q108,150 100,152 Q92,150 82,147 Q74,144 72,140 Z
    `,
    shadowPath: `
      M65,150 Q72,145 82,148 Q92,145 100,148 Q108,145 118,148 Q128,145 135,150
      Q138,162 135,175 Q128,188 100,192 Q72,188 65,175 Q62,162 65,150 Z
    `,
    anchorOffset: { x: 0, y: 0 },
    hasMustache: true,
    hasBeard: true,
    thickness: 0.9,
  },
  {
    id: "long_beard",
    name: "Long Beard",
    // Extended, flowing beard
    mainPath: `
      M52,130 Q58,122 70,126 Q82,122 94,126 Q106,122 118,126 Q130,122 142,126 Q148,122 152,130
      Q158,150 155,175 Q150,200 142,225 Q130,252 100,260 Q70,252 58,225 Q50,200 45,175 Q42,150 52,130 Z
      M68,138 Q78,134 90,137 Q100,132 110,137 Q122,134 132,138
      Q130,143 120,147 Q110,152 100,155 Q90,152 80,147 Q70,143 68,138 Z
    `,
    shadowPath: `
      M55,145 Q62,138 75,142 Q88,138 100,142 Q112,138 125,142 Q138,138 145,145
      Q150,165 148,190 Q142,218 125,242 Q112,255 100,258 Q88,255 75,242 Q58,218 52,190 Q50,165 55,145 Z
    `,
    anchorOffset: { x: 0, y: 0 },
    hasMustache: true,
    hasBeard: true,
    thickness: 1.3,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SPECIALTY STYLES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "soul_patch",
    name: "Soul Patch",
    // Small patch below lower lip
    mainPath: `
      M95,155 Q98,152 102,152 Q105,152 108,155
      Q110,162 108,170 Q105,178 102,180 Q98,178 95,170 Q93,162 95,155 Z
    `,
    shadowPath: `
      M97,160 Q100,158 103,160
      Q105,166 103,172 Q100,175 97,172 Q95,166 97,160 Z
    `,
    anchorOffset: { x: 0, y: 10 },
    hasMustache: false,
    hasBeard: true,
    thickness: 0.8,
  },
  {
    id: "mutton_chops",
    name: "Mutton Chops",
    // Extended sideburns without chin connection
    mainPath: `
      M48,90 Q52,85 58,88 Q62,92 65,100 Q68,115 70,130 Q72,148 70,165 Q68,178 62,185 Q55,190 48,182 Q42,170 40,150 Q38,125 42,105 Q45,92 48,90 Z
      M152,90 Q148,85 142,88 Q138,92 135,100 Q132,115 130,130 Q128,148 130,165 Q132,178 138,185 Q145,190 152,182 Q158,170 160,150 Q162,125 158,105 Q155,92 152,90 Z
    `,
    shadowPath: `
      M50,100 Q55,95 60,100 Q64,112 66,130 Q68,150 65,168 Q60,180 52,175 Q45,165 44,145 Q43,120 50,100 Z
      M150,100 Q145,95 140,100 Q136,112 134,130 Q132,150 135,168 Q140,180 148,175 Q155,165 156,145 Q157,120 150,100 Z
    `,
    anchorOffset: { x: 0, y: -40 },
    hasMustache: false,
    hasBeard: true,
    thickness: 1.1,
  },
  {
    id: "handlebar",
    name: "Handlebar Mustache",
    // Dramatic curled mustache
    mainPath: `
      M58,138 Q65,132 75,135 Q85,130 95,133 Q100,128 105,133 Q115,130 125,135 Q135,132 142,138
      Q145,142 142,148 Q138,155 130,152 Q122,158 115,152 Q108,160 100,155 Q92,160 85,152 Q78,158 70,152 Q62,155 58,148 Q55,142 58,138 Z
      M55,145 Q50,150 42,148 Q35,145 32,140 Q35,135 42,138 Q50,140 55,145 Z
      M145,145 Q150,150 158,148 Q165,145 168,140 Q165,135 158,138 Q150,140 145,145 Z
    `,
    shadowPath: `
      M62,140 Q70,136 82,138 Q94,134 100,138 Q106,134 118,138 Q130,136 138,140
      Q140,145 135,150 Q125,155 115,150 Q105,158 100,152 Q95,158 85,150 Q75,155 65,150 Q60,145 62,140 Z
    `,
    anchorOffset: { x: 0, y: -5 },
    hasMustache: true,
    hasBeard: false,
    thickness: 1.0,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get facial hair style data by ID
 */
export function getFacialHairStyle(
  id: FacialHairStyleId,
): FacialHairStyleData | undefined {
  return FACIAL_HAIR_STYLES.find((style) => style.id === id);
}

/**
 * Get facial hair style with fallback to none
 */
export function getFacialHairStyleSafe(
  id: FacialHairStyleId,
): FacialHairStyleData {
  return getFacialHairStyle(id) ?? FACIAL_HAIR_STYLES[0]; // Default to none
}

/**
 * Get all facial hair styles that include a mustache
 */
export function getMustacheStyles(): FacialHairStyleData[] {
  return FACIAL_HAIR_STYLES.filter((style) => style.hasMustache);
}

/**
 * Get all facial hair styles that include a beard
 */
export function getBeardStyles(): FacialHairStyleData[] {
  return FACIAL_HAIR_STYLES.filter((style) => style.hasBeard);
}

/**
 * Get all facial hair styles (excluding none)
 */
export function getAllFacialHairStyles(): FacialHairStyleData[] {
  return FACIAL_HAIR_STYLES.filter((style) => style.id !== "none");
}

/**
 * Default facial hair style ID for new avatars
 */
export const DEFAULT_FACIAL_HAIR_STYLE: FacialHairStyleId = "none";
