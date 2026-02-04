/**
 * Launcher Platform Renderer (Phase 4)
 * Renders launcher with charge indicator
 */

import {
  Group,
  LinearGradient,
  Rect,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React from "react";
import { LauncherPlatformMechanism } from "../types/cartCourse.types";

// ============================================
// Props Interface
// ============================================

interface LauncherPlatformRendererProps {
  mechanism: LauncherPlatformMechanism;
  cameraOffset: { x: number; y: number };
  scale?: number;
}

// ============================================
// Colors
// ============================================

const COLORS = {
  platform: "#4a4a4a",
  platformHighlight: "#6a6a6a",
  platformShadow: "#2a2a2a",
  chargeEmpty: "#333333",
  chargeFill: "#ff6600",
  chargeFull: "#ff2222",
  arrow: "#ffcc00",
  arrowGlow: "rgba(255, 200, 0, 0.5)",
};

// ============================================
// Component
// ============================================

export const LauncherPlatformRenderer: React.FC<
  LauncherPlatformRendererProps
> = ({ mechanism, cameraOffset, scale = 1 }) => {
  const { position, chargeLevel, isCharging, platform, launchDirection } =
    mechanism;

  // Calculate screen position
  const screenX = (position.x - cameraOffset.x) * scale;
  const screenY = (position.y - cameraOffset.y) * scale;

  // Platform dimensions
  const platformBounds = platform.bounds;
  const width = (platformBounds.max.x - platformBounds.min.x) * scale;
  const height = (platformBounds.max.y - platformBounds.min.y) * scale;

  // Charge bar dimensions
  const chargeBarWidth = width * 0.8;
  const chargeBarHeight = 8 * scale;
  const chargeBarY = screenY + height / 2 + 10 * scale;

  // Arrow dimensions
  const arrowSize = 20 * scale;
  const arrowX = screenX;
  const arrowY = screenY - height / 2 - arrowSize - 5 * scale;

  // Determine charge color
  const chargeColor = chargeLevel >= 1 ? COLORS.chargeFull : COLORS.chargeFill;

  return (
    <Group>
      {/* Platform base */}
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
      </RoundedRect>

      {/* Platform details - spring mechanism visual */}
      <Rect
        x={screenX - width / 4}
        y={screenY - height / 2 + 2 * scale}
        width={width / 2}
        height={height - 4 * scale}
        color={COLORS.platformShadow}
      />

      {/* Launch direction arrow */}
      <Group transform={[{ translateX: arrowX }, { translateY: arrowY }]}>
        {/* Arrow glow when charging */}
        {isCharging && (
          <Rect
            x={-arrowSize / 2 - 2}
            y={-arrowSize / 2 - 2}
            width={arrowSize + 4}
            height={arrowSize + 4}
            color={COLORS.arrowGlow}
            opacity={chargeLevel * 0.8}
          >
            <Shadow
              dx={0}
              dy={0}
              blur={10 * chargeLevel}
              color={COLORS.arrow}
            />
          </Rect>
        )}

        {/* Arrow body - points in launch direction */}
        <Group
          transform={[
            {
              rotate:
                Math.atan2(launchDirection.y, launchDirection.x) + Math.PI / 2,
            },
          ]}
        >
          {/* Arrow shaft */}
          <Rect
            x={-3 * scale}
            y={-arrowSize / 3}
            width={6 * scale}
            height={arrowSize * 0.6}
            color={COLORS.arrow}
          />
          {/* Arrow head (triangle approximation with rects) */}
          <Rect
            x={-8 * scale}
            y={-arrowSize / 2}
            width={16 * scale}
            height={arrowSize / 3}
            color={COLORS.arrow}
          />
        </Group>
      </Group>

      {/* Charge bar background */}
      {isCharging && (
        <>
          <RoundedRect
            x={screenX - chargeBarWidth / 2}
            y={chargeBarY}
            width={chargeBarWidth}
            height={chargeBarHeight}
            r={chargeBarHeight / 2}
            color={COLORS.chargeEmpty}
          />

          {/* Charge bar fill */}
          <RoundedRect
            x={screenX - chargeBarWidth / 2}
            y={chargeBarY}
            width={chargeBarWidth * chargeLevel}
            height={chargeBarHeight}
            r={chargeBarHeight / 2}
            color={chargeColor}
          >
            {chargeLevel >= 1 && (
              <Shadow dx={0} dy={0} blur={8} color={COLORS.chargeFull} />
            )}
          </RoundedRect>

          {/* Charge segments */}
          {[0.25, 0.5, 0.75].map((segment) => (
            <Rect
              key={segment}
              x={screenX - chargeBarWidth / 2 + chargeBarWidth * segment - 0.5}
              y={chargeBarY}
              width={1}
              height={chargeBarHeight}
              color="rgba(255, 255, 255, 0.3)"
            />
          ))}
        </>
      )}
    </Group>
  );
};

export default LauncherPlatformRenderer;
