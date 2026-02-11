/**
 * FACE DETECTION SERVICE
 * Real-time face detection with 16 AR effects
 * Uses ML Kit for cross-platform detection
 */

import {
  DetectedFace,
  FaceDetectionResult,
  FaceEffect,
  FaceEffectConfig,
  FaceLandmarks,
  Point,
} from "@/types/camera";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/camera/faceDetectionService");
/**
 * Face Effects Library (16 total effects)
 */
export const FACE_EFFECTS_LIBRARY: Record<FaceEffect, FaceEffectConfig> = {
  // ACCESSORIES (4)
  flower_crown: {
    id: "flower_crown",
    name: "Flower Crown",
    category: "accessories",
    assetPath: "assets/effects/flower_crown.png",
    requiresFaceDetection: true,
    scale: 1.3,
    landmarkOffsets: {
      leftEar: { x: -20, y: -40 },
      rightEar: { x: 20, y: -40 },
    },
  },

  sunglasses: {
    id: "sunglasses",
    name: "Sunglasses",
    category: "accessories",
    assetPath: "assets/effects/sunglasses.png",
    requiresFaceDetection: true,
    scale: 1.2,
    landmarkOffsets: {
      leftEye: { x: -10, y: 0 },
      rightEye: { x: 10, y: 0 },
    },
  },

  glasses: {
    id: "glasses",
    name: "Glasses",
    category: "accessories",
    assetPath: "assets/effects/glasses.png",
    requiresFaceDetection: true,
    scale: 1.15,
    landmarkOffsets: {
      leftEye: { x: -10, y: -5 },
      rightEye: { x: 10, y: -5 },
    },
  },

  crown: {
    id: "crown",
    name: "Crown",
    category: "accessories",
    assetPath: "assets/effects/crown.png",
    requiresFaceDetection: true,
    scale: 1.25,
    landmarkOffsets: {
      leftEar: { x: -15, y: -50 },
      rightEar: { x: 15, y: -50 },
    },
  },

  // MASKS (4)
  dog_filter: {
    id: "dog_filter",
    name: "Dog Filter",
    category: "masks",
    assetPath: "assets/effects/dog_mask.png",
    requiresFaceDetection: true,
    scale: 1.4,
    landmarkOffsets: {
      leftEar: { x: -30, y: -50 },
      rightEar: { x: 30, y: -50 },
      noseBase: { x: 0, y: 20 },
    },
  },

  cat_filter: {
    id: "cat_filter",
    name: "Cat Filter",
    category: "masks",
    assetPath: "assets/effects/cat_mask.png",
    requiresFaceDetection: true,
    scale: 1.35,
    landmarkOffsets: {
      leftEar: { x: -25, y: -55 },
      rightEar: { x: 25, y: -55 },
      noseBase: { x: 0, y: 15 },
    },
  },

  skull_mask: {
    id: "skull_mask",
    name: "Skull Mask",
    category: "masks",
    assetPath: "assets/effects/skull_mask.png",
    requiresFaceDetection: true,
    scale: 1.3,
    landmarkOffsets: {
      leftEye: { x: -15, y: -5 },
      rightEye: { x: 15, y: -5 },
    },
  },

  golden_mask: {
    id: "golden_mask",
    name: "Golden Mask",
    category: "masks",
    assetPath: "assets/effects/golden_mask.png",
    requiresFaceDetection: true,
    scale: 1.2,
    landmarkOffsets: {
      leftEye: { x: -10, y: 0 },
      rightEye: { x: 10, y: 0 },
    },
  },

  // EXPRESSIONS (4)
  heart_eyes: {
    id: "heart_eyes",
    name: "Heart Eyes",
    category: "expressions",
    assetPath: "assets/effects/heart_eyes.png",
    requiresFaceDetection: true,
    scale: 0.8,
    landmarkOffsets: {
      leftEye: { x: 0, y: 0 },
      rightEye: { x: 0, y: 0 },
    },
  },

  devil_horns: {
    id: "devil_horns",
    name: "Devil Horns",
    category: "expressions",
    assetPath: "assets/effects/devil_horns.png",
    requiresFaceDetection: true,
    scale: 1.3,
    landmarkOffsets: {
      leftEar: { x: -20, y: -60 },
      rightEar: { x: 20, y: -60 },
    },
  },

  tears: {
    id: "tears",
    name: "Tears",
    category: "expressions",
    assetPath: "assets/effects/tears.png",
    requiresFaceDetection: true,
    scale: 0.6,
    landmarkOffsets: {
      leftEye: { x: 5, y: 15 },
      rightEye: { x: 5, y: 15 },
    },
  },

  nose_blush: {
    id: "nose_blush",
    name: "Nose Blush",
    category: "expressions",
    assetPath: "assets/effects/nose_blush.png",
    requiresFaceDetection: true,
    scale: 0.7,
    landmarkOffsets: {
      noseBase: { x: 0, y: 10 },
    },
  },

  // OVERLAYS (4)
  bunny_ears: {
    id: "bunny_ears",
    name: "Bunny Ears",
    category: "overlays",
    assetPath: "assets/effects/bunny_ears.png",
    requiresFaceDetection: true,
    scale: 1.2,
    landmarkOffsets: {
      leftEar: { x: -15, y: -70 },
      rightEar: { x: 15, y: -70 },
    },
  },

  butterfly: {
    id: "butterfly",
    name: "Butterfly",
    category: "overlays",
    assetPath: "assets/effects/butterfly.png",
    requiresFaceDetection: true,
    scale: 1.0,
    landmarkOffsets: {
      noseBase: { x: -5, y: 0 },
    },
  },

  rainbow_mouth: {
    id: "rainbow_mouth",
    name: "Rainbow Mouth",
    category: "overlays",
    assetPath: "assets/effects/rainbow_mouth.png",
    requiresFaceDetection: true,
    scale: 0.8,
    landmarkOffsets: {
      leftMouth: { x: 0, y: 5 },
      rightMouth: { x: 0, y: 5 },
      mouthBottom: { x: 0, y: 0 },
    },
  },

  ice_crown: {
    id: "ice_crown",
    name: "Ice Crown",
    category: "overlays",
    assetPath: "assets/effects/ice_crown.png",
    requiresFaceDetection: true,
    scale: 1.25,
    landmarkOffsets: {
      leftEar: { x: -20, y: -55 },
      rightEar: { x: 20, y: -55 },
    },
  },
};

/**
 * Initialize face detection
 * Loads ML Kit model and prepares for real-time detection
 */
export async function initializeFaceDetection(): Promise<void> {
  try {
    logger.info("[Face Detection Service] Initializing face detection");

    // Delegate to native face detection
    const { initializeFaceDetection } = await import("./nativeFaceDetection");
    await initializeFaceDetection();
  } catch (error) {
    logger.error("[Face Detection Service] Failed to initialize:", error);
    throw error;
  }
}

/**
 * Detect faces in frame (real-time, target 30 FPS)
 */
export async function detectFacesInFrame(
  frameData: any,
): Promise<FaceDetectionResult> {
  try {
    // Delegate to native face detection
    const { detectFacesInFrame: nativeDetect } =
      await import("./nativeFaceDetection");
    return nativeDetect(frameData);
  } catch (error) {
    logger.error("[Face Detection Service] Face detection failed:", error);
    return { faces: [], timestamp: Date.now() };
  }
}

/**
 * Determine if effect should be rendered for this frame
 */
export function shouldRenderEffect(face: DetectedFace): boolean {
  // Effect should be rendered if:
  // 1. Face is detected
  // 2. Face bounding box is large enough (> 50x50)
  // 3. Face is within frame bounds

  const minFaceSize = 50;
  const isFaceValid =
    face.bounds.width > minFaceSize &&
    face.bounds.height > minFaceSize &&
    face.bounds.x >= 0 &&
    face.bounds.y >= 0;

  return isFaceValid;
}

/**
 * Calculate effect positioning based on face landmarks
 */
export function getEffectPositioning(
  face: DetectedFace,
  effect: FaceEffectConfig,
): {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
} {
  // Determine primary anchor point
  let anchorX = face.bounds.x + face.bounds.width / 2;
  let anchorY = face.bounds.y + face.bounds.height / 2;

  // Apply landmark offsets if specified
  if (effect.landmarkOffsets) {
    const offset = effect.landmarkOffsets["noseBase"];
    if (offset) {
      anchorX += offset.x;
      anchorY += offset.y;
    }
  }

  // Calculate width/height based on face size and effect scale
  const effectWidth = face.bounds.width * (effect.scale || 1);
  const effectHeight = face.bounds.height * (effect.scale || 1);

  return {
    x: anchorX - effectWidth / 2,
    y: anchorY - effectHeight / 2,
    width: effectWidth,
    height: effectHeight,
    rotation: face.eulerAngleZ || 0,
  };
}

/**
 * Get effect by ID
 */
export function getEffectById(
  effectId: FaceEffect,
): FaceEffectConfig | undefined {
  return FACE_EFFECTS_LIBRARY[effectId];
}

/**
 * Get all effects grouped by category
 */
export function getEffectsGroupedByCategory(): Record<
  string,
  FaceEffectConfig[]
> {
  const grouped: Record<string, FaceEffectConfig[]> = {
    accessories: [],
    masks: [],
    expressions: [],
    overlays: [],
  };

  Object.values(FACE_EFFECTS_LIBRARY).forEach((effect) => {
    grouped[effect.category].push(effect);
  });

  return grouped;
}

/**
 * Get effects by category
 */
export function getEffectsByCategory(
  category: "accessories" | "masks" | "expressions" | "overlays",
): FaceEffectConfig[] {
  return Object.values(FACE_EFFECTS_LIBRARY).filter(
    (e) => e.category === category,
  );
}

/**
 * Track face movement across frames
 * For smooth effect following
 */
export async function trackFaceMovement(
  frames: Array<{ timestamp: number; faces: DetectedFace[] }>,
  duration: number,
): Promise<Map<number, DetectedFace[]>> {
  const trackingMap = new Map<number, DetectedFace[]>();

  frames.forEach((frame) => {
    frame.faces.forEach((face) => {
      if (!trackingMap.has(face.trackingId)) {
        trackingMap.set(face.trackingId, []);
      }
      const track = trackingMap.get(face.trackingId);
      track?.push(face);
    });
  });

  return trackingMap;
}

/**
 * Smooth face tracking data (reduce jitter)
 */
export function smoothFaceTracking(
  faces: DetectedFace[],
  windowSize: number = 3,
): DetectedFace[] {
  if (faces.length <= windowSize) return faces;

  const smoothed: DetectedFace[] = [];

  for (let i = 0; i < faces.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(faces.length, i + Math.floor(windowSize / 2) + 1);
    const window = faces.slice(start, end);

    // Average face positions
    const avgFace = averageFaces(window);
    smoothed.push(avgFace);
  }

  return smoothed;
}

/**
 * Average multiple face detections
 */
function averageFaces(faces: DetectedFace[]): DetectedFace {
  if (faces.length === 0) throw new Error("Cannot average zero faces");

  const count = faces.length;
  const avgBounds = {
    x: faces.reduce((sum, f) => sum + f.bounds.x, 0) / count,
    y: faces.reduce((sum, f) => sum + f.bounds.y, 0) / count,
    width: faces.reduce((sum, f) => sum + f.bounds.width, 0) / count,
    height: faces.reduce((sum, f) => sum + f.bounds.height, 0) / count,
  };

  const avgLandmarks = averageLandmarks(faces.map((f) => f.landmarks));

  return {
    faceId: faces[0].faceId,
    bounds: avgBounds,
    landmarks: avgLandmarks,
    eulerAngleX: faces.reduce((sum, f) => sum + f.eulerAngleX, 0) / count,
    eulerAngleY: faces.reduce((sum, f) => sum + f.eulerAngleY, 0) / count,
    eulerAngleZ: faces.reduce((sum, f) => sum + f.eulerAngleZ, 0) / count,
    smilingProbability:
      faces.reduce((sum, f) => sum + f.smilingProbability, 0) / count,
    leftEyeOpenProbability:
      faces.reduce((sum, f) => sum + f.leftEyeOpenProbability, 0) / count,
    rightEyeOpenProbability:
      faces.reduce((sum, f) => sum + f.rightEyeOpenProbability, 0) / count,
    trackingId: faces[0].trackingId,
  };
}

/**
 * Average face landmarks
 */
function averageLandmarks(landmarks: FaceLandmarks[]): FaceLandmarks {
  const count = landmarks.length;

  const avgPoint = (key: keyof FaceLandmarks): Point => ({
    x: landmarks.reduce((sum, l) => sum + l[key].x, 0) / count,
    y: landmarks.reduce((sum, l) => sum + l[key].y, 0) / count,
  });

  return {
    leftEye: avgPoint("leftEye"),
    rightEye: avgPoint("rightEye"),
    leftEar: avgPoint("leftEar"),
    rightEar: avgPoint("rightEar"),
    leftCheek: avgPoint("leftCheek"),
    rightCheek: avgPoint("rightCheek"),
    leftMouth: avgPoint("leftMouth"),
    rightMouth: avgPoint("rightMouth"),
    mouthBottom: avgPoint("mouthBottom"),
    noseBase: avgPoint("noseBase"),
  };
}

/**
 * Detect if person is smiling
 */
export function isSmiling(face: DetectedFace): boolean {
  return face.smilingProbability > 0.5;
}

/**
 * Detect if eyes are open
 */
export function areEyesOpen(face: DetectedFace): boolean {
  const avgEyeOpenness =
    (face.leftEyeOpenProbability + face.rightEyeOpenProbability) / 2;
  return avgEyeOpenness > 0.5;
}

/**
 * Get face orientation (which way head is turned)
 */
export function getFaceOrientation(
  face: DetectedFace,
): "front" | "left" | "right" | "down" | "up" {
  const { eulerAngleY, eulerAngleX } = face;

  if (Math.abs(eulerAngleY) > 20) {
    return eulerAngleY > 0 ? "right" : "left";
  }
  if (Math.abs(eulerAngleX) > 20) {
    return eulerAngleX > 0 ? "down" : "up";
  }
  return "front";
}

/**
 * Get popular effects
 */
export function getPopularEffects(): FaceEffectConfig[] {
  return [
    FACE_EFFECTS_LIBRARY.dog_filter,
    FACE_EFFECTS_LIBRARY.cat_filter,
    FACE_EFFECTS_LIBRARY.flower_crown,
    FACE_EFFECTS_LIBRARY.heart_eyes,
    FACE_EFFECTS_LIBRARY.bunny_ears,
  ];
}

/**
 * Get effects suitable for selfies
 */
export function getSelfieEffects(): FaceEffectConfig[] {
  return [
    FACE_EFFECTS_LIBRARY.flower_crown,
    FACE_EFFECTS_LIBRARY.sunglasses,
    FACE_EFFECTS_LIBRARY.heart_eyes,
    FACE_EFFECTS_LIBRARY.bunny_ears,
    FACE_EFFECTS_LIBRARY.rainbow_mouth,
  ];
}

/**
 * Clean up face detection resources
 */
export function cleanupFaceDetection(): void {
  // Release ML Kit model
  logger.info("[Face Detection Service] Cleaning up resources");
}
