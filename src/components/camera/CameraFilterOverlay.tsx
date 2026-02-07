/**
 * CAMERA FILTER OVERLAY
 * Renders a translucent tinted layer on top of the camera preview to give a
 * live preview of the selected filter's colour grading.
 *
 * We cannot apply a pixel-level color matrix to the live camera stream (the
 * CameraView is a native texture that Skia cannot sample). Instead we compute
 * the filter's dominant tint colour and overlay a translucent View.
 *
 * The pixel-accurate filter is applied post-capture via
 * filterService.applyFilterToImage().
 */

import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { FilterConfig } from "../../types/camera";

interface Props {
  filter: FilterConfig | null;
  /** 0 – 1 intensity multiplier (default 1) */
  intensity?: number;
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
 */
function filterToOverlayColor(
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
    a += 0.12;
  }

  // ── Sepia ──────────────────────────────────────────────────────────────
  if (sepia > 0) {
    const sw = sepia * 0.6; // weight
    r = r * (1 - sw) + 0.76 * sw; // warm brown
    g = g * (1 - sw) + 0.58 * sw;
    b = b * (1 - sw) + 0.36 * sw;
    a += sepia * 0.18;
  }

  // ── Desaturation → gray overlay ────────────────────────────────────────
  if (saturation < 1) {
    const desat = 1 - saturation; // 0..1
    const gray = 0.5;
    r = r * saturation + gray * desat;
    g = g * saturation + gray * desat;
    b = b * saturation + gray * desat;
    a += desat * 0.25;
  } else if (saturation > 1) {
    // Boost → slightly stronger existing tint
    a += (saturation - 1) * 0.05;
  }

  // ── Brightness ─────────────────────────────────────────────────────────
  if (brightness > 0) {
    // Lighten: mix toward white
    r = r + (1 - r) * brightness * 0.5;
    g = g + (1 - g) * brightness * 0.5;
    b = b + (1 - b) * brightness * 0.5;
    a += brightness * 0.08;
  } else if (brightness < 0) {
    // Darken: mix toward black
    const dark = -brightness;
    r *= 1 - dark * 0.6;
    g *= 1 - dark * 0.6;
    b *= 1 - dark * 0.6;
    a += dark * 0.15;
  }

  // ── Contrast ───────────────────────────────────────────────────────────
  if (contrast > 1) {
    // Higher contrast → slightly darker overlay
    a += (contrast - 1) * 0.04;
  } else if (contrast < 1) {
    // Low contrast → slight haze
    r = r * 0.7 + 0.5 * 0.3;
    g = g * 0.7 + 0.5 * 0.3;
    b = b * 0.7 + 0.5 * 0.3;
    a += (1 - contrast) * 0.08;
  }

  // ── Invert ─────────────────────────────────────────────────────────────
  if (invert === 1) {
    r = 0.3;
    g = 0.6;
    b = 0.8;
    a += 0.2;
  }

  // Clamp opacity
  a = Math.min(0.35, Math.max(0, a)) * intensity;

  if (a < 0.01) return null; // too faint to be visible

  // Convert to rgba
  const ri = Math.round(Math.min(1, Math.max(0, r)) * 255);
  const gi = Math.round(Math.min(1, Math.max(0, g)) * 255);
  const bi = Math.round(Math.min(1, Math.max(0, b)) * 255);

  return `rgba(${ri}, ${gi}, ${bi}, ${a.toFixed(2)})`;
}

const CameraFilterOverlay: React.FC<Props> = React.memo(
  ({ filter, intensity = 1 }) => {
    const overlayColor = useMemo(() => {
      if (!filter) return null;
      return filterToOverlayColor(filter, intensity);
    }, [filter, intensity]);

    if (!overlayColor) return null;

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
