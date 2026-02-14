/**
 * NATIVE IMAGE FILTERING SERVICE (LEGACY)
 *
 * ⚠️  SUPERSEDED by Skia-based rendering in SkiaFilteredImage.tsx
 *
 * This module used expo-image-manipulator for filter application, but
 * ImageManipulator only supports resize/crop/rotate/flip — it CANNOT do
 * colour grading (brightness, contrast, saturation, hue, blur).
 *
 * All filter rendering is now handled by @shopify/react-native-skia via:
 *   - SkiaFilteredImage (editor)     → ColorMatrix + Blur + Vignette + Grain
 *   - CameraFilterOverlay (live)     → Skia Canvas + Fill + BlendColor
 *   - filterService.filterConfigToColorMatrix() → Skia-compatible 20-element array
 *
 * This file is kept for backward compatibility with any code still
 * calling applyFilterToImage(), but it returns the original image unchanged.
 */

import { FilterConfig } from "@/types/camera";
import * as ImageManipulator from "expo-image-manipulator";

import { createLogger } from "@/utils/log";
const logger = createLogger("services/camera/nativeImageFiltering");
/**
 * Color matrix type for advanced filtering
 */
interface ColorMatrix {
  matrix: number[][];
}

/**
 * Apply filter to image using native processing
 * Uses expo-image-manipulator for performance
 */
export async function applyFilterToImage(
  imageUri: string,
  filter: FilterConfig,
  intensity: number = 1.0,
): Promise<string> {
  try {
    logger.info(
      `[Native Image Filtering] Applying filter ${filter.id} at intensity ${intensity}`,
    );

    // Clamp intensity
    const clampedIntensity = Math.max(0, Math.min(1, intensity));

    // Create manipulator actions
    const actions: ImageManipulator.Action[] = [];

    // Apply brightness (in range -0.5 to 0.5)
    if (filter.brightness !== 0) {
      const brightnessDelta = filter.brightness * clampedIntensity * 0.5; // -0.5 to 0.5
      // expo-image-manipulator doesn't support brightness natively
      // Would need Skia or Canvas for real implementation
      logger.info(
        `[Native Image Filtering] Brightness adjustment: ${brightnessDelta} (placeholder)`,
      );
    }

    // Apply saturation and hue shift
    // These require color manipulation which needs Skia or Canvas
    if (filter.saturation !== 0 || filter.hue !== 0) {
      logger.info(
        `[Native Image Filtering] Saturation/hue adjustment (placeholder)`,
      );
    }

    // Apply blur if specified
    if (filter.blur && filter.blur > 0) {
      const blurAmount = Math.round(filter.blur * clampedIntensity * 10);
      if (blurAmount > 0) {
        // expo-image-manipulator doesn't support blur natively
        logger.info(
          `[Native Image Filtering] Blur: ${blurAmount} (placeholder)`,
        );
      }
    }

    // If no color actions, just return original
    if (actions.length === 0) {
      return imageUri;
    }

    // Apply manipulations using the native library
    // Note: expo-image-manipulator has limited filter support
    // For full filter implementation, we need to use native code or canvas
    const result = await ImageManipulator.manipulateAsync(imageUri, actions, {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    logger.info(`[Native Image Filtering] Filter applied successfully`);
    return result.uri;
  } catch (error) {
    logger.error("[Native Image Filtering] Failed to apply filter:", error);
    throw error;
  }
}

/**
 * Apply multiple filters with blending
 * Creates a composite effect
 */
export async function applyMultipleFilters(
  imageUri: string,
  filters: Array<{ filter: FilterConfig; intensity: number }>,
): Promise<string> {
  try {
    logger.info(
      `[Native Image Filtering] Applying ${filters.length} filters with blending`,
    );

    let currentUri = imageUri;

    // Apply filters sequentially
    for (const { filter, intensity } of filters) {
      currentUri = await applyFilterToImage(currentUri, filter, intensity);
    }

    return currentUri;
  } catch (error) {
    logger.error(
      "[Native Image Filtering] Failed to apply multiple filters:",
      error,
    );
    throw error;
  }
}

/**
 * Generate color adjustment matrix
 * Converts brightness, contrast, saturation, hue into color transformation
 */
export function generateColorMatrix(
  brightness: number,
  contrast: number,
  saturation: number,
  hue: number,
): ColorMatrix {
  // 4x5 color transformation matrix
  // [R, G, B, A, Offset]

  // Start with identity matrix
  let matrix: number[][] = [
    [1, 0, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0],
  ];

  // Apply contrast
  const contrastFactor = (contrast - 1) * 127.5;
  matrix[0][0] = contrast;
  matrix[1][1] = contrast;
  matrix[2][2] = contrast;
  matrix[0][4] = contrastFactor;
  matrix[1][4] = contrastFactor;
  matrix[2][4] = contrastFactor;

  // Apply brightness
  const brightnessDelta = brightness * 255;
  matrix[0][4] += brightnessDelta;
  matrix[1][4] += brightnessDelta;
  matrix[2][4] += brightnessDelta;

  // Apply saturation using luminance-preserving desaturation
  const saturationMatrix = createSaturationMatrix(saturation);
  matrix = multiplyMatrices(matrix, saturationMatrix);

  // Apply hue rotation
  if (hue !== 0) {
    const hueMatrix = createHueRotationMatrix(hue);
    matrix = multiplyMatrices(matrix, hueMatrix);
  }

  return { matrix };
}

/**
 * Create saturation adjustment matrix
 */
function createSaturationMatrix(saturation: number): number[][] {
  // Grayscale coefficients for RGB
  const luminance = [0.3, 0.59, 0.11];

  // Interpolate between grayscale and original color
  const r0 = luminance[0] * (1 - saturation) + saturation;
  const r1 = luminance[1] * (1 - saturation);
  const r2 = luminance[2] * (1 - saturation);

  const g0 = luminance[0] * (1 - saturation);
  const g1 = luminance[1] * (1 - saturation) + saturation;
  const g2 = luminance[2] * (1 - saturation);

  const b0 = luminance[0] * (1 - saturation);
  const b1 = luminance[1] * (1 - saturation);
  const b2 = luminance[2] * (1 - saturation) + saturation;

  return [
    [r0, r1, r2, 0, 0],
    [g0, g1, g2, 0, 0],
    [b0, b1, b2, 0, 0],
    [0, 0, 0, 1, 0],
  ];
}

/**
 * Create hue rotation matrix (in degrees)
 */
function createHueRotationMatrix(hue: number): number[][] {
  // Convert to radians
  const radians = (hue * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  // Hue rotation matrix for RGB
  // Based on the luminance coefficients
  const lumR = 0.299;
  const lumG = 0.587;
  const lumB = 0.114;

  return [
    [
      lumR + cos * (1 - lumR) + sin * -lumR,
      lumG + cos * -lumG + sin * -lumG,
      lumB + cos * -lumB + sin * (1 - lumB),
      0,
      0,
    ],
    [
      lumR + cos * -lumR + sin * 0.143,
      lumG + cos * (1 - lumG) + sin * 0.14,
      lumB + cos * -lumB + sin * -0.283,
      0,
      0,
    ],
    [
      lumR + cos * -lumR + sin * -(1 - lumR),
      lumG + cos * -lumG + sin * lumG,
      lumB + cos * (1 - lumB) + sin * lumB,
      0,
      0,
    ],
    [0, 0, 0, 1, 0],
  ];
}

/**
 * Multiply two 4x5 matrices
 */
function multiplyMatrices(a: number[][], b: number[][]): number[][] {
  const result: number[][] = [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ];

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 5; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }

  return result;
}

/**
 * Apply sepia tone effect
 * Creates warm, vintage brown color cast
 */
export async function applySepiaEffect(
  imageUri: string,
  intensity: number = 1.0,
): Promise<string> {
  try {
    logger.info(
      `[Native Image Filtering] Applying sepia effect at intensity ${intensity}`,
    );

    const clampedIntensity = Math.max(0, Math.min(1, intensity));

    // Sepia transformation matrix
    const r = 0.393 + 0.607 * (1 - clampedIntensity);
    const g = 0.769 - 0.769 * clampedIntensity;
    const b = 0.189 - 0.189 * clampedIntensity;

    const result = await ImageManipulator.manipulateAsync(imageUri, [], {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    return result.uri;
  } catch (error) {
    logger.error(
      "[Native Image Filtering] Failed to apply sepia effect:",
      error,
    );
    throw error;
  }
}

/**
 * Apply vignette effect
 * Darkens edges of image
 */
export async function applyVignetteEffect(
  imageUri: string,
  intensity: number = 1.0,
): Promise<string> {
  try {
    logger.info(
      `[Native Image Filtering] Applying vignette effect at intensity ${intensity}`,
    );

    // Vignette would require custom rendering
    // For now, return original
    return imageUri;
  } catch (error) {
    logger.error(
      "[Native Image Filtering] Failed to apply vignette effect:",
      error,
    );
    throw error;
  }
}

/**
 * Apply blur effect
 */
export async function applyBlurEffect(
  imageUri: string,
  radius: number = 10,
): Promise<string> {
  try {
    logger.info(
      `[Native Image Filtering] Applying blur effect with radius ${radius}`,
    );

    // Blur is limited in expo-image-manipulator
    // Use native code for better results
    const result = await ImageManipulator.manipulateAsync(imageUri, [], {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    return result.uri;
  } catch (error) {
    logger.error(
      "[Native Image Filtering] Failed to apply blur effect:",
      error,
    );
    throw error;
  }
}

/**
 * Resize image while maintaining aspect ratio
 */
export async function resizeImage(
  imageUri: string,
  maxWidth: number,
  maxHeight: number,
): Promise<string> {
  try {
    logger.info(
      `[Native Image Filtering] Resizing image to ${maxWidth}x${maxHeight}`,
    );

    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: maxWidth, height: maxHeight } }],
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    logger.info(`[Native Image Filtering] Image resized successfully`);
    return result.uri;
  } catch (error) {
    logger.error("[Native Image Filtering] Failed to resize image:", error);
    throw error;
  }
}

/**
 * Compress image with quality setting
 */
export async function compressImage(
  imageUri: string,
  quality: number = 0.85,
): Promise<string> {
  try {
    logger.info(
      `[Native Image Filtering] Compressing image to quality ${quality}`,
    );

    const clampedQuality = Math.max(0.1, Math.min(1, quality));

    const result = await ImageManipulator.manipulateAsync(imageUri, [], {
      compress: clampedQuality,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    logger.info(`[Native Image Filtering] Image compressed successfully`);
    return result.uri;
  } catch (error) {
    logger.error("[Native Image Filtering] Failed to compress image:", error);
    throw error;
  }
}

/**
 * Rotate image
 */
export async function rotateImage(
  imageUri: string,
  degrees: number,
): Promise<string> {
  try {
    logger.info(`[Native Image Filtering] Rotating image by ${degrees}°`);

    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ rotate: degrees }],
      {
        compress: 1,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    logger.info(`[Native Image Filtering] Image rotated successfully`);
    return result.uri;
  } catch (error) {
    logger.error("[Native Image Filtering] Failed to rotate image:", error);
    throw error;
  }
}

/**
 * Flip image (horizontal or vertical)
 */
export async function flipImage(
  imageUri: string,
  direction: "horizontal" | "vertical",
): Promise<string> {
  try {
    logger.info(`[Native Image Filtering] Flipping image ${direction}`);

    const actions: ImageManipulator.Action[] = [];

    if (direction === "horizontal") {
      actions.push({ flip: ImageManipulator.FlipType.Horizontal });
    } else {
      actions.push({ flip: ImageManipulator.FlipType.Vertical });
    }

    const result = await ImageManipulator.manipulateAsync(imageUri, actions, {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    logger.info(`[Native Image Filtering] Image flipped successfully`);
    return result.uri;
  } catch (error) {
    logger.error("[Native Image Filtering] Failed to flip image:", error);
    throw error;
  }
}

/**
 * Crop image to specific dimensions
 */
export async function cropImage(
  imageUri: string,
  originX: number,
  originY: number,
  width: number,
  height: number,
): Promise<string> {
  try {
    logger.info(
      `[Native Image Filtering] Cropping image to ${width}x${height} at (${originX}, ${originY})`,
    );

    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        {
          crop: {
            originX,
            originY,
            width,
            height,
          },
        },
      ],
      {
        compress: 1,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    logger.info(`[Native Image Filtering] Image cropped successfully`);
    return result.uri;
  } catch (error) {
    logger.error("[Native Image Filtering] Failed to crop image:", error);
    throw error;
  }
}

/**
 * Extract dominant color from image
 * Useful for theme generation
 */
export async function extractDominantColor(
  imageUri: string,
): Promise<{ r: number; g: number; b: number }> {
  try {
    logger.info(`[Native Image Filtering] Extracting dominant color`);

    // This would require image analysis
    // Return placeholder
    return { r: 128, g: 128, b: 128 };
  } catch (error) {
    logger.error(
      "[Native Image Filtering] Failed to extract dominant color:",
      error,
    );
    throw error;
  }
}

/**
 * Apply instant film look (combination of filters)
 */
export async function applyInstantFilmLook(imageUri: string): Promise<string> {
  try {
    logger.info(`[Native Image Filtering] Applying instant film look`);

    const result = await ImageManipulator.manipulateAsync(imageUri, [], {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    return result.uri;
  } catch (error) {
    logger.error(
      "[Native Image Filtering] Failed to apply instant film look:",
      error,
    );
    throw error;
  }
}

/**
 * Apply black and white conversion
 */
export async function applyBlackAndWhite(imageUri: string): Promise<string> {
  try {
    logger.info(`[Native Image Filtering] Applying black and white conversion`);

    const result = await ImageManipulator.manipulateAsync(imageUri, [], {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    return result.uri;
  } catch (error) {
    logger.error(
      "[Native Image Filtering] Failed to apply black and white conversion:",
      error,
    );
    throw error;
  }
}
