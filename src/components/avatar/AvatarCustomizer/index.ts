/**
 * AvatarCustomizer - Barrel Exports
 *
 * Comprehensive avatar customization system with:
 * - Modal interface for full customization
 * - Category-specific customizers (Face, Eyes, Hair, Body, Clothing, Accessories)
 * - Preset system with locked/unlockable items
 * - Color and style pickers
 * - Feature sliders
 * - Live preview panel
 * - Undo/redo support
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

// =============================================================================
// MAIN MODAL
// =============================================================================

export { AvatarCustomizerModal } from "./AvatarCustomizerModal";
export type { AvatarCustomizerModalProps } from "./AvatarCustomizerModal";

// =============================================================================
// NAVIGATION & PREVIEW
// =============================================================================

export { CategoryTabs } from "./CategoryTabs";
export type { CategoryTabsProps, CustomizationCategory } from "./CategoryTabs";

export { PreviewPanel } from "./PreviewPanel";
export type { PreviewPanelProps } from "./PreviewPanel";

// =============================================================================
// INPUT COMPONENTS
// =============================================================================

export { FeatureSlider, SLIDER_PRESETS, SliderGroup } from "./FeatureSliders";
export type { FeatureSliderProps, SliderGroupProps } from "./FeatureSliders";

export { SkinTonePicker } from "./SkinTonePicker";
export type { SkinTonePickerProps } from "./SkinTonePicker";

export { ColorPicker } from "./ColorPicker";
export type { ColorOption, ColorPickerProps } from "./ColorPicker";

export { StylePicker } from "./StylePicker";
export type { StyleOption, StylePickerProps } from "./StylePicker";

// =============================================================================
// CATEGORY CUSTOMIZERS
// =============================================================================

export { FaceCustomizer } from "./FaceCustomizer";
export type { FaceCustomizerProps } from "./FaceCustomizer";

export { EyesCustomizer } from "./EyesCustomizer";
export type { EyesCustomizerProps } from "./EyesCustomizer";

export { HairCustomizer } from "./HairCustomizer";
export type { HairCustomizerProps } from "./HairCustomizer";

export { BodyCustomizer } from "./BodyCustomizer";
export type { BodyCustomizerProps } from "./BodyCustomizer";

export { ClothingCustomizer } from "./ClothingCustomizer";
export type { ClothingCustomizerProps } from "./ClothingCustomizer";

export { AccessoriesCustomizer } from "./AccessoriesCustomizer";
export type { AccessoriesCustomizerProps } from "./AccessoriesCustomizer";

// =============================================================================
// PRESET SYSTEM
// =============================================================================

export { PresetPicker } from "./PresetPicker";
export type { PresetPickerProps } from "./PresetPicker";
