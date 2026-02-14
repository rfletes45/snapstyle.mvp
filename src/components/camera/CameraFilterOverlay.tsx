/**
 * CAMERA FILTER OVERLAY (Skia-Powered)
 *
 * Renders a cinematic blend-color layer on top of the live camera preview
 * using @shopify/react-native-skia's Canvas + Fill + BlendColor.
 *
 * Why Skia instead of a plain translucent View?
 *   - Proper blend modes (softLight, overlay, multiply) produce cinema-grade
 *     tinting that interacts with the underlying brightness/colour, not just
 *     an alpha-blended flat colour.
 *   - GPU-accelerated — zero CPU overhead.
 *   - Same tech stack as the editor filter (Phase 1: SkiaFilteredImage).
 *
 * We still cannot apply a pixel-level color matrix to the live camera stream
 * (CameraView is a native texture), but Skia blend modes produce dramatically
 * better results than plain rgba overlays.
 *
 * Falls back to a plain View on Skia import failure (e.g. web).
 */

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

/**
 * Pick the best Skia blend mode for a filter's characteristics.
 *
 * - softLight: warm/sepia/vintage filters — lightens lights, darkens darks
 * - overlay: high-contrast filters — stronger colour grading
 * - multiply: dark/moody filters — deepens shadows
 * - screen: bright/dreamy filters — lifts everything
 * - colorBurn: for invert/sketch — dramatic darkening
 */
function pickBlendMode(filter: FilterConfig): string {
  const { brightness, contrast, saturation, sepia = 0, invert = 0 } = filter;

  if (invert === 1) return "exclusion";
  if (sepia > 0.3) return "softLight";
  if (contrast > 1.3) return "overlay";
  if (brightness < -0.2) return "multiply";
  if (brightness > 0.2) return "screen";
  if (saturation < 0.5) return "saturation";
  return "softLight"; // default — most natural-looking
}

/**
 * Convert a FilterConfig into a translucent overlay colour.
 *
 * The idea:
 *  - Hue   → rotate around HSL wheel to pick the tint colour
 *  - Saturation < 1  → desaturate by mixing toward gray
 *  - Sepia → blend toward warm brown
 *  - Brightness → lighten or darken by mixing toward white/black
 *  - Contrast → slightly darken to hint at stronger blacks
 *  - Invert → blue-ish/cyan to hint at inversion
 *
 * The overlay is always quite transparent (opacity 0.10 – 0.35) so the camera
 * feed is visible underneath.
 *
 * Exported so CameraScreen's editor can reuse the same logic for its
 * post-capture filter overlay, avoiding the previous copy-paste duplication.
 */
export function filterToOverlayColor(
  filter: FilterConfig,
  intensity: number,
): string | null {
  // Gather adjustments
  const {
    brightness,
    contrast,
    saturation,
    hue,
    sepia = 0,
    invert = 0,
  } = filter;

  // If filter is essentially identity, skip
  const isIdentity =
    brightness === 0 &&
    contrast === 1 &&
    saturation === 1 &&
    hue === 0 &&
    sepia === 0 &&
    invert === 0;
  if (isIdentity) return null;

  // Start with hue-derived colour
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0; // opacity will be built up

  // ── Hue tint ───────────────────────────────────────────────────────────
  if (hue > 0) {
    // Convert hue (degrees) to RGB on the colour wheel at full saturation
    const h = (hue % 360) / 60;
    const x = 1 - Math.abs((h % 2) - 1);
    if (h < 1) {
      r = 1;
      g = x;
      b = 0;
    } else if (h < 2) {
      r = x;
      g = 1;
      b = 0;
    } else if (h < 3) {
      r = 0;
      g = 1;
      b = x;
    } else if (h < 4) {
      r = 0;
      g = x;
      b = 1;
    } else if (h < 5) {
      r = x;
      g = 0;
      b = 1;
    } else {
      r = 1;
      g = 0;
      b = x;
    }
    a += 0.18; // Stronger than before — blend modes handle it better
  }

  // ── Sepia ──────────────────────────────────────────────────────────────
  if (sepia > 0) {
    const sw = sepia * 0.7;
    r = r * (1 - sw) + 0.82 * sw; // warm brown
    g = g * (1 - sw) + 0.62 * sw;
    b = b * (1 - sw) + 0.38 * sw;
    a += sepia * 0.25;
  }

  // ── Desaturation → gray overlay ────────────────────────────────────────
  if (saturation < 1) {
    const desat = 1 - saturation;
    const gray = 0.5;
    r = r * saturation + gray * desat;
    g = g * saturation + gray * desat;
    b = b * saturation + gray * desat;
    a += desat * 0.3;
  } else if (saturation > 1) {
    a += (saturation - 1) * 0.08;
  }

  // ── Brightness ─────────────────────────────────────────────────────────
  if (brightness > 0) {
    r = r + (1 - r) * brightness * 0.5;
    g = g + (1 - g) * brightness * 0.5;
    b = b + (1 - b) * brightness * 0.5;
    a += brightness * 0.12;
  } else if (brightness < 0) {
    const dark = -brightness;
    r *= 1 - dark * 0.6;
    g *= 1 - dark * 0.6;
    b *= 1 - dark * 0.6;
    a += dark * 0.2;
  }

  // ── Contrast ───────────────────────────────────────────────────────────
  if (contrast > 1) {
    a += (contrast - 1) * 0.06;
  } else if (contrast < 1) {
    r = r * 0.7 + 0.5 * 0.3;
    g = g * 0.7 + 0.5 * 0.3;
    b = b * 0.7 + 0.5 * 0.3;
    a += (1 - contrast) * 0.1;
  }

  // ── Invert ─────────────────────────────────────────────────────────────
  if (invert === 1) {
    r = 0.3;
    g = 0.6;
    b = 0.8;
    a += 0.25;
  }

  // Clamp opacity — higher cap now because blend modes are more forgiving
  a = Math.min(0.55, Math.max(0, a)) * intensity;

  if (a < 0.01) return null;

  const ri = Math.round(Math.min(1, Math.max(0, r)) * 255);
  const gi = Math.round(Math.min(1, Math.max(0, g)) * 255);
  const bi = Math.round(Math.min(1, Math.max(0, b)) * 255);

  return `rgba(${ri}, ${gi}, ${bi}, ${a.toFixed(2)})`;
}

/**
 * Skia-powered live camera filter overlay.
 *
 * Uses a Skia Canvas with a Fill + BlendColor for cinema-grade colour grading
 * that properly interacts with the underlying camera feed's brightness and
 * colour distribution (softLight, overlay, multiply, etc.).
 *
 * Falls back to a plain View overlay if Skia is unavailable.
 */
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

    // Fallback: plain View overlay (same as before)
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
