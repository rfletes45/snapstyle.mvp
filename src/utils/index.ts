/**
 * Utils barrel export
 * Provides centralized access to all utility functions
 *
 * Note: gameCollision and gamePhysics have overlapping exports.
 * Import directly from specific modules when needed.
 */

export * from "./animations";
export * from "./dates";
export * from "./errors";
export * from "./gameState";
export * from "./haptics";
export * from "./ids";
export * from "./listPerformance";
export * from "./log";
export * from "./styles";
export * from "./validators";
export * from "./webImagePicker";

// Game physics modules have some overlapping types
// Export primary module, import gameCollision directly when needed
export * from "./gamePhysics";

// Avatar utilities
export * from "./avatarAccessibility";
export * from "./avatarCache";
export * from "./avatarHelpers";
export * from "./avatarValidation";
export * from "./hash";

// Rollout utilities
export * from "./rollout";

// Re-export specific items from avatarMigration to avoid conflicts with avatarHelpers
// (both modules export mapColorToSkinTone, so we use avatarHelpers' version)
export {
  CLOTHING_EMOJI_MAP,
  GLASSES_EMOJI_TO_EYEWEAR,
  HAT_EMOJI_TO_HEADWEAR,
  LEGACY_COLOR_TO_SKIN_MAP,
  getMigrationStatus,
  hasDigitalAvatar,
  mapLegacyGlassesToEyewear,
  mapLegacyHatToHeadwear,
  migrateLegacyAvatar,
  needsMigration,
} from "./avatarMigration";
