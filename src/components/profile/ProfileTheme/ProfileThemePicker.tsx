/**
 * ProfileThemePicker Component
 *
 * Modal/screen for selecting and previewing profile themes.
 * Shows owned and available themes organized by rarity.
 *
 * @module components/profile/ProfileTheme/ProfileThemePicker
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import {
  PROFILE_THEMES,
  getThemeById,
  getThemesByRarity,
} from "@/data/profileThemes";
import { equipTheme, getUserOwnedThemes } from "@/services/profileThemes";
import type { ExtendedCosmeticRarity, ProfileTheme } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Divider,
  Modal,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemePreview } from "./ThemePreview";


import { createLogger } from "@/utils/log";
const logger = createLogger("components/profile/ProfileTheme/ProfileThemePicker");
// =============================================================================
// Types
// =============================================================================

export interface ProfileThemePickerProps {
  /** Whether the picker is visible */
  visible: boolean;
  /** Current user's ID */
  userId: string;
  /** Currently equipped theme ID (optional) */
  currentThemeId?: string | null;
  /** Callback when a theme is selected and applied */
  onThemeSelected?: (themeId: string) => void;
  /** Callback to close the picker */
  onClose: () => void;
  /** Callback when theme equip completes */
  onThemeEquipped?: (themeId: string) => void;
  /** Callback when theme changes (provides theme object) */
  onThemeChanged?: (theme: ProfileTheme) => void;
}

// =============================================================================
// Constants
// =============================================================================

const RARITY_ORDER: ExtendedCosmeticRarity[] = [
  "common",
  "rare",
  "epic",
  "legendary",
  "mythic",
];
const RARITY_LABELS: Record<ExtendedCosmeticRarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

// =============================================================================
// Theme Section Component
// =============================================================================

interface ThemeSectionProps {
  rarity: ExtendedCosmeticRarity;
  themes: ProfileTheme[];
  ownedThemeIds: string[];
  selectedThemeId: string;
  onSelectTheme: (theme: ProfileTheme) => void;
}

const ThemeSection = memo(function ThemeSection({
  rarity,
  themes,
  ownedThemeIds,
  selectedThemeId,
  onSelectTheme,
}: ThemeSectionProps) {
  const paperTheme = useTheme();

  if (themes.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text
        style={[
          styles.sectionTitle,
          { color: paperTheme.colors.onSurfaceVariant },
        ]}
      >
        {RARITY_LABELS[rarity] || rarity} ({themes.length})
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.themeRow}
      >
        {themes.map((theme) => (
          <ThemePreview
            key={theme.id}
            theme={theme}
            isSelected={theme.id === selectedThemeId}
            isOwned={ownedThemeIds.includes(theme.id)}
            isLocked={!ownedThemeIds.includes(theme.id)}
            onPress={() => onSelectTheme(theme)}
            size="medium"
            showName
            showRarity
          />
        ))}
      </ScrollView>
    </View>
  );
});

// =============================================================================
// Main Component
// =============================================================================

export const ProfileThemePicker = memo(function ProfileThemePicker({
  visible,
  userId,
  currentThemeId,
  onThemeSelected,
  onClose,
  onThemeEquipped,
  onThemeChanged,
}: ProfileThemePickerProps) {
  const paperTheme = useTheme();
  const insets = useSafeAreaInsets();

  // State
  const [selectedThemeId, setSelectedThemeId] = useState(
    currentThemeId || "default",
  );
  const [ownedThemeIds, setOwnedThemeIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load owned themes
  useEffect(() => {
    if (visible && userId) {
      loadOwnedThemes();
    }
  }, [visible, userId]);

  const loadOwnedThemes = async () => {
    setIsLoading(true);
    try {
      const owned = await getUserOwnedThemes(userId);
      setOwnedThemeIds(owned);
    } catch (error) {
      logger.error("[ProfileThemePicker] Error loading themes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset selection when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedThemeId(currentThemeId || "default");
    }
  }, [visible, currentThemeId]);

  // Group themes by rarity
  const themesByRarity = useMemo(() => {
    const grouped: Record<ExtendedCosmeticRarity, ProfileTheme[]> = {
      common: [],
      rare: [],
      epic: [],
      legendary: [],
      mythic: [],
    };
    RARITY_ORDER.forEach((rarity) => {
      grouped[rarity] = getThemesByRarity(rarity);
    });
    return grouped;
  }, []);

  // Get selected theme
  const selectedTheme = useMemo(() => {
    return PROFILE_THEMES.find((t) => t.id === selectedThemeId);
  }, [selectedThemeId]);

  // Handle theme selection
  const handleSelectTheme = useCallback(
    (theme: ProfileTheme) => {
      if (ownedThemeIds.includes(theme.id)) {
        setSelectedThemeId(theme.id);
        onThemeSelected?.(theme.id);
      } else {
        // Could show purchase modal here
        logger.info("[ProfileThemePicker] Theme not owned:", theme.id);
      }
    },
    [ownedThemeIds, onThemeSelected],
  );

  // Handle save/apply
  const handleApply = useCallback(async () => {
    if (selectedThemeId === currentThemeId) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      const success = await equipTheme(userId, selectedThemeId);
      if (success) {
        onThemeEquipped?.(selectedThemeId);

        // Call onThemeChanged with the theme object
        const themeObj = getThemeById(selectedThemeId);
        if (themeObj && onThemeChanged) {
          onThemeChanged(themeObj);
        }

        onClose();
      } else {
        logger.error("[ProfileThemePicker] Failed to equip theme");
      }
    } catch (error) {
      logger.error("[ProfileThemePicker] Error equipping theme:", error);
    } finally {
      setIsSaving(false);
    }
  }, [
    userId,
    selectedThemeId,
    currentThemeId,
    onThemeEquipped,
    onThemeChanged,
    onClose,
  ]);

  const hasChanges = selectedThemeId !== (currentThemeId || "default");

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={[
          styles.modalContainer,
          {
            backgroundColor: paperTheme.colors.surface,
            paddingBottom: insets.bottom + Spacing.md,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={paperTheme.colors.onSurface}
            />
          </TouchableOpacity>
          <Text variant="titleLarge" style={styles.headerTitle}>
            Profile Theme
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <Divider />

        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text
              style={{
                color: paperTheme.colors.onSurfaceVariant,
                marginTop: Spacing.md,
              }}
            >
              Loading themes...
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Current Preview */}
            {selectedTheme && (
              <View style={styles.previewSection}>
                <Text
                  variant="labelLarge"
                  style={{
                    color: paperTheme.colors.onSurfaceVariant,
                    marginBottom: Spacing.sm,
                  }}
                >
                  Preview
                </Text>
                <View style={styles.largePreview}>
                  <ThemePreview
                    theme={selectedTheme}
                    isSelected={false}
                    isOwned
                    size="large"
                    showName={false}
                    showRarity={false}
                  />
                  <View style={styles.previewInfo}>
                    <Text variant="titleMedium">{selectedTheme.name}</Text>
                    {selectedTheme.description && (
                      <Text
                        variant="bodySmall"
                        style={{ color: paperTheme.colors.onSurfaceVariant }}
                      >
                        {selectedTheme.description}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            <Divider style={styles.divider} />

            {/* Theme Sections by Rarity */}
            {RARITY_ORDER.map((rarity) => (
              <ThemeSection
                key={rarity}
                rarity={rarity}
                themes={themesByRarity[rarity]}
                ownedThemeIds={ownedThemeIds}
                selectedThemeId={selectedThemeId}
                onSelectTheme={handleSelectTheme}
              />
            ))}
          </ScrollView>
        )}

        {/* Footer Actions */}
        <View style={styles.footer}>
          <Button mode="outlined" onPress={onClose} style={styles.footerButton}>
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleApply}
            disabled={!hasChanges || isSaving}
            loading={isSaving}
            style={styles.footerButton}
          >
            Apply Theme
          </Button>
        </View>
      </Modal>
    </Portal>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  modalContainer: {
    margin: Spacing.md,
    borderRadius: BorderRadius.xl,
    maxHeight: "90%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontWeight: "bold",
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    padding: Spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
  },
  previewSection: {
    marginBottom: Spacing.md,
  },
  largePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  previewInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  divider: {
    marginVertical: Spacing.md,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  themeRow: {
    paddingRight: Spacing.md,
    gap: Spacing.sm,
  },
  footer: {
    flexDirection: "row",
    padding: Spacing.md,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  footerButton: {
    flex: 1,
  },
});

export default ProfileThemePicker;
