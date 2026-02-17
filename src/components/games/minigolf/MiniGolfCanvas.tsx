/**
 * MiniGolfCanvas — Platform-split re-export for TypeScript module resolution.
 *
 * At runtime, Metro resolves:
 *   - MiniGolfCanvas.native.tsx (Skia, mobile)
 *   - MiniGolfCanvas.web.tsx   (HTML canvas 2D, web)
 *
 * This file exists solely so `tsc` can resolve `./MiniGolfCanvas` imports.
 */

export {
  MiniGolfCanvas,
  type MiniGolfCanvasProps,
} from "./MiniGolfCanvas.native";
