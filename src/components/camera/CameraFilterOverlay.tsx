/**
 * CAMERA FILTER OVERLAY — FALLBACK ONLY
 *
 * ⚠️  This component is a FALLBACK for environments where VisionCamera + Skia
 *    frame processors are unavailable (e.g. Expo Go, web).
 *
 * When `USE_VISION_CAMERA` is true and VisionCamera loads successfully,
 * the main camera path uses `LiveFilterCamera` which applies the real
 * per-pixel ColorMatrix filter to every camera frame on the GPU.
 * This overlay is NOT used in that path.
 *
 * This overlay is an *approximation* — it renders a single flat tint colour
 * derived from the filter's ColorMatrix, which is visually close but not
 * pixel-accurate.  It is only used when:
 *   - Expo Go development (VisionCamera unavailable)
 *   - AR face-effect mode (face detection occupies the frame processor slot)
 *   - Web platform (Skia frame processors not supported)
 *
 * HOW IT WORKS:
 * The overlay colour is derived from the actual Skia ColorMatrix used in the
 * editor (SkiaFilteredImage). We apply the matrix to reference sample pixels
 * and compute the resulting tint, so the live preview always reflects the same
 * colour transform the editor will apply — just as a flat overlay rather than
 * per-pixel.
 *
 * Falls back to a plain View on Skia import failure (e.g. web).
 */

import { filterConfigToColorMatrix } from "@/services/camera/filterService";
import type { FilterConfig } from "@/types/camera";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

// Skia imports — wrapped so the old View fallback still works if Skia fails
let SkiaCanvas: any = null;
let SkiaFill: any = null;
try {
  const Skia = require("@shopify/react-native-skia");
  SkiaCanvas = Skia.Canvas;
  SkiaFill = Skia.Fill;
} catch {
  // Skia unavailable — will use plain View fallback
}

interface Props {
  filter: FilterConfig | null;
  /** 0 – 1 intensity multiplier (default 1) */
  intensity?: number;
}

// =============================================================================
// Helpers
// =============================================================================

/** Identity matrix (no-op) for a 4×5 color matrix. */
const IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/**
 * Interpolate a color matrix toward identity by `t` (0 = identity, 1 = full).
 * Same function used in SkiaFilteredImage for the intensity slider.
 */
function lerpMatrix(matrix: number[], t: number): number[] {
  if (t >= 1) return matrix;
  if (t <= 0) return IDENTITY;
  return matrix.map((v, i) => IDENTITY[i] + (v - IDENTITY[i]) * t);
}

/**
 * Apply a 4×5 color matrix to an [R, G, B, A] pixel (all values 0–1).
 * Returns the transformed [R, G, B, A].
 */
function applyMatrix(
  m: number[],
  r: number,
  g: number,
  b: number,
  a: number,
): [number, number, number, number] {
  return [
    Math.max(0, Math.min(1, m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4])),
    Math.max(0, Math.min(1, m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9])),
    Math.max(
      0,
      Math.min(1, m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14]),
    ),
    Math.max(
      0,
      Math.min(1, m[15] * r + m[16] * g + m[17] * b + m[18] * a + m[19]),
    ),
  ];
}

/**
 * Pick the Skia blend mode that best represents the filter's character.
 */
function pickBlendMode(filter: FilterConfig): string {
  const { brightness, contrast, saturation, sepia = 0, invert = 0 } = filter;

  if (invert === 1) return "exclusion";
  if (sepia > 0.3) return "softLight";
  if (contrast > 1.3) return "overlay";
  if (brightness < -0.2) return "multiply";
  if (brightness > 0.2) return "screen";
  if (saturation < 0.5) return "saturation";
  return "softLight";
}

/**
 * Derive the overlay tint from the actual ColorMatrix that SkiaFilteredImage
 * will apply in the editor.
 *
 * Method:
 *  1. Build the same 4×5 color matrix the editor uses.
 *  2. Apply it (with intensity lerp) to 3 reference pixels:
 *     - dark   (0.25, 0.25, 0.25)
 *     - mid    (0.50, 0.50, 0.50)
 *     - bright (0.75, 0.75, 0.75)
 *  3. Compute the average colour shift from the original neutral gray.
 *  4. The shift becomes the overlay tint colour; the magnitude becomes alpha.
 *
 * This means any change to the filter definitions or matrix math in
 * filterService automatically propagates here — no more hand-tuned
 * coefficients drifting out of sync.
 */
export function filterToOverlayColor(
  filter: FilterConfig,
  intensity: number,
): string | null {
  // Build the full matrix and lerp toward identity by intensity
  const fullMatrix = filterConfigToColorMatrix(filter);
  const m = lerpMatrix(fullMatrix, intensity);

  // Check if the lerped matrix is essentially identity
  let isIdentity = true;
  for (let i = 0; i < 20; i++) {
    if (Math.abs(m[i] - IDENTITY[i]) > 0.001) {
      isIdentity = false;
      break;
    }
  }
  if (isIdentity) return null;

  // Sample 3 neutral reference grays through the matrix
  const samples: [number, number, number][] = [
    [0.25, 0.25, 0.25], // shadows
    [0.5, 0.5, 0.5], // midtones
    [0.75, 0.75, 0.75], // highlights
  ];

  let totalDr = 0;
  let totalDg = 0;
  let totalDb = 0;

  // Also track the average output colour for the tint
  let avgR = 0;
  let avgG = 0;
  let avgB = 0;

  for (const [sr, sg, sb] of samples) {
    const [outR, outG, outB] = applyMatrix(m, sr, sg, sb, 1);
    totalDr += Math.abs(outR - sr);
    totalDg += Math.abs(outG - sg);
    totalDb += Math.abs(outB - sb);
    avgR += outR;
    avgG += outG;
    avgB += outB;
  }

  const n = samples.length;
  totalDr /= n;
  totalDg /= n;
  totalDb /= n;
  avgR /= n;
  avgG /= n;
  avgB /= n;

  // The magnitude of colour shift determines overlay opacity
  const shiftMagnitude = Math.sqrt(
    totalDr * totalDr + totalDg * totalDg + totalDb * totalDb,
  );

  // Scale opacity: small shifts → subtle overlay, big shifts → stronger
  // The sqrt scaling compresses the range so moderate filters still show clearly
  let alpha = Math.sqrt(shiftMagnitude) * 0.85;
  alpha = Math.min(0.6, Math.max(0, alpha));

  if (alpha < 0.01) return null;

  // Use the average output colour as the tint (this is what the image will
  // tend toward after the matrix is applied)
  const ri = Math.round(Math.min(1, Math.max(0, avgR)) * 255);
  const gi = Math.round(Math.min(1, Math.max(0, avgG)) * 255);
  const bi = Math.round(Math.min(1, Math.max(0, avgB)) * 255);

  return `rgba(${ri}, ${gi}, ${bi}, ${alpha.toFixed(3)})`;
}

// =============================================================================
// Component
// =============================================================================

const CameraFilterOverlay: React.FC<Props> = React.memo(
  ({ filter, intensity = 1 }) => {
    const overlayColor = useMemo(() => {
      if (!filter) return null;
      return filterToOverlayColor(filter, intensity);
    }, [filter, intensity]);

    const blendMode = useMemo(() => {
      if (!filter) return "softLight";
      return pickBlendMode(filter);
    }, [filter]);

    if (!overlayColor) return null;

    // Use Skia Canvas with proper blend mode if available
    if (SkiaCanvas && SkiaFill) {
      return (
        <View style={styles.overlay} pointerEvents="none">
          <SkiaCanvas style={StyleSheet.absoluteFill}>
            <SkiaFill color={overlayColor} blendMode={blendMode} />
          </SkiaCanvas>
        </View>
      );
    }

    // Fallback: plain View overlay
    return (
      <View
        style={[styles.overlay, { backgroundColor: overlayColor }]}
        pointerEvents="none"
      />
    );
  },
);

CameraFilterOverlay.displayName = "CameraFilterOverlay";

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});

export default CameraFilterOverlay;
