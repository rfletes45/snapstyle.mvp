/**
 * AvatarCustomizerModal Component
 *
 * Full-screen modal for comprehensive avatar customization.
 * Composes all customizer components with category navigation,
 * live preview, undo/redo, and save functionality.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import type { AvatarPreset } from "@/data";
import { useAvatarCustomization } from "@/hooks/useAvatarCustomization";
import { useAppTheme } from "@/store/ThemeContext";
import type { DigitalAvatarConfig } from "@/types/avatar";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
} from "react-native-reanimated";

// Component imports
import { AccessoriesCustomizer } from "./AccessoriesCustomizer";
import { BodyCustomizer } from "./BodyCustomizer";
import { CategoryTabs, type CustomizationCategory } from "./CategoryTabs";
import { ClothingCustomizer } from "./ClothingCustomizer";
import { EyesCustomizer } from "./EyesCustomizer";
import { FaceCustomizer } from "./FaceCustomizer";
import { HairCustomizer } from "./HairCustomizer";
import { PresetPicker } from "./PresetPicker";
import { PreviewPanel } from "./PreviewPanel";

// =============================================================================
// TYPES
// =============================================================================

export interface AvatarCustomizerModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when modal is dismissed */
  onDismiss: () => void;
  /** Initial avatar configuration */
  initialConfig: DigitalAvatarConfig;
  /** Callback when save is pressed with new config */
  onSave: (config: DigitalAvatarConfig) => void | Promise<void>;
  /** User ID for saving */
  userId?: string;
  /** Set of unlocked item IDs (for accessories and presets) */
  unlockedItems?: Set<string>;
  /** Callback when user taps a locked item */
  onLockedItemPress?: (itemId: string) => void;
  /** Test ID */
  testID?: string;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const PREVIEW_HEIGHT = 200;

// =============================================================================
// HEADER
// =============================================================================

interface HeaderProps {
  onCancel: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  colors: {
    background: string;
    text: string;
    textSecondary: string;
    primary: string;
    border: string;
  };
}

const Header = memo(function Header({
  onCancel,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isSaving,
  hasChanges,
  colors,
}: HeaderProps) {
  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.headerButton}
        onPress={onCancel}
        disabled={isSaving}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.headerButtonText, { color: colors.textSecondary }]}
        >
          Cancel
        </Text>
      </TouchableOpacity>

      <View style={styles.headerCenter}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Customize Avatar
        </Text>
        <View style={styles.undoRedoContainer}>
          <TouchableOpacity
            style={[styles.undoRedoButton, { opacity: canUndo ? 1 : 0.4 }]}
            onPress={onUndo}
            disabled={!canUndo || isSaving}
            activeOpacity={0.7}
          >
            <Text style={styles.undoRedoIcon}>↩️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.undoRedoButton, { opacity: canRedo ? 1 : 0.4 }]}
            onPress={onRedo}
            disabled={!canRedo || isSaving}
            activeOpacity={0.7}
          >
            <Text style={styles.undoRedoIcon}>↪️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.saveButton,
          {
            backgroundColor: hasChanges ? colors.primary : colors.border,
            opacity: hasChanges && !isSaving ? 1 : 0.6,
          },
        ]}
        onPress={onSave}
        disabled={!hasChanges || isSaving}
        activeOpacity={0.7}
      >
        <Text style={styles.saveButtonText}>
          {isSaving ? "Saving..." : "Save"}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

// =============================================================================
// UNSAVED CHANGES ALERT
// =============================================================================

const showUnsavedChangesAlert = (
  onDiscard: () => void,
  onContinue: () => void,
): void => {
  Alert.alert(
    "Unsaved Changes",
    "You have unsaved changes. Are you sure you want to discard them?",
    [
      {
        text: "Continue Editing",
        style: "cancel",
        onPress: onContinue,
      },
      {
        text: "Discard",
        style: "destructive",
        onPress: onDiscard,
      },
    ],
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function AvatarCustomizerModalBase({
  visible,
  onDismiss,
  initialConfig,
  onSave,
  userId,
  unlockedItems = new Set(),
  onLockedItemPress,
  testID,
}: AvatarCustomizerModalProps) {
  const { colors, isDark } = useAppTheme();
  const [selectedCategory, setSelectedCategory] =
    useState<CustomizationCategory>("presets");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<
    string | undefined
  >();

  // Use customization hook
  const {
    config,
    updateBody,
    updateFace,
    updateEyes,
    updateNose,
    updateMouth,
    updateEars,
    updateHair,
    updateClothing,
    updateAccessories,
    applyPreset,
    randomize,
    undo,
    redo,
    canUndo,
    canRedo,
    hasChanges,
    reset,
  } = useAvatarCustomization({
    initialConfig,
  });

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      reset();
      setSelectedCategory("presets");
      setSelectedPresetId(undefined);
    }
  }, [visible, reset]);

  // Handle cancel with unsaved changes check
  const handleCancel = useCallback(() => {
    if (hasChanges) {
      showUnsavedChangesAlert(
        () => {
          reset();
          onDismiss();
        },
        () => {}, // Continue editing
      );
    } else {
      onDismiss();
    }
  }, [hasChanges, reset, onDismiss]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!hasChanges || isSaving) return;

    setIsSaving(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    try {
      await onSave(config);
      onDismiss();
    } catch (error) {
      Alert.alert(
        "Save Failed",
        "Failed to save your avatar. Please try again.",
        [{ text: "OK" }],
      );
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, isSaving, config, onSave, onDismiss]);

  // Handle undo/redo with haptics
  const handleUndo = useCallback(() => {
    if (canUndo) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      undo();
    }
  }, [canUndo, undo]);

  const handleRedo = useCallback(() => {
    if (canRedo) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      redo();
    }
  }, [canRedo, redo]);

  // Handle preset selection
  const handleSelectPreset = useCallback(
    (preset: AvatarPreset) => {
      setSelectedPresetId(preset.id);
      applyPreset(preset.config);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    },
    [applyPreset],
  );

  // Handle randomize
  const handleRandomize = useCallback(() => {
    setSelectedPresetId(undefined);
    randomize();
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, [randomize]);

  // Handle locked preset press
  const handleLockedPresetPress = useCallback(
    (preset: AvatarPreset) => {
      if (onLockedItemPress) {
        onLockedItemPress(preset.id);
      } else {
        Alert.alert(
          "🔒 Locked Preset",
          preset.unlockRequirement ||
            "Complete achievements to unlock this preset.",
          [{ text: "OK" }],
        );
      }
    },
    [onLockedItemPress],
  );

  const themeColors = {
    background: colors.background,
    surface: colors.surface,
    text: colors.text,
    textSecondary: colors.textSecondary,
    primary: colors.primary,
    border: colors.border,
  };

  // Render the current category content
  const renderCategoryContent = () => {
    switch (selectedCategory) {
      case "presets":
        return (
          <PresetPicker
            selectedPresetId={selectedPresetId}
            onSelectPreset={handleSelectPreset}
            onRandomize={handleRandomize}
            unlockedPresetIds={unlockedItems}
            onLockedPresetPress={handleLockedPresetPress}
          />
        );
      case "face":
        return (
          <FaceCustomizer
            config={config}
            onUpdateSkinTone={(skinTone) => updateBody({ skinTone })}
            onUpdateFaceShape={(shape) => updateFace({ shape })}
            onUpdateFaceWidth={(width) => updateFace({ width })}
            onUpdateNoseStyle={(style) => updateNose({ style })}
            onUpdateNoseSize={(size) => updateNose({ size })}
            onUpdateMouthStyle={(style) => updateMouth({ style })}
            onUpdateMouthSize={(size) => updateMouth({ size })}
            onUpdateLipColor={(lipColor) => updateMouth({ lipColor })}
            onUpdateLipThickness={(lipThickness) =>
              updateMouth({ lipThickness })
            }
            onUpdateEarStyle={(style) => updateEars({ style })}
            onUpdateEarSize={(size) => updateEars({ size })}
            onUpdateEarVisibility={(visible) => updateEars({ visible })}
          />
        );
      case "eyes":
        return (
          <EyesCustomizer
            config={config}
            onUpdateEyeStyle={(style) => updateEyes({ style })}
            onUpdateEyeColor={(color) => updateEyes({ color })}
            onUpdateEyeSize={(size) => updateEyes({ size })}
            onUpdateEyeSpacing={(spacing) => updateEyes({ spacing })}
            onUpdateEyeTilt={(tilt) => updateEyes({ tilt })}
            onUpdateEyebrowStyle={(style) =>
              updateEyes({
                eyebrows: { ...config.eyes.eyebrows, style },
              })
            }
            onUpdateEyebrowColor={(color) =>
              updateEyes({
                eyebrows: { ...config.eyes.eyebrows, color },
              })
            }
            onUpdateEyebrowThickness={(thickness) =>
              updateEyes({
                eyebrows: { ...config.eyes.eyebrows, thickness },
              })
            }
            onUpdateEyelashStyle={(style) =>
              updateEyes({
                eyelashes: { ...config.eyes.eyelashes, style },
              })
            }
          />
        );
      case "hair":
        return (
          <HairCustomizer
            config={config}
            onUpdateHairStyle={(style) => updateHair({ style })}
            onUpdateHairColor={(color) => updateHair({ color })}
            onUpdateHighlightColor={(highlightColor) =>
              updateHair({ highlightColor })
            }
            onUpdateFacialHairStyle={(style) =>
              updateHair({
                facialHair: { ...config.hair.facialHair, style },
              })
            }
            onUpdateFacialHairColor={(color) =>
              updateHair({
                facialHair: { ...config.hair.facialHair, color },
              })
            }
          />
        );
      case "body":
        return (
          <BodyCustomizer
            config={config}
            onUpdateSkinTone={(skinTone) => updateBody({ skinTone })}
            onUpdateBodyShape={(shape) => updateBody({ shape })}
            onUpdateHeight={(height) => updateBody({ height })}
          />
        );
      case "clothing":
        return (
          <ClothingCustomizer
            config={config}
            onUpdateTop={(top) => updateClothing({ top })}
            onUpdateTopColor={(topColor) => updateClothing({ topColor })}
            onUpdateBottom={(bottom) => updateClothing({ bottom })}
            onUpdateBottomColor={(bottomColor) =>
              updateClothing({ bottomColor })
            }
            onUpdateOutfit={(outfit) => updateClothing({ outfit })}
          />
        );
      case "accessories":
        return (
          <AccessoriesCustomizer
            config={config}
            onUpdateHeadwear={(headwear) => updateAccessories({ headwear })}
            onUpdateEyewear={(eyewear) => updateAccessories({ eyewear })}
            onUpdateEarwear={(earwear) => updateAccessories({ earwear })}
            onUpdateNeckwear={(neckwear) => updateAccessories({ neckwear })}
            onUpdateWristwear={(wristwear) => updateAccessories({ wristwear })}
            lockedItems={unlockedItems}
            onLockedItemPress={onLockedItemPress}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={handleCancel}
      testID={testID}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            {/* Header */}
            <Header
              onCancel={handleCancel}
              onSave={handleSave}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={canUndo}
              canRedo={canRedo}
              isSaving={isSaving}
              hasChanges={hasChanges}
              colors={themeColors}
            />

            {/* Preview Panel */}
            <PreviewPanel config={config} size={PREVIEW_HEIGHT} />

            {/* Category Tabs */}
            <CategoryTabs
              activeCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />

            {/* Content Area */}
            <Animated.View
              entering={SlideInDown.duration(300)}
              style={styles.contentArea}
            >
              {renderCategoryContent()}
            </Animated.View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

export const AvatarCustomizerModal = memo(AvatarCustomizerModalBase);

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerButtonText: {
    fontSize: 16,
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  undoRedoContainer: {
    flexDirection: "row",
    marginTop: 4,
    gap: 12,
  },
  undoRedoButton: {
    padding: 4,
  },
  undoRedoIcon: {
    fontSize: 16,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  contentArea: {
    flex: 1,
  },
});

export default AvatarCustomizerModal;
