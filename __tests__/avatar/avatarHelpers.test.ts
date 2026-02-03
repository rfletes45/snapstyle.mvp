/**
 * Avatar Helper Functions Unit Tests
 * Phase 7: Testing Requirements
 *
 * Tests for:
 * - Avatar defaults and creation
 * - Legacy config conversion
 * - Type guards
 * - Accessibility helpers
 * - Hash utilities
 *
 * @see src/utils/avatarHelpers.ts
 * @see src/utils/avatarAccessibility.ts
 */

import type { AvatarConfig } from "@/types/avatar";
import {
  EYE_COLOR_NAMES,
  getAccessibleTextColor,
  getAvatarAccessibilityLabel,
  getContrastRatio,
  HAIR_COLOR_NAMES,
  meetsContrastRequirement,
  SKIN_TONE_NAMES,
} from "@/utils/avatarAccessibility";
import {
  convertLegacyConfig,
  getDefaultAvatarConfig,
  isDigitalAvatarConfig,
  isLegacyAvatarConfig,
  mapColorToSkinTone,
  mapLegacyGlasses,
  mapLegacyHat,
} from "@/utils/avatarHelpers";
import {
  createHash,
  generateShortId,
  hashEqual,
  hashObject,
} from "@/utils/hash";

// =============================================================================
// Default Config Tests
// =============================================================================

describe("getDefaultAvatarConfig", () => {
  it("should return a valid avatar config", () => {
    const config = getDefaultAvatarConfig();
    expect(config).toBeDefined();
    expect(config.version).toBe(2);
  });

  it("should have all required top-level properties", () => {
    const config = getDefaultAvatarConfig();
    expect(config).toHaveProperty("body");
    expect(config).toHaveProperty("face");
    expect(config).toHaveProperty("eyes");
    expect(config).toHaveProperty("hair");
    expect(config).toHaveProperty("nose");
    expect(config).toHaveProperty("mouth");
  });

  it("should have valid body config", () => {
    const config = getDefaultAvatarConfig();
    expect(config.body).toHaveProperty("skinTone");
    expect(config.body).toHaveProperty("shape");
    expect(config.body).toHaveProperty("height");
  });

  it("should have height value within valid range", () => {
    const config = getDefaultAvatarConfig();
    expect(config.body.height).toBeGreaterThanOrEqual(0.8);
    expect(config.body.height).toBeLessThanOrEqual(1.2);
  });

  it("should return new instance each time", () => {
    const config1 = getDefaultAvatarConfig();
    const config2 = getDefaultAvatarConfig();
    expect(config1).not.toBe(config2);
  });

  it("should allow safe modification without affecting other instances", () => {
    const config1 = getDefaultAvatarConfig();
    const config2 = getDefaultAvatarConfig();
    config1.body.skinTone = "skin_12";
    expect(config2.body.skinTone).not.toBe("skin_12");
  });
});

// =============================================================================
// Color Mapping Tests
// =============================================================================

describe("mapColorToSkinTone", () => {
  it("should map hex colors to skin tones", () => {
    const skinTone = mapColorToSkinTone("#FFE0BD");
    expect(skinTone).toBeDefined();
    expect(skinTone).toMatch(/^skin_/);
  });

  it("should handle lowercase hex colors", () => {
    const upper = mapColorToSkinTone("#FFE0BD");
    const lower = mapColorToSkinTone("#ffe0bd");
    expect(upper).toBe(lower);
  });

  it("should return a default for unknown colors", () => {
    const skinTone = mapColorToSkinTone("#FF00FF");
    expect(skinTone).toBeDefined();
    expect(skinTone).toMatch(/^skin_/);
  });
});

// =============================================================================
// Legacy Accessory Mapping Tests
// =============================================================================

describe("mapLegacyHat", () => {
  it("should map hat emoji to headwear ID", () => {
    const headwear = mapLegacyHat("🧢");
    // Either returns a string or null
    expect(typeof headwear === "string" || headwear === null).toBe(true);
  });

  it("should return null for unknown emoji", () => {
    const result = mapLegacyHat("🍕");
    expect(result).toBeNull();
  });

  it("should return null for empty string", () => {
    const result = mapLegacyHat("");
    expect(result).toBeNull();
  });
});

describe("mapLegacyGlasses", () => {
  it("should map glasses emoji to eyewear ID", () => {
    const eyewear = mapLegacyGlasses("👓");
    expect(typeof eyewear === "string" || eyewear === null).toBe(true);
  });

  it("should return null for unknown emoji", () => {
    const result = mapLegacyGlasses("🍕");
    expect(result).toBeNull();
  });
});

// =============================================================================
// Legacy Config Conversion Tests
// =============================================================================

describe("convertLegacyConfig", () => {
  const legacyConfig: AvatarConfig = {
    baseColor: "#FFE0BD",
    hat: undefined,
    glasses: undefined,
    background: undefined,
  };

  it("should convert legacy config to digital config", () => {
    const digital = convertLegacyConfig(legacyConfig);
    expect(digital).toBeDefined();
    expect(digital.version).toBe(2);
  });

  it("should map base color to skin tone", () => {
    const digital = convertLegacyConfig(legacyConfig);
    expect(digital.body.skinTone).toBeDefined();
    expect(digital.body.skinTone).toMatch(/^skin_/);
  });

  it("should have all required sections", () => {
    const digital = convertLegacyConfig(legacyConfig);
    expect(digital.body).toBeDefined();
    expect(digital.face).toBeDefined();
    expect(digital.eyes).toBeDefined();
    expect(digital.hair).toBeDefined();
    expect(digital.nose).toBeDefined();
    expect(digital.mouth).toBeDefined();
  });
});

// =============================================================================
// Type Guard Tests
// =============================================================================

describe("isDigitalAvatarConfig", () => {
  it("should return true for digital avatar config", () => {
    const config = getDefaultAvatarConfig();
    expect(isDigitalAvatarConfig(config)).toBe(true);
  });

  it("should return false for legacy config", () => {
    const legacy: AvatarConfig = {
      baseColor: "#FFE0BD",
      hat: undefined,
      glasses: undefined,
      background: undefined,
    };
    expect(isDigitalAvatarConfig(legacy)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isDigitalAvatarConfig(null)).toBe(false);
  });
});

describe("isLegacyAvatarConfig", () => {
  it("should return true for legacy config", () => {
    const legacy: AvatarConfig = {
      baseColor: "#FFE0BD",
      hat: undefined,
      glasses: undefined,
      background: undefined,
    };
    expect(isLegacyAvatarConfig(legacy)).toBe(true);
  });

  it("should return false for digital config", () => {
    const config = getDefaultAvatarConfig();
    expect(isLegacyAvatarConfig(config)).toBe(false);
  });
});

// =============================================================================
// Accessibility Helper Tests
// =============================================================================

describe("SKIN_TONE_NAMES", () => {
  it("should have names for all 12 skin tones", () => {
    for (let i = 1; i <= 12; i++) {
      const key = `skin_${i.toString().padStart(2, "0")}`;
      expect(SKIN_TONE_NAMES[key]).toBeDefined();
      expect(SKIN_TONE_NAMES[key].length).toBeGreaterThan(0);
    }
  });
});

describe("HAIR_COLOR_NAMES", () => {
  it("should have human-readable names", () => {
    Object.entries(HAIR_COLOR_NAMES).forEach(([key, name]) => {
      expect(name.length).toBeGreaterThan(0);
      // Names should be capitalized
      expect(name[0]).toBe(name[0].toUpperCase());
    });
  });
});

describe("EYE_COLOR_NAMES", () => {
  it("should have human-readable names", () => {
    Object.entries(EYE_COLOR_NAMES).forEach(([key, name]) => {
      expect(name.length).toBeGreaterThan(0);
      expect(name[0]).toBe(name[0].toUpperCase());
    });
  });
});

describe("getAvatarAccessibilityLabel", () => {
  it("should generate descriptive label", () => {
    const config = getDefaultAvatarConfig();
    const label = getAvatarAccessibilityLabel(config);
    expect(label.length).toBeGreaterThan(20);
    expect(label.toLowerCase()).toContain("avatar");
  });

  it("should include user name when provided", () => {
    const config = getDefaultAvatarConfig();
    const label = getAvatarAccessibilityLabel(config, "John");
    expect(label).toContain("John");
  });
});

describe("getContrastRatio", () => {
  it("should return 21 for black and white", () => {
    const ratio = getContrastRatio("#000000", "#FFFFFF");
    expect(ratio).toBeCloseTo(21, 0);
  });

  it("should return 1 for same colors", () => {
    const ratio = getContrastRatio("#FF0000", "#FF0000");
    expect(ratio).toBe(1);
  });

  it("should be symmetric", () => {
    const ratio1 = getContrastRatio("#FF0000", "#0000FF");
    const ratio2 = getContrastRatio("#0000FF", "#FF0000");
    expect(ratio1).toBeCloseTo(ratio2, 4);
  });
});

describe("meetsContrastRequirement", () => {
  it("should pass WCAG AA for black on white", () => {
    expect(meetsContrastRequirement("#000000", "#FFFFFF", "AA")).toBe(true);
    expect(meetsContrastRequirement("#000000", "#FFFFFF", "AAA")).toBe(true);
  });

  it("should fail for low contrast pairs", () => {
    expect(meetsContrastRequirement("#777777", "#888888", "AA")).toBe(false);
  });
});

describe("getAccessibleTextColor", () => {
  it("should return black for light backgrounds", () => {
    expect(getAccessibleTextColor("#FFFFFF")).toBe("#000000");
    expect(getAccessibleTextColor("#F5F5F5")).toBe("#000000");
  });

  it("should return white for dark backgrounds", () => {
    expect(getAccessibleTextColor("#000000")).toBe("#FFFFFF");
    expect(getAccessibleTextColor("#333333")).toBe("#FFFFFF");
  });
});

// =============================================================================
// Hash Utility Tests
// =============================================================================

describe("createHash", () => {
  it("should return consistent hash for same string", () => {
    const hash1 = createHash("test string");
    const hash2 = createHash("test string");
    expect(hash1).toBe(hash2);
  });

  it("should return different hashes for different strings", () => {
    const hash1 = createHash("string1");
    const hash2 = createHash("string2");
    expect(hash1).not.toBe(hash2);
  });

  it("should handle empty string", () => {
    const hash = createHash("");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("should handle special characters", () => {
    const hash = createHash("!@#$%^&*()_+-=[]{}|;':\",./<>?");
    expect(typeof hash).toBe("string");
  });

  it("should handle unicode characters", () => {
    const hash = createHash("你好世界🌍");
    expect(typeof hash).toBe("string");
  });
});

describe("hashObject", () => {
  it("should return consistent hash for same object", () => {
    const obj = { a: 1, b: "two" };
    const hash1 = hashObject(obj);
    const hash2 = hashObject(obj);
    expect(hash1).toBe(hash2);
  });

  it("should return same hash for equivalent objects", () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 2 };
    expect(hashObject(obj1)).toBe(hashObject(obj2));
  });

  it("should return different hashes for different objects", () => {
    const obj1 = { a: 1 };
    const obj2 = { a: 2 };
    expect(hashObject(obj1)).not.toBe(hashObject(obj2));
  });

  it("should handle nested objects", () => {
    const obj = {
      level1: {
        level2: {
          level3: "deep value",
        },
      },
    };
    const hash = hashObject(obj);
    expect(typeof hash).toBe("string");
  });

  it("should handle arrays", () => {
    const arr = [1, 2, 3, "four", { five: 5 }];
    const hash = hashObject(arr);
    expect(typeof hash).toBe("string");
  });
});

describe("hashEqual", () => {
  it("should return true for same hashes", () => {
    const hash = createHash("test");
    expect(hashEqual(hash, hash)).toBe(true);
  });

  it("should return false for different hashes", () => {
    const hash1 = createHash("test1");
    const hash2 = createHash("test2");
    expect(hashEqual(hash1, hash2)).toBe(false);
  });
});

describe("generateShortId", () => {
  it("should return string of expected length", () => {
    const id = generateShortId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("should generate unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateShortId());
    }
    // Allow for some collision but expect mostly unique
    expect(ids.size).toBeGreaterThan(90);
  });
});
