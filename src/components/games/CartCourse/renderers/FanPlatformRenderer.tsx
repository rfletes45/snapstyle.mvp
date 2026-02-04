/**
 * Fan Platform Renderer (Phase 4)
 * Renders fan platform with wind effect
 */

import {
  Circle,
  Group,
  Line,
  LinearGradient,
  Rect,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React from "react";
import { FanPlatformMechanism } from "../types/cartCourse.types";

// ============================================
// Props Interface
// ============================================

interface FanPlatformRendererProps {
  mechanism: FanPlatformMechanism;
  cameraOffset: { x: number; y: number };
  scale?: number;
  time?: number; // For animation
}

// ============================================
// Colors
// ============================================

const COLORS = {
  platform: "#5a7a8a",
  platformHighlight: "#7a9aaa",
  platformShadow: "#3a5a6a",
  fan: "#8a8a8a",
  fanBlade: "#aaaaaa",
  fanCenter: "#666666",
  windLine: "rgba(200, 230, 255, 0.4)",
  windLineActive: "rgba(150, 200, 255, 0.7)",
  base: "#4a4a4a",
};

// ============================================
// Component
// ============================================

export const FanPlatformRenderer: React.FC<FanPlatformRendererProps> = ({
  mechanism,
  cameraOffset,
  scale = 1,
  time = 0,
}) => {
  const { position, currentLift, state, platform, baseY } = mechanism;

  // Calculate screen position
  const screenX = (platform.position.x - cameraOffset.x) * scale;
  const screenY = (platform.position.y - cameraOffset.y) * scale;
  const baseScreenY = (baseY - cameraOffset.y) * scale;

  // Platform dimensions
  const platformBounds = platform.bounds;
  const width = (platformBounds.max.x - platformBounds.min.x) * scale;
  const height = (platformBounds.max.y - platformBounds.min.y) * scale;

  // Fan dimensions
  const fanRadius = 25 * scale;
  const fanX = screenX;
  const fanY = baseScreenY + 30 * scale;

  // Wind animation
  const isActive = state === "active";
  const windLineCount = 5;
  const animationSpeed = time * 0.005;

  // Support column connecting platform to base
  const columnWidth = 10 * scale;
  const columnHeight = baseScreenY - screenY;

  return (
    <Group>
      {/* Support column */}
      {columnHeight > 0 && (
        <Rect
          x={screenX - columnWidth / 2}
          y={screenY + height / 2}
          width={columnWidth}
          height={columnHeight}
          color={COLORS.base}
        />
      )}

      {/* Platform */}
      <RoundedRect
        x={screenX - width / 2}
        y={screenY - height / 2}
        width={width}
        height={height}
        r={4 * scale}
      >
        <LinearGradient
          start={vec(screenX - width / 2, screenY - height / 2)}
          end={vec(screenX - width / 2, screenY + height / 2)}
          colors={[
            COLORS.platformHighlight,
            COLORS.platform,
            COLORS.platformShadow,
          ]}
        />
        {isActive && (
          <Shadow dx={0} dy={-2} blur={8} color="rgba(100, 200, 255, 0.5)" />
        )}
      </RoundedRect>

      {/* Base unit */}
      <RoundedRect
        x={screenX - width / 2 - 5 * scale}
        y={baseScreenY}
        width={width + 10 * scale}
        height={50 * scale}
        r={5 * scale}
        color={COLORS.base}
      />

      {/* Fan housing */}
      <Circle cx={fanX} cy={fanY} r={fanRadius} color={COLORS.fan} />

      {/* Fan blades - rotate when active */}
      <Group
        transform={[
          { translateX: fanX },
          { translateY: fanY },
          { rotate: isActive ? animationSpeed * 10 : 0 },
        ]}
      >
        {[0, 1, 2, 3].map((i) => (
          <Group key={i} transform={[{ rotate: (i * Math.PI) / 2 }]}>
            <Rect
              x={-3 * scale}
              y={-fanRadius + 5 * scale}
              width={6 * scale}
              height={fanRadius - 8 * scale}
              color={COLORS.fanBlade}
            />
          </Group>
        ))}
      </Group>

      {/* Fan center */}
      <Circle cx={fanX} cy={fanY} r={8 * scale} color={COLORS.fanCenter} />

      {/* Wind effect lines */}
      {isActive && (
        <Group>
          {Array.from({ length: windLineCount }).map((_, i) => {
            const offsetPhase = (i / windLineCount + animationSpeed) % 1;
            const lineY = fanY - fanRadius - offsetPhase * 60 * scale;
            const opacity = 1 - offsetPhase;
            const lineWidth = width * 0.6 * (1 - offsetPhase * 0.5);

            return (
              <Line
                key={i}
                p1={vec(fanX - lineWidth / 2, lineY)}
                p2={vec(fanX + lineWidth / 2, lineY)}
                color={COLORS.windLineActive}
                strokeWidth={2 * scale}
                opacity={opacity * currentLift}
              />
            );
          })}
        </Group>
      )}

      {/* Lift indicator */}
      <Group>
        {/* Track */}
        <Rect
          x={screenX + width / 2 + 8 * scale}
          y={screenY - height / 2}
          width={4 * scale}
          height={columnHeight > 0 ? columnHeight + height : 100 * scale}
          color="rgba(255, 255, 255, 0.1)"
        />
        {/* Current position */}
        <Circle
          cx={screenX + width / 2 + 10 * scale}
          cy={screenY}
          r={4 * scale}
          color={
            isActive ? "rgba(100, 200, 255, 0.8)" : "rgba(255, 255, 255, 0.4)"
          }
        />
      </Group>
    </Group>
  );
};

export default FanPlatformRenderer;
