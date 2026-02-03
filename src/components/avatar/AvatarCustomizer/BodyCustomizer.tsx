/**
 * BodyCustomizer Component
 *
 * Customization panel for body-related features:
 * - Skin tone
 * - Body shape/type
 * - Height adjustment
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import { BODY_SHAPES } from "@/data/avatarAssets";
import { useAppTheme } from "@/store/ThemeContext";
import type {
  BodyShapeId,
  DigitalAvatarConfig,
  SkinToneId,
} from "@/types/avatar";
import React, { memo, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { FeatureSlider } from "./FeatureSliders";
import { SkinTonePicker } from "./SkinTonePicker";
import { StylePicker, type StyleOption } from "./StylePicker";

// =============================================================================
// TYPES
// =============================================================================

export interface BodyCustomizerProps {
  /** Current avatar configuration */
  config: DigitalAvatarConfig;
  /** Update skin tone */
  onUpdateSkinTone: (skinTone: SkinToneId) => void;
  /** Update body shape */
  onUpdateBodyShape: (shape: BodyShapeId) => void;
  /** Update height */
  onUpdateHeight: (height: number) => void;
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
// HEIGHT VISUALIZER
// =============================================================================

interface HeightVisualizerProps {
  height: number;
  colors: {
    primary: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
}

const HEIGHT_LABELS: Record<number, string> = {
  0.85: "Very Short",
  0.9: "Short",
  0.95: "Below Average",
  1.0: "Average",
  1.05: "Above Average",
  1.1: "Tall",
  1.15: "Very Tall",
};

const HeightVisualizer = memo(function HeightVisualizer({
  height,
  colors,
}: HeightVisualizerProps) {
  // Find the closest label
  const heightKeys = Object.keys(HEIGHT_LABELS).map(Number);
  const closestHeight = heightKeys.reduce((prev, curr) =>
    Math.abs(curr - height) < Math.abs(prev - height) ? curr : prev,
  );
  const label = HEIGHT_LABELS[closestHeight] || "Average";

  // Calculate visual height (50-100px range)
  const visualHeight = 50 + (height - 0.85) * (50 / 0.3);

  return (
    <View style={styles.heightVisualizerContainer}>
      <View style={styles.heightVisualWrapper}>
        <View
          style={[
            styles.heightBar,
            {
              height: visualHeight,
              backgroundColor: colors.primary,
            },
          ]}
        />
        <View
          style={[
            styles.heightBaseline,
            { backgroundColor: colors.textSecondary },
          ]}
        />
      </View>
      <Text style={[styles.heightLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.heightValue, { color: colors.textSecondary }]}>
        {(height * 100).toFixed(0)}%
      </Text>
    </View>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function BodyCustomizerBase({
  config,
  onUpdateSkinTone,
  onUpdateBodyShape,
  onUpdateHeight,
  testID,
}: BodyCustomizerProps) {
  const { colors } = useAppTheme();

  // Convert body shapes to style options
  const bodyShapeOptions: StyleOption[] = useMemo(
    () =>
      BODY_SHAPES.map((shape) => ({
        id: shape.id,
        name: shape.name,
      })),
    [],
  );

  const themeColors = {
    text: colors.text,
    surface: colors.surface,
    primary: colors.primary,
    textSecondary: colors.textSecondary,
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

      {/* Body Shape */}
      <StylePicker
        title="Body Shape"
        options={bodyShapeOptions}
        selectedId={config.body.shape}
        onSelectStyle={onUpdateBodyShape}
        baseConfig={config}
        previewKey="body.shape"
        itemSize="large"
        columns={3}
        showCategories={false}
      />

      {/* Height */}
      <Section title="Height" colors={themeColors}>
        <HeightVisualizer height={config.body.height} colors={themeColors} />
        <FeatureSlider
          label="Height"
          value={config.body.height}
          onValueChange={onUpdateHeight}
          minimumValue={0.85}
          maximumValue={1.15}
          step={0.01}
          minLabel="Short"
          maxLabel="Tall"
        />
      </Section>

      {/* Information Card */}
      <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.infoTitle, { color: colors.text }]}>
          💡 Body Type Tips
        </Text>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Your body shape affects how clothing items fit and appear on your
          avatar. Try different combinations to find your perfect look!
        </Text>
      </View>

      {/* Bottom spacing */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

export const BodyCustomizer = memo(BodyCustomizerBase);

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
  heightVisualizerContainer: {
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 16,
  },
  heightVisualWrapper: {
    height: 100,
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 8,
  },
  heightBar: {
    width: 40,
    borderRadius: 4,
    minHeight: 10,
  },
  heightBaseline: {
    position: "absolute",
    bottom: 0,
    left: -20,
    right: -20,
    height: 2,
    borderRadius: 1,
  },
  heightLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  heightValue: {
    fontSize: 12,
    marginTop: 2,
  },
  infoCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 40,
  },
});

export default BodyCustomizer;
