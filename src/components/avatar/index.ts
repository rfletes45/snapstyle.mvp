/**
 * Avatar Components Barrel Export
 *
 * Main entry point for the digital avatar system.
 *
 * @example
 * import { DigitalAvatar } from '@/components/avatar';
 *
 * <DigitalAvatar config={user.digitalAvatar} size={100} />
 */

// Main avatar component
export {
  AvatarPreview,
  CircularAvatar,
  CompactAvatar,
  DigitalAvatar,
} from "./DigitalAvatar";

// Core rendering engine
export { AvatarSvgRenderer } from "./AvatarSvgRenderer";

// Individual parts (for advanced customization)
export * from "./AvatarParts";

// Avatar customizer (Phase 2)
export * from "./AvatarCustomizer";

// Animation components and hooks
export {
  BlinkAnimation,
  IdleAnimation,
  useBlinkAnimation,
  useIdleAnimation,
} from "./animations";

// Re-export types for convenience
export type {
  AvatarConfig,
  DigitalAvatarConfig,
  EarStyleId,
  EyeColorId,
  EyeStyleId,
  EyebrowStyleId,
  EyelashStyleId,
  FaceShapeId,
  HairColorId,
  HairStyleId,
  LegacyAvatarConfig,
  LipColorId,
  MouthStyleId,
  NoseStyleId,
  SkinToneId,
} from "@/types/avatar";
