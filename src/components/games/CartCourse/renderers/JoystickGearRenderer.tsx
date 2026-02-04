/**
 * Joystick Gear Renderer (Phase 3)
 * Skia renderer for joystick-controlled gear mechanisms
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
import { VISUAL_CONFIG } from "../data/constants";
import { JoystickGearMechanism, Vector2D } from "../types/cartCourse.types";

// ============================================
// Props Interface
// ============================================

interface JoystickGearRendererProps {
  mechanism: JoystickGearMechanism;
  cameraOffset: Vector2D;
  scale?: number;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Creates a gear teeth path for visual effect
 */
function createGearTeethPath(
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  teeth: number,
): string {
  const anglePerTooth = (2 * Math.PI) / teeth;
  const toothWidth = 0.4; // Tooth width as fraction of tooth angle

  let pathData = "";

  for (let i = 0; i < teeth; i++) {
    const baseAngle = i * anglePerTooth;
    const innerStart = baseAngle;
    const outerStart = baseAngle + anglePerTooth * (0.5 - toothWidth / 2);
    const outerEnd = baseAngle + anglePerTooth * (0.5 + toothWidth / 2);
    const innerEnd = baseAngle + anglePerTooth;

    const p1x = centerX + innerRadius * Math.cos(innerStart);
    const p1y = centerY + innerRadius * Math.sin(innerStart);
    const p2x = centerX + outerRadius * Math.cos(outerStart);
    const p2y = centerY + outerRadius * Math.sin(outerStart);
    const p3x = centerX + outerRadius * Math.cos(outerEnd);
    const p3y = centerY + outerRadius * Math.sin(outerEnd);
    const p4x = centerX + innerRadius * Math.cos(innerEnd);
    const p4y = centerY + innerRadius * Math.sin(innerEnd);

    if (i === 0) {
      pathData += `M ${p1x} ${p1y} `;
    }
    pathData += `L ${p2x} ${p2y} L ${p3x} ${p3y} L ${p4x} ${p4y} `;
  }

  pathData += "Z";
  return pathData;
}

// ============================================
// Joystick Gear Renderer
// ============================================

export const JoystickGearRenderer: React.FC<JoystickGearRendererProps> = ({
  mechanism,
  cameraOffset,
  scale = 1,
}) => {
  const { position, currentAngle, attachedPlatform, armLength } = mechanism;
  const gearRadius = 25 * scale; // Default gear radius
  const platformWidth = attachedPlatform ? 100 * scale : 0;
  const platformHeight = 12 * scale;

  // Calculate screen position relative to camera
  const screenX = (position.x - cameraOffset.x) * scale;
  const screenY = (position.y - cameraOffset.y) * scale;

  // Calculate rotation in radians
  const angleRadians = (currentAngle * Math.PI) / 180;

  // Calculate platform end position
  const platformEndX = screenX + Math.cos(angleRadians) * armLength * scale;
  const platformEndY = screenY + Math.sin(angleRadians) * armLength * scale;

  // Create gear teeth path
  const gearPath = createGearTeethPath(
    screenX,
    screenY,
    gearRadius * 0.7,
    gearRadius,
    10,
  );

  // Colors based on state - joystick gears have different color scheme
  const isActive = mechanism.state === "active";
  const gearColor = isActive ? "#a29bfe" : "#636e72";
  const armColor = isActive ? "#dfe6e9" : "#b2bec3";
  const platformColor = isActive ? "#81ecec" : VISUAL_CONFIG.colors.platforms;
  const highlightColor = isActive
    ? "rgba(255, 255, 255, 0.5)"
    : "rgba(255, 255, 255, 0.3)";

  // Determine control type label
  const controlLabel = mechanism.type.includes("LEFT") ? "L" : "R";

  // Create rotation transform for the entire gear assembly
  const gearTransform = [{ rotate: angleRadians }];

  return (
    <Group>
      {/* Gear body with teeth */}
      <Group origin={vec(screenX, screenY)} transform={gearTransform}>
        {/* Gear teeth */}
        <Path
          path={Skia.Path.MakeFromSVGString(gearPath) || Skia.Path.Make()}
          color={gearColor}
          style="fill"
        />

        {/* Gear center circle */}
        <Circle
          cx={screenX}
          cy={screenY}
          r={gearRadius * 0.5}
          color={gearColor}
        />

        {/* Gear center highlight */}
        <Circle
          cx={screenX - gearRadius * 0.15}
          cy={screenY - gearRadius * 0.15}
          r={gearRadius * 0.2}
          color={highlightColor}
        />
      </Group>

      {/* Arm connecting gear to platform */}
      <Line
        p1={vec(screenX, screenY)}
        p2={vec(platformEndX, platformEndY)}
        color={armColor}
        strokeWidth={6}
        style="stroke"
        strokeCap="round"
      />

      {/* Platform at end of arm */}
      {attachedPlatform && (
        <Group
          origin={vec(platformEndX, platformEndY)}
          transform={[{ rotate: angleRadians }]}
        >
          {/* Platform body */}
          <Rect
            x={platformEndX - platformWidth / 2}
            y={platformEndY - platformHeight / 2}
            width={platformWidth}
            height={platformHeight}
            color={platformColor}
          />

          {/* Platform highlight */}
          <Rect
            x={platformEndX - platformWidth / 2}
            y={platformEndY - platformHeight / 2}
            width={platformWidth}
            height={3}
            color={highlightColor}
          />
        </Group>
      )}

      {/* Joystick indicator (shows which joystick controls this) */}
      <Circle
        cx={screenX}
        cy={screenY - gearRadius - 10}
        r={5}
        color={controlLabel === "L" ? "#e17055" : "#0984e3"}
      />

      {/* Angle indicator line (subtle) */}
      <Line
        p1={vec(screenX, screenY)}
        p2={vec(
          screenX + Math.cos(angleRadians) * (gearRadius + 5),
          screenY + Math.sin(angleRadians) * (gearRadius + 5),
        )}
        color="rgba(255, 255, 255, 0.5)"
        strokeWidth={2}
        style="stroke"
        strokeCap="round"
      />
    </Group>
  );
};

export default JoystickGearRenderer;
