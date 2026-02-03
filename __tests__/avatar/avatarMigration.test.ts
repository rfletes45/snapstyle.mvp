/**
 * Avatar Migration Unit Tests
 * Phase 7: Testing Requirements
 *
 * Tests for:
 * - Legacy to digital avatar migration
 * - Color mapping accuracy
 * - Accessory mapping
 * - Migration status checking
 *
 * @see src/utils/avatarMigration.ts
 */

import type { DigitalAvatarConfig } from "@/types/avatar";
import type { AvatarConfig } from "@/types/models";
import { getDefaultAvatarConfig } from "@/utils/avatarHelpers";
import {
  getMigrationStatus,
  GLASSES_EMOJI_TO_EYEWEAR,
  hasDigitalAvatar,
  HAT_EMOJI_TO_HEADWEAR,
  LEGACY_COLOR_TO_SKIN_MAP,
  mapColorToSkinTone,
  mapLegacyGlassesToEyewear,
  mapLegacyHatToHeadwear,
  migrateLegacyAvatar,
  needsMigration,
} from "@/utils/avatarMigration";

// =============================================================================
// Test Data
// =============================================================================

// Sample legacy avatar configurations using the actual AvatarConfig type
const LEGACY_AVATARS: Record<string, AvatarConfig> = {
  basic: { baseColor: "#FFE0BD" },
  withHat: { baseColor: "#8D5524", hat: "🧢" },
  withGlasses: { baseColor: "#FFE0BD", glasses: "👓" },
  withAll: { baseColor: "#FFE0BD", hat: "🎩", glasses: "🕶️" },
  purpleColor: { baseColor: "#9B59B6" },
  darkSkin: { baseColor: "#8D5524" },
  lightSkin: { baseColor: "#FFE0BD" },
};

// Mock user data for migration status tests
function createMockUser(opts: {
  digitalAvatar?: DigitalAvatarConfig;
  avatarConfig?: AvatarConfig;
}) {
  return {
    digitalAvatar: opts.digitalAvatar,
    avatarConfig: opts.avatarConfig,
  };
}

// =============================================================================
// Color Mapping Tests
// =============================================================================

describe("LEGACY_COLOR_TO_SKIN_MAP", () => {
  it("should have mappings for common skin colors", () => {
    expect(Object.keys(LEGACY_COLOR_TO_SKIN_MAP).length).toBeGreaterThan(5);
  });

  it("should map to valid skin tone IDs", () => {
    Object.values(LEGACY_COLOR_TO_SKIN_MAP).forEach((skinTone) => {
      expect(skinTone).toMatch(/^skin_\d{2}$/);
    });
  });
});

describe("mapColorToSkinTone", () => {
  it("should map light skin colors correctly", () => {
    const result = mapColorToSkinTone("#FFE0BD");
    expect(result).toMatch(/^skin_0[1-4]$/);
  });

  it("should map medium skin colors correctly", () => {
    const result = mapColorToSkinTone("#D4A574");
    expect(result).toMatch(/^skin_0[5-8]$/);
  });

  it("should map dark skin colors correctly", () => {
    const result = mapColorToSkinTone("#8D5524");
    expect(result).toMatch(/^skin_(09|1[0-2])$/);
  });

  it("should return default for unmapped colors", () => {
    const result = mapColorToSkinTone("#FF00FF");
    expect(result).toMatch(/^skin_\d{2}$/);
  });

  it("should handle lowercase hex colors", () => {
    const upper = mapColorToSkinTone("#FFE0BD");
    const lower = mapColorToSkinTone("#ffe0bd");
    expect(upper).toBe(lower);
  });

  it("should handle colors without hash prefix", () => {
    const withHash = mapColorToSkinTone("#FFE0BD");
    const withoutHash = mapColorToSkinTone("FFE0BD");
    expect(withHash).toBe(withoutHash);
  });
});

// =============================================================================
// Hat Mapping Tests
// =============================================================================

describe("HAT_EMOJI_TO_HEADWEAR", () => {
  it("should map common hat emojis", () => {
    expect(HAT_EMOJI_TO_HEADWEAR["🧢"]).toBeDefined();
    expect(HAT_EMOJI_TO_HEADWEAR["🎩"]).toBeDefined();
  });
});

describe("mapLegacyHatToHeadwear", () => {
  it("should map baseball cap emoji", () => {
    const result = mapLegacyHatToHeadwear("🧢");
    expect(result).toContain("cap");
  });

  it("should map top hat emoji", () => {
    const result = mapLegacyHatToHeadwear("🎩");
    expect(result).toBeTruthy();
  });

  it("should return null for unknown emoji", () => {
    const result = mapLegacyHatToHeadwear("🍕");
    expect(result).toBeNull();
  });
});

// =============================================================================
// Glasses Mapping Tests
// =============================================================================

describe("GLASSES_EMOJI_TO_EYEWEAR", () => {
  it("should map common glasses emojis", () => {
    expect(GLASSES_EMOJI_TO_EYEWEAR["👓"]).toBeDefined();
    expect(GLASSES_EMOJI_TO_EYEWEAR["🕶️"]).toBeDefined();
  });
});

describe("mapLegacyGlassesToEyewear", () => {
  it("should map regular glasses emoji", () => {
    const result = mapLegacyGlassesToEyewear("👓");
    expect(result).toContain("eyewear");
  });

  it("should map sunglasses emoji", () => {
    const result = mapLegacyGlassesToEyewear("🕶️");
    expect(result).toContain("eyewear");
  });
});

// =============================================================================
// Full Migration Tests
// =============================================================================

describe("migrateLegacyAvatar", () => {
  it("should migrate basic avatar with just color", () => {
    const result = migrateLegacyAvatar(LEGACY_AVATARS.basic);

    expect(result).toBeDefined();
    expect(result.body).toBeDefined();
    expect(result.body.skinTone).toMatch(/^skin_\d{2}$/);
    expect(result.face).toBeDefined();
    expect(result.eyes).toBeDefined();
    expect(result.hair).toBeDefined();
  });

  it("should migrate avatar with hat", () => {
    const result = migrateLegacyAvatar(LEGACY_AVATARS.withHat);

    expect(result.accessories.headwear).toBeTruthy();
  });

  it("should migrate avatar with glasses", () => {
    const result = migrateLegacyAvatar(LEGACY_AVATARS.withGlasses);

    expect(result.accessories.eyewear).toBeTruthy();
  });

  it("should migrate avatar with all accessories", () => {
    const result = migrateLegacyAvatar(LEGACY_AVATARS.withAll);

    expect(result.accessories.headwear).toBeTruthy();
    expect(result.accessories.eyewear).toBeTruthy();
  });

  it("should return valid DigitalAvatarConfig structure", () => {
    const result = migrateLegacyAvatar(LEGACY_AVATARS.withAll);

    // Check all required fields exist (based on actual DigitalAvatarConfig type)
    expect(result).toHaveProperty("body.skinTone");
    expect(result).toHaveProperty("body.shape");
    expect(result).toHaveProperty("body.height");
    expect(result).toHaveProperty("face.shape");
    expect(result).toHaveProperty("face.width");
    expect(result).toHaveProperty("eyes.style");
    expect(result).toHaveProperty("eyes.color");
    expect(result).toHaveProperty("hair.style");
    expect(result).toHaveProperty("hair.color");
    expect(result).toHaveProperty("nose.style");
    expect(result).toHaveProperty("mouth.style");
    expect(result).toHaveProperty("clothing.top");
    expect(result).toHaveProperty("accessories.headwear");
    expect(result).toHaveProperty("accessories.eyewear");
  });

  it("should handle empty object input", () => {
    const result = migrateLegacyAvatar({} as AvatarConfig);

    expect(result).toBeDefined();
    expect(result.body.skinTone).toMatch(/^skin_\d{2}$/);
  });

  it("should set timestamps on migrated config", () => {
    const result = migrateLegacyAvatar(LEGACY_AVATARS.basic);

    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
    expect(typeof result.createdAt).toBe("number");
    expect(typeof result.updatedAt).toBe("number");
  });
});

// =============================================================================
// Migration Status Tests
// =============================================================================

describe("hasDigitalAvatar", () => {
  it("should return true for user with digital avatar", () => {
    const digitalConfig = getDefaultAvatarConfig();
    const user = createMockUser({ digitalAvatar: digitalConfig });
    expect(hasDigitalAvatar(user)).toBe(true);
  });

  it("should return false for user without digital avatar", () => {
    const user = createMockUser({ avatarConfig: LEGACY_AVATARS.basic });
    expect(hasDigitalAvatar(user)).toBe(false);
  });

  it("should return false for user with null digital avatar", () => {
    const user = {
      digitalAvatar: null,
    };
    expect(hasDigitalAvatar(user)).toBe(false);
  });

  it("should return false for user with undefined digital avatar", () => {
    const user = {
      digitalAvatar: undefined,
    };
    expect(hasDigitalAvatar(user)).toBe(false);
  });
});

describe("needsMigration", () => {
  it("should return true for user with legacy but no digital", () => {
    const user = createMockUser({ avatarConfig: LEGACY_AVATARS.basic });
    expect(needsMigration(user)).toBe(true);
  });

  it("should return false for user with digital avatar", () => {
    const digitalConfig = getDefaultAvatarConfig();
    const user = createMockUser({
      avatarConfig: LEGACY_AVATARS.basic,
      digitalAvatar: digitalConfig,
    });
    expect(needsMigration(user)).toBe(false);
  });

  it("should return false for user without any avatar", () => {
    const user = createMockUser({});
    expect(needsMigration(user)).toBe(false);
  });
});

describe("getMigrationStatus", () => {
  it("should return 'migrated' for user with digital avatar", () => {
    const digitalConfig = getDefaultAvatarConfig();
    const user = createMockUser({
      avatarConfig: LEGACY_AVATARS.basic,
      digitalAvatar: digitalConfig,
    });
    const status = getMigrationStatus(user);

    expect(status).toBe("migrated");
  });

  it("should return 'needs_migration' for user with legacy only", () => {
    const user = createMockUser({ avatarConfig: LEGACY_AVATARS.basic });
    const status = getMigrationStatus(user);

    expect(status).toBe("needs_migration");
  });

  it("should return 'new_user' for user without any avatar", () => {
    const user = createMockUser({});
    const status = getMigrationStatus(user);

    expect(status).toBe("new_user");
  });
});

// =============================================================================
// Edge Cases & Error Handling
// =============================================================================

describe("Migration Edge Cases", () => {
  it("should handle extremely long color strings", () => {
    const longColor = "#" + "F".repeat(100);
    const result = mapColorToSkinTone(longColor);
    expect(result).toMatch(/^skin_\d{2}$/);
  });

  it("should handle color strings with invalid characters", () => {
    const invalidColor = "#GGGGGG";
    const result = mapColorToSkinTone(invalidColor);
    expect(result).toMatch(/^skin_\d{2}$/);
  });

  it("should handle RGB colors (not hex)", () => {
    const rgbColor = "rgb(255, 224, 189)";
    const result = mapColorToSkinTone(rgbColor);
    // Should return default since RGB format isn't directly supported
    expect(result).toMatch(/^skin_\d{2}$/);
  });

  it("should handle emoji strings with variation selectors", () => {
    // These emojis might have variation selectors
    const hatWithSelector = "🧢\uFE0F";
    const result = mapLegacyHatToHeadwear(hatWithSelector);
    // Should still work or return null, but not throw
    expect(result === null || typeof result === "string").toBe(true);
  });

  it("should handle empty string color", () => {
    const result = mapColorToSkinTone("");
    expect(result).toMatch(/^skin_\d{2}$/);
  });

  it("should handle uppercase hex colors", () => {
    const upper = mapColorToSkinTone("#AABBCC");
    const lower = mapColorToSkinTone("#aabbcc");
    expect(upper).toBe(lower);
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe("Full Migration Workflow", () => {
  it("should successfully migrate and verify status", () => {
    // Start with legacy only
    const user1 = createMockUser({ avatarConfig: LEGACY_AVATARS.basic });
    expect(getMigrationStatus(user1)).toBe("needs_migration");

    // Perform migration
    const migratedConfig = migrateLegacyAvatar(LEGACY_AVATARS.basic);

    // Create user with migrated config
    const user2 = createMockUser({
      avatarConfig: LEGACY_AVATARS.basic,
      digitalAvatar: migratedConfig,
    });
    expect(getMigrationStatus(user2)).toBe("migrated");
  });

  it("should preserve legacy config in migrated result when preserveLegacy is true", () => {
    const result = migrateLegacyAvatar(LEGACY_AVATARS.basic, {
      preserveLegacy: true,
    });

    expect(result.legacy).toBeDefined();
    expect(result.legacy?.baseColor).toBe(LEGACY_AVATARS.basic.baseColor);
  });

  it("should not include legacy config when preserveLegacy is false", () => {
    const result = migrateLegacyAvatar(LEGACY_AVATARS.basic, {
      preserveLegacy: false,
    });

    expect(result.legacy).toBeUndefined();
  });
});
