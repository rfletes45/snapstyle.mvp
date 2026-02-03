/**
 * EyesCustomizer Component
 *
 * Customization panel for eye-related features:
 * - Eye style and shape
 * - Eye color
 * - Eye size and spacing
 * - Eyebrow style, color, and thickness
 * - Eyelash style
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import {
  EYE_COLORS,
  EYE_STYLES,
  EYEBROW_STYLES,
  EYELASH_STYLES,
  HAIR_COLORS, // Eyebrow colors match hair colors
} from "@/data/avatarAssets";
import { useAppTheme } from "@/store/ThemeContext";
import type {
  DigitalAvatarConfig,
  EyebrowStyleData,
  EyebrowStyleId,
  EyeColorData,
  EyeColorId,
  EyelashStyleData,
  EyelashStyleId,
  EyeStyleData,
  EyeStyleId,
  HairColorData,
  HairColorId,
} from "@/types/avatar";
import React, { memo, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ColorPicker, type ColorOption } from "./ColorPicker";
import { FeatureSlider, SLIDER_PRESETS } from "./FeatureSliders";
import { StylePicker, type StyleOption } from "./StylePicker";

// =============================================================================
// TYPES
// =============================================================================

export interface EyesCustomizerProps {
  /** Current avatar configuration */
  config: DigitalAvatarConfig;
  /** Update eye settings */
  onUpdateEyeStyle: (style: EyeStyleId) => void;
  onUpdateEyeColor: (color: EyeColorId) => void;
  onUpdateEyeSize: (size: number) => void;
  onUpdateEyeSpacing: (spacing: number) => void;
  onUpdateEyeTilt: (tilt: number) => void;
  /** Update eyebrow settings */
  onUpdateEyebrowStyle: (style: EyebrowStyleId) => void;
  onUpdateEyebrowColor: (color: HairColorId) => void;
  onUpdateEyebrowThickness: (thickness: number) => void;
  /** Update eyelash settings */
  onUpdateEyelashStyle: (style: EyelashStyleId) => void;
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

function EyesCustomizerBase({
  config,
  onUpdateEyeStyle,
  onUpdateEyeColor,
  onUpdateEyeSize,
  onUpdateEyeSpacing,
  onUpdateEyeTilt,
  onUpdateEyebrowStyle,
  onUpdateEyebrowColor,
  onUpdateEyebrowThickness,
  onUpdateEyelashStyle,
  testID,
}: EyesCustomizerProps) {
  const { colors } = useAppTheme();

  // Convert data to style options
  const eyeStyleOptions: StyleOption[] = useMemo(
    () =>
      EYE_STYLES.map((style: EyeStyleData) => ({
        id: style.id,
        name: style.name,
      })),
    [],
  );

  const eyeColorOptions: ColorOption[] = useMemo(
    () =>
      EYE_COLORS.map((color: EyeColorData) => ({
        id: color.id,
        name: color.name,
        color: color.irisColors.middle, // Use middle iris color for preview
      })),
    [],
  );

  const eyebrowStyleOptions: StyleOption[] = useMemo(
    () =>
      EYEBROW_STYLES.map((style: EyebrowStyleData) => ({
        id: style.id,
        name: style.name,
      })),
    [],
  );

  const eyebrowColorOptions: ColorOption[] = useMemo(
    () =>
      HAIR_COLORS.map((color: HairColorData) => ({
        id: color.id,
        name: color.name,
        color: color.baseColor,
        category: color.isFantasy ? "fantasy" : "natural",
      })),
    [],
  );

  const eyelashStyleOptions: StyleOption[] = useMemo(
    () =>
      EYELASH_STYLES.map((style: EyelashStyleData) => ({
        id: style.id,
        name: style.name,
      })),
    [],
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
      {/* Eye Style */}
      <StylePicker
        title="Eye Style"
        options={eyeStyleOptions}
        selectedId={config.eyes.style}
        onSelectStyle={onUpdateEyeStyle}
        baseConfig={config}
        previewKey="eyes.style"
        itemSize="medium"
        showCategories={false}
      />

      {/* Eye Color */}
      <ColorPicker
        title="Eye Color"
        colors={eyeColorOptions}
        selectedId={config.eyes.color}
        onSelectColor={onUpdateEyeColor as (id: string) => void}
        swatchSize="medium"
        showCategories={true}
      />

      {/* Eye Adjustments */}
      <Section title="Eye Adjustments" colors={themeColors}>
        <FeatureSlider
          label="Size"
          value={config.eyes.size}
          onValueChange={onUpdateEyeSize}
          {...SLIDER_PRESETS.size}
        />
        <FeatureSlider
          label="Spacing"
          value={config.eyes.spacing}
          onValueChange={onUpdateEyeSpacing}
          {...SLIDER_PRESETS.spacing}
        />
        <FeatureSlider
          label="Tilt"
          value={config.eyes.tilt}
          onValueChange={onUpdateEyeTilt}
          {...SLIDER_PRESETS.tilt}
        />
      </Section>

      {/* Eyebrow Style */}
      <StylePicker
        title="Eyebrow Style"
        options={eyebrowStyleOptions}
        selectedId={config.eyes.eyebrows.style}
        onSelectStyle={onUpdateEyebrowStyle}
        baseConfig={config}
        previewKey="eyes.eyebrows.style"
        itemSize="small"
        showCategories={false}
      />

      {/* Eyebrow Color */}
      <ColorPicker
        title="Eyebrow Color"
        colors={eyebrowColorOptions}
        selectedId={config.eyes.eyebrows.color}
        onSelectColor={onUpdateEyebrowColor as (id: string) => void}
        swatchSize="small"
        showCategories={true}
      />

      {/* Eyebrow Adjustments */}
      <Section title="Eyebrow Adjustments" colors={themeColors}>
        <FeatureSlider
          label="Thickness"
          value={config.eyes.eyebrows.thickness}
          onValueChange={onUpdateEyebrowThickness}
          {...SLIDER_PRESETS.thickness}
        />
      </Section>

      {/* Eyelash Style */}
      <StylePicker
        title="Eyelash Style"
        options={eyelashStyleOptions}
        selectedId={config.eyes.eyelashes.style}
        onSelectStyle={onUpdateEyelashStyle}
        baseConfig={config}
        previewKey="eyes.eyelashes.style"
        itemSize="small"
        showCategories={false}
      />

      {/* Bottom spacing */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

export const EyesCustomizer = memo(EyesCustomizerBase);

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
  bottomSpacer: {
    height: 40,
  },
});

export default EyesCustomizer;
