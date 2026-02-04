/**
 * Bumper Renderer (Phase 2)
 * Renders bouncy bumper walls with visual feedback
 */

import { Group, Rect, RoundedRect, Shadow } from "@shopify/react-native-skia";
import React, { useEffect, useState } from "react";
import { SURFACE_MATERIALS } from "../data/constants";
import {
  BumperEntity,
  CameraEntity,
  SurfaceType,
} from "../types/cartCourse.types";

interface BumperRendererProps {
  bumper: BumperEntity;
  camera: CameraEntity;
  wasHit?: boolean; // For hit animation
}

export const BumperRenderer: React.FC<BumperRendererProps> = ({
  bumper,
  camera,
  wasHit = false,
}) => {
  const [pulseScale, setPulseScale] = useState(1);

  // Pulse animation when hit
  useEffect(() => {
    if (wasHit) {
      setPulseScale(1.2);
      const timeout = setTimeout(() => setPulseScale(1), 150);
      return () => clearTimeout(timeout);
    }
  }, [wasHit]);

  // Transform position relative to camera
  const screenX = bumper.position.x - camera.position.x;
  const screenY = bumper.position.y - camera.position.y;

  // Get bumper color
  const bumperMaterial = SURFACE_MATERIALS[SurfaceType.BOUNCY];
  const baseColor = bumperMaterial.color ?? "#FF6B6B";

  // Calculate scaled dimensions
  const scaledWidth = bumper.size.width * pulseScale;
  const scaledHeight = bumper.size.height * pulseScale;

  // Rotation transform
  const rotationRad = (bumper.rotation * Math.PI) / 180;

  return (
    <Group
      transform={[
        { translateX: screenX },
        { translateY: screenY },
        { rotate: rotationRad },
        { scale: camera.zoom },
      ]}
      origin={{ x: 0, y: 0 }}
    >
      {/* Glow effect */}
      <RoundedRect
        x={-scaledWidth / 2 - 2}
        y={-scaledHeight / 2 - 2}
        width={scaledWidth + 4}
        height={scaledHeight + 4}
        r={6}
        color={wasHit ? "#FFFF00" : baseColor}
        opacity={wasHit ? 0.6 : 0.3}
      >
        <Shadow dx={0} dy={0} blur={8} color={baseColor} />
      </RoundedRect>

      {/* Main bumper body */}
      <RoundedRect
        x={-scaledWidth / 2}
        y={-scaledHeight / 2}
        width={scaledWidth}
        height={scaledHeight}
        r={4}
        color={baseColor}
      />

      {/* Highlight stripe */}
      <RoundedRect
        x={-scaledWidth / 2 + 2}
        y={-scaledHeight / 2 + 2}
        width={scaledWidth - 4}
        height={4}
        r={2}
        color="#FFFFFF"
        opacity={0.5}
      />

      {/* Center indicator */}
      <Rect
        x={-2}
        y={-scaledHeight / 4}
        width={4}
        height={scaledHeight / 2}
        color="#FFFFFF"
        opacity={0.7}
      />
    </Group>
  );
};

export default BumperRenderer;
