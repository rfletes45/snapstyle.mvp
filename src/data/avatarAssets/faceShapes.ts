/**
 * Face Shape Definitions
 *
 * 8 face shapes with SVG path data for head/face outline.
 * Paths are designed for a 200x300 viewBox with head centered around (100, 80).
 */

import type { FaceShapeData, FaceShapeId } from "@/types/avatar";

/**
 * Complete face shape catalog
 */
export const FACE_SHAPES: FaceShapeData[] = [
  {
    id: "oval",
    name: "Oval",
    // Classic oval shape - balanced proportions
    svgPath:
      "M100,20 C140,20 165,50 170,90 C175,130 165,170 150,195 C135,220 115,235 100,240 C85,235 65,220 50,195 C35,170 25,130 30,90 C35,50 60,20 100,20 Z",
    chinOffset: 0,
    jawWidth: 1.0,
    cheekCurve: 0.5,
  },
  {
    id: "round",
    name: "Round",
    // Circular, soft features
    svgPath:
      "M100,15 C150,15 180,55 180,115 C180,175 150,225 100,225 C50,225 20,175 20,115 C20,55 50,15 100,15 Z",
    chinOffset: -10,
    jawWidth: 1.1,
    cheekCurve: 0.8,
  },
  {
    id: "square",
    name: "Square",
    // Strong jawline, angular
    svgPath:
      "M100,20 C135,20 165,35 175,65 C180,95 180,155 175,195 C165,225 135,240 100,240 C65,240 35,225 25,195 C20,155 20,95 25,65 C35,35 65,20 100,20 Z",
    chinOffset: 5,
    jawWidth: 1.2,
    cheekCurve: 0.2,
  },
  {
    id: "heart",
    name: "Heart",
    // Wide forehead, pointed chin
    svgPath:
      "M100,20 C150,20 175,45 178,85 C180,125 165,165 145,200 C125,230 110,245 100,250 C90,245 75,230 55,200 C35,165 20,125 22,85 C25,45 50,20 100,20 Z",
    chinOffset: 10,
    jawWidth: 0.85,
    cheekCurve: 0.4,
  },
  {
    id: "oblong",
    name: "Oblong",
    // Long and narrow
    svgPath:
      "M100,10 C135,10 155,35 160,75 C165,115 165,175 160,215 C155,250 135,270 100,270 C65,270 45,250 40,215 C35,175 35,115 40,75 C45,35 65,10 100,10 Z",
    chinOffset: 15,
    jawWidth: 0.9,
    cheekCurve: 0.3,
  },
  {
    id: "diamond",
    name: "Diamond",
    // Wide cheekbones, narrow forehead and jaw
    svgPath:
      "M100,25 C125,25 145,40 155,70 C170,100 175,130 170,155 C165,180 145,210 120,230 C105,245 100,250 100,250 C100,250 95,245 80,230 C55,210 35,180 30,155 C25,130 30,100 45,70 C55,40 75,25 100,25 Z",
    chinOffset: 8,
    jawWidth: 0.8,
    cheekCurve: 0.6,
  },
  {
    id: "triangle",
    name: "Triangle",
    // Narrow forehead, wide jaw
    svgPath:
      "M100,25 C130,25 150,40 155,70 C160,100 165,140 170,180 C172,210 160,235 100,240 C40,235 28,210 30,180 C35,140 40,100 45,70 C50,40 70,25 100,25 Z",
    chinOffset: 5,
    jawWidth: 1.25,
    cheekCurve: 0.35,
  },
  {
    id: "rectangle",
    name: "Rectangle",
    // Longer face, squared jaw
    svgPath:
      "M100,15 C140,15 165,35 170,65 C175,95 175,165 170,210 C165,245 140,265 100,265 C60,265 35,245 30,210 C25,165 25,95 30,65 C35,35 60,15 100,15 Z",
    chinOffset: 12,
    jawWidth: 1.15,
    cheekCurve: 0.25,
  },
];

/**
 * Get face shape data by ID
 */
export function getFaceShape(id: FaceShapeId): FaceShapeData {
  const shape = FACE_SHAPES.find((s) => s.id === id);
  if (!shape) {
    console.warn(`Face shape not found: ${id}, using default (oval)`);
    return FACE_SHAPES[0]; // Default to oval
  }
  return shape;
}

/**
 * Default face shape ID
 */
export const DEFAULT_FACE_SHAPE: FaceShapeId = "oval";

/**
 * Face anchor points for feature placement
 * These coordinates work with the 200x300 viewBox
 */
export const FACE_ANCHORS = {
  /** Center of the face for eye-level features */
  center: { x: 100, y: 90 },
  /** Left eye position */
  leftEye: { x: 70, y: 85 },
  /** Right eye position */
  rightEye: { x: 130, y: 85 },
  /** Nose position */
  nose: { x: 100, y: 115 },
  /** Mouth position */
  mouth: { x: 100, y: 150 },
  /** Left ear position */
  leftEar: { x: 25, y: 95 },
  /** Right ear position */
  rightEar: { x: 175, y: 95 },
  /** Forehead/hair start */
  forehead: { x: 100, y: 30 },
  /** Chin point */
  chin: { x: 100, y: 230 },
};
