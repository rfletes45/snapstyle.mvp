/**
 * Wall Renderer
 * Renders walls using Skia
 */

import { Group, Line, Rect, vec } from "@shopify/react-native-skia";
import React from "react";
import { VISUAL_CONFIG } from "../data/constants";
import { WallEntity } from "../types/cartCourse.types";

// ============================================
// Wall Renderer Props
// ============================================

interface WallRendererProps {
  wall: WallEntity;
}

// ============================================
// Wall Renderer Component
// ============================================

export const WallRenderer: React.FC<WallRendererProps> = ({ wall }) => {
  if (!wall || !wall.body) {
    return null;
  }

  const { body, size } = wall;
  const { colors } = VISUAL_CONFIG;

  // Get position and angle from physics body
  const x = body.position.x;
  const y = body.position.y;
  const angle = body.angle;
  const { width, height } = size;

  // Wall color slightly darker than platforms
  const wallColor = colors.walls;
  const wallHighlight = "#7f8c8d";

  return (
    <Group
      transform={[{ translateX: x }, { translateY: y }, { rotate: angle }]}
    >
      {/* Main wall body */}
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        color={wallColor}
      />

      {/* Left edge highlight */}
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={2}
        height={height}
        color={wallHighlight}
      />

      {/* Brick pattern for tall walls */}
      {height > 50 && (
        <>
          {Array.from({ length: Math.floor(height / 20) }).map((_, i) => (
            <Line
              key={`brick-line-${i}`}
              p1={vec(-width / 2 + 2, -height / 2 + 20 + i * 20)}
              p2={vec(width / 2 - 2, -height / 2 + 20 + i * 20)}
              color={wallHighlight}
              strokeWidth={1}
            />
          ))}
        </>
      )}
    </Group>
  );
};
