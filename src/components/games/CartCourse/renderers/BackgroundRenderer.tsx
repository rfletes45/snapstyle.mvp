/**
 * Background Renderer
 * Renders the game background with parallax effect
 */

import { Circle, Group, Line, Rect, vec } from "@shopify/react-native-skia";
import React from "react";
import { VISUAL_CONFIG } from "../data/constants";
import { Vector2D } from "../types/cartCourse.types";

// ============================================
// Background Renderer Props
// ============================================

interface BackgroundRendererProps {
  screenWidth: number;
  screenHeight: number;
  cameraPosition: Vector2D;
}

// ============================================
// Background Renderer Component
// ============================================

export const BackgroundRenderer: React.FC<BackgroundRendererProps> = ({
  screenWidth,
  screenHeight,
  cameraPosition,
}) => {
  const { colors } = VISUAL_CONFIG;

  // Calculate parallax offsets
  const parallaxFactor = 0.2;
  const bgOffsetX = cameraPosition.x * parallaxFactor;
  const bgOffsetY = cameraPosition.y * parallaxFactor;

  // Grid line spacing
  const gridSpacing = 100;

  return (
    <Group>
      {/* Main background */}
      <Rect
        x={cameraPosition.x - screenWidth}
        y={cameraPosition.y - screenHeight}
        width={screenWidth * 3}
        height={screenHeight * 3}
        color={colors.background}
      />

      {/* Background grid (subtle) */}
      <Group opacity={0.1}>
        {/* Vertical lines */}
        {Array.from({ length: 40 }).map((_, i) => {
          const startX =
            Math.floor((cameraPosition.x - screenWidth) / gridSpacing) *
              gridSpacing +
            i * gridSpacing;
          return (
            <Line
              key={`v-grid-${i}`}
              p1={vec(startX, cameraPosition.y - screenHeight)}
              p2={vec(startX, cameraPosition.y + screenHeight * 2)}
              color={colors.girders}
              strokeWidth={1}
            />
          );
        })}

        {/* Horizontal lines */}
        {Array.from({ length: 30 }).map((_, i) => {
          const startY =
            Math.floor((cameraPosition.y - screenHeight) / gridSpacing) *
              gridSpacing +
            i * gridSpacing;
          return (
            <Line
              key={`h-grid-${i}`}
              p1={vec(cameraPosition.x - screenWidth, startY)}
              p2={vec(cameraPosition.x + screenWidth * 2, startY)}
              color={colors.girders}
              strokeWidth={1}
            />
          );
        })}
      </Group>

      {/* Decorative stars (with parallax) */}
      <Group opacity={0.3}>
        {generateStars(
          20,
          screenWidth,
          screenHeight,
          cameraPosition,
          bgOffsetX,
          bgOffsetY,
        ).map((star, i) => (
          <Circle
            key={`star-${i}`}
            cx={star.x}
            cy={star.y}
            r={star.size}
            color={colors.text}
          />
        ))}
      </Group>
    </Group>
  );
};

// ============================================
// Generate Stars (pseudo-random based on position)
// ============================================

function generateStars(
  count: number,
  screenWidth: number,
  screenHeight: number,
  cameraPosition: Vector2D,
  offsetX: number,
  offsetY: number,
): Array<{ x: number; y: number; size: number }> {
  const stars: Array<{ x: number; y: number; size: number }> = [];

  // Use a seeded approach for consistent star positions
  const seed = 12345;

  for (let i = 0; i < count; i++) {
    // Pseudo-random but deterministic positions
    const pseudoRand1 = ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;
    const pseudoRand2 = ((seed * (i + 2) * 9301 + 49297) % 233280) / 233280;
    const pseudoRand3 = ((seed * (i + 3) * 9301 + 49297) % 233280) / 233280;

    stars.push({
      x:
        cameraPosition.x -
        screenWidth +
        pseudoRand1 * screenWidth * 3 -
        offsetX,
      y:
        cameraPosition.y -
        screenHeight +
        pseudoRand2 * screenHeight * 3 -
        offsetY,
      size: 1 + pseudoRand3 * 2,
    });
  }

  return stars;
}
