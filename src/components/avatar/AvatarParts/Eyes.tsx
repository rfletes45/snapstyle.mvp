/**
 * Eyes SVG Component
 *
 * Renders eyes with customizable style, color, size, spacing, and tilt.
 * Includes optional eyebrows and eyelashes rendering with blink animation support.
 */

import {
  getEyeColor,
  getEyeStyle,
  getEyebrowStyle,
  getEyelashStyle,
} from "@/data/avatarAssets/eyeStyles";
import type {
  EyeColorId,
  EyeStyleId,
  EyebrowStyleId,
  EyelashStyleId,
  HairColorId,
} from "@/types/avatar";
import React, { memo, useMemo } from "react";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedProps } from "react-native-reanimated";
import {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

// Create animated versions of SVG components
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedG = Animated.createAnimatedComponent(G);

interface EyesSvgProps {
  /** Eye style ID */
  style: EyeStyleId;
  /** Eye color ID */
  color: EyeColorId;
  /** Size scale factor (0.8 - 1.2) */
  size?: number;
  /** Spacing factor (0.8 = closer, 1.2 = further apart) */
  spacing?: number;
  /** Tilt in degrees (-10 to 10) */
  tilt?: number;
  /** Whether to render eyebrows */
  showEyebrows?: boolean;
  /** Eyebrow style ID */
  eyebrowStyle?: EyebrowStyleId;
  /** Eyebrow color */
  eyebrowColor?: HairColorId;
  /** Eyebrow thickness scale */
  eyebrowThickness?: number;
  /** Whether to render eyelashes */
  showEyelashes?: boolean;
  /** Eyelash style ID */
  eyelashStyle?: EyelashStyleId;
  /** Eyelash color (defaults to black) */
  eyelashColor?: string;
  /** Blink animation value (0 = open, 1 = closed) from useBlinkAnimation */
  blinkValue?: SharedValue<number>;
  /** Unique ID prefix for gradients */
  gradientId?: string;
}

// Base positions for eyes (in 200x300 viewBox, head-only mode uses 200x150)
const LEFT_EYE_CENTER = { x: 70, y: 85 };
const RIGHT_EYE_CENTER = { x: 130, y: 85 };
const EYE_BASE_SCALE = 1.2; // Base scale multiplier

// Hair color to actual color mapping (simplified for eyebrows)
const HAIR_COLOR_MAP: Record<string, string> = {
  black: "#1A1A1A",
  dark_brown: "#3D2314",
  medium_brown: "#6B4423",
  light_brown: "#A67B5B",
  auburn: "#922724",
  chestnut: "#6F4E37",
  copper: "#B87333",
  strawberry_blonde: "#C67B47",
  golden_blonde: "#E6BE8A",
  platinum_blonde: "#E8E4C9",
  dirty_blonde: "#B8A078",
  gray_dark: "#505050",
  gray_light: "#808080",
  silver: "#C0C0C0",
  white: "#F5F5F5",
  fantasy_blue: "#4A90D9",
  fantasy_purple: "#8B5CF6",
  fantasy_pink: "#EC4899",
  fantasy_green: "#22C55E",
  fantasy_red: "#EF4444",
};

/**
 * Eyes SVG Component
 */
function EyesSvgBase({
  style,
  color,
  size = 1.0,
  spacing = 1.0,
  tilt = 0,
  showEyebrows = true,
  eyebrowStyle = "brow_natural",
  eyebrowColor = "dark_brown",
  eyebrowThickness = 1.0,
  showEyelashes = false,
  eyelashStyle = "none",
  eyelashColor = "#1A1A1A",
  blinkValue,
  gradientId = "eyes",
}: EyesSvgProps) {
  const eyeStyleData = getEyeStyle(style);
  const eyeColorData = getEyeColor(color);
  const eyebrowStyleData = getEyebrowStyle(eyebrowStyle);
  const eyelashStyleData = getEyelashStyle(eyelashStyle);

  // Calculate adjusted positions based on spacing
  const spacingOffset = (spacing - 1) * 20;
  const leftEye = useMemo(
    () => ({ x: LEFT_EYE_CENTER.x - spacingOffset, y: LEFT_EYE_CENTER.y }),
    [spacingOffset],
  );
  const rightEye = useMemo(
    () => ({ x: RIGHT_EYE_CENTER.x + spacingOffset, y: RIGHT_EYE_CENTER.y }),
    [spacingOffset],
  );

  // Scale factors
  const scale = EYE_BASE_SCALE * size;
  const irisRadius = eyeStyleData.irisSize * scale * 0.5;
  const pupilRadius = eyeStyleData.pupilSize * scale * 0.5;

  // Eyebrow color
  const browColor = HAIR_COLOR_MAP[eyebrowColor] || "#3D2314";

  // Combined thickness from style data and user preference
  const combinedBrowThickness =
    eyebrowStyleData.thickness * eyebrowThickness * 2.5;

  // Animated props for blink (eyelid cover)
  const animatedEyelidProps = useAnimatedProps(() => {
    if (!blinkValue) return { height: 0, y: -10 };
    // When blinkValue is 0, height is 0 (eyes open)
    // When blinkValue is 1, height covers the eye (eyes closed)
    const closedHeight = 18 * scale;
    return {
      height: blinkValue.value * closedHeight,
      y: -10 - (1 - blinkValue.value) * 2,
    };
  });

  const renderEye = (center: { x: number; y: number }, isLeft: boolean) => {
    const eyeTilt = isLeft ? -tilt : tilt;
    const mirrorScale = isLeft ? 1 : -1;

    return (
      <G
        key={isLeft ? "left-eye" : "right-eye"}
        transform={`translate(${center.x}, ${center.y}) rotate(${eyeTilt}) scale(${scale * mirrorScale}, ${scale})`}
      >
        {/* Sclera (white of eye) */}
        <Ellipse
          cx={0}
          cy={0}
          rx={12}
          ry={8}
          fill="#FFFFFF"
          stroke="#E0E0E0"
          strokeWidth={0.3}
        />

        {/* Iris with gradient */}
        <Circle
          cx={0}
          cy={0}
          r={irisRadius}
          fill={`url(#${gradientId}-iris)`}
        />

        {/* Pupil */}
        <Circle cx={0} cy={0} r={pupilRadius} fill={eyeColorData.pupilColor} />

        {/* Highlight/reflection */}
        <Circle
          cx={-irisRadius * 0.35}
          cy={-irisRadius * 0.35}
          r={pupilRadius * 0.4}
          fill={eyeColorData.highlight}
          opacity={0.85}
        />

        {/* Small secondary highlight */}
        <Circle
          cx={irisRadius * 0.25}
          cy={irisRadius * 0.2}
          r={pupilRadius * 0.2}
          fill={eyeColorData.highlight}
          opacity={0.5}
        />

        {/* Upper eyelid line */}
        <Path
          d="M-12,-3 Q0,-10 12,-3"
          stroke="#8B7355"
          strokeWidth={0.8}
          fill="none"
        />

        {/* Eyelashes (if enabled) */}
        {showEyelashes && eyelashStyleData.svgPath && (
          <Path
            d={eyelashStyleData.svgPath}
            stroke={eyelashColor}
            strokeWidth={0.5 * eyelashStyleData.density}
            strokeLinecap="round"
            fill="none"
            transform="translate(0, -6)"
          />
        )}

        {/* Animated eyelid for blink */}
        {blinkValue && (
          <G>
            <Defs>
              {/* Clip path for eyelid - use skin tone or default */}
              <LinearGradient
                id={`${gradientId}-eyelid-${isLeft ? "left" : "right"}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <Stop offset="0%" stopColor="#E8C9A0" />
                <Stop offset="100%" stopColor="#D4B896" />
              </LinearGradient>
            </Defs>
            <AnimatedRect
              x={-13}
              rx={2}
              width={26}
              fill={`url(#${gradientId}-eyelid-${isLeft ? "left" : "right"})`}
              animatedProps={animatedEyelidProps}
            />
          </G>
        )}
      </G>
    );
  };

  const renderEyebrow = (center: { x: number; y: number }, isLeft: boolean) => {
    const browTilt = isLeft ? -tilt * 0.5 : tilt * 0.5;
    const mirrorScale = isLeft ? 1 : -1;
    const yOffset = -18 * size; // Position above eye

    return (
      <G
        key={isLeft ? "left-brow" : "right-brow"}
        transform={`translate(${center.x}, ${center.y + yOffset}) rotate(${browTilt}) scale(${mirrorScale * size}, ${size})`}
      >
        <Path
          d={eyebrowStyleData.svgPath}
          stroke={browColor}
          strokeWidth={combinedBrowThickness}
          strokeLinecap="round"
          fill="none"
        />
      </G>
    );
  };

  return (
    <G id="eyes-layer">
      {/* Gradient definitions */}
      <Defs>
        <LinearGradient id={`${gradientId}-iris`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={eyeColorData.irisColors.outer} />
          <Stop offset="50%" stopColor={eyeColorData.irisColors.middle} />
          <Stop offset="100%" stopColor={eyeColorData.irisColors.inner} />
        </LinearGradient>
      </Defs>

      {/* Eyebrows (rendered first, behind eyes) */}
      {showEyebrows && (
        <G id="eyebrows">
          {renderEyebrow(leftEye, true)}
          {renderEyebrow(rightEye, false)}
        </G>
      )}

      {/* Eyes */}
      <G id="eyes">
        {renderEye(leftEye, true)}
        {renderEye(rightEye, false)}
      </G>
    </G>
  );
}

export const EyesSvg = memo(EyesSvgBase);
