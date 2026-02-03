/**
 * Avatar Validation Utilities
 *
 * Functions to validate avatar configurations for correctness
 * before saving to Firestore.
 */

import type {
  AvatarValidationResult,
  DigitalAvatarConfig,
} from "@/types/avatar";

/**
 * Validates avatar configuration for completeness and correctness
 *
 * Checks:
 * - Required fields are present
 * - Numeric values are within valid ranges
 * - Returns errors and warnings
 */
export function validateAvatarConfig(
  config: DigitalAvatarConfig,
): AvatarValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // VERSION & METADATA VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  if (config.version !== 2) {
    errors.push("Invalid version (expected 2)");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BODY VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  if (!config.body) {
    errors.push("Missing body configuration");
  } else {
    if (!config.body.skinTone) {
      errors.push("Missing skin tone");
    }
    if (!config.body.shape) {
      errors.push("Missing body shape");
    }
    if (
      config.body.height !== undefined &&
      (config.body.height < 0.8 || config.body.height > 1.2)
    ) {
      errors.push("Body height out of range (0.8-1.2)");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FACE VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  if (!config.face) {
    errors.push("Missing face configuration");
  } else {
    if (!config.face.shape) {
      errors.push("Missing face shape");
    }
    if (
      config.face.width !== undefined &&
      (config.face.width < 0.8 || config.face.width > 1.2)
    ) {
      errors.push("Face width out of range (0.8-1.2)");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EYES VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  if (!config.eyes) {
    errors.push("Missing eyes configuration");
  } else {
    if (!config.eyes.style) {
      errors.push("Missing eye style");
    }
    if (!config.eyes.color) {
      errors.push("Missing eye color");
    }
    if (
      config.eyes.size !== undefined &&
      (config.eyes.size < 0.8 || config.eyes.size > 1.2)
    ) {
      errors.push("Eye size out of range (0.8-1.2)");
    }
    if (
      config.eyes.spacing !== undefined &&
      (config.eyes.spacing < 0.8 || config.eyes.spacing > 1.2)
    ) {
      errors.push("Eye spacing out of range (0.8-1.2)");
    }
    if (
      config.eyes.tilt !== undefined &&
      (config.eyes.tilt < -10 || config.eyes.tilt > 10)
    ) {
      errors.push("Eye tilt out of range (-10 to 10)");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOSE VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  if (!config.nose) {
    errors.push("Missing nose configuration");
  } else {
    if (!config.nose.style) {
      errors.push("Missing nose style");
    }
    if (
      config.nose.size !== undefined &&
      (config.nose.size < 0.8 || config.nose.size > 1.2)
    ) {
      errors.push("Nose size out of range (0.8-1.2)");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOUTH VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  if (!config.mouth) {
    errors.push("Missing mouth configuration");
  } else {
    if (!config.mouth.style) {
      errors.push("Missing mouth style");
    }
    if (
      config.mouth.size !== undefined &&
      (config.mouth.size < 0.8 || config.mouth.size > 1.2)
    ) {
      errors.push("Mouth size out of range (0.8-1.2)");
    }
    if (
      config.mouth.lipThickness !== undefined &&
      (config.mouth.lipThickness < 0.8 || config.mouth.lipThickness > 1.2)
    ) {
      errors.push("Lip thickness out of range (0.8-1.2)");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HAIR VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  if (!config.hair) {
    errors.push("Missing hair configuration");
  } else {
    if (!config.hair.style) {
      errors.push("Missing hair style");
    }
    if (!config.hair.color) {
      errors.push("Missing hair color");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EARS VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════
  if (!config.ears) {
    errors.push("Missing ears configuration");
  } else {
    if (
      config.ears.size !== undefined &&
      (config.ears.size < 0.8 || config.ears.size > 1.2)
    ) {
      errors.push("Ear size out of range (0.8-1.2)");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WARNINGS (non-critical)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!config.accessories?.headwear) {
    warnings.push("No headwear selected");
  }
  if (!config.accessories?.eyewear) {
    warnings.push("No eyewear selected");
  }
  if (!config.clothing?.top && !config.clothing?.outfit) {
    warnings.push("No top clothing selected");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Quick check if config has all required fields
 * (faster than full validation)
 */
export function isValidAvatarConfig(
  config: unknown,
): config is DigitalAvatarConfig {
  if (!config || typeof config !== "object") return false;

  const c = config as Record<string, unknown>;

  return (
    c.version === 2 &&
    typeof c.body === "object" &&
    typeof c.face === "object" &&
    typeof c.eyes === "object" &&
    typeof c.nose === "object" &&
    typeof c.mouth === "object" &&
    typeof c.hair === "object" &&
    typeof c.ears === "object"
  );
}

/**
 * Clamp a numeric value to valid range
 */
export function clampAvatarValue(
  value: number,
  min: number = 0.8,
  max: number = 1.2,
): number {
  return Math.min(max, Math.max(min, value));
}
