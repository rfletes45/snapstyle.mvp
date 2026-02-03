/**
 * useAvatarCustomization Hook
 *
 * Manages the state and operations for customizing digital avatars.
 * Provides live preview, validation, undo/redo, and save functionality.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import type {
  BodyShapeId,
  DigitalAvatarConfig,
  EarStyleId,
  EyebrowStyleId,
  EyeColorId,
  EyelashStyleId,
  EyeStyleId,
  FaceShapeId,
  FacialHairStyleId,
  HairColorId,
  HairStyleId,
  LipColorId,
  MouthStyleId,
  NoseStyleId,
  SkinToneId,
} from "@/types/avatar";
import { validateAvatarConfig } from "@/utils/avatarValidation";
import { useCallback, useMemo, useRef, useState } from "react";

// =============================================================================
// TYPES
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface UseAvatarCustomizationOptions {
  /** Initial avatar configuration */
  initialConfig: DigitalAvatarConfig;
  /** User ID for saving (optional) */
  userId?: string;
  /** Callback when save completes */
  onSave?: (config: DigitalAvatarConfig) => void;
  /** Callback when changes are discarded */
  onDiscard?: () => void;
  /** Maximum history size for undo/redo */
  maxHistorySize?: number;
}

export interface UseAvatarCustomizationReturn {
  // Current config (live preview)
  config: DigitalAvatarConfig;

  // Body updates
  updateSkinTone: (skinTone: SkinToneId) => void;
  updateBodyShape: (shape: BodyShapeId) => void;
  updateBodyHeight: (height: number) => void;
  updateBody: (updates: Partial<DigitalAvatarConfig["body"]>) => void;

  // Face updates
  updateFaceShape: (shape: FaceShapeId) => void;
  updateFaceWidth: (width: number) => void;
  updateFace: (updates: Partial<DigitalAvatarConfig["face"]>) => void;

  // Eye updates
  updateEyeStyle: (style: EyeStyleId) => void;
  updateEyeColor: (color: EyeColorId) => void;
  updateEyeSize: (size: number) => void;
  updateEyeSpacing: (spacing: number) => void;
  updateEyeTilt: (tilt: number) => void;
  updateEyebrowStyle: (style: EyebrowStyleId) => void;
  updateEyebrowColor: (color: HairColorId) => void;
  updateEyebrowThickness: (thickness: number) => void;
  updateEyelashStyle: (style: EyelashStyleId) => void;
  updateEyelashEnabled: (enabled: boolean) => void;
  updateEyes: (updates: Partial<DigitalAvatarConfig["eyes"]>) => void;

  // Nose updates
  updateNoseStyle: (style: NoseStyleId) => void;
  updateNoseSize: (size: number) => void;
  updateNose: (updates: Partial<DigitalAvatarConfig["nose"]>) => void;

  // Mouth updates
  updateMouthStyle: (style: MouthStyleId) => void;
  updateMouthSize: (size: number) => void;
  updateLipColor: (color: LipColorId) => void;
  updateLipThickness: (thickness: number) => void;
  updateMouth: (updates: Partial<DigitalAvatarConfig["mouth"]>) => void;

  // Ear updates
  updateEarStyle: (style: EarStyleId) => void;
  updateEarSize: (size: number) => void;
  updateEarVisibility: (visible: boolean) => void;
  updateEars: (updates: Partial<DigitalAvatarConfig["ears"]>) => void;

  // Hair updates
  updateHairStyle: (style: HairStyleId) => void;
  updateHairColor: (color: HairColorId) => void;
  updateHairHighlightColor: (color: HairColorId | undefined) => void;
  updateFacialHairStyle: (style: FacialHairStyleId) => void;
  updateFacialHairColor: (color: HairColorId) => void;
  updateHair: (updates: Partial<DigitalAvatarConfig["hair"]>) => void;

  // Clothing updates
  updateClothingTop: (topId: string | null) => void;
  updateClothingBottom: (bottomId: string | null) => void;
  updateClothingOutfit: (outfitId: string | null) => void;
  updateClothingTopColor: (color: string | undefined) => void;
  updateClothingBottomColor: (color: string | undefined) => void;
  updateClothing: (updates: Partial<DigitalAvatarConfig["clothing"]>) => void;

  // Accessory updates
  updateHeadwear: (id: string | null, color?: string | null) => void;
  updateEyewear: (id: string | null, color?: string | null) => void;
  updateEarwear: (id: string | null, color?: string | null) => void;
  updateNeckwear: (id: string | null, color?: string | null) => void;
  updateWristwear: (id: string | null, color?: string | null) => void;
  updateAccessories: (
    updates: Partial<DigitalAvatarConfig["accessories"]>,
  ) => void;

  // Preset application
  applyPreset: (preset: Partial<DigitalAvatarConfig>) => void;
  randomize: () => void;

  // Validation
  validation: ValidationResult;
  isValid: boolean;

  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Save/Reset
  save: () => Promise<boolean>;
  reset: () => void;
  hasChanges: boolean;

  // State
  isSaving: boolean;
  error: string | null;
  clearError: () => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useAvatarCustomization({
  initialConfig,
  userId,
  onSave,
  onDiscard,
  maxHistorySize = 50,
}: UseAvatarCustomizationOptions): UseAvatarCustomizationReturn {
  // Current config state
  const [config, setConfig] = useState<DigitalAvatarConfig>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store initial config for reset comparison
  const initialConfigRef = useRef(initialConfig);

  // Undo/Redo history
  const [history, setHistory] = useState<DigitalAvatarConfig[]>([
    initialConfig,
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // =============================================================================
  // HISTORY MANAGEMENT
  // =============================================================================

  const pushToHistory = useCallback(
    (newConfig: DigitalAvatarConfig) => {
      setHistory((prev) => {
        // Remove any future history if we're not at the end
        const newHistory = prev.slice(0, historyIndex + 1);
        // Add new config
        newHistory.push(newConfig);
        // Trim to max size
        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
        }
        return newHistory;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, maxHistorySize - 1));
    },
    [historyIndex, maxHistorySize],
  );

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex((prev) => prev - 1);
      setConfig(history[historyIndex - 1]);
    }
  }, [canUndo, history, historyIndex]);

  const redo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex((prev) => prev + 1);
      setConfig(history[historyIndex + 1]);
    }
  }, [canRedo, history, historyIndex]);

  // =============================================================================
  // UPDATE HELPERS
  // =============================================================================

  const updateConfig = useCallback(
    (updater: (prev: DigitalAvatarConfig) => DigitalAvatarConfig) => {
      setConfig((prev) => {
        const newConfig = updater(prev);
        pushToHistory(newConfig);
        return newConfig;
      });
    },
    [pushToHistory],
  );

  // =============================================================================
  // BODY UPDATES
  // =============================================================================

  const updateSkinTone = useCallback(
    (skinTone: SkinToneId) => {
      updateConfig((prev) => ({
        ...prev,
        body: { ...prev.body, skinTone },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateBodyShape = useCallback(
    (shape: BodyShapeId) => {
      updateConfig((prev) => ({
        ...prev,
        body: { ...prev.body, shape },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateBodyHeight = useCallback(
    (height: number) => {
      const clampedHeight = Math.max(0.8, Math.min(1.2, height));
      updateConfig((prev) => ({
        ...prev,
        body: { ...prev.body, height: clampedHeight },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateBody = useCallback(
    (updates: Partial<DigitalAvatarConfig["body"]>) => {
      updateConfig((prev) => ({
        ...prev,
        body: { ...prev.body, ...updates },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  // =============================================================================
  // FACE UPDATES
  // =============================================================================

  const updateFaceShape = useCallback(
    (shape: FaceShapeId) => {
      updateConfig((prev) => ({
        ...prev,
        face: { ...prev.face, shape },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateFaceWidth = useCallback(
    (width: number) => {
      const clampedWidth = Math.max(0.8, Math.min(1.2, width));
      updateConfig((prev) => ({
        ...prev,
        face: { ...prev.face, width: clampedWidth },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateFace = useCallback(
    (updates: Partial<DigitalAvatarConfig["face"]>) => {
      updateConfig((prev) => ({
        ...prev,
        face: { ...prev.face, ...updates },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  // =============================================================================
  // EYE UPDATES
  // =============================================================================

  const updateEyeStyle = useCallback(
    (style: EyeStyleId) => {
      updateConfig((prev) => ({
        ...prev,
        eyes: { ...prev.eyes, style },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateEyeColor = useCallback(
    (color: EyeColorId) => {
      updateConfig((prev) => ({
        ...prev,
        eyes: { ...prev.eyes, color },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateEyeSize = useCallback(
    (size: number) => {
      const clampedSize = Math.max(0.8, Math.min(1.2, size));
      updateConfig((prev) => ({
        ...prev,
        eyes: { ...prev.eyes, size: clampedSize },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateEyeSpacing = useCallback(
    (spacing: number) => {
      const clampedSpacing = Math.max(0.8, Math.min(1.2, spacing));
      updateConfig((prev) => ({
        ...prev,
        eyes: { ...prev.eyes, spacing: clampedSpacing },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateEyeTilt = useCallback(
    (tilt: number) => {
      const clampedTilt = Math.max(-10, Math.min(10, tilt));
      updateConfig((prev) => ({
        ...prev,
        eyes: { ...prev.eyes, tilt: clampedTilt },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateEyebrowStyle = useCallback(
    (style: EyebrowStyleId) => {
      updateConfig((prev) => ({
        ...prev,
        eyes: {
          ...prev.eyes,
          eyebrows: { ...prev.eyes.eyebrows, style },
        },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateEyebrowColor = useCallback(
    (color: HairColorId) => {
      updateConfig((prev) => ({
        ...prev,
        eyes: {
          ...prev.eyes,
          eyebrows: { ...prev.eyes.eyebrows, color },
        },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateEyebrowThickness = useCallback(
    (thickness: number) => {
      const clampedThickness = Math.max(0.8, Math.min(1.2, thickness));
      updateConfig((prev) => ({
        ...prev,
        eyes: {
          ...prev.eyes,
          eyebrows: { ...prev.eyes.eyebrows, thickness: clampedThickness },
        },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateEyelashStyle = useCallback(
    (style: EyelashStyleId) => {
      updateConfig((prev) => ({
        ...prev,
        eyes: {
          ...prev.eyes,
          eyelashes: { ...prev.eyes.eyelashes, style },
        },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateEyelashEnabled = useCallback(
    (enabled: boolean) => {
      updateConfig((prev) => ({
        ...prev,
        eyes: {
          ...prev.eyes,
          eyelashes: { ...prev.eyes.eyelashes, enabled },
        },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateEyes = useCallback(
    (updates: Partial<DigitalAvatarConfig["eyes"]>) => {
      updateConfig((prev) => ({
        ...prev,
        eyes: { ...prev.eyes, ...updates },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  // =============================================================================
  // NOSE UPDATES
  // =============================================================================

  const updateNoseStyle = useCallback(
    (style: NoseStyleId) => {
      updateConfig((prev) => ({
        ...prev,
        nose: { ...prev.nose, style },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateNoseSize = useCallback(
    (size: number) => {
      const clampedSize = Math.max(0.8, Math.min(1.2, size));
      updateConfig((prev) => ({
        ...prev,
        nose: { ...prev.nose, size: clampedSize },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateNose = useCallback(
    (updates: Partial<DigitalAvatarConfig["nose"]>) => {
      updateConfig((prev) => ({
        ...prev,
        nose: { ...prev.nose, ...updates },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  // =============================================================================
  // MOUTH UPDATES
  // =============================================================================

  const updateMouthStyle = useCallback(
    (style: MouthStyleId) => {
      updateConfig((prev) => ({
        ...prev,
        mouth: { ...prev.mouth, style },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateMouthSize = useCallback(
    (size: number) => {
      const clampedSize = Math.max(0.8, Math.min(1.2, size));
      updateConfig((prev) => ({
        ...prev,
        mouth: { ...prev.mouth, size: clampedSize },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateLipColor = useCallback(
    (lipColor: LipColorId) => {
      updateConfig((prev) => ({
        ...prev,
        mouth: { ...prev.mouth, lipColor },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateLipThickness = useCallback(
    (lipThickness: number) => {
      const clampedThickness = Math.max(0.8, Math.min(1.2, lipThickness));
      updateConfig((prev) => ({
        ...prev,
        mouth: { ...prev.mouth, lipThickness: clampedThickness },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateMouth = useCallback(
    (updates: Partial<DigitalAvatarConfig["mouth"]>) => {
      updateConfig((prev) => ({
        ...prev,
        mouth: { ...prev.mouth, ...updates },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  // =============================================================================
  // EAR UPDATES
  // =============================================================================

  const updateEarStyle = useCallback(
    (style: EarStyleId) => {
      updateConfig((prev) => ({
        ...prev,
        ears: { ...prev.ears, style },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateEarSize = useCallback(
    (size: number) => {
      const clampedSize = Math.max(0.8, Math.min(1.2, size));
      updateConfig((prev) => ({
        ...prev,
        ears: { ...prev.ears, size: clampedSize },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateEarVisibility = useCallback(
    (visible: boolean) => {
      updateConfig((prev) => ({
        ...prev,
        ears: { ...prev.ears, visible },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateEars = useCallback(
    (updates: Partial<DigitalAvatarConfig["ears"]>) => {
      updateConfig((prev) => ({
        ...prev,
        ears: { ...prev.ears, ...updates },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  // =============================================================================
  // HAIR UPDATES
  // =============================================================================

  const updateHairStyle = useCallback(
    (style: HairStyleId) => {
      updateConfig((prev) => ({
        ...prev,
        hair: { ...prev.hair, style },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateHairColor = useCallback(
    (color: HairColorId) => {
      updateConfig((prev) => ({
        ...prev,
        hair: { ...prev.hair, color },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateHairHighlightColor = useCallback(
    (highlightColor: HairColorId | undefined) => {
      updateConfig((prev) => ({
        ...prev,
        hair: { ...prev.hair, highlightColor },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateFacialHairStyle = useCallback(
    (style: FacialHairStyleId) => {
      updateConfig((prev) => ({
        ...prev,
        hair: {
          ...prev.hair,
          facialHair: { ...prev.hair.facialHair, style },
        },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateFacialHairColor = useCallback(
    (color: HairColorId) => {
      updateConfig((prev) => ({
        ...prev,
        hair: {
          ...prev.hair,
          facialHair: { ...prev.hair.facialHair, color },
        },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateHair = useCallback(
    (updates: Partial<DigitalAvatarConfig["hair"]>) => {
      updateConfig((prev) => ({
        ...prev,
        hair: { ...prev.hair, ...updates },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  // =============================================================================
  // CLOTHING UPDATES
  // =============================================================================

  const updateClothingTop = useCallback(
    (top: string | null) => {
      updateConfig((prev) => ({
        ...prev,
        clothing: { ...prev.clothing, top },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateClothingBottom = useCallback(
    (bottom: string | null) => {
      updateConfig((prev) => ({
        ...prev,
        clothing: { ...prev.clothing, bottom },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateClothingOutfit = useCallback(
    (outfit: string | null) => {
      updateConfig((prev) => ({
        ...prev,
        clothing: {
          ...prev.clothing,
          outfit,
          // Clear top/bottom when outfit is set
          top: outfit ? null : prev.clothing.top,
          bottom: outfit ? null : prev.clothing.bottom,
        },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateClothingTopColor = useCallback(
    (topColor: string | undefined) => {
      updateConfig((prev) => ({
        ...prev,
        clothing: { ...prev.clothing, topColor },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateClothingBottomColor = useCallback(
    (bottomColor: string | undefined) => {
      updateConfig((prev) => ({
        ...prev,
        clothing: { ...prev.clothing, bottomColor },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateClothing = useCallback(
    (updates: Partial<DigitalAvatarConfig["clothing"]>) => {
      updateConfig((prev) => ({
        ...prev,
        clothing: { ...prev.clothing, ...updates },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  // =============================================================================
  // ACCESSORY UPDATES
  // =============================================================================

  const updateHeadwear = useCallback(
    (headwear: string | null, headwearColor?: string | null) => {
      updateConfig((prev) => ({
        ...prev,
        accessories: {
          ...prev.accessories,
          headwear,
          headwearColor: headwearColor ?? prev.accessories.headwearColor,
        },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateEyewear = useCallback(
    (eyewear: string | null, eyewearColor?: string | null) => {
      updateConfig((prev) => ({
        ...prev,
        accessories: {
          ...prev.accessories,
          eyewear,
          eyewearColor: eyewearColor ?? prev.accessories.eyewearColor,
        },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateEarwear = useCallback(
    (earwear: string | null, earwearColor?: string | null) => {
      updateConfig((prev) => ({
        ...prev,
        accessories: {
          ...prev.accessories,
          earwear,
          earwearColor: earwearColor ?? prev.accessories.earwearColor,
        },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateNeckwear = useCallback(
    (neckwear: string | null, neckwearColor?: string | null) => {
      updateConfig((prev) => ({
        ...prev,
        accessories: {
          ...prev.accessories,
          neckwear,
          neckwearColor: neckwearColor ?? prev.accessories.neckwearColor,
        },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateWristwear = useCallback(
    (wristwear: string | null, wristwearColor?: string | null) => {
      updateConfig((prev) => ({
        ...prev,
        accessories: {
          ...prev.accessories,
          wristwear,
          wristwearColor: wristwearColor ?? prev.accessories.wristwearColor,
        },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  const updateAccessories = useCallback(
    (updates: Partial<DigitalAvatarConfig["accessories"]>) => {
      updateConfig((prev) => ({
        ...prev,
        accessories: { ...prev.accessories, ...updates },
        updatedAt: Date.now(),
      }));
    },
    [updateConfig],
  );

  // =============================================================================
  // PRESET & RANDOMIZE
  // =============================================================================

  const applyPreset = useCallback(
    (preset: Partial<DigitalAvatarConfig>) => {
      updateConfig((prev) => {
        const newConfig: DigitalAvatarConfig = {
          ...prev,
          ...preset,
          // Preserve version and timestamps
          version: 2,
          createdAt: prev.createdAt,
          updatedAt: Date.now(),
          // Deep merge nested objects
          body: { ...prev.body, ...preset.body },
          face: { ...prev.face, ...preset.face },
          eyes: {
            ...prev.eyes,
            ...preset.eyes,
            eyebrows: {
              ...prev.eyes.eyebrows,
              ...(preset.eyes?.eyebrows ?? {}),
            },
            eyelashes: {
              ...prev.eyes.eyelashes,
              ...(preset.eyes?.eyelashes ?? {}),
            },
          },
          nose: { ...prev.nose, ...preset.nose },
          mouth: { ...prev.mouth, ...preset.mouth },
          ears: { ...prev.ears, ...preset.ears },
          hair: {
            ...prev.hair,
            ...preset.hair,
            facialHair: {
              ...prev.hair.facialHair,
              ...(preset.hair?.facialHair ?? {}),
            },
          },
          clothing: { ...prev.clothing, ...preset.clothing },
          accessories: { ...prev.accessories, ...preset.accessories },
        };
        return newConfig;
      });
    },
    [updateConfig],
  );

  const randomize = useCallback(() => {
    const randomConfig = generateRandomConfig();
    applyPreset(randomConfig);
  }, [applyPreset]);

  // =============================================================================
  // VALIDATION
  // =============================================================================

  const validation = useMemo(() => validateAvatarConfig(config), [config]);

  const isValid = validation.valid;

  // =============================================================================
  // HAS CHANGES
  // =============================================================================

  const hasChanges = useMemo(() => {
    return JSON.stringify(config) !== JSON.stringify(initialConfigRef.current);
  }, [config]);

  // =============================================================================
  // SAVE / RESET
  // =============================================================================

  const save = useCallback(async (): Promise<boolean> => {
    if (!isValid) {
      setError(`Invalid configuration: ${validation.errors.join(", ")}`);
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Import dynamically to avoid circular deps
      const { saveDigitalAvatar } = await import("@/services/avatarService");
      const result = await saveDigitalAvatar(userId, config);

      if (result.success) {
        initialConfigRef.current = config;
        onSave?.(config);
        // Reset history after successful save
        setHistory([config]);
        setHistoryIndex(0);
        return true;
      } else {
        setError(result.error ?? "Failed to save avatar");
        return false;
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [config, isValid, validation.errors, userId, onSave]);

  const reset = useCallback(() => {
    setConfig(initialConfigRef.current);
    setHistory([initialConfigRef.current]);
    setHistoryIndex(0);
    setError(null);
    onDiscard?.();
  }, [onDiscard]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // =============================================================================
  // RETURN
  // =============================================================================

  return {
    config,

    // Body
    updateSkinTone,
    updateBodyShape,
    updateBodyHeight,
    updateBody,

    // Face
    updateFaceShape,
    updateFaceWidth,
    updateFace,

    // Eyes
    updateEyeStyle,
    updateEyeColor,
    updateEyeSize,
    updateEyeSpacing,
    updateEyeTilt,
    updateEyebrowStyle,
    updateEyebrowColor,
    updateEyebrowThickness,
    updateEyelashStyle,
    updateEyelashEnabled,
    updateEyes,

    // Nose
    updateNoseStyle,
    updateNoseSize,
    updateNose,

    // Mouth
    updateMouthStyle,
    updateMouthSize,
    updateLipColor,
    updateLipThickness,
    updateMouth,

    // Ears
    updateEarStyle,
    updateEarSize,
    updateEarVisibility,
    updateEars,

    // Hair
    updateHairStyle,
    updateHairColor,
    updateHairHighlightColor,
    updateFacialHairStyle,
    updateFacialHairColor,
    updateHair,

    // Clothing
    updateClothingTop,
    updateClothingBottom,
    updateClothingOutfit,
    updateClothingTopColor,
    updateClothingBottomColor,
    updateClothing,

    // Accessories
    updateHeadwear,
    updateEyewear,
    updateEarwear,
    updateNeckwear,
    updateWristwear,
    updateAccessories,

    // Presets
    applyPreset,
    randomize,

    // Validation
    validation,
    isValid,

    // Undo/Redo
    canUndo,
    canRedo,
    undo,
    redo,

    // Save/Reset
    save,
    reset,
    hasChanges,

    // State
    isSaving,
    error,
    clearError,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a random avatar configuration
 */
function generateRandomConfig(): Partial<DigitalAvatarConfig> {
  const skinTones: SkinToneId[] = [
    "skin_01",
    "skin_02",
    "skin_03",
    "skin_04",
    "skin_05",
    "skin_06",
    "skin_07",
    "skin_08",
    "skin_09",
    "skin_10",
    "skin_11",
    "skin_12",
  ];

  const faceShapes: FaceShapeId[] = [
    "oval",
    "round",
    "square",
    "heart",
    "oblong",
    "diamond",
    "triangle",
    "rectangle",
  ];

  const eyeStyles: EyeStyleId[] = [
    "eye_natural",
    "eye_round",
    "eye_almond",
    "eye_hooded",
    "eye_monolid",
    "eye_upturned",
    "eye_downturned",
  ];

  const eyeColors: EyeColorId[] = [
    "brown_dark",
    "brown_light",
    "hazel_gold",
    "hazel_green",
    "green_forest",
    "green_light",
    "blue_deep",
    "blue_light",
    "gray_dark",
    "amber",
  ];

  const noseStyles: NoseStyleId[] = [
    "nose_small",
    "nose_medium",
    "nose_button",
    "nose_pointed",
    "nose_wide",
  ];

  const mouthStyles: MouthStyleId[] = [
    "mouth_smile",
    "mouth_slight_smile",
    "mouth_neutral",
    "mouth_smirk",
  ];

  const hairStyles: HairStyleId[] = [
    "hair_short_classic",
    "hair_short_textured",
    "hair_short_fade",
    "hair_medium_wavy",
    "hair_medium_straight",
    "hair_medium_bob",
    "hair_long_straight",
    "hair_long_wavy",
    "hair_long_ponytail",
  ];

  const hairColors: HairColorId[] = [
    "black",
    "dark_brown",
    "medium_brown",
    "light_brown",
    "auburn",
    "golden_blonde",
    "platinum_blonde",
    "gray_dark",
  ];

  const randomItem = <T>(arr: T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];
  const randomRange = (min: number, max: number): number =>
    Math.round((min + Math.random() * (max - min)) * 100) / 100;

  const hairColor = randomItem(hairColors);

  return {
    body: {
      skinTone: randomItem(skinTones),
      shape: "body_average",
      height: randomRange(0.9, 1.1),
    },
    face: {
      shape: randomItem(faceShapes),
      width: randomRange(0.9, 1.1),
    },
    eyes: {
      style: randomItem(eyeStyles),
      color: randomItem(eyeColors),
      size: randomRange(0.9, 1.1),
      spacing: randomRange(0.95, 1.05),
      tilt: randomRange(-3, 3),
      eyebrows: {
        style: "brow_natural",
        color: hairColor,
        thickness: randomRange(0.9, 1.1),
      },
      eyelashes: {
        enabled: Math.random() > 0.5,
        style: "natural",
        color: "#000000",
      },
    },
    nose: {
      style: randomItem(noseStyles),
      size: randomRange(0.9, 1.1),
    },
    mouth: {
      style: randomItem(mouthStyles),
      size: randomRange(0.95, 1.05),
      lipColor: "lip_natural_medium",
      lipThickness: randomRange(0.9, 1.1),
    },
    hair: {
      style: randomItem(hairStyles),
      color: hairColor,
      facialHair: {
        style: Math.random() > 0.7 ? "stubble" : "none",
        color: hairColor,
      },
    },
  };
}

export default useAvatarCustomization;
