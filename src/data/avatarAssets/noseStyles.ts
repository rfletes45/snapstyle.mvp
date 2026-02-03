/**
 * Nose Style Definitions
 *
 * Nose shapes and sizing data for avatar rendering.
 */

import type { NoseStyleData, NoseStyleId } from "@/types/avatar";

/**
 * Nose style definitions
 * SVG paths are designed to be centered at (0, 0)
 */
export const NOSE_STYLES: NoseStyleData[] = [
  {
    id: "nose_small",
    name: "Small",
    svgPath: "M-3,-8 L0,-10 L3,-8 L3,2 Q0,6 -3,2 Z M-5,2 Q0,5 5,2",
    bridgeWidth: 0.8,
    tipWidth: 0.85,
    nostrilSize: 0.7,
    length: 0.85,
  },
  {
    id: "nose_medium",
    name: "Medium",
    svgPath: "M-4,-10 L0,-12 L4,-10 L4,4 Q0,9 -4,4 Z M-6,4 Q0,8 6,4",
    bridgeWidth: 1.0,
    tipWidth: 1.0,
    nostrilSize: 1.0,
    length: 1.0,
  },
  {
    id: "nose_large",
    name: "Large",
    svgPath: "M-5,-12 L0,-15 L5,-12 L5,6 Q0,12 -5,6 Z M-8,6 Q0,11 8,6",
    bridgeWidth: 1.2,
    tipWidth: 1.25,
    nostrilSize: 1.2,
    length: 1.15,
  },
  {
    id: "nose_button",
    name: "Button",
    svgPath:
      "M-3,-6 C-3,-8 3,-8 3,-6 L3,2 C3,5 -3,5 -3,2 Z M-4,2 C-4,4 4,4 4,2",
    bridgeWidth: 0.9,
    tipWidth: 1.1,
    nostrilSize: 0.8,
    length: 0.8,
  },
  {
    id: "nose_pointed",
    name: "Pointed",
    svgPath: "M-3,-10 L0,-14 L3,-10 L2,3 L0,6 L-2,3 Z M-4,3 Q0,5 4,3",
    bridgeWidth: 0.85,
    tipWidth: 0.75,
    nostrilSize: 0.85,
    length: 1.1,
  },
  {
    id: "nose_wide",
    name: "Wide",
    svgPath: "M-4,-8 L0,-11 L4,-8 L5,3 Q0,8 -5,3 Z M-7,3 Q0,7 7,3",
    bridgeWidth: 1.1,
    tipWidth: 1.3,
    nostrilSize: 1.25,
    length: 0.95,
  },
  {
    id: "nose_narrow",
    name: "Narrow",
    svgPath: "M-2,-10 L0,-13 L2,-10 L2,4 Q0,7 -2,4 Z M-3,4 Q0,6 3,4",
    bridgeWidth: 0.7,
    tipWidth: 0.75,
    nostrilSize: 0.7,
    length: 1.05,
  },
  {
    id: "nose_hooked",
    name: "Hooked",
    svgPath:
      "M-3,-10 L0,-12 L3,-10 C4,-6 5,-2 3,3 Q0,8 -3,3 C-5,-2 -4,-6 -3,-10 Z M-5,3 Q0,7 5,3",
    bridgeWidth: 1.0,
    tipWidth: 1.05,
    nostrilSize: 1.0,
    length: 1.1,
  },
  {
    id: "nose_upturned",
    name: "Upturned",
    svgPath: "M-3,-8 L0,-10 L3,-8 L4,0 Q2,4 0,3 Q-2,4 -4,0 Z M-5,0 Q0,3 5,0",
    bridgeWidth: 0.9,
    tipWidth: 0.95,
    nostrilSize: 1.0,
    length: 0.8,
  },
  {
    id: "nose_flat",
    name: "Flat",
    svgPath: "M-4,-6 L0,-8 L4,-6 L4,2 Q0,5 -4,2 Z M-6,2 Q0,4 6,2",
    bridgeWidth: 1.15,
    tipWidth: 1.2,
    nostrilSize: 1.1,
    length: 0.75,
  },
];

/**
 * Get nose style data by ID
 */
export function getNoseStyle(id: NoseStyleId): NoseStyleData {
  const style = NOSE_STYLES.find((s) => s.id === id);
  if (!style) {
    console.warn(`Nose style not found: ${id}, using default`);
    return NOSE_STYLES[0]; // Default to small
  }
  return style;
}

/**
 * Default nose style ID
 */
export const DEFAULT_NOSE_STYLE: NoseStyleId = "nose_small";
