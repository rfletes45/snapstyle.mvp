/**
 * HairCustomizer Component
 *
 * Customization panel for hair-related features:
 * - Hair style
 * - Hair color
 * - Hair highlight color (optional)
 * - Facial hair style and color
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import {
  FACIAL_HAIR_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
} from "@/data/avatarAssets";
import { useAppTheme } from "@/store/ThemeContext";
import type {
  DigitalAvatarConfig,
  FacialHairStyleId,
  HairColorId,
  HairStyleId,
} from "@/types/avatar";
import React, { memo, useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { ColorPicker, type ColorOption } from "./ColorPicker";
import { StylePicker, type StyleOption } from "./StylePicker";

// =============================================================================
// TYPES
// =============================================================================

export interface HairCustomizerProps {
  /** Current avatar configuration */
  config: DigitalAvatarConfig;
  /** Update hair settings */
  onUpdateHairStyle: (style: HairStyleId) => void;
  onUpdateHairColor: (color: HairColorId) => void;
  /** Update highlight color (undefined to disable) */
  onUpdateHighlightColor: (color: HairColorId | undefined) => void;
  /** Update facial hair settings */
  onUpdateFacialHairStyle: (style: FacialHairStyleId) => void;
  onUpdateFacialHairColor: (color: HairColorId) => void;
  /** Test ID */
  testID?: string;
}

// =============================================================================
// SECTION COMPONENT
// =============================================================================

interface SectionProps {
  title: string;
  children: React.ReactNode;
  colors: {
    text: string;
    surface: string;
  };
}

const Section = memo(function Section({
  title,
  children,
  colors,
}: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <View
        style={[styles.sectionContent, { backgroundColor: colors.surface }]}
      >
        {children}
      </View>
    </View>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function HairCustomizerBase({
  config,
  onUpdateHairStyle,
  onUpdateHairColor,
  onUpdateHighlightColor,
  onUpdateFacialHairStyle,
  onUpdateFacialHairColor,
  testID,
}: HairCustomizerProps) {
  const { colors } = useAppTheme();

  // Convert data to style options with categories
  const hairStyleOptions: StyleOption[] = useMemo(
    () =>
      HAIR_STYLES.map((style) => ({
        id: style.id,
        name: style.name,
        category: style.category,
      })),
    [],
  );

  const hairColorOptions: ColorOption[] = useMemo(
    () =>
      HAIR_COLORS.map((color) => ({
        id: color.id,
        name: color.name,
        color: color.baseColor,
        category: color.isFantasy ? "fantasy" : "natural",
      })),
    [],
  );

  const facialHairOptions: StyleOption[] = useMemo(
    () =>
      FACIAL_HAIR_STYLES.map((style) => ({
        id: style.id,
        name: style.name,
      })),
    [],
  );

  const facialHairColorOptions: ColorOption[] = useMemo(
    () =>
      HAIR_COLORS.map((color) => ({
        id: color.id,
        name: color.name,
        color: color.baseColor,
        category: color.isFantasy ? "fantasy" : "natural",
      })),
    [],
  );

  // Determine if highlights are enabled
  const highlightsEnabled = config.hair.highlightColor !== undefined;

  // Handle highlights toggle
  const handleHighlightsToggle = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        // Set a default highlight color
        onUpdateHighlightColor("golden_blonde");
      } else {
        onUpdateHighlightColor(undefined);
      }
    },
    [onUpdateHighlightColor],
  );

  // Handle highlights color change
  const handleHighlightsColor = useCallback(
    (colorId: string) => {
      onUpdateHighlightColor(colorId as HairColorId);
    },
    [onUpdateHighlightColor],
  );

  const themeColors = {
    text: colors.text,
    surface: colors.surface,
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      testID={testID}
    >
      {/* Hair Style */}
      <StylePicker
        title="Hair Style"
        options={hairStyleOptions}
        selectedId={config.hair.style}
        onSelectStyle={onUpdateHairStyle}
        baseConfig={config}
        previewKey="hair.style"
        itemSize="medium"
        columns={3}
        showCategories={true}
      />

      {/* Hair Color */}
      <ColorPicker
        title="Hair Color"
        colors={hairColorOptions}
        selectedId={config.hair.color}
        onSelectColor={onUpdateHairColor as (id: string) => void}
        swatchSize="medium"
        showCategories={true}
      />

      {/* Highlights */}
      <Section title="Highlights" colors={themeColors}>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>
            Enable Highlights
          </Text>
          <Switch
            value={highlightsEnabled}
            onValueChange={handleHighlightsToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </Section>

      {/* Highlight Color - only show if enabled */}
      {highlightsEnabled && (
        <ColorPicker
          title="Highlight Color"
          colors={hairColorOptions}
          selectedId={config.hair.highlightColor || "golden_blonde"}
          onSelectColor={handleHighlightsColor}
          swatchSize="small"
          showCategories={true}
        />
      )}

      {/* Facial Hair Style */}
      <StylePicker
        title="Facial Hair"
        options={facialHairOptions}
        selectedId={config.hair.facialHair.style}
        onSelectStyle={onUpdateFacialHairStyle}
        baseConfig={config}
        previewKey="hair.facialHair.style"
        itemSize="medium"
        columns={3}
        showCategories={false}
      />

      {/* Facial Hair Color - only show if facial hair is not "none" */}
      {config.hair.facialHair.style !== "none" && (
        <ColorPicker
          title="Facial Hair Color"
          colors={facialHairColorOptions}
          selectedId={config.hair.facialHair.color}
          onSelectColor={onUpdateFacialHairColor as (id: string) => void}
          swatchSize="small"
          showCategories={true}
        />
      )}

      {/* Bottom spacing */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

export const HairCustomizer = memo(HairCustomizerBase);

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 8,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  sectionContent: {
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  bottomSpacer: {
    height: 40,
  },
});

export default HairCustomizer;
