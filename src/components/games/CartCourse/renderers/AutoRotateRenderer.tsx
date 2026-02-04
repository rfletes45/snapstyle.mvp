/**
 * Auto Rotate Platform Renderer (Phase 4)
 * Renders rotating platform with pivot point
 */

import {
  Circle,
  Group,
  LinearGradient,
  Path,
  Rect,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React from "react";
import { AutoRotateMechanism } from "../types/cartCourse.types";

// ============================================
// Props Interface
// ============================================

interface AutoRotateRendererProps {
  mechanism: AutoRotateMechanism;
  cameraOffset: { x: number; y: number };
  scale?: number;
}

// ============================================
// Colors
// ============================================

const COLORS = {
  platform: "#8a6a4a",
  platformHighlight: "#aa8a6a",
  platformShadow: "#6a4a2a",
  pivot: "#3a3a3a",
  pivotHighlight: "#5a5a5a",
  triggered: "#ffaa44",
  arc: "rgba(255, 170, 68, 0.3)",
  arcActive: "rgba(255, 170, 68, 0.6)",
};

// ============================================
// Component
// ============================================

export const AutoRotateRenderer: React.FC<AutoRotateRendererProps> = ({
  mechanism,
  cameraOffset,
  scale = 1,
}) => {
  const {
    position,
    platform,
    pivotPosition,
    currentAngle,
    targetAngle,
    isTriggered,
    state,
  } = mechanism;

  // Calculate screen position
  const screenX = (platform.position.x - cameraOffset.x) * scale;
  const screenY = (platform.position.y - cameraOffset.y) * scale;

  // Platform dimensions
  const platformBounds = platform.bounds;
  const width = (platformBounds.max.x - platformBounds.min.x) * scale;
  const height = (platformBounds.max.y - platformBounds.min.y) * scale;

  // Pivot position
  const pivotScreenX = (pivotPosition.x - cameraOffset.x) * scale;
  const pivotScreenY = (pivotPosition.y - cameraOffset.y) * scale;

  // Rotation progress
  const rotationProgress =
    targetAngle !== 0 ? Math.abs(currentAngle / targetAngle) : 0;

  const isActive = state === "active" || state === "transitioning";

  // Create rotation arc path
  const arcRadius = 30 * scale;
  const startAngle = Math.PI / 2; // Start from bottom
  const endAngle = startAngle + targetAngle;
  const arcPath = `
    M ${pivotScreenX} ${pivotScreenY}
    L ${pivotScreenX + Math.cos(startAngle) * arcRadius} ${pivotScreenY + Math.sin(startAngle) * arcRadius}
    A ${arcRadius} ${arcRadius} 0 ${Math.abs(targetAngle) > Math.PI ? 1 : 0} ${targetAngle > 0 ? 1 : 0} 
      ${pivotScreenX + Math.cos(endAngle) * arcRadius} ${pivotScreenY + Math.sin(endAngle) * arcRadius}
    Z
  `;

  return (
    <Group>
      {/* Rotation arc indicator */}
      <Path
        path={arcPath}
        color={isActive ? COLORS.arcActive : COLORS.arc}
        opacity={0.5}
      />

      {/* Platform group with rotation */}
      <Group
        transform={[
          { translateX: pivotScreenX },
          { translateY: pivotScreenY },
          { rotate: currentAngle },
          { translateX: -pivotScreenX },
          { translateY: -pivotScreenY },
        ]}
      >
        {/* Platform body */}
        <RoundedRect
          x={screenX - width / 2}
          y={screenY - height / 2}
          width={width}
          height={height}
          r={3 * scale}
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
            <Shadow dx={0} dy={2} blur={6} color="rgba(255, 170, 68, 0.4)" />
          )}
        </RoundedRect>

        {/* Grip lines on platform */}
        {Array.from({ length: 5 }).map((_, i) => {
          const lineX = screenX - width / 2 + width * ((i + 1) / 6);
          return (
            <Rect
              key={i}
              x={lineX - 1 * scale}
              y={screenY - height / 2 + 2 * scale}
              width={2 * scale}
              height={height - 4 * scale}
              color="rgba(0, 0, 0, 0.2)"
            />
          );
        })}

        {/* Trigger indicator */}
        {isTriggered && (
          <Circle
            cx={screenX}
            cy={screenY}
            r={8 * scale}
            color={COLORS.triggered}
            opacity={0.7}
          />
        )}
      </Group>

      {/* Pivot point (rendered on top, outside rotation) */}
      <Group>
        {/* Pivot base */}
        <Circle
          cx={pivotScreenX}
          cy={pivotScreenY}
          r={12 * scale}
          color={COLORS.pivot}
        />
        {/* Pivot highlight */}
        <Circle
          cx={pivotScreenX}
          cy={pivotScreenY}
          r={8 * scale}
          color={COLORS.pivotHighlight}
        />
        {/* Pivot center */}
        <Circle
          cx={pivotScreenX}
          cy={pivotScreenY}
          r={4 * scale}
          color={isActive ? COLORS.triggered : COLORS.pivot}
        >
          {isActive && (
            <Shadow dx={0} dy={0} blur={8} color={COLORS.triggered} />
          )}
        </Circle>
      </Group>

      {/* Progress indicator */}
      {isActive && (
        <Group>
          {/* Background ring */}
          <Circle
            cx={pivotScreenX}
            cy={pivotScreenY - 25 * scale}
            r={6 * scale}
            color="rgba(0, 0, 0, 0.3)"
          />
          {/* Progress fill */}
          <Circle
            cx={pivotScreenX}
            cy={pivotScreenY - 25 * scale}
            r={5 * scale}
            color={COLORS.triggered}
          />
        </Group>
      )}
    </Group>
  );
};

export default AutoRotateRenderer;
