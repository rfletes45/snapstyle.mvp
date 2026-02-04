/**
 * Conveyor Belt Renderer (Phase 4)
 * Renders animated conveyor belt
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
import { ConveyorMechanism } from "../types/cartCourse.types";

// ============================================
// Props Interface
// ============================================

interface ConveyorRendererProps {
  mechanism: ConveyorMechanism;
  cameraOffset: { x: number; y: number };
  scale?: number;
}

// ============================================
// Colors
// ============================================

const COLORS = {
  belt: "#4a4a4a",
  beltStripe: "#3a3a3a",
  beltHighlight: "#5a5a5a",
  frame: "#666666",
  frameHighlight: "#888888",
  roller: "#555555",
  rollerHighlight: "#777777",
  arrow: "rgba(255, 200, 100, 0.6)",
  arrowActive: "rgba(255, 200, 100, 0.9)",
};

// ============================================
// Component
// ============================================

export const ConveyorRenderer: React.FC<ConveyorRendererProps> = ({
  mechanism,
  cameraOffset,
  scale = 1,
}) => {
  const { position, belt, speed, direction, isActive, animationOffset } =
    mechanism;

  // Calculate screen position
  const screenX = (belt.position.x - cameraOffset.x) * scale;
  const screenY = (belt.position.y - cameraOffset.y) * scale;

  // Belt dimensions
  const beltBounds = belt.bounds;
  const width = (beltBounds.max.x - beltBounds.min.x) * scale;
  const height = (beltBounds.max.y - beltBounds.min.y) * scale;

  // Stripe properties
  const stripeWidth = 15 * scale;
  const stripeSpacing = 25 * scale;
  const numStripes = Math.ceil(width / stripeSpacing) + 2;

  // Animation offset for stripe movement
  const offset = (animationOffset * stripeSpacing) % stripeSpacing;
  const displayOffset = direction === "left" ? -offset : offset;

  // Roller properties
  const rollerRadius = (height / 2 + 5) * scale;

  return (
    <Group>
      {/* Frame/base */}
      <RoundedRect
        x={screenX - width / 2 - 5 * scale}
        y={screenY - height / 2 - 5 * scale}
        width={width + 10 * scale}
        height={height + 20 * scale}
        r={8 * scale}
      >
        <LinearGradient
          start={vec(screenX - width / 2, screenY - height / 2)}
          end={vec(screenX - width / 2, screenY + height / 2 + 10)}
          colors={[COLORS.frameHighlight, COLORS.frame]}
        />
      </RoundedRect>

      {/* Left roller */}
      <Circle
        cx={screenX - width / 2}
        cy={screenY}
        r={rollerRadius}
        color={COLORS.roller}
      />
      <Circle
        cx={screenX - width / 2}
        cy={screenY}
        r={rollerRadius - 3 * scale}
        color={COLORS.rollerHighlight}
      />

      {/* Right roller */}
      <Circle
        cx={screenX + width / 2}
        cy={screenY}
        r={rollerRadius}
        color={COLORS.roller}
      />
      <Circle
        cx={screenX + width / 2}
        cy={screenY}
        r={rollerRadius - 3 * scale}
        color={COLORS.rollerHighlight}
      />

      {/* Belt surface with clipping */}
      <Group
        clip={{
          x: screenX - width / 2,
          y: screenY - height / 2,
          width: width,
          height: height,
        }}
      >
        {/* Belt background */}
        <Rect
          x={screenX - width / 2}
          y={screenY - height / 2}
          width={width}
          height={height}
        >
          <LinearGradient
            start={vec(screenX - width / 2, screenY - height / 2)}
            end={vec(screenX - width / 2, screenY + height / 2)}
            colors={[COLORS.beltHighlight, COLORS.belt]}
          />
        </Rect>

        {/* Moving stripes */}
        {Array.from({ length: numStripes }).map((_, i) => {
          const stripeX =
            screenX -
            width / 2 -
            stripeSpacing +
            i * stripeSpacing +
            displayOffset;
          return (
            <Rect
              key={i}
              x={stripeX}
              y={screenY - height / 2}
              width={stripeWidth}
              height={height}
              color={COLORS.beltStripe}
              opacity={0.5}
            />
          );
        })}
      </Group>

      {/* Direction arrows */}
      <Group>
        {Array.from({ length: 3 }).map((_, i) => {
          const arrowX = screenX - width / 3 + (i * width) / 3;
          const arrowSize = 8 * scale;
          const arrowDirection = direction === "left" ? -1 : 1;

          return (
            <Group key={i}>
              {/* Arrow shape using lines */}
              <Line
                p1={vec(
                  arrowX - arrowSize * arrowDirection,
                  screenY - arrowSize / 2,
                )}
                p2={vec(arrowX, screenY)}
                color={isActive ? COLORS.arrowActive : COLORS.arrow}
                strokeWidth={3 * scale}
              />
              <Line
                p1={vec(arrowX, screenY)}
                p2={vec(
                  arrowX - arrowSize * arrowDirection,
                  screenY + arrowSize / 2,
                )}
                color={isActive ? COLORS.arrowActive : COLORS.arrow}
                strokeWidth={3 * scale}
              />
            </Group>
          );
        })}
      </Group>

      {/* Speed indicator */}
      {isActive && (
        <Group>
          {/* Speed bar background */}
          <RoundedRect
            x={screenX - 30 * scale}
            y={screenY + height / 2 + 8 * scale}
            width={60 * scale}
            height={6 * scale}
            r={3 * scale}
            color="rgba(0, 0, 0, 0.3)"
          />
          {/* Speed bar fill */}
          <RoundedRect
            x={screenX - 30 * scale}
            y={screenY + height / 2 + 8 * scale}
            width={60 * scale * Math.min(Math.abs(speed) / 5, 1)}
            height={6 * scale}
            r={3 * scale}
            color={COLORS.arrowActive}
          />
        </Group>
      )}

      {/* Active glow effect */}
      {isActive && (
        <RoundedRect
          x={screenX - width / 2}
          y={screenY - height / 2}
          width={width}
          height={height}
          r={2 * scale}
          color="transparent"
        >
          <Shadow dx={0} dy={0} blur={10} color="rgba(255, 200, 100, 0.3)" />
        </RoundedRect>
      )}
    </Group>
  );
};

export default ConveyorRenderer;
