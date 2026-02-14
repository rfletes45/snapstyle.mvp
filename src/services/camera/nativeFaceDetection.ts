/**
 * NATIVE FACE DETECTION SERVICE
 * Real-time face detection using react-native-vision-camera + MLKit
 *
 * Replaces the old expo-face-detector stub with real face detection via
 * react-native-vision-camera-face-detector (Google MLKit under the hood).
 *
 * Architecture:
 *   - VisionCamera provides the camera feed + frame processor API
 *   - react-native-vision-camera-face-detector wraps MLKit Face Detection
 *   - This module converts MLKit results to our internal DetectedFace format
 *   - The useFaceDetection hook wires this into React state
 */

import {
  DetectedFace,
  FaceDetectionResult,
  FaceLandmarks,
  Point,
} from "@/types/camera";
import { createLogger } from "@/utils/log";

const logger = createLogger("services/camera/nativeFaceDetection");

// ─── Types from react-native-vision-camera-face-detector ─────────────────────
// Defined locally to avoid import issues on web/non-native platforms.

export interface MLKitFace {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pitchAngle: number;
  rollAngle: number;
  yawAngle: number;
  smilingProbability: number;
  leftEyeOpenProbability: number;
  rightEyeOpenProbability: number;
  trackingId?: number;
  landmarks?: MLKitLandmark[];
  contours?: MLKitContour[];
}

export interface MLKitLandmark {
  type: string;
  position: { x: number; y: number };
}

export interface MLKitContour {
  type: string;
  points: Array<{ x: number; y: number }>;
}

// ─── Face Detection Mode ─────────────────────────────────────────────────────

export enum FaceDetectionMode {
  FAST = 1,
  ACCURATE = 2,
}

// ─── Configuration ───────────────────────────────────────────────────────────

export interface FaceDetectionSettings {
  mode: FaceDetectionMode;
  minFaceSize: number;
  minConfidence: number;
  landmarkDetection: boolean;
  expressionDetection: boolean;
  performanceMonitoring: boolean;
}

export const DEFAULT_REALTIME_SETTINGS: FaceDetectionSettings = {
  mode: FaceDetectionMode.FAST,
  minFaceSize: 30,
  minConfidence: 0.5,
  landmarkDetection: true,
  expressionDetection: true,
  performanceMonitoring: false,
};

export const DEFAULT_IMAGE_SETTINGS: FaceDetectionSettings = {
  mode: FaceDetectionMode.ACCURATE,
  minFaceSize: 50,
  minConfidence: 0.8,
  landmarkDetection: true,
  expressionDetection: true,
  performanceMonitoring: false,
};

// ─── Current settings ────────────────────────────────────────────────────────

let currentSettings: FaceDetectionSettings = { ...DEFAULT_REALTIME_SETTINGS };

export function getDetectionSettings(): FaceDetectionSettings {
  return { ...currentSettings };
}

export async function updateDetectionSettings(
  settings: Partial<FaceDetectionSettings>,
): Promise<void> {
  currentSettings = { ...currentSettings, ...settings };
  logger.info("[Native Face Detection] Settings updated");
}

// ─── Initialization ──────────────────────────────────────────────────────────

export async function initializeFaceDetection(
  mode: FaceDetectionMode = FaceDetectionMode.FAST,
): Promise<void> {
  try {
    currentSettings.mode = mode;
    logger.info(
      `[Native Face Detection] Initialized (${mode === FaceDetectionMode.FAST ? "FAST" : "ACCURATE"} mode)`,
    );
    logger.info(
      "[Native Face Detection] Using react-native-vision-camera-face-detector (MLKit)",
    );
  } catch (error) {
    logger.error("[Native Face Detection] Failed to initialize:", error);
    throw error;
  }
}

// ─── Core Conversion: MLKit → Internal Format ───────────────────────────────

/**
 * Convert an array of MLKit Face results into our internal FaceDetectionResult.
 * Called from the useFaceDetection hook after each frame processor invocation.
 */
export function convertMLKitFaces(
  mlkitFaces: MLKitFace[],
): FaceDetectionResult {
  const faces = mlkitFaces
    .filter((face) => {
      const { width, height } = face.bounds;
      return (
        width > currentSettings.minFaceSize &&
        height > currentSettings.minFaceSize
      );
    })
    .map((face, index) => convertSingleFace(face, index));

  return {
    faces,
    timestamp: Date.now(),
  };
}

/**
 * Convert a single MLKit face to our DetectedFace format.
 */
function convertSingleFace(face: MLKitFace, index: number): DetectedFace {
  const landmarks = extractLandmarks(face);

  return {
    faceId: face.trackingId ?? index,
    bounds: {
      x: face.bounds.x,
      y: face.bounds.y,
      width: face.bounds.width,
      height: face.bounds.height,
    },
    landmarks,
    eulerAngleX: face.pitchAngle ?? 0,
    eulerAngleY: face.yawAngle ?? 0,
    eulerAngleZ: face.rollAngle ?? 0,
    leftEyeOpenProbability: face.leftEyeOpenProbability ?? 0.5,
    rightEyeOpenProbability: face.rightEyeOpenProbability ?? 0.5,
    smilingProbability: face.smilingProbability ?? 0,
    trackingId: face.trackingId ?? index,
  };
}

/**
 * Extract facial landmarks from MLKit face data.
 */
function extractLandmarks(face: MLKitFace): FaceLandmarks {
  const defaultPoint: Point = { x: 0, y: 0 };

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
    return estimateLandmarksFromBounds(face.bounds);
  }

  for (const landmark of face.landmarks) {
    const point: Point = { x: landmark.position.x, y: landmark.position.y };

    switch (landmark.type) {
      case "LEFT_EYE":
        landmarks.leftEye = point;
        break;
      case "RIGHT_EYE":
        landmarks.rightEye = point;
        break;
      case "LEFT_EAR":
        landmarks.leftEar = point;
        break;
      case "RIGHT_EAR":
        landmarks.rightEar = point;
        break;
      case "LEFT_CHEEK":
        landmarks.leftCheek = point;
        break;
      case "RIGHT_CHEEK":
        landmarks.rightCheek = point;
        break;
      case "MOUTH_LEFT":
        landmarks.leftMouth = point;
        break;
      case "MOUTH_RIGHT":
        landmarks.rightMouth = point;
        break;
      case "MOUTH_BOTTOM":
        landmarks.mouthBottom = point;
        break;
      case "NOSE_BASE":
        landmarks.noseBase = point;
        break;
    }
  }

  fillMissingLandmarks(landmarks, face.bounds);
  return landmarks;
}

/**
 * Estimate landmark positions from bounding box (average face proportions).
 */
function estimateLandmarksFromBounds(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): FaceLandmarks {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const w = bounds.width;
  const h = bounds.height;

  return {
    leftEye: { x: cx - w * 0.18, y: cy - h * 0.12 },
    rightEye: { x: cx + w * 0.18, y: cy - h * 0.12 },
    leftEar: { x: cx - w * 0.45, y: cy - h * 0.05 },
    rightEar: { x: cx + w * 0.45, y: cy - h * 0.05 },
    leftCheek: { x: cx - w * 0.28, y: cy + h * 0.08 },
    rightCheek: { x: cx + w * 0.28, y: cy + h * 0.08 },
    leftMouth: { x: cx - w * 0.15, y: cy + h * 0.25 },
    rightMouth: { x: cx + w * 0.15, y: cy + h * 0.25 },
    mouthBottom: { x: cx, y: cy + h * 0.32 },
    noseBase: { x: cx, y: cy + h * 0.05 },
  };
}

/**
 * Fill in any landmarks that are still at (0,0) with estimates.
 */
function fillMissingLandmarks(
  landmarks: FaceLandmarks,
  bounds: { x: number; y: number; width: number; height: number },
): void {
  const estimated = estimateLandmarksFromBounds(bounds);
  const keys = Object.keys(landmarks) as Array<keyof FaceLandmarks>;

  for (const key of keys) {
    if (landmarks[key].x === 0 && landmarks[key].y === 0) {
      landmarks[key] = estimated[key];
    }
  }
}

// ─── Legacy API Compatibility ────────────────────────────────────────────────

/**
 * Detect faces from frame data (legacy callback-based API).
 */
export async function detectFacesInFrame(
  frameData: any,
): Promise<FaceDetectionResult> {
  if (!frameData || !frameData.faces) {
    return { faces: [], timestamp: Date.now() };
  }
  return convertMLKitFaces(frameData.faces);
}

/**
 * Detect faces in a static image.
 */
export async function detectFacesInImage(
  imageUri: string,
): Promise<FaceDetectionResult> {
  try {
    logger.info("[Native Face Detection] Detecting faces in static image");

    const { detectFaces } =
      await import("react-native-vision-camera-face-detector");

    const faces = await detectFaces({
      image: imageUri,
      options: {
        performanceMode:
          currentSettings.mode === FaceDetectionMode.FAST ? "fast" : "accurate",
        landmarkMode: currentSettings.landmarkDetection ? "all" : "none",
        classificationMode: currentSettings.expressionDetection
          ? "all"
          : "none",
      },
    });

    return convertMLKitFaces(faces as unknown as MLKitFace[]);
  } catch (error) {
    logger.warn(
      "[Native Face Detection] Static image detection failed:",
      error,
    );
    return { faces: [], timestamp: Date.now() };
  }
}

// ─── Utility Functions ───────────────────────────────────────────────────────

export function getFaceEffectBounds(
  face: DetectedFace,
  marginPercent: number = 20,
): { x: number; y: number; width: number; height: number } {
  const margin = (face.bounds.width * marginPercent) / 100;
  return {
    x: face.bounds.x - margin / 2,
    y: face.bounds.y - margin / 2,
    width: face.bounds.width + margin,
    height: face.bounds.height + margin,
  };
}

export function isFaceLookingForward(face: DetectedFace): boolean {
  return Math.abs(face.eulerAngleX) < 20 && Math.abs(face.eulerAngleY) < 20;
}

export function isFaceLookingLeft(face: DetectedFace): boolean {
  return face.eulerAngleY > 20;
}

export function isFaceLookingRight(face: DetectedFace): boolean {
  return face.eulerAngleY < -20;
}

export function isFaceLookingUp(face: DetectedFace): boolean {
  return face.eulerAngleX < -20;
}

export function isFaceLookingDown(face: DetectedFace): boolean {
  return face.eulerAngleX > 20;
}

export function isFaceSmiling(face: DetectedFace): boolean {
  return face.smilingProbability > 0.5;
}

export function areBothEyesOpen(face: DetectedFace): boolean {
  return (
    face.leftEyeOpenProbability > 0.5 && face.rightEyeOpenProbability > 0.5
  );
}

export function isLeftEyeOpen(face: DetectedFace): boolean {
  return face.leftEyeOpenProbability > 0.5;
}

export function isRightEyeOpen(face: DetectedFace): boolean {
  return face.rightEyeOpenProbability > 0.5;
}

export function getFaceExpression(
  face: DetectedFace,
): "neutral" | "smiling" | "surprised" | "sad" {
  if (face.smilingProbability > 0.7) return "smiling";
  if (face.smilingProbability < 0.3) return "sad";
  return "neutral";
}

export function getFace3DRotation(face: DetectedFace): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: face.eulerAngleX / 45,
    y: face.eulerAngleY / 45,
    z: face.eulerAngleZ / 45,
  };
}

export function getLandmarkDistance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getEyeAspectRatio(
  face: DetectedFace,
  eye: "left" | "right",
): number {
  return eye === "left"
    ? face.leftEyeOpenProbability
    : face.rightEyeOpenProbability;
}

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
