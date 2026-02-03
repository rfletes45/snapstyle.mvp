/**
 * PreviewPanel Component
 *
 * Live preview panel for avatar customization. Shows the avatar
 * with controls for toggling body view and background color.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import { useAppTheme } from "@/store/ThemeContext";
import type { DigitalAvatarConfig } from "@/types/avatar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { DigitalAvatar } from "../DigitalAvatar";

// =============================================================================
// TYPES
// =============================================================================

export interface PreviewPanelProps {
  /** Avatar configuration to preview */
  config: DigitalAvatarConfig;
  /** Whether showing full body or head only */
  showBody?: boolean;
  /** Callback to toggle body view */
  onToggleBody?: (showBody: boolean) => void;
  /** Enable animations */
  animated?: boolean;
  /** Custom size for avatar */
  size?: number;
  /** Test ID */
  testID?: string;
}

// Background color presets for preview
const BACKGROUND_COLORS = [
  { color: "transparent", label: "None" },
  { color: "#FFFFFF", label: "White" },
  { color: "#1e1e2e", label: "Dark" },
  { color: "#89b4fa", label: "Blue" },
  { color: "#a6e3a1", label: "Green" },
  { color: "#fab387", label: "Peach" },
  { color: "#f5c2e7", label: "Pink" },
];

// =============================================================================
// BACKGROUND SELECTOR COMPONENT
// =============================================================================

interface BackgroundSelectorProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
  colors: {
    primary: string;
    border: string;
    surface: string;
  };
}

const BackgroundSelector = memo(function BackgroundSelector({
  selectedColor,
  onSelectColor,
  colors,
}: BackgroundSelectorProps) {
  return (
    <View style={styles.backgroundSelector}>
      {BACKGROUND_COLORS.map(({ color, label }) => {
        const isSelected = selectedColor === color;
        const isTransparent = color === "transparent";

        return (
          <Pressable
            key={color}
            onPress={() => onSelectColor(color)}
            style={[
              styles.backgroundOption,
              {
                borderColor: isSelected ? colors.primary : colors.border,
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
            accessibilityLabel={`${label} background`}
            accessibilityState={{ selected: isSelected }}
          >
            {isTransparent ? (
              <View style={styles.transparentPattern}>
                <View
                  style={[styles.checkerSquare, { backgroundColor: "#ddd" }]}
                />
                <View
                  style={[styles.checkerSquare, { backgroundColor: "#fff" }]}
                />
                <View
                  style={[styles.checkerSquare, { backgroundColor: "#fff" }]}
                />
                <View
                  style={[styles.checkerSquare, { backgroundColor: "#ddd" }]}
                />
              </View>
            ) : (
              <View style={[styles.colorSwatch, { backgroundColor: color }]} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
});

// =============================================================================
// VIEW TOGGLE COMPONENT
// =============================================================================

interface ViewToggleProps {
  showBody: boolean;
  onToggle: () => void;
  colors: {
    primary: string;
    textMuted: string;
    surface: string;
    border: string;
  };
}

const ViewToggle = memo(function ViewToggle({
  showBody,
  onToggle,
  colors,
}: ViewToggleProps) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: withSpring(showBody ? 32 : 0, {
            damping: 15,
            stiffness: 200,
          }),
        },
      ],
    };
  }, [showBody]);

  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.viewToggle,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: showBody }}
      accessibilityLabel="Toggle full body view"
    >
      <View style={styles.toggleLabels}>
        <MaterialCommunityIcons
          name="face-man"
          size={16}
          color={!showBody ? colors.primary : colors.textMuted}
        />
        <MaterialCommunityIcons
          name="human"
          size={16}
          color={showBody ? colors.primary : colors.textMuted}
        />
      </View>
      <Animated.View
        style={[
          styles.toggleThumb,
          { backgroundColor: colors.primary },
          animatedStyle,
        ]}
      />
    </Pressable>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function PreviewPanelBase({
  config,
  showBody: externalShowBody,
  onToggleBody,
  animated = false,
  size = 180,
  testID,
}: PreviewPanelProps) {
  const { colors } = useAppTheme();

  // Internal state if not controlled
  const [internalShowBody, setInternalShowBody] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState("transparent");

  // Use external or internal state
  const showBody = externalShowBody ?? internalShowBody;

  const handleToggleBody = () => {
    const newValue = !showBody;
    if (onToggleBody) {
      onToggleBody(newValue);
    } else {
      setInternalShowBody(newValue);
    }
  };

  const themeColors = {
    primary: colors.primary,
    textMuted: colors.textMuted,
    surface: colors.surface,
    border: colors.border,
  };

  // Calculate avatar size based on view mode
  const avatarSize = showBody ? size * 1.5 : size;

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surfaceVariant }]}
      testID={testID}
    >
      {/* Avatar Preview Area */}
      <View
        style={[
          styles.previewArea,
          {
            backgroundColor:
              backgroundColor === "transparent"
                ? colors.surface
                : backgroundColor,
            height: showBody ? 280 : 220,
          },
        ]}
      >
        <DigitalAvatar
          config={config}
          size={avatarSize}
          showBody={showBody}
          animated={animated}
        />
      </View>

      {/* Controls Row */}
      <View style={styles.controlsRow}>
        {/* Background Selector */}
        <View style={styles.controlGroup}>
          <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>
            Background
          </Text>
          <BackgroundSelector
            selectedColor={backgroundColor}
            onSelectColor={setBackgroundColor}
            colors={themeColors}
          />
        </View>

        {/* View Toggle */}
        <View style={styles.controlGroup}>
          <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>
            View
          </Text>
          <ViewToggle
            showBody={showBody}
            onToggle={handleToggleBody}
            colors={themeColors}
          />
        </View>
      </View>
    </View>
  );
}

export const PreviewPanel = memo(PreviewPanelBase);

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
    marginHorizontal: 16,
    marginVertical: 8,
  },
  previewArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  controlGroup: {
    alignItems: "flex-start",
  },
  controlLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  backgroundSelector: {
    flexDirection: "row",
    gap: 6,
  },
  backgroundOption: {
    width: 28,
    height: 28,
    borderRadius: 6,
    overflow: "hidden",
  },
  transparentPattern: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  checkerSquare: {
    width: "50%",
    height: "50%",
  },
  colorSwatch: {
    flex: 1,
  },
  viewToggle: {
    width: 68,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    position: "relative",
    justifyContent: "center",
  },
  toggleLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    zIndex: 0,
  },
  toggleThumb: {
    position: "absolute",
    width: 28,
    height: 24,
    borderRadius: 12,
    left: 2,
    opacity: 0.2,
  },
});

export default PreviewPanel;
