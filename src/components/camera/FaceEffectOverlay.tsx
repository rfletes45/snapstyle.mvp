/**
 * FACE EFFECT OVERLAY (Skia-Powered)
 *
 * Renders 2D face-effect assets positioned on top of detected face landmarks.
 * Uses Skia Canvas for GPU-accelerated rendering that composites cleanly
 * over the VisionCamera preview.
 *
 * Each effect is drawn at the correct position, scale, and rotation based on:
 *   - The detected face's bounding box
 *   - Specific landmark positions (eyes, ears, nose, mouth)
 *   - The effect's configured landmarkOffsets and scale
 *   - The face's 3D Euler angles (head tilt/rotation)
 *
 * Falls back to React Native Image-based rendering if Skia is unavailable.
 */

import {
  FACE_EFFECTS_LIBRARY,
  getEffectPositioning,
  shouldRenderEffect,
} from "@/services/camera/faceDetectionService";
import type {
  DetectedFace,
  FaceEffect,
  FaceEffectConfig,
  Point,
} from "@/types/camera";
import React, { useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";

// ─── Skia imports (with graceful fallback) ────────────────────────────────────
let SkiaCanvas: any = null;
let SkiaImage: any = null;
let SkiaGroup: any = null;
let SkiaCircle: any = null;
let SkiaRoundedRect: any = null;
let SkiaPaint: any = null;
let SkiaFill: any = null;
let useSkiaImage: any = null;

try {
  const Skia = require("@shopify/react-native-skia");
  SkiaCanvas = Skia.Canvas;
  SkiaImage = Skia.Image;
  SkiaGroup = Skia.Group;
  SkiaCircle = Skia.Circle;
  SkiaRoundedRect = Skia.RoundedRect;
  SkiaPaint = Skia.Paint;
  SkiaFill = Skia.Fill;
  useSkiaImage = Skia.useImage;
} catch {
  // Skia unavailable — will use RN Image fallback
}

// ─── Asset map: effect ID → require() ─────────────────────────────────────────
// React Native requires static require() calls. We map each effect to a
// placeholder PNG. When real assets are created, swap these out.
const EFFECT_ASSETS: Partial<Record<FaceEffect, any>> = {};

// Try to load assets, but don't crash if they don't exist yet
try {
  // These will be loaded from assets/effects/ when they exist
  // For now we use Skia-drawn procedural shapes as placeholders
} catch {
  // Assets not yet created
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  /** Array of detected faces from useFaceDetection */
  faces: DetectedFace[];
  /** Currently selected face effect ID */
  selectedEffect: FaceEffect | null;
  /** Camera preview dimensions (to scale coordinates) */
  previewWidth: number;
  previewHeight: number;
  /** Whether the camera is mirrored (front-facing) */
  mirrored?: boolean;
}

// ─── Procedural Effect Renderers ──────────────────────────────────────────────
//
// Until real PNG assets are created, we render simple procedural shapes
// using Skia primitives. Each renderer draws a recognizable effect.

interface EffectRenderProps {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  face: DetectedFace;
  config: FaceEffectConfig;
}

/** Get center point between two landmarks */
function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Distance between two points */
function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Render a procedural face effect using Skia primitives.
 * Each effect produces recognizable visual elements.
 */
function renderProceduralEffect({
  x,
  y,
  width,
  height,
  rotation,
  face,
  config,
}: EffectRenderProps): React.ReactNode {
  if (!SkiaCanvas || !SkiaCircle || !SkiaGroup) return null;

  const { landmarks } = face;
  const eyeDist = distance(landmarks.leftEye, landmarks.rightEye);
  const eyeSize = eyeDist * 0.25;

  switch (config.id) {
    // ─── Dog Filter: ears + nose ─────────────────────────────────────
    case "dog_filter": {
      const earSize = eyeDist * 0.6;
      return (
        <SkiaGroup
          key="dog"
          transform={[{ rotate: (rotation * Math.PI) / 180 }]}
        >
          {/* Left ear */}
          <SkiaCircle
            cx={landmarks.leftEar.x - 5}
            cy={landmarks.leftEar.y - earSize}
            r={earSize}
            color="rgba(139, 90, 43, 0.85)"
          />
          <SkiaCircle
            cx={landmarks.leftEar.x - 5}
            cy={landmarks.leftEar.y - earSize}
            r={earSize * 0.6}
            color="rgba(205, 160, 110, 0.9)"
          />
          {/* Right ear */}
          <SkiaCircle
            cx={landmarks.rightEar.x + 5}
            cy={landmarks.rightEar.y - earSize}
            r={earSize}
            color="rgba(139, 90, 43, 0.85)"
          />
          <SkiaCircle
            cx={landmarks.rightEar.x + 5}
            cy={landmarks.rightEar.y - earSize}
            r={earSize * 0.6}
            color="rgba(205, 160, 110, 0.9)"
          />
          {/* Nose */}
          <SkiaCircle
            cx={landmarks.noseBase.x}
            cy={landmarks.noseBase.y + 5}
            r={eyeSize * 1.2}
            color="rgba(30, 30, 30, 0.9)"
          />
        </SkiaGroup>
      );
    }

    // ─── Cat Filter: pointed ears + whiskers approximation ───────────
    case "cat_filter": {
      const earSize = eyeDist * 0.5;
      return (
        <SkiaGroup
          key="cat"
          transform={[{ rotate: (rotation * Math.PI) / 180 }]}
        >
          {/* Left ear (two overlapping circles for pointed look) */}
          <SkiaCircle
            cx={landmarks.leftEar.x - 10}
            cy={landmarks.leftEar.y - earSize * 1.2}
            r={earSize * 0.8}
            color="rgba(80, 80, 80, 0.85)"
          />
          <SkiaCircle
            cx={landmarks.leftEar.x - 10}
            cy={landmarks.leftEar.y - earSize * 1.2}
            r={earSize * 0.45}
            color="rgba(255, 182, 193, 0.9)"
          />
          {/* Right ear */}
          <SkiaCircle
            cx={landmarks.rightEar.x + 10}
            cy={landmarks.rightEar.y - earSize * 1.2}
            r={earSize * 0.8}
            color="rgba(80, 80, 80, 0.85)"
          />
          <SkiaCircle
            cx={landmarks.rightEar.x + 10}
            cy={landmarks.rightEar.y - earSize * 1.2}
            r={earSize * 0.45}
            color="rgba(255, 182, 193, 0.9)"
          />
          {/* Nose dot */}
          <SkiaCircle
            cx={landmarks.noseBase.x}
            cy={landmarks.noseBase.y}
            r={eyeSize * 0.6}
            color="rgba(255, 140, 160, 0.9)"
          />
        </SkiaGroup>
      );
    }

    // ─── Heart Eyes ──────────────────────────────────────────────────
    case "heart_eyes": {
      const heartSize = eyeSize * 1.8;
      return (
        <SkiaGroup
          key="hearts"
          transform={[{ rotate: (rotation * Math.PI) / 180 }]}
        >
          {/* Left heart (two overlapping circles) */}
          <SkiaCircle
            cx={landmarks.leftEye.x - heartSize * 0.2}
            cy={landmarks.leftEye.y - heartSize * 0.1}
            r={heartSize * 0.5}
            color="rgba(255, 0, 80, 0.85)"
          />
          <SkiaCircle
            cx={landmarks.leftEye.x + heartSize * 0.2}
            cy={landmarks.leftEye.y - heartSize * 0.1}
            r={heartSize * 0.5}
            color="rgba(255, 0, 80, 0.85)"
          />
          {/* Right heart */}
          <SkiaCircle
            cx={landmarks.rightEye.x - heartSize * 0.2}
            cy={landmarks.rightEye.y - heartSize * 0.1}
            r={heartSize * 0.5}
            color="rgba(255, 0, 80, 0.85)"
          />
          <SkiaCircle
            cx={landmarks.rightEye.x + heartSize * 0.2}
            cy={landmarks.rightEye.y - heartSize * 0.1}
            r={heartSize * 0.5}
            color="rgba(255, 0, 80, 0.85)"
          />
        </SkiaGroup>
      );
    }

    // ─── Sunglasses ──────────────────────────────────────────────────
    case "sunglasses":
    case "glasses": {
      const lensRadius = eyeSize * 1.5;
      const isShades = config.id === "sunglasses";
      const lensColor = isShades
        ? "rgba(20, 20, 20, 0.8)"
        : "rgba(180, 220, 255, 0.3)";
      const frameColor = isShades
        ? "rgba(30, 30, 30, 0.95)"
        : "rgba(60, 60, 60, 0.9)";
      return (
        <SkiaGroup
          key="glasses"
          transform={[{ rotate: (rotation * Math.PI) / 180 }]}
        >
          {/* Left lens */}
          <SkiaCircle
            cx={landmarks.leftEye.x}
            cy={landmarks.leftEye.y}
            r={lensRadius + 2}
            color={frameColor}
          />
          <SkiaCircle
            cx={landmarks.leftEye.x}
            cy={landmarks.leftEye.y}
            r={lensRadius}
            color={lensColor}
          />
          {/* Right lens */}
          <SkiaCircle
            cx={landmarks.rightEye.x}
            cy={landmarks.rightEye.y}
            r={lensRadius + 2}
            color={frameColor}
          />
          <SkiaCircle
            cx={landmarks.rightEye.x}
            cy={landmarks.rightEye.y}
            r={lensRadius}
            color={lensColor}
          />
        </SkiaGroup>
      );
    }

    // ─── Crown / Flower Crown / Ice Crown ────────────────────────────
    case "crown":
    case "flower_crown":
    case "ice_crown": {
      const crownWidth = eyeDist * 1.6;
      const crownHeight = eyeDist * 0.5;
      const center = midpoint(landmarks.leftEar, landmarks.rightEar);
      const crownY = center.y - face.bounds.height * 0.55;
      const colors: Record<string, string> = {
        crown: "rgba(255, 215, 0, 0.9)",
        flower_crown: "rgba(255, 120, 180, 0.85)",
        ice_crown: "rgba(150, 220, 255, 0.85)",
      };
      const color = colors[config.id] || "rgba(255, 215, 0, 0.9)";
      const dotCount = 5;

      return (
        <SkiaGroup
          key="crown"
          transform={[{ rotate: (rotation * Math.PI) / 180 }]}
        >
          {/* Crown base — a row of circles */}
          {Array.from({ length: dotCount }).map((_, i) => (
            <SkiaCircle
              key={`crown-${i}`}
              cx={center.x - crownWidth / 2 + (crownWidth / (dotCount - 1)) * i}
              cy={crownY + (i % 2 === 0 ? 0 : crownHeight * 0.3)}
              r={crownHeight * 0.5}
              color={color}
            />
          ))}
        </SkiaGroup>
      );
    }

    // ─── Bunny Ears ──────────────────────────────────────────────────
    case "bunny_ears": {
      const earHeight = face.bounds.height * 0.5;
      const earWidth = eyeDist * 0.25;
      return (
        <SkiaGroup
          key="bunny"
          transform={[{ rotate: (rotation * Math.PI) / 180 }]}
        >
          {/* Left ear — tall ellipse via two circles */}
          <SkiaCircle
            cx={landmarks.leftEar.x}
            cy={landmarks.leftEar.y - earHeight * 0.7}
            r={earWidth}
            color="rgba(255, 255, 255, 0.9)"
          />
          <SkiaCircle
            cx={landmarks.leftEar.x}
            cy={landmarks.leftEar.y - earHeight}
            r={earWidth * 0.9}
            color="rgba(255, 255, 255, 0.9)"
          />
          <SkiaCircle
            cx={landmarks.leftEar.x}
            cy={landmarks.leftEar.y - earHeight * 0.8}
            r={earWidth * 0.5}
            color="rgba(255, 180, 200, 0.85)"
          />
          {/* Right ear */}
          <SkiaCircle
            cx={landmarks.rightEar.x}
            cy={landmarks.rightEar.y - earHeight * 0.7}
            r={earWidth}
            color="rgba(255, 255, 255, 0.9)"
          />
          <SkiaCircle
            cx={landmarks.rightEar.x}
            cy={landmarks.rightEar.y - earHeight}
            r={earWidth * 0.9}
            color="rgba(255, 255, 255, 0.9)"
          />
          <SkiaCircle
            cx={landmarks.rightEar.x}
            cy={landmarks.rightEar.y - earHeight * 0.8}
            r={earWidth * 0.5}
            color="rgba(255, 180, 200, 0.85)"
          />
        </SkiaGroup>
      );
    }

    // ─── Devil Horns ─────────────────────────────────────────────────
    case "devil_horns": {
      const hornSize = eyeDist * 0.35;
      const topY =
        Math.min(landmarks.leftEar.y, landmarks.rightEar.y) -
        face.bounds.height * 0.35;
      return (
        <SkiaGroup
          key="devil"
          transform={[{ rotate: (rotation * Math.PI) / 180 }]}
        >
          <SkiaCircle
            cx={landmarks.leftEar.x + eyeDist * 0.15}
            cy={topY}
            r={hornSize}
            color="rgba(200, 0, 0, 0.9)"
          />
          <SkiaCircle
            cx={landmarks.leftEar.x + eyeDist * 0.15}
            cy={topY - hornSize * 0.8}
            r={hornSize * 0.6}
            color="rgba(200, 0, 0, 0.9)"
          />
          <SkiaCircle
            cx={landmarks.rightEar.x - eyeDist * 0.15}
            cy={topY}
            r={hornSize}
            color="rgba(200, 0, 0, 0.9)"
          />
          <SkiaCircle
            cx={landmarks.rightEar.x - eyeDist * 0.15}
            cy={topY - hornSize * 0.8}
            r={hornSize * 0.6}
            color="rgba(200, 0, 0, 0.9)"
          />
        </SkiaGroup>
      );
    }

    // ─── Nose Blush ──────────────────────────────────────────────────
    case "nose_blush": {
      return (
        <SkiaGroup
          key="blush"
          transform={[{ rotate: (rotation * Math.PI) / 180 }]}
        >
          <SkiaCircle
            cx={landmarks.leftCheek.x}
            cy={landmarks.leftCheek.y}
            r={eyeSize * 1.2}
            color="rgba(255, 130, 150, 0.4)"
          />
          <SkiaCircle
            cx={landmarks.rightCheek.x}
            cy={landmarks.rightCheek.y}
            r={eyeSize * 1.2}
            color="rgba(255, 130, 150, 0.4)"
          />
          <SkiaCircle
            cx={landmarks.noseBase.x}
            cy={landmarks.noseBase.y}
            r={eyeSize * 0.7}
            color="rgba(255, 100, 120, 0.5)"
          />
        </SkiaGroup>
      );
    }

    // ─── Tears ───────────────────────────────────────────────────────
    case "tears": {
      const tearSize = eyeSize * 0.4;
      return (
        <SkiaGroup
          key="tears"
          transform={[{ rotate: (rotation * Math.PI) / 180 }]}
        >
          {[0, 1, 2].map((i) => (
            <React.Fragment key={`tear-l-${i}`}>
              <SkiaCircle
                cx={landmarks.leftEye.x + tearSize * (i - 1)}
                cy={landmarks.leftEye.y + eyeSize + tearSize * i * 2}
                r={tearSize}
                color="rgba(100, 180, 255, 0.7)"
              />
            </React.Fragment>
          ))}
          {[0, 1, 2].map((i) => (
            <React.Fragment key={`tear-r-${i}`}>
              <SkiaCircle
                cx={landmarks.rightEye.x + tearSize * (i - 1)}
                cy={landmarks.rightEye.y + eyeSize + tearSize * i * 2}
                r={tearSize}
                color="rgba(100, 180, 255, 0.7)"
              />
            </React.Fragment>
          ))}
        </SkiaGroup>
      );
    }

    // ─── Skull Mask ──────────────────────────────────────────────────
    case "skull_mask": {
      return (
        <SkiaGroup
          key="skull"
          transform={[{ rotate: (rotation * Math.PI) / 180 }]}
        >
          {/* Dark eye sockets */}
          <SkiaCircle
            cx={landmarks.leftEye.x}
            cy={landmarks.leftEye.y}
            r={eyeSize * 1.3}
            color="rgba(0, 0, 0, 0.8)"
          />
          <SkiaCircle
            cx={landmarks.rightEye.x}
            cy={landmarks.rightEye.y}
            r={eyeSize * 1.3}
            color="rgba(0, 0, 0, 0.8)"
          />
          {/* Nose triangle approximation */}
          <SkiaCircle
            cx={landmarks.noseBase.x}
            cy={landmarks.noseBase.y}
            r={eyeSize * 0.5}
            color="rgba(0, 0, 0, 0.7)"
          />
        </SkiaGroup>
      );
    }

    // ─── Golden Mask ─────────────────────────────────────────────────
    case "golden_mask": {
      return (
        <SkiaGroup
          key="golden"
          transform={[{ rotate: (rotation * Math.PI) / 180 }]}
        >
          <SkiaCircle
            cx={landmarks.leftEye.x}
            cy={landmarks.leftEye.y}
            r={eyeSize * 1.5}
            color="rgba(255, 215, 0, 0.5)"
          />
          <SkiaCircle
            cx={landmarks.rightEye.x}
            cy={landmarks.rightEye.y}
            r={eyeSize * 1.5}
            color="rgba(255, 215, 0, 0.5)"
          />
          <SkiaCircle
            cx={landmarks.noseBase.x}
            cy={landmarks.noseBase.y}
            r={eyeSize}
            color="rgba(255, 200, 0, 0.4)"
          />
        </SkiaGroup>
      );
    }

    // ─── Butterfly ───────────────────────────────────────────────────
    case "butterfly": {
      const bflySize = eyeSize * 1.5;
      return (
        <SkiaGroup
          key="butterfly"
          transform={[{ rotate: (rotation * Math.PI) / 180 }]}
        >
          {/* Wings */}
          <SkiaCircle
            cx={landmarks.noseBase.x - bflySize}
            cy={landmarks.noseBase.y}
            r={bflySize}
            color="rgba(180, 100, 255, 0.6)"
          />
          <SkiaCircle
            cx={landmarks.noseBase.x + bflySize}
            cy={landmarks.noseBase.y}
            r={bflySize}
            color="rgba(255, 150, 200, 0.6)"
          />
          {/* Body */}
          <SkiaCircle
            cx={landmarks.noseBase.x}
            cy={landmarks.noseBase.y}
            r={bflySize * 0.2}
            color="rgba(50, 50, 50, 0.8)"
          />
        </SkiaGroup>
      );
    }

    // ─── Rainbow Mouth ───────────────────────────────────────────────
    case "rainbow_mouth": {
      const mouthCenter = midpoint(landmarks.leftMouth, landmarks.rightMouth);
      const mouthWidth = distance(landmarks.leftMouth, landmarks.rightMouth);
      const rainbowColors = [
        "rgba(255, 0, 0, 0.5)",
        "rgba(255, 165, 0, 0.5)",
        "rgba(255, 255, 0, 0.5)",
        "rgba(0, 200, 0, 0.5)",
        "rgba(0, 100, 255, 0.5)",
        "rgba(128, 0, 255, 0.5)",
      ];
      return (
        <SkiaGroup
          key="rainbow"
          transform={[{ rotate: (rotation * Math.PI) / 180 }]}
        >
          {rainbowColors.map((color, i) => (
            <SkiaCircle
              key={`rb-${i}`}
              cx={mouthCenter.x}
              cy={mouthCenter.y + (i - 2) * (mouthWidth * 0.08)}
              r={mouthWidth * (0.8 - i * 0.05)}
              color={color}
            />
          ))}
        </SkiaGroup>
      );
    }

    // ─── Default: generic glow around face ───────────────────────────
    default: {
      const center = midpoint(landmarks.leftEye, landmarks.rightEye);
      return (
        <SkiaGroup key="default">
          <SkiaCircle
            cx={center.x}
            cy={center.y}
            r={eyeDist * 0.6}
            color="rgba(255, 255, 255, 0.3)"
          />
        </SkiaGroup>
      );
    }
  }
}

// ─── RN Image Fallback Renderer ───────────────────────────────────────────────

function FallbackEffectRenderer({
  face,
  config,
}: {
  face: DetectedFace;
  config: FaceEffectConfig;
}) {
  const pos = getEffectPositioning(face, config);
  const asset = EFFECT_ASSETS[config.id];

  // If no asset, render a colored circle as placeholder
  const categoryColors: Record<string, string> = {
    accessories: "rgba(255, 215, 0, 0.6)",
    masks: "rgba(139, 90, 43, 0.6)",
    expressions: "rgba(255, 50, 100, 0.6)",
    overlays: "rgba(150, 100, 255, 0.6)",
  };

  return (
    <View
      style={[
        styles.effectContainer,
        {
          left: pos.x,
          top: pos.y,
          width: pos.width,
          height: pos.height,
          transform: [{ rotate: `${pos.rotation}deg` }],
        },
      ]}
    >
      {asset ? (
        <Image source={asset} style={styles.effectImage} resizeMode="contain" />
      ) : (
        <View
          style={[
            styles.placeholderEffect,
            {
              backgroundColor:
                categoryColors[config.category] || "rgba(255,255,255,0.4)",
              borderRadius: pos.width / 2,
            },
          ]}
        />
      )}
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const FaceEffectOverlay: React.FC<Props> = React.memo(
  ({
    faces,
    selectedEffect,
    previewWidth,
    previewHeight,
    mirrored = false,
  }) => {
    const effectConfig = useMemo(() => {
      if (!selectedEffect) return null;
      return FACE_EFFECTS_LIBRARY[selectedEffect] || null;
    }, [selectedEffect]);

    if (!effectConfig || faces.length === 0) return null;

    // Filter to valid faces
    const validFaces = faces.filter(shouldRenderEffect);
    if (validFaces.length === 0) return null;

    // ─── Skia renderer ────────────────────────────────────────────────
    if (SkiaCanvas && SkiaGroup) {
      return (
        <View
          style={[
            styles.overlay,
            { width: previewWidth, height: previewHeight },
          ]}
          pointerEvents="none"
        >
          <SkiaCanvas
            style={[
              styles.skiaCanvas,
              { width: previewWidth, height: previewHeight },
            ]}
          >
            <SkiaGroup
              transform={
                mirrored
                  ? [{ translateX: previewWidth }, { scaleX: -1 }]
                  : undefined
              }
            >
              {validFaces.map((face) => {
                const pos = getEffectPositioning(face, effectConfig);
                return (
                  <React.Fragment key={face.trackingId}>
                    {renderProceduralEffect({
                      x: pos.x,
                      y: pos.y,
                      width: pos.width,
                      height: pos.height,
                      rotation: pos.rotation,
                      face,
                      config: effectConfig,
                    })}
                  </React.Fragment>
                );
              })}
            </SkiaGroup>
          </SkiaCanvas>
        </View>
      );
    }

    // ─── RN Image fallback ────────────────────────────────────────────
    return (
      <View
        style={[
          styles.overlay,
          {
            width: previewWidth,
            height: previewHeight,
            transform: mirrored ? [{ scaleX: -1 }] : undefined,
          },
        ]}
        pointerEvents="none"
      >
        {validFaces.map((face) => (
          <FallbackEffectRenderer
            key={face.trackingId}
            face={face}
            config={effectConfig}
          />
        ))}
      </View>
    );
  },
);

FaceEffectOverlay.displayName = "FaceEffectOverlay";

export default FaceEffectOverlay;

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 10,
  },
  skiaCanvas: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  effectContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  effectImage: {
    width: "100%",
    height: "100%",
  },
  placeholderEffect: {
    width: "100%",
    height: "100%",
    opacity: 0.6,
  },
});
