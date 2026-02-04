/**
 * Lift Platform Renderer (Phase 3)
 * Skia renderer for lift platform mechanisms
 */

import { Group, Line, Rect, vec } from "@shopify/react-native-skia";
import React from "react";
import { MECHANISM_CONFIG, VISUAL_CONFIG } from "../data/constants";
import { LiftPlatformMechanism, Vector2D } from "../types/cartCourse.types";

// ============================================
// Props Interface
// ============================================

interface LiftPlatformRendererProps {
  mechanism: LiftPlatformMechanism;
  cameraOffset: Vector2D;
  scale?: number;
}

// ============================================
// Lift Platform Renderer
// ============================================

export const LiftPlatformRenderer: React.FC<LiftPlatformRendererProps> = ({
  mechanism,
  cameraOffset,
  scale = 1,
}) => {
  const { position, baseY, maxLiftY, currentLift, platform } = mechanism;
  const platformWidth = MECHANISM_CONFIG.liftPlatform.platformWidth * scale;
  const platformHeight = MECHANISM_CONFIG.liftPlatform.platformHeight * scale;

  // Calculate screen position relative to camera
  const screenX = (position.x - cameraOffset.x) * scale;
  const baseScreenY = (baseY - cameraOffset.y) * scale;
  const maxScreenY = (maxLiftY - cameraOffset.y) * scale;

  // Current platform position
  const currentScreenY = baseScreenY + (maxScreenY - baseScreenY) * currentLift;

  // Colors based on state
  const isActive = mechanism.state === "active";
  const platformColor = isActive ? "#74b9ff" : VISUAL_CONFIG.colors.platforms;
  const trackColor = "rgba(100, 100, 100, 0.5)";
  const highlightColor = isActive
    ? "rgba(255, 255, 255, 0.4)"
    : "rgba(255, 255, 255, 0.2)";

  // Track width (vertical guide rails)
  const trackWidth = 8;
  const trackOffset = platformWidth / 2 + 5;

  return (
    <Group>
      {/* Left track (guide rail) */}
      <Line
        p1={vec(screenX - trackOffset, maxScreenY - 10)}
        p2={vec(screenX - trackOffset, baseScreenY + 10)}
        color={trackColor}
        strokeWidth={trackWidth}
        style="stroke"
      />

      {/* Right track (guide rail) */}
      <Line
        p1={vec(screenX + trackOffset, maxScreenY - 10)}
        p2={vec(screenX + trackOffset, baseScreenY + 10)}
        color={trackColor}
        strokeWidth={trackWidth}
        style="stroke"
      />

      {/* Platform */}
      <Rect
        x={screenX - platformWidth / 2}
        y={currentScreenY - platformHeight / 2}
        width={platformWidth}
        height={platformHeight}
        color={platformColor}
      />

      {/* Platform highlight */}
      <Rect
        x={screenX - platformWidth / 2}
        y={currentScreenY - platformHeight / 2}
        width={platformWidth}
        height={3}
        color={highlightColor}
      />

      {/* Platform edge shadows */}
      <Rect
        x={screenX - platformWidth / 2}
        y={currentScreenY + platformHeight / 2 - 3}
        width={platformWidth}
        height={3}
        color="rgba(0, 0, 0, 0.2)"
      />

      {/* Lift indicator (shows lift progress) */}
      {currentLift > 0 && (
        <Line
          p1={vec(screenX, currentScreenY + platformHeight / 2)}
          p2={vec(screenX, baseScreenY)}
          color="rgba(116, 185, 255, 0.3)"
          strokeWidth={2}
          style="stroke"
          strokeCap="round"
        />
      )}
    </Group>
  );
};

export default LiftPlatformRenderer;
