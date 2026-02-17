/**
 * MiniGolfDebugOverlay — Dev-only transparent overlay
 *
 * Visualises physics-critical geometry on top of the game canvas:
 *   - Bounds rectangle (cyan dashed border)
 *   - Wall segment center dots (red) + corner plug circles (orange)
 *   - Cup circle (white outline) with radius ring
 *   - Tee crosshair (yellow)
 *   - Coordinate labels at key points
 *
 * Gated by DEBUG_MINIGOLF_OVERLAY feature flag.
 * Does NOT render in production builds.
 */

import { DEBUG_MINIGOLF_OVERLAY } from "@/constants/featureFlags";
import type { HoleConfig, Point } from "@/games/minigolf/courseLoader";
import { buildAllWallGeometry } from "@/games/minigolf/courseLoader";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

// =============================================================================
// Props
// =============================================================================

export interface MiniGolfDebugOverlayProps {
  holeConfig: HoleConfig | null;
  /** Available layout dimensions (from parent onLayout) */
  layout: { width: number; height: number };
  /** Whether debug is force-enabled (overrides flag) */
  forceShow?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function MiniGolfDebugOverlay({
  holeConfig,
  layout,
  forceShow = false,
}: MiniGolfDebugOverlayProps) {
  // Gate: do not render in prod unless force-enabled
  if (!DEBUG_MINIGOLF_OVERLAY && !forceShow) return null;
  if (!holeConfig || layout.width === 0 || layout.height === 0) return null;

  return <DebugContent holeConfig={holeConfig} layout={layout} />;
}

// Separate component to avoid hook-after-return issues
function DebugContent({
  holeConfig,
  layout,
}: {
  holeConfig: HoleConfig;
  layout: { width: number; height: number };
}) {
  const PADDING = 16;

  // Compute transform (same as canvas)
  const transform = useMemo(() => {
    const { width: wW, height: wH } = holeConfig.bounds;
    const availW = layout.width - PADDING * 2;
    const availH = layout.height - PADDING * 2;
    const scale = Math.min(availW / wW, availH / wH);
    const offX = PADDING + (availW - wW * scale) / 2;
    const offY = PADDING + (availH - wH * scale) / 2;
    return { scale, offX, offY, wW, wH };
  }, [holeConfig, layout]);

  const toScreen = (p: Point) => ({
    x: transform.offX + p.x * transform.scale,
    y: transform.offY + p.y * transform.scale,
  });

  // Build geometry
  const wallGeometry = useMemo(
    () => buildAllWallGeometry(holeConfig.walls),
    [holeConfig.walls],
  );

  const { scale } = transform;
  const cup = toScreen(holeConfig.cup);
  const tee = toScreen(holeConfig.tee);
  const cupR = holeConfig.cupRadius * scale;

  // Bounds rect in screen coords
  const boundsTopLeft = toScreen({ x: 0, y: 0 });
  const boundsW = holeConfig.bounds.width * scale;
  const boundsH = holeConfig.bounds.height * scale;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Bounds rectangle */}
      <View
        style={[
          styles.boundsRect,
          {
            left: boundsTopLeft.x,
            top: boundsTopLeft.y,
            width: boundsW,
            height: boundsH,
          },
        ]}
      />

      {/* Bounds label */}
      <Text
        style={[
          styles.label,
          { left: boundsTopLeft.x + 2, top: boundsTopLeft.y + 2 },
        ]}
      >
        {holeConfig.bounds.width}×{holeConfig.bounds.height}
      </Text>

      {/* Wall segment centers (red dots) */}
      {wallGeometry.segments.map((seg, i) => {
        const sp = toScreen({ x: seg.cx, y: seg.cy });
        return (
          <View
            key={`seg-${i}`}
            style={[styles.segDot, { left: sp.x - 2, top: sp.y - 2 }]}
          />
        );
      })}

      {/* Corner plugs (orange circles) */}
      {wallGeometry.cornerPlugs.map((plug, i) => {
        const sp = toScreen({ x: plug.x, y: plug.y });
        const r = plug.radius * scale;
        return (
          <View
            key={`plug-${i}`}
            style={[
              styles.plugCircle,
              {
                left: sp.x - r,
                top: sp.y - r,
                width: r * 2,
                height: r * 2,
                borderRadius: r,
              },
            ]}
          />
        );
      })}

      {/* Cup circle + label */}
      <View
        style={[
          styles.cupCircle,
          {
            left: cup.x - cupR,
            top: cup.y - cupR,
            width: cupR * 2,
            height: cupR * 2,
            borderRadius: cupR,
          },
        ]}
      />
      <Text style={[styles.label, { left: cup.x + cupR + 4, top: cup.y - 6 }]}>
        CUP r={holeConfig.cupRadius}
      </Text>

      {/* Tee crosshair + label */}
      <View style={[styles.teeCross, { left: tee.x - 6, top: tee.y - 1 }]} />
      <View style={[styles.teeCrossV, { left: tee.x - 1, top: tee.y - 6 }]} />
      <Text style={[styles.label, { left: tee.x + 8, top: tee.y - 6 }]}>
        TEE ({Math.round(holeConfig.tee.x)},{Math.round(holeConfig.tee.y)})
      </Text>

      {/* Hole info */}
      <Text style={[styles.infoLabel, { left: 4, top: 4 }]}>
        {holeConfig.id} | par {holeConfig.par} | segs:
        {wallGeometry.segments.length} plugs:{wallGeometry.cornerPlugs.length}
      </Text>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  boundsRect: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "#00FFFF80",
    borderStyle: "dashed",
  },
  label: {
    position: "absolute",
    fontSize: 8,
    color: "#00FFFF",
    fontFamily: "monospace",
  },
  infoLabel: {
    position: "absolute",
    fontSize: 9,
    color: "#FFFF00",
    fontFamily: "monospace",
    backgroundColor: "#00000080",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  segDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FF000099",
  },
  plugCircle: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "#FF980099",
    backgroundColor: "transparent",
  },
  cupCircle: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "#FFFFFF99",
    backgroundColor: "transparent",
  },
  teeCross: {
    position: "absolute",
    width: 12,
    height: 2,
    backgroundColor: "#FFFF0099",
  },
  teeCrossV: {
    position: "absolute",
    width: 2,
    height: 12,
    backgroundColor: "#FFFF0099",
  },
});
