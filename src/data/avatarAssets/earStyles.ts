/**
 * Ear Style Definitions
 *
 * Ear shapes for avatar rendering.
 */

import type { EarStyleData, EarStyleId } from "@/types/avatar";

/**
 * Ear style definitions
 * SVG paths are designed for a single ear (will be mirrored for left/right)
 */
export const EAR_STYLES: EarStyleData[] = [
  {
    id: "ear_small",
    name: "Small",
    svgPath:
      "M0,0 C6,-8 10,-6 12,0 C14,6 12,14 8,18 C4,20 0,16 0,12 C0,8 2,4 0,0 Z",
    lobeSize: 0.8,
    angle: 5,
  },
  {
    id: "ear_medium",
    name: "Medium",
    svgPath:
      "M0,0 C8,-12 14,-8 16,0 C18,10 16,22 10,28 C4,32 0,26 0,20 C0,14 4,8 0,0 Z",
    lobeSize: 1.0,
    angle: 8,
  },
  {
    id: "ear_large",
    name: "Large",
    svgPath:
      "M0,0 C10,-16 18,-10 20,0 C22,14 20,32 12,40 C4,46 0,38 0,28 C0,18 6,10 0,0 Z",
    lobeSize: 1.2,
    angle: 10,
  },
  {
    id: "ear_pointed",
    name: "Pointed",
    svgPath:
      "M0,0 C6,-10 12,-12 14,-8 L18,-14 C20,-8 18,10 12,22 C6,30 0,24 0,16 C0,10 4,4 0,0 Z",
    lobeSize: 0.9,
    angle: 8,
  },
  {
    id: "ear_round",
    name: "Round",
    svgPath:
      "M0,0 C4,-8 12,-8 16,0 C20,8 18,20 14,26 C10,32 4,30 2,24 C0,18 2,8 0,0 Z",
    lobeSize: 1.1,
    angle: 6,
  },
  {
    id: "ear_attached",
    name: "Attached Lobe",
    svgPath:
      "M0,0 C8,-12 14,-8 16,0 C18,10 16,20 10,24 C4,28 0,22 0,16 C0,10 4,6 0,0 Z",
    lobeSize: 0.6,
    angle: 7,
  },
  {
    id: "ear_detached",
    name: "Detached Lobe",
    svgPath:
      "M0,0 C8,-12 14,-8 16,0 C18,10 16,22 10,28 C6,32 2,32 0,28 C-2,24 0,20 0,14 C0,8 4,4 0,0 Z",
    lobeSize: 1.3,
    angle: 9,
  },
  {
    id: "ear_elf",
    name: "Elf",
    svgPath:
      "M0,0 C6,-8 12,-10 14,-6 L22,-18 C24,-10 20,8 14,20 C8,30 0,26 0,18 C0,12 4,6 0,0 Z",
    lobeSize: 0.85,
    angle: 12,
  },
];

/**
 * Get ear style data by ID
 */
export function getEarStyle(id: EarStyleId): EarStyleData {
  const style = EAR_STYLES.find((s) => s.id === id);
  if (!style) {
    console.warn(`Ear style not found: ${id}, using default`);
    return EAR_STYLES[1]; // Default to medium
  }
  return style;
}

/**
 * Default ear style ID
 */
export const DEFAULT_EAR_STYLE: EarStyleId = "ear_medium";
