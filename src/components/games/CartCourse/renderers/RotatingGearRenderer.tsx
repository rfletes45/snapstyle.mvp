/**
 * Rotating Gear Renderer (Phase 3)
 * Skia renderer for rotating gear mechanisms
 */

import {
  Circle,
  Group,
  Line,
  Path,
  Rect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import React from "react";
import { MECHANISM_CONFIG, VISUAL_CONFIG } from "../data/constants";
import { RotatingGearMechanism, Vector2D } from "../types/cartCourse.types";

// ============================================
// Props Interface
// ============================================

interface RotatingGearRendererProps {
  mechanism: RotatingGearMechanism;
  cameraOffset: Vector2D;
  scale?: number;
}

// ============================================
// Rotating Gear Renderer
// ============================================

export const RotatingGearRenderer: React.FC<RotatingGearRendererProps> = ({
  mechanism,
  cameraOffset,
  scale = 1,
}) => {
  const { position, currentAngle, armLength, attachedPlatform, body } =
    mechanism;
  const gearRadius = MECHANISM_CONFIG.rotatingGear.gearRadius * scale;
  const platformWidth = MECHANISM_CONFIG.rotatingGear.platformWidth * scale;
  const platformHeight = MECHANISM_CONFIG.rotatingGear.platformHeight * scale;

  // Calculate screen position relative to camera
  const screenX = (position.x - cameraOffset.x) * scale;
  const screenY = (position.y - cameraOffset.y) * scale;

  // Calculate platform position from angle
  const angleRad = (currentAngle * Math.PI) / 180;
  const platformX = screenX + Math.cos(angleRad) * armLength;
  const platformY = screenY + Math.sin(angleRad) * armLength;

  // Create gear teeth path
  const teethCount = 12;
  const teethPath = Skia.Path.Make();
  for (let i = 0; i < teethCount; i++) {
    const angle = (i / teethCount) * Math.PI * 2 + angleRad;
    const innerRadius = gearRadius - 3;
    const outerRadius = gearRadius + 5;

    const x1 = screenX + Math.cos(angle) * innerRadius;
    const y1 = screenY + Math.sin(angle) * innerRadius;
    const x2 = screenX + Math.cos(angle) * outerRadius;
    const y2 = screenY + Math.sin(angle) * outerRadius;

    teethPath.moveTo(x1, y1);
    teethPath.lineTo(x2, y2);
  }

  // Colors based on state
  const isActive = mechanism.state === "active";
  const gearColor = isActive ? "#fdcb6e" : VISUAL_CONFIG.colors.girders;
  const platformColor = VISUAL_CONFIG.colors.platforms;
  const armColor = "#7f8c8d";

  return (
    <Group>
      {/* Arm connecting gear to platform */}
      <Line
        p1={vec(screenX, screenY)}
        p2={vec(platformX, platformY)}
        color={armColor}
        strokeWidth={4}
        style="stroke"
      />

      {/* Gear body */}
      <Circle cx={screenX} cy={screenY} r={gearRadius} color={gearColor} />

      {/* Gear teeth */}
      <Path path={teethPath} color={gearColor} strokeWidth={3} style="stroke" />

      {/* Gear center */}
      <Circle cx={screenX} cy={screenY} r={5} color="#2c3e50" />

      {/* Platform */}
      <Group
        transform={[
          { translateX: platformX },
          { translateY: platformY },
          { rotate: angleRad },
          { translateX: -platformWidth / 2 },
          { translateY: -platformHeight / 2 },
        ]}
      >
        <Rect
          x={0}
          y={0}
          width={platformWidth}
          height={platformHeight}
          color={platformColor}
        />
        {/* Platform highlight */}
        <Rect
          x={0}
          y={0}
          width={platformWidth}
          height={3}
          color="rgba(255, 255, 255, 0.3)"
        />
      </Group>
    </Group>
  );
};

export default RotatingGearRenderer;
