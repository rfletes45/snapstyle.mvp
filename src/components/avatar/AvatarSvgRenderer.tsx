/**
 * Avatar SVG Renderer
 *
 * Core rendering engine for digital avatars.
 * Composes all avatar parts into a layered SVG.
 * Supports blink and idle animations.
 */

import type { DigitalAvatarConfig } from "@/types/avatar";
import React, { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

// Import avatar part components
import { BodySvg, NeckSvg } from "./AvatarParts/Body";
import { FullClothingSvg } from "./AvatarParts/Clothing";
import { EarsSvg } from "./AvatarParts/Ears";
import { EarwearSvg } from "./AvatarParts/Earwear";
import { EyesSvg } from "./AvatarParts/Eyes";
import { EyewearSvg } from "./AvatarParts/Eyewear";
import { FacialHairSvg } from "./AvatarParts/FacialHair";
import { HairBackSvg, HairFrontSvg } from "./AvatarParts/Hair";
import { HeadSvg } from "./AvatarParts/Head";
import {
  HeadwearSvg,
  getHeadwearHairInteraction,
} from "./AvatarParts/Headwear";
import { MouthSvg } from "./AvatarParts/Mouth";
import { NeckwearSvg } from "./AvatarParts/Neckwear";
import { NoseSvg } from "./AvatarParts/Nose";
import { WristwearSvg } from "./AvatarParts/Wristwear";

// Import animations
import { IdleAnimation, useBlinkAnimation } from "./animations";

// Import data utilities
import { getBodyShapeSafe } from "@/data/avatarAssets/bodyShapes";
import { getFaceShape } from "@/data/avatarAssets/faceShapes";
import { getHairStyleSafe } from "@/data/avatarAssets/hairStyles";
import { getSkinToneColors } from "@/data/avatarAssets/skinTones";

interface AvatarSvgRendererProps {
  /** Complete avatar configuration */
  config: DigitalAvatarConfig;
  /** Size in pixels (width = size, height calculated from aspect ratio) */
  size: number;
  /** Show full body or head only */
  showBody?: boolean;
  /** Enable animations (idle, blink, etc.) */
  animated?: boolean;
  /** Enable blink animation specifically */
  enableBlink?: boolean;
  /** Enable idle animation specifically */
  enableIdle?: boolean;
  /** Idle animation intensity (0-1) */
  idleIntensity?: number;
  /** Background color (transparent by default) */
  backgroundColor?: string;
  /** Callback when render completes */
  onRender?: () => void;
}

// ViewBox dimensions
const VIEWBOX_WIDTH = 200;
const VIEWBOX_HEIGHT_HEAD = 200; // Head-only mode
const VIEWBOX_HEIGHT_FULL = 300; // Full body mode

/**
 * Avatar SVG Renderer Component
 *
 * Renders a complete digital avatar using SVG.
 * Supports head-only and full-body modes.
 * Includes optional blink and idle animations.
 */
function AvatarSvgRendererBase({
  config,
  size,
  showBody = false,
  animated = false,
  enableBlink,
  enableIdle,
  idleIntensity = 0.5,
  backgroundColor = "transparent",
}: AvatarSvgRendererProps) {
  // Derive animation flags from animated prop if not explicitly set
  const shouldBlink = enableBlink ?? animated;
  const shouldIdle = enableIdle ?? animated;

  // Use blink animation hook
  const { blinkValue } = useBlinkAnimation({
    enabled: shouldBlink,
    blinkInterval: 4000,
    intervalVariation: 2000,
    blinkDuration: 150,
  });
  // Calculate dimensions
  const viewboxHeight = showBody ? VIEWBOX_HEIGHT_FULL : VIEWBOX_HEIGHT_HEAD;
  const aspectRatio = VIEWBOX_WIDTH / viewboxHeight;
  const height = size / aspectRatio;

  // Memoize skin colors
  const skinColors = useMemo(
    () => getSkinToneColors(config.body.skinTone),
    [config.body.skinTone],
  );

  // Memoize face shape for clipping
  const faceShape = useMemo(
    () => getFaceShape(config.face.shape),
    [config.face.shape],
  );

  // Memoize body shape for body rendering
  const bodyShape = useMemo(
    () => getBodyShapeSafe(config.body.shape),
    [config.body.shape],
  );

  // Memoize hair style to determine ear visibility
  const hairStyle = useMemo(
    () => getHairStyleSafe(config.hair.style),
    [config.hair.style],
  );

  // Determine if ears should be hidden by hair
  const showEars = useMemo(() => {
    return config.ears.visible && !hairStyle.coversEars;
  }, [config.ears.visible, hairStyle.coversEars]);

  // Check if wearing headwear that might affect hair rendering
  const wearingHat = !!config.accessories.headwear;

  // Determine how headwear interacts with hair
  const headwearHairInteraction = useMemo(() => {
    if (!config.accessories.headwear) return "none";
    return getHeadwearHairInteraction(config.accessories.headwear);
  }, [config.accessories.headwear]);

  // Should hair be hidden completely by headwear?
  const hideHairForHeadwear = headwearHairInteraction === "hide";

  // Generate unique ID for this avatar instance (for gradient/clip references)
  const instanceId = useMemo(
    () => `avatar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    [],
  );

  return (
    <View style={[styles.container, { width: size, height }]}>
      <IdleAnimation enabled={shouldIdle} intensity={idleIntensity}>
        <Svg
          width={size}
          height={height}
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${viewboxHeight}`}
        >
          {/* ═══════════════════════════════════════════════════════════════════
            DEFINITIONS (Gradients, Clips, etc.)
            ═══════════════════════════════════════════════════════════════════ */}
          <Defs>
            {/* Background gradient (optional) */}
            <LinearGradient id={`${instanceId}-bg`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={backgroundColor} />
              <Stop offset="100%" stopColor={backgroundColor} />
            </LinearGradient>

            {/* Skin gradient for shared use */}
            <LinearGradient
              id={`${instanceId}-skin`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <Stop offset="0%" stopColor={skinColors.highlight} />
              <Stop offset="50%" stopColor={skinColors.base} />
              <Stop offset="100%" stopColor={skinColors.shadow} />
            </LinearGradient>

            {/* Face clip path for features */}
            <ClipPath id={`${instanceId}-face-clip`}>
              <Path d={faceShape.svgPath} />
            </ClipPath>
          </Defs>

          {/* ═══════════════════════════════════════════════════════════════════
            LAYER 0: Background
            ═══════════════════════════════════════════════════════════════════ */}
          {backgroundColor !== "transparent" && (
            <Rect
              x="0"
              y="0"
              width={VIEWBOX_WIDTH}
              height={viewboxHeight}
              fill={backgroundColor}
            />
          )}

          {/* ═══════════════════════════════════════════════════════════════════
            LAYER 1: Body (if showing full body)
            ═══════════════════════════════════════════════════════════════════ */}
          {showBody && (
            <G id="body-layer">
              {/* Render body shape with skin tone */}
              <BodySvg
                shape={config.body.shape}
                skinTone={config.body.skinTone}
                height={config.body.height}
                gradientId={`${instanceId}-body`}
              />
            </G>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
            LAYER 1.5: Clothing (if showing full body)
            ═══════════════════════════════════════════════════════════════════ */}
          {showBody && (
            <G id="clothing-layer">
              <FullClothingSvg
                topId={config.clothing.top}
                bottomId={config.clothing.bottom}
                outfitId={config.clothing.outfit}
                topColor={config.clothing.topColor}
                bottomColor={config.clothing.bottomColor}
                outfitColor={config.clothing.outfitColor}
              />
            </G>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
            LAYER 2: Neck
            ═══════════════════════════════════════════════════════════════════ */}
          <G id="neck-layer">
            <NeckSvg
              skinTone={config.body.skinTone}
              gradientId={`${instanceId}-neck`}
            />
          </G>

          {/* ═══════════════════════════════════════════════════════════════════
            LAYER 3: Hair Back (behind head - ponytails, back of hair)
            ═══════════════════════════════════════════════════════════════════ */}
          {!hideHairForHeadwear && (
            <HairBackSvg
              style={config.hair.style}
              color={config.hair.color}
              highlightColor={config.hair.highlightColor}
              wearingHat={wearingHat}
              gradientId={`${instanceId}-hair-back`}
            />
          )}

          {/* ═══════════════════════════════════════════════════════════════════
            LAYER 4: Ears (behind head for most styles, hidden by some hair)
            ═══════════════════════════════════════════════════════════════════ */}
          <EarsSvg
            style={config.ears.style}
            size={config.ears.size}
            skinTone={config.body.skinTone}
            visible={showEars}
          />

          {/* ═══════════════════════════════════════════════════════════════════
            LAYER 4.5: Earwear (on ears, before head)
            ═══════════════════════════════════════════════════════════════════ */}
          {config.accessories.earwear && (
            <G id="earwear-back-layer">
              <EarwearSvg
                itemId={config.accessories.earwear}
                customColor={config.accessories.earwearColor}
                gradientId={`${instanceId}-earwear`}
              />
            </G>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
            LAYER 5: Head/Face Shape
            ═══════════════════════════════════════════════════════════════════ */}
          <HeadSvg
            shape={config.face.shape}
            width={config.face.width}
            skinTone={config.body.skinTone}
            gradientId={`${instanceId}-head`}
          />

          {/* ═══════════════════════════════════════════════════════════════════
            LAYER 6: Facial Features
            ═══════════════════════════════════════════════════════════════════ */}
          <G id="features-layer">
            {/* Eyes with eyebrows, eyelashes, and blink animation */}
            <EyesSvg
              style={config.eyes.style}
              color={config.eyes.color}
              size={config.eyes.size}
              spacing={config.eyes.spacing}
              tilt={config.eyes.tilt}
              showEyebrows={true}
              eyebrowStyle={config.eyes.eyebrows.style}
              eyebrowColor={config.eyes.eyebrows.color}
              eyebrowThickness={config.eyes.eyebrows.thickness}
              showEyelashes={config.eyes.eyelashes?.enabled ?? false}
              eyelashStyle={config.eyes.eyelashes?.style ?? "none"}
              eyelashColor={config.eyes.eyelashes?.color ?? "#1A1A1A"}
              blinkValue={shouldBlink ? blinkValue : undefined}
              gradientId={`${instanceId}-eyes`}
            />

            {/* Nose */}
            <NoseSvg
              style={config.nose.style}
              size={config.nose.size}
              skinTone={config.body.skinTone}
            />

            {/* Mouth */}
            <MouthSvg
              style={config.mouth.style}
              size={config.mouth.size}
              lipColor={config.mouth.lipColor}
              lipThickness={config.mouth.lipThickness}
              gradientId={`${instanceId}-mouth`}
            />

            {/* Facial Hair (after mouth, part of face features) */}
            {config.hair.facialHair?.style !== "none" && (
              <FacialHairSvg
                style={config.hair.facialHair.style}
                color={config.hair.facialHair.color}
                gradientId={`${instanceId}-facial-hair`}
              />
            )}
          </G>

          {/* ═══════════════════════════════════════════════════════════════════
            LAYER 7: Hair Front (over face - bangs, front strands)
            ═══════════════════════════════════════════════════════════════════ */}
          {!hideHairForHeadwear && (
            <HairFrontSvg
              style={config.hair.style}
              color={config.hair.color}
              highlightColor={config.hair.highlightColor}
              wearingHat={wearingHat}
              gradientId={`${instanceId}-hair-front`}
            />
          )}

          {/* ═══════════════════════════════════════════════════════════════════
            LAYER 8: Eyewear (if equipped)
            ═══════════════════════════════════════════════════════════════════ */}
          {config.accessories.eyewear && (
            <G id="eyewear-layer">
              <EyewearSvg
                itemId={config.accessories.eyewear}
                customFrameColor={config.accessories.eyewearColor}
                gradientId={`${instanceId}-eyewear`}
              />
            </G>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
            LAYER 9: Headwear (if equipped)
            ═══════════════════════════════════════════════════════════════════ */}
          {config.accessories.headwear && (
            <G id="headwear-layer">
              <HeadwearSvg
                itemId={config.accessories.headwear}
                customColor={config.accessories.headwearColor}
                hairVisible={!hideHairForHeadwear}
                gradientId={`${instanceId}-headwear`}
              />
            </G>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
            LAYER 10: Neckwear (if equipped and showing body)
            ═══════════════════════════════════════════════════════════════════ */}
          {showBody && config.accessories.neckwear && (
            <G id="neckwear-layer">
              <NeckwearSvg
                itemId={config.accessories.neckwear}
                customColor={config.accessories.neckwearColor}
                gradientId={`${instanceId}-neckwear`}
              />
            </G>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
            LAYER 11: Wristwear (if equipped and showing body)
            ═══════════════════════════════════════════════════════════════════ */}
          {showBody && config.accessories.wristwear && (
            <G id="wristwear-layer">
              <WristwearSvg
                itemId={config.accessories.wristwear}
                customBandColor={config.accessories.wristwearColor}
                gradientId={`${instanceId}-wristwear`}
              />
            </G>
          )}
        </Svg>
      </IdleAnimation>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});

export const AvatarSvgRenderer = memo(AvatarSvgRendererBase);
