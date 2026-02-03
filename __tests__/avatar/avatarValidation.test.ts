/**
 * Avatar Validation Unit Tests
 * Phase 7: Testing Requirements
 *
 * Tests for:
 * - Avatar configuration validation
 * - Field validation
 * - Boundary conditions
 * - Error handling
 *
 * @see src/utils/avatarValidation.ts
 */

import type { DigitalAvatarConfig } from "@/types/avatar";
import { getDefaultAvatarConfig } from "@/utils/avatarHelpers";
import {
  clampAvatarValue,
  isValidAvatarConfig,
  validateAvatarConfig,
} from "@/utils/avatarValidation";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a valid avatar config for testing
 */
function createValidConfig(): DigitalAvatarConfig {
  return getDefaultAvatarConfig();
}

/**
 * Create an invalid avatar config by modifying a specific field
 */
function createInvalidConfig(
  path: string,
  value: unknown,
): DigitalAvatarConfig {
  const config = createValidConfig();
  const parts = path.split(".");
  let current: Record<string, unknown> = config as unknown as Record<
    string,
    unknown
  >;

  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
  return config;
}

// =============================================================================
// validateAvatarConfig Tests
// =============================================================================

describe("validateAvatarConfig", () => {
  it("should accept valid avatar config", () => {
    const config = createValidConfig();
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject config with missing body", () => {
    const config = createValidConfig();
    // @ts-expect-error - Testing invalid config
    delete config.body;
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should reject config with missing face", () => {
    const config = createValidConfig();
    // @ts-expect-error - Testing invalid config
    delete config.face;
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(false);
  });

  it("should reject config with missing eyes", () => {
    const config = createValidConfig();
    // @ts-expect-error - Testing invalid config
    delete config.eyes;
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(false);
  });

  it("should reject config with missing hair", () => {
    const config = createValidConfig();
    // @ts-expect-error - Testing invalid config
    delete config.hair;
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(false);
  });

  it("should reject config with invalid version", () => {
    const config = createValidConfig();
    // @ts-expect-error - Testing invalid version value
    config.version = 1; // Invalid version
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(false);
  });

  it("should validate body height range", () => {
    const config = createValidConfig();
    config.body.height = 0.5; // Below valid range (0.8-1.2)
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(false);
  });

  it("should validate face width range", () => {
    const config = createValidConfig();
    config.face.width = 1.5; // Above valid range (0.8-1.2)
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(false);
  });

  it("should collect multiple errors", () => {
    const config = createValidConfig();
    // @ts-expect-error - Testing invalid config
    delete config.body;
    // @ts-expect-error - Testing invalid config
    delete config.face;
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// isValidAvatarConfig Tests
// =============================================================================

describe("isValidAvatarConfig", () => {
  it("should return true for valid config", () => {
    const config = createValidConfig();
    expect(isValidAvatarConfig(config)).toBe(true);
  });

  it("should return false for invalid config", () => {
    const config = createValidConfig();
    // @ts-expect-error - Testing invalid config
    delete config.body;
    expect(isValidAvatarConfig(config)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isValidAvatarConfig(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isValidAvatarConfig(undefined)).toBe(false);
  });

  it("should return false for non-object", () => {
    expect(isValidAvatarConfig("string")).toBe(false);
  });
});

// =============================================================================
// clampAvatarValue Tests
// =============================================================================

describe("clampAvatarValue", () => {
  it("should return value within range", () => {
    expect(clampAvatarValue(1.0, 0.8, 1.2)).toBe(1.0);
  });

  it("should clamp value below minimum", () => {
    expect(clampAvatarValue(0.5, 0.8, 1.2)).toBe(0.8);
  });

  it("should clamp value above maximum", () => {
    expect(clampAvatarValue(1.5, 0.8, 1.2)).toBe(1.2);
  });

  it("should handle boundary values", () => {
    expect(clampAvatarValue(0.8, 0.8, 1.2)).toBe(0.8);
    expect(clampAvatarValue(1.2, 0.8, 1.2)).toBe(1.2);
  });

  it("should handle negative values", () => {
    expect(clampAvatarValue(-1.0, 0.8, 1.2)).toBe(0.8);
  });

  it("should handle zero", () => {
    expect(clampAvatarValue(0, 0.8, 1.2)).toBe(0.8);
  });
});

// =============================================================================
// Boundary Condition Tests
// =============================================================================

describe("Avatar Validation Boundary Conditions", () => {
  it("should accept body height at lower boundary (0.8)", () => {
    const config = createValidConfig();
    config.body.height = 0.8;
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(true);
  });

  it("should accept body height at upper boundary (1.2)", () => {
    const config = createValidConfig();
    config.body.height = 1.2;
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(true);
  });

  it("should accept face width at lower boundary (0.8)", () => {
    const config = createValidConfig();
    config.face.width = 0.8;
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(true);
  });

  it("should accept face width at upper boundary (1.2)", () => {
    const config = createValidConfig();
    config.face.width = 1.2;
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(true);
  });

  it("should accept default config", () => {
    const config = getDefaultAvatarConfig();
    const result = validateAvatarConfig(config);
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// Error Message Quality Tests
// =============================================================================

describe("Validation Error Messages", () => {
  it("should provide descriptive error messages", () => {
    const config = createValidConfig();
    config.body.height = 0.5;
    const result = validateAvatarConfig(config);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].length).toBeGreaterThan(10);
  });

  it("should include field-specific errors", () => {
    const config = createValidConfig();
    // @ts-expect-error - Testing invalid config
    delete config.body.skinTone;
    const result = validateAvatarConfig(config);
    expect(result.errors.some((e) => e.toLowerCase().includes("skin"))).toBe(
      true,
    );
  });
});
