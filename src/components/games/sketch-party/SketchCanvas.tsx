/**
 * SketchCanvas — Platform-split re-export for TypeScript module resolution.
 *
 * At runtime, Metro/webpack resolves:
 *   - SketchCanvas.native.tsx (Skia, mobile)
 *   - SketchCanvas.web.tsx (HTML canvas, web)
 *
 * This file exists solely so `tsc` can resolve `./SketchCanvas` imports.
 */

export {
  SketchCanvas,
  type SketchCanvasProps,
  type SketchCanvasRef,
} from "./SketchCanvas.native";
