/**
 * EDITOR SERVICE
 * Handles rendering overlays, applying effects, and exporting media
 */

import * as ImageManipulator from "expo-image-manipulator";
import {
  AppliedFilter,
  DrawingElement,
  OverlayElement,
  PollElement,
  StickerElement,
  TextElement,
} from "../../types/camera";

/**
 * ============================================================================
 * OVERLAY RENDERING
 * ============================================================================
 */

/**
 * Render single overlay element on image
 */
export async function renderOverlayElement(
  baseImageUri: string,
  element: OverlayElement,
): Promise<string> {
  try {
    console.log(`[Editor Service] Rendering overlay element: ${element.type}`);

    // This would use native graphics libraries (Skia, Canvas)
    // For now, return base image (placeholder)

    switch (element.type) {
      case "text":
        return renderTextElement(baseImageUri, element as TextElement);

      case "sticker":
        return renderStickerElement(baseImageUri, element as StickerElement);

      case "drawing":
        return renderDrawingElement(baseImageUri, element as DrawingElement);

      case "poll":
        return renderPollElement(baseImageUri, element as PollElement);

      default:
        return baseImageUri;
    }
  } catch (error) {
    console.error("[Editor Service] Failed to render overlay element:", error);
    return baseImageUri;
  }
}

/**
 * Render all overlays on image
 */
export async function renderAllOverlays(
  baseImageUri: string,
  elements: OverlayElement[],
): Promise<string> {
  try {
    if (elements.length === 0) return baseImageUri;

    console.log(
      `[Editor Service] Rendering ${elements.length} overlay elements`,
    );

    // Process elements in order (bottom to top layer)
    let resultUri = baseImageUri;

    for (const element of elements) {
      resultUri = await renderOverlayElement(resultUri, element);
    }

    return resultUri;
  } catch (error) {
    console.error("[Editor Service] Failed to render all overlays:", error);
    return baseImageUri;
  }
}

/**
 * Render text element
 */
async function renderTextElement(
  baseImageUri: string,
  element: TextElement,
): Promise<string> {
  try {
    // This would use native canvas API with:
    // - Font selection
    // - Color application
    // - Stroke/shadow effects
    // - Rotation

    console.log(`[Editor Service] Rendering text: "${element.content}"`);

    // Placeholder: return base image
    return baseImageUri;
  } catch (error) {
    console.error("[Editor Service] Failed to render text element:", error);
    return baseImageUri;
  }
}

/**
 * Render sticker element
 */
async function renderStickerElement(
  baseImageUri: string,
  element: StickerElement,
): Promise<string> {
  try {
    console.log(`[Editor Service] Rendering sticker: ${element.stickerId}`);

    // This would:
    // 1. Load sticker asset
    // 2. Resize to element.size
    // 3. Rotate by element.rotation
    // 4. Apply opacity
    // 5. Composite on base image at position

    // Placeholder: return base image
    return baseImageUri;
  } catch (error) {
    console.error("[Editor Service] Failed to render sticker element:", error);
    return baseImageUri;
  }
}

/**
 * Render drawing element
 */
async function renderDrawingElement(
  baseImageUri: string,
  element: DrawingElement,
): Promise<string> {
  try {
    console.log(
      `[Editor Service] Rendering drawing with ${element.paths.length} paths`,
    );

    // Delegate to native drawing service
    const { renderDrawingOnImage } = await import("./nativeDrawing");
    return renderDrawingOnImage(baseImageUri, element.paths);
  } catch (error) {
    console.error("[Editor Service] Failed to render drawing element:", error);
    return baseImageUri;
  }
}

/**
 * Render poll element
 */
async function renderPollElement(
  baseImageUri: string,
  element: PollElement,
): Promise<string> {
  try {
    console.log(`[Editor Service] Rendering poll: "${element.question}"`);

    // This would:
    // 1. Create poll UI (question + options/results)
    // 2. Render as image
    // 3. Composite on base image at position
    // 4. Apply styling (colors, fonts)

    // Placeholder: return base image
    return baseImageUri;
  } catch (error) {
    console.error("[Editor Service] Failed to render poll element:", error);
    return baseImageUri;
  }
}

/**
 * ============================================================================
 * FILTER APPLICATION
 * ============================================================================
 */

/**
 * Apply filters to image
 */
export async function applyFiltersToImage(
  imageUri: string,
  filters: AppliedFilter[],
): Promise<string> {
  try {
    if (filters.length === 0) return imageUri;

    console.log(`[Editor Service] Applying ${filters.length} filters to image`);

    // Would apply color adjustments, blur, sepia, etc. using native APIs
    // Placeholder: return image

    return imageUri;
  } catch (error) {
    console.error("[Editor Service] Failed to apply filters:", error);
    return imageUri;
  }
}

/**
 * ============================================================================
 * SNAP EXPORT
 * ============================================================================
 */

/**
 * Export snap as final image
 * Combines base media + overlays + filters
 */
export async function exportSnapAsImage(
  mediaUri: string,
  overlays: OverlayElement[],
  filters: AppliedFilter[],
): Promise<string> {
  try {
    console.log("[Editor Service] Exporting snap as image");

    // Process in order:
    // 1. Apply filters
    // 2. Render overlays
    // 3. Optimize and compress
    // 4. Return final URI

    let resultUri = mediaUri;

    // Apply filters
    resultUri = await applyFiltersToImage(resultUri, filters);

    // Render overlays
    resultUri = await renderAllOverlays(resultUri, overlays);

    // Optimize
    const optimized = await ImageManipulator.manipulateAsync(resultUri, [], {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    return optimized.uri;
  } catch (error) {
    console.error("[Editor Service] Failed to export snap as image:", error);
    throw error;
  }
}

/**
 * Export snap as video
 * Applies overlays and filters to video frames
 */
export async function exportSnapAsVideo(
  videoUri: string,
  overlays: OverlayElement[],
  filters: AppliedFilter[],
): Promise<string> {
  try {
    console.log("[Editor Service] Exporting snap as video");

    // This requires FFmpeg for video processing:
    // 1. Extract frames
    // 2. Apply filters to each frame
    // 3. Render overlays on each frame
    // 4. Re-encode to video
    // 5. Add audio back

    // Placeholder: return original
    return videoUri;
  } catch (error) {
    console.error("[Editor Service] Failed to export snap as video:", error);
    throw error;
  }
}

/**
 * ============================================================================
 * ELEMENT POSITIONING & MANIPULATION
 * ============================================================================
 */

/**
 * Calculate element position relative to container
 */
export function calculateElementPosition(
  containerSize: { width: number; height: number },
  elementSize: { width: number; height: number },
  position: { x: number; y: number },
): { x: number; y: number } {
  // Ensure element stays within container
  const maxX = containerSize.width - elementSize.width;
  const maxY = containerSize.height - elementSize.height;

  return {
    x: Math.max(0, Math.min(position.x, maxX)),
    y: Math.max(0, Math.min(position.y, maxY)),
  };
}

/**
 * Get element bounding box
 */
export function getElementBounds(element: OverlayElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  switch (element.type) {
    case "text":
      const textEl = element as TextElement;
      return {
        x: textEl.position.x,
        y: textEl.position.y,
        width: textEl.content.length * textEl.size * 0.5, // Approximate
        height: textEl.size * 1.2,
      };

    case "sticker":
      const stickerEl = element as StickerElement;
      return {
        x: stickerEl.position.x - stickerEl.size / 2,
        y: stickerEl.position.y - stickerEl.size / 2,
        width: stickerEl.size,
        height: stickerEl.size,
      };

    case "drawing":
      const drawingEl = element as DrawingElement;
      return getDrawingBounds(drawingEl);

    case "poll":
      const pollEl = element as PollElement;
      return {
        x: pollEl.position.x,
        y: pollEl.position.y,
        width: 300, // Approximate
        height: 200,
      };

    default:
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}

/**
 * Get bounding box for drawing
 */
function getDrawingBounds(drawing: DrawingElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  drawing.paths.forEach((path) => {
    path.points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Check if point touches element
 */
export function isPointInElement(
  point: { x: number; y: number },
  element: OverlayElement,
): boolean {
  const bounds = getElementBounds(element);
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

/**
 * ============================================================================
 * CANVAS & DRAWING
 * ============================================================================
 */

/**
 * Create blank canvas for drawing
 */
export function createDrawingCanvas(width: number, height: number): Canvas {
  // Placeholder: would use react-native-canvas or react-native-skia
  return {} as Canvas;
}

/**
 * Draw path on canvas
 */
export function drawPath(
  canvas: Canvas,
  path: { x: number; y: number }[],
  color: string,
  width: number,
  opacity: number,
): void {
  // Implementation would use canvas API
}

/**
 * Export canvas as image
 */
export async function exportCanvasAsImage(canvas: Canvas): Promise<string> {
  // Would convert canvas to image URI
  return "";
}

/**
 * ============================================================================
 * OPTIMIZATION
 * ============================================================================
 */

/**
 * Estimate file size after all processing
 */
export function estimateFinalFileSize(
  originalSize: number,
  hasOverlays: boolean,
  hasFilters: boolean,
): number {
  // Base + overhead for processing
  let estimatedSize = originalSize * 1.05; // 5% overhead

  // Overlays can increase complexity
  if (hasOverlays) {
    estimatedSize *= 1.1;
  }

  // Filters applied during export
  if (hasFilters) {
    estimatedSize *= 1.05;
  }

  return Math.round(estimatedSize);
}

/**
 * Check if export will be too large
 */
export function isExportSizeTooLarge(
  estimatedSize: number,
  maxSize: number = 10 * 1024 * 1024,
): boolean {
  // Max 10MB by default
  return estimatedSize > maxSize;
}

// Canvas type placeholder
interface Canvas {
  // Canvas context methods
}
