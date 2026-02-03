/**
 * FaceCustomizer Component
 *
 * Customization panel for face-related features:
 * - Skin tone
 * - Face shape
 * - Face width
 * - Nose style and size
 * - Mouth style, lip color, and thickness
 * - Ear style, size, and visibility
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import {
  EAR_STYLES,
  FACE_SHAPES,
  LIP_COLORS,
  MOUTH_STYLES,
  NOSE_STYLES,
} from "@/data/avatarAssets";
import { useAppTheme } from "@/store/ThemeContext";
import type {
  DigitalAvatarConfig,
  EarStyleData,
  EarStyleId,
  FaceShapeData,
  FaceShapeId,
  LipColorData,
  LipColorId,
  MouthStyleData,
  MouthStyleId,
  NoseStyleData,
  NoseStyleId,
  SkinToneId,
} from "@/types/avatar";
import React, { memo, useMemo } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { ColorPicker, type ColorOption } from "./ColorPicker";
import { FeatureSlider, SLIDER_PRESETS } from "./FeatureSliders";
import { SkinTonePicker } from "./SkinTonePicker";
import { StylePicker, type StyleOption } from "./StylePicker";

// =============================================================================
// TYPES
// =============================================================================

export interface FaceCustomizerProps {
  /** Current avatar configuration */
  config: DigitalAvatarConfig;
  /** Update skin tone */
  onUpdateSkinTone: (skinTone: SkinToneId) => void;
  /** Update face settings */
  onUpdateFaceShape: (shape: FaceShapeId) => void;
  onUpdateFaceWidth: (width: number) => void;
  /** Update nose settings */
  onUpdateNoseStyle: (style: NoseStyleId) => void;
  onUpdateNoseSize: (size: number) => void;
  /** Update mouth settings */
  onUpdateMouthStyle: (style: MouthStyleId) => void;
  onUpdateMouthSize: (size: number) => void;
  onUpdateLipColor: (color: LipColorId) => void;
  onUpdateLipThickness: (thickness: number) => void;
  /** Update ear settings */
  onUpdateEarStyle: (style: EarStyleId) => void;
  onUpdateEarSize: (size: number) => void;
  onUpdateEarVisibility: (visible: boolean) => void;
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

function FaceCustomizerBase({
  config,
  onUpdateSkinTone,
  onUpdateFaceShape,
  onUpdateFaceWidth,
  onUpdateNoseStyle,
  onUpdateNoseSize,
  onUpdateMouthStyle,
  onUpdateMouthSize,
  onUpdateLipColor,
  onUpdateLipThickness,
  onUpdateEarStyle,
  onUpdateEarSize,
  onUpdateEarVisibility,
  testID,
}: FaceCustomizerProps) {
  const { colors } = useAppTheme();

  // Convert data to style options
  const faceShapeOptions: StyleOption[] = useMemo(
    () =>
      FACE_SHAPES.map((shape: FaceShapeData) => ({
        id: shape.id,
        name: shape.name,
      })),
    [],
  );

  const noseStyleOptions: StyleOption[] = useMemo(
    () =>
      NOSE_STYLES.map((style: NoseStyleData) => ({
        id: style.id,
        name: style.name,
      })),
    [],
  );

  const mouthStyleOptions: StyleOption[] = useMemo(
    () =>
      MOUTH_STYLES.map((style: MouthStyleData) => ({
        id: style.id,
        name: style.name,
      })),
    [],
  );

  const lipColorOptions: ColorOption[] = useMemo(
    () =>
      LIP_COLORS.map((color: LipColorData) => ({
        id: color.id,
        name: color.name,
        color: color.color,
      })),
    [],
  );

  const earStyleOptions: StyleOption[] = useMemo(
    () =>
      EAR_STYLES.map((style: EarStyleData) => ({
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
      {/* Skin Tone */}
      <SkinTonePicker
        selectedSkinTone={config.body.skinTone}
        onSelectSkinTone={onUpdateSkinTone}
        title="Skin Tone"
      />

      {/* Face Shape */}
      <StylePicker
        title="Face Shape"
        options={faceShapeOptions}
        selectedId={config.face.shape}
        onSelectStyle={onUpdateFaceShape}
        baseConfig={config}
        previewKey="face.shape"
        itemSize="medium"
        showCategories={false}
      />

      {/* Face Width Slider */}
      <Section title="Face Width" colors={themeColors}>
        <FeatureSlider
          label="Width"
          value={config.face.width}
          onValueChange={onUpdateFaceWidth}
          {...SLIDER_PRESETS.width}
        />
      </Section>

      {/* Nose */}
      <StylePicker
        title="Nose Style"
        options={noseStyleOptions}
        selectedId={config.nose.style}
        onSelectStyle={onUpdateNoseStyle}
        baseConfig={config}
        previewKey="nose.style"
        itemSize="small"
        showCategories={false}
      />

      <Section title="Nose Size" colors={themeColors}>
        <FeatureSlider
          label="Size"
          value={config.nose.size}
          onValueChange={onUpdateNoseSize}
          {...SLIDER_PRESETS.size}
        />
      </Section>

      {/* Mouth */}
      <StylePicker
        title="Mouth Style"
        options={mouthStyleOptions}
        selectedId={config.mouth.style}
        onSelectStyle={onUpdateMouthStyle}
        baseConfig={config}
        previewKey="mouth.style"
        itemSize="small"
        showCategories={false}
      />

      <Section title="Mouth Adjustments" colors={themeColors}>
        <FeatureSlider
          label="Size"
          value={config.mouth.size}
          onValueChange={onUpdateMouthSize}
          {...SLIDER_PRESETS.size}
        />
        <FeatureSlider
          label="Lip Thickness"
          value={config.mouth.lipThickness}
          onValueChange={onUpdateLipThickness}
          {...SLIDER_PRESETS.thickness}
        />
      </Section>

      {/* Lip Color */}
      <ColorPicker
        title="Lip Color"
        colors={lipColorOptions}
        selectedId={config.mouth.lipColor}
        onSelectColor={onUpdateLipColor as (id: string) => void}
        swatchSize="medium"
        showCategories={false}
      />

      {/* Ears */}
      <StylePicker
        title="Ear Style"
        options={earStyleOptions}
        selectedId={config.ears.style}
        onSelectStyle={onUpdateEarStyle}
        baseConfig={config}
        previewKey="ears.style"
        itemSize="small"
        showCategories={false}
      />

      <Section title="Ear Settings" colors={themeColors}>
        <FeatureSlider
          label="Size"
          value={config.ears.size}
          onValueChange={onUpdateEarSize}
          {...SLIDER_PRESETS.size}
        />
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>
            Show Ears
          </Text>
          <Switch
            value={config.ears.visible}
            onValueChange={onUpdateEarVisibility}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </Section>

      {/* Bottom spacing */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

export const FaceCustomizer = memo(FaceCustomizerBase);

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

export default FaceCustomizer;
