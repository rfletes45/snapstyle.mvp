/**
 * Platform Renderer (Phase 2 Enhanced)
 * Renders platforms using Skia with surface-specific colors
 */

import { Group, Line, Rect, vec } from "@shopify/react-native-skia";
import React from "react";
import { SURFACE_MATERIALS, VISUAL_CONFIG } from "../data/constants";
import { PlatformEntity, SurfaceType } from "../types/cartCourse.types";

// ============================================
// Platform Renderer Props
// ============================================

interface PlatformRendererProps {
  platform: PlatformEntity;
}

// ============================================
// Get Surface Color
// ============================================

function getSurfaceColor(surfaceType: SurfaceType): string {
  return (
    SURFACE_MATERIALS[surfaceType]?.color ?? VISUAL_CONFIG.colors.platforms
  );
}

// ============================================
// Get Surface Pattern
// ============================================

function getSurfacePattern(
  surfaceType: SurfaceType,
): "solid" | "striped" | "dotted" | "crosshatch" {
  switch (surfaceType) {
    case SurfaceType.SLIPPERY:
      return "striped"; // Ice stripes
    case SurfaceType.STICKY:
      return "dotted"; // Tar dots
    case SurfaceType.ROUGH:
      return "crosshatch"; // Gravel texture
    case SurfaceType.METAL:
      return "striped"; // Metal grating
    default:
      return "solid";
  }
}

// ============================================
// Platform Renderer Component
// ============================================

export const PlatformRenderer: React.FC<PlatformRendererProps> = ({
  platform,
}) => {
  if (!platform || !platform.body) {
    return null;
  }

  const { body, size, surfaceType = SurfaceType.NORMAL } = platform;
  const { colors } = VISUAL_CONFIG;

  // Get position and angle from physics body
  const x = body.position.x;
  const y = body.position.y;
  const angle = body.angle;
  const { width, height } = size;

  // Get surface-specific visuals
  const surfaceColor = getSurfaceColor(surfaceType);
  const pattern = getSurfacePattern(surfaceType);

  return (
    <Group
      transform={[{ translateX: x }, { translateY: y }, { rotate: angle }]}
    >
      {/* Main platform body */}
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        color={surfaceColor}
      />

      {/* Surface-specific patterns */}
      {pattern === "striped" && (
        <>
          {Array.from({ length: Math.floor(width / 12) }).map((_, i) => (
            <Rect
              key={`stripe-${i}`}
              x={-width / 2 + i * 12 + 4}
              y={-height / 2}
              width={4}
              height={height}
              color={
                surfaceType === SurfaceType.SLIPPERY
                  ? "#FFFFFF"
                  : colors.girders
              }
              opacity={0.3}
            />
          ))}
        </>
      )}

      {pattern === "dotted" && (
        <>
          {Array.from({ length: Math.floor(width / 16) }).map((_, i) =>
            Array.from({ length: Math.floor(height / 10) }).map((_, j) => (
              <Rect
                key={`dot-${i}-${j}`}
                x={-width / 2 + i * 16 + 6}
                y={-height / 2 + j * 10 + 3}
                width={4}
                height={4}
                color="#000000"
                opacity={0.4}
              />
            )),
          )}
        </>
      )}

      {/* Top surface highlight */}
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={4}
        color={
          surfaceType === SurfaceType.SLIPPERY ? "#FFFFFF" : colors.girders
        }
        opacity={surfaceType === SurfaceType.SLIPPERY ? 0.6 : 1}
      />

      {/* Left edge detail */}
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={3}
        height={height}
        color={colors.girders}
      />

      {/* Right edge detail */}
      <Rect
        x={width / 2 - 3}
        y={-height / 2}
        width={3}
        height={height}
        color={colors.girders}
      />

      {/* Cross-hatch pattern for girder effect */}
      {width > 60 && pattern !== "striped" && pattern !== "dotted" && (
        <>
          <Line
            p1={vec(-width / 2 + 10, -height / 2 + 8)}
            p2={vec(-width / 2 + 10, height / 2 - 4)}
            color={colors.girders}
            strokeWidth={2}
          />
          <Line
            p1={vec(width / 2 - 10, -height / 2 + 8)}
            p2={vec(width / 2 - 10, height / 2 - 4)}
            color={colors.girders}
            strokeWidth={2}
          />
        </>
      )}
    </Group>
  );
};

// ============================================
// Ground Platform Renderer (special styling)
// ============================================

interface GroundRendererProps {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const GroundRenderer: React.FC<GroundRendererProps> = ({
  x,
  y,
  width,
  height,
}) => {
  const { colors } = VISUAL_CONFIG;

  return (
    <Group>
      {/* Main ground */}
      <Rect
        x={x - width / 2}
        y={y - height / 2}
        width={width}
        height={height}
        color={colors.platforms}
      />

      {/* Top surface */}
      <Rect
        x={x - width / 2}
        y={y - height / 2}
        width={width}
        height={6}
        color={colors.girders}
      />

      {/* Stripes pattern */}
      {Array.from({ length: Math.floor(width / 40) }).map((_, i) => (
        <Line
          key={`ground-stripe-${i}`}
          p1={vec(x - width / 2 + 20 + i * 40, y - height / 2 + 8)}
          p2={vec(x - width / 2 + 20 + i * 40, y + height / 2)}
          color={colors.girders}
          strokeWidth={2}
        />
      ))}
    </Group>
  );
};
