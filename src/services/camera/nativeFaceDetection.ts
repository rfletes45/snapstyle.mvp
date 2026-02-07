/**
 * NATIVE FACE DETECTION SERVICE
 * Real-time face detection and landmark tracking
 *
 * NOTE: expo-face-detector was removed from Expo SDK 51+.
 * This module provides stub implementations that can be replaced with:
 * - react-native-vision-camera frame processors
 * - Firebase ML Kit
 * - MediaPipe face detection
 *
 * PRODUCTION UPGRADE: Integrate a face detection library above.
 */

import {
  DetectedFace,
  FaceDetectionResult,
  FaceLandmarks,
  Point,
} from "../../types/camera";

// Stub constants matching the old expo-face-detector API
const FaceDetector = {
  FaceDetectorMode: { fast: 1, accurate: 2 },
  FaceDetectorLandmarks: {
    none: 0,
    all: 1,
    leftEye: "leftEye",
    rightEye: "rightEye",
    leftEar: "leftEar",
    rightEar: "rightEar",
    mouthBottom: "mouthBottom",
    mouthLeft: "mouthLeft",
    mouthRight: "mouthRight",
    noseBase: "noseBase",
  },
  FaceDetectorClassifications: { none: 0, all: 1 },
  setDetectionMode: async (_mode: number) => {},
  setLandmarkDetectionMode: async (_mode: number) => {},
  setClassifications: async (_mode: number) => {},
  detectFaces: async (_uri: string, _options?: any) => ({
    faces: [] as any[],
  }),
};

/**
 * Face detection mode
 * Trading off speed vs accuracy
 */
export enum FaceDetectionMode {
  FAST = 1,
  ACCURATE = 2,
}

/**
 * Landmarks that can be detected on a face
 */
export enum FaceLandmarkType {
  LEFT_EYE = "left_eye",
  RIGHT_EYE = "right_eye",
  LEFT_EAR = "left_ear",
  RIGHT_EAR = "right_ear",
  MOUTH_BOTTOM = "mouth_bottom",
  MOUTH_LEFT = "mouth_left",
  MOUTH_RIGHT = "mouth_right",
  NOSE_BASE = "nose_base",
}

/**
 * Initialize face detection
 * Call once on app startup
 */
export async function initializeFaceDetection(
  mode: FaceDetectionMode = FaceDetectionMode.FAST,
): Promise<void> {
  try {
    console.log(
      `[Native Face Detection] Initializing face detection (${mode === FaceDetectionMode.FAST ? "FAST" : "ACCURATE"} mode)`,
    );

    // Configure face detector
    await FaceDetector.setDetectionMode(mode);
    await FaceDetector.setLandmarkDetectionMode(
      FaceDetector.FaceDetectorLandmarks.all,
    );
    await FaceDetector.setClassifications(
      FaceDetector.FaceDetectorClassifications.all,
    );

    console.log("[Native Face Detection] Face detection initialized");
  } catch (error) {
    console.error(
      "[Native Face Detection] Failed to initialize face detection:",
      error,
    );
    throw error;
  }
}

/**
 * Detect faces in an image URI
 * Returns coordinates, landmarks, and expression data
 */
export async function detectFacesInImage(
  imageUri: string,
): Promise<FaceDetectionResult> {
  try {
    console.log("[Native Face Detection] Detecting faces in image");

    // Detect faces using expo-face-detector
    const result = await FaceDetector.detectFaces(imageUri, {
      mode: FaceDetector.FaceDetectorMode.accurate,
      detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
      runClassifications: FaceDetector.FaceDetectorClassifications.all,
    });

    // Convert to internal format
    const detectedFaces = result.faces
      .filter(
        (face) => face.bounds.size.width > 50 && face.bounds.size.height > 50,
      ) // Filter small faces
      .map((face, index) => convertToDetectedFace(face, index));

    console.log(
      `[Native Face Detection] Detected ${detectedFaces.length} faces`,
    );

    return {
      faces: detectedFaces,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("[Native Face Detection] Face detection failed:", error);
    return {
      faces: [],
      timestamp: Date.now(),
    };
  }
}

/**
 * Real-time face detection from camera frame
 * Optimized for 30 FPS performance
 */
export async function detectFacesInFrame(
  frameData: any,
): Promise<FaceDetectionResult> {
  try {
    // For real-time camera detection with expo-face-detector,
    // we need to use the Camera component's onFacesDetected callback
    // This function is called within that callback

    // The frameData parameter would contain the detected faces from the camera
    // Return them in our standard format

    if (!frameData || !frameData.faces) {
      return {
        faces: [],
        timestamp: Date.now(),
      };
    }

    const detectedFaces = frameData.faces
      .filter(
        (face: any) =>
          face.bounds.size.width > 30 && face.bounds.size.height > 30, // Lower threshold for real-time
      )
      .map((face: any, index: number) => convertToDetectedFace(face, index));

    return {
      faces: detectedFaces,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error(
      "[Native Face Detection] Real-time face detection failed:",
      error,
    );
    return {
      faces: [],
      timestamp: Date.now(),
    };
  }
}

/**
 * Convert expo-face-detector face to our format
 */
function convertToDetectedFace(face: any, index: number): DetectedFace {
  const landmarks = extractLandmarks(face);

  return {
    faceId: face.faceID ?? index,
    bounds: {
      x: face.bounds?.origin?.x ?? 0,
      y: face.bounds?.origin?.y ?? 0,
      width: face.bounds?.size?.width ?? 0,
      height: face.bounds?.size?.height ?? 0,
    },
    landmarks,
    eulerAngleX: face.rollAngle || 0,
    eulerAngleY: face.yawAngle || 0,
    eulerAngleZ: 0,
    leftEyeOpenProbability: face.isLeftEyeOpen ? 1 : 0,
    rightEyeOpenProbability: face.isRightEyeOpen ? 1 : 0,
    smilingProbability: calculateSmileProbability(face),
    trackingId: face.faceID ?? index,
  };
}

/**
 * Extract facial landmarks from detected face
 */
function extractLandmarks(face: any): FaceLandmarks {
  const defaultPoint: Point = { x: 0, y: 0 };

  // Initialize with defaults for all required fields
  const landmarks: FaceLandmarks = {
    leftEye: defaultPoint,
    rightEye: defaultPoint,
    leftEar: defaultPoint,
    rightEar: defaultPoint,
    leftCheek: defaultPoint,
    rightCheek: defaultPoint,
    leftMouth: defaultPoint,
    rightMouth: defaultPoint,
    mouthBottom: defaultPoint,
    noseBase: defaultPoint,
  };

  if (!face.landmarks || face.landmarks.length === 0) {
    return landmarks;
  }

  // Map detected landmarks to our format
  face.landmarks.forEach((landmark: any) => {
    const point: Point = {
      x: landmark.position?.x ?? 0,
      y: landmark.position?.y ?? 0,
    };

    switch (landmark.type) {
      case FaceDetector.FaceDetectorLandmarks.leftEye:
        landmarks.leftEye = point;
        break;
      case FaceDetector.FaceDetectorLandmarks.rightEye:
        landmarks.rightEye = point;
        break;
      case FaceDetector.FaceDetectorLandmarks.leftEar:
        landmarks.leftEar = point;
        break;
      case FaceDetector.FaceDetectorLandmarks.rightEar:
        landmarks.rightEar = point;
        break;
      case FaceDetector.FaceDetectorLandmarks.mouthBottom:
        landmarks.mouthBottom = point;
        break;
      case FaceDetector.FaceDetectorLandmarks.mouthLeft:
        landmarks.leftMouth = point;
        break;
      case FaceDetector.FaceDetectorLandmarks.mouthRight:
        landmarks.rightMouth = point;
        break;
      case FaceDetector.FaceDetectorLandmarks.noseBase:
        landmarks.noseBase = point;
        break;
    }
  });

  return landmarks;
}

/**
 * Calculate smile probability from facial expressions
 */
function calculateSmileProbability(face: any): number {
  // expo-face-detector doesn't provide direct smile detection
  // Estimate based on mouth position and shape
  // This is a placeholder - would need ML Kit for accurate detection

  // Higher value if mouth is open/smiling
  const mouthOpen = face.bounds ? 0.5 : 0;
  return Math.min(1, mouthOpen + 0.3);
}

/**
 * Get face bounds with margin for effect positioning
 * Used for accessory placement
 */
export function getFaceEffectBounds(
  face: DetectedFace,
  marginPercent: number = 20, // 20% margin
): { x: number; y: number; width: number; height: number } {
  const margin = (face.bounds.width * marginPercent) / 100;

  return {
    x: face.bounds.x - margin / 2,
    y: face.bounds.y - margin / 2,
    width: face.bounds.width + margin,
    height: face.bounds.height + margin,
  };
}

/**
 * Check if face is looking forward (suitable for masks)
 */
export function isFaceLookingForward(face: DetectedFace): boolean {
  const maxTilt = 20; // degrees
  return Math.abs(face.eulerAngleX) < maxTilt &&
    Math.abs(face.eulerAngleY) < maxTilt
    ? true
    : false;
}

/**
 * Check if face is looking left
 */
export function isFaceLookingLeft(face: DetectedFace): boolean {
  return face.eulerAngleY > 20; // degrees
}

/**
 * Check if face is looking right
 */
export function isFaceLookingRight(face: DetectedFace): boolean {
  return face.eulerAngleY < -20; // degrees
}

/**
 * Check if face is looking up
 */
export function isFaceLookingUp(face: DetectedFace): boolean {
  return face.eulerAngleX < -20; // degrees
}

/**
 * Check if face is looking down
 */
export function isFaceLookingDown(face: DetectedFace): boolean {
  return face.eulerAngleX > 20; // degrees
}

/**
 * Check if face is smiling
 */
export function isFaceSmiling(face: DetectedFace): boolean {
  return face.smilingProbability > 0.5;
}

/**
 * Check if both eyes are open
 */
export function areBothEyesOpen(face: DetectedFace): boolean {
  return face.leftEyeOpenProbability > 0.5 && face.rightEyeOpenProbability > 0.5
    ? true
    : false;
}

/**
 * Check if left eye is open
 */
export function isLeftEyeOpen(face: DetectedFace): boolean {
  return face.leftEyeOpenProbability > 0.5;
}

/**
 * Check if right eye is open
 */
export function isRightEyeOpen(face: DetectedFace): boolean {
  return face.rightEyeOpenProbability > 0.5;
}

/**
 * Get face expression (enum-like string)
 */
export function getFaceExpression(
  face: DetectedFace,
): "neutral" | "smiling" | "surprised" | "sad" {
  if (face.smilingProbability > 0.7) {
    return "smiling";
  }
  if (face.smilingProbability < 0.3) {
    return "sad";
  }
  return "neutral";
}

/**
 * Get rotation vector for 3D effect positioning
 */
export function getFace3DRotation(face: DetectedFace): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: face.eulerAngleX / 45, // Normalize to -1 to 1 range
    y: face.eulerAngleY / 45,
    z: 0,
  };
}

/**
 * Calculate distance between two facial landmarks
 */
export function getLandmarkDistance(
  landmark1: Point,
  landmark2: Point,
): number {
  const dx = landmark2.x - landmark1.x;
  const dy = landmark2.y - landmark1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get eye aspect ratio (for blink detection)
 * Values close to 0 indicate blink, > 0.1 indicates open eye
 */
export function getEyeAspectRatio(
  face: DetectedFace,
  eye: "left" | "right",
): number {
  const landmarks = face.landmarks;
  if (!landmarks) {
    return face.leftEyeOpenProbability; // Fallback
  }

  // This would require eye corner landmarks to calculate properly
  // For now, estimate from eye open probability
  return eye === "left"
    ? face.leftEyeOpenProbability
    : face.rightEyeOpenProbability;
}

/**
 * Configure face detection settings
 */
export interface FaceDetectionSettings {
  mode: FaceDetectionMode;
  minFaceSize: number; // Minimum face bounding box size in pixels
  minConfidence: number; // Minimum confidence threshold (0-1)
  landmarkDetection: boolean;
  expressionDetection: boolean;
  performanceMonitoring: boolean;
}

/**
 * Default settings for real-time detection
 */
export const DEFAULT_REALTIME_SETTINGS: FaceDetectionSettings = {
  mode: FaceDetectionMode.FAST,
  minFaceSize: 30,
  minConfidence: 0.7,
  landmarkDetection: true,
  expressionDetection: true,
  performanceMonitoring: false,
};

/**
 * Default settings for image-based detection
 */
export const DEFAULT_IMAGE_SETTINGS: FaceDetectionSettings = {
  mode: FaceDetectionMode.ACCURATE,
  minFaceSize: 50,
  minConfidence: 0.8,
  landmarkDetection: true,
  expressionDetection: true,
  performanceMonitoring: false,
};

/**
 * Get current face detection settings
 */
export function getDetectionSettings(): FaceDetectionSettings {
  return DEFAULT_REALTIME_SETTINGS;
}

/**
 * Update face detection settings
 */
export async function updateDetectionSettings(
  settings: Partial<FaceDetectionSettings>,
): Promise<void> {
  try {
    if (settings.mode !== undefined) {
      await FaceDetector.setDetectionMode(settings.mode);
    }

    console.log("[Native Face Detection] Settings updated");
  } catch (error) {
    console.error("[Native Face Detection] Failed to update settings:", error);
    throw error;
  }
}
