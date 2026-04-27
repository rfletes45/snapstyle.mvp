/**
 * ScreenHeader — Shared minimal header component
 *
 * Modeled on the Calls screen header: flat background matching the screen
 * surface, large bold left-aligned title, optional back arrow, thin bottom
 * divider, and optional right-side actions.
 *
 * @module components/shared/ScreenHeader
 */

import {
  MAIN_HEADER_BOTTOM_PADDING,
  MAIN_HEADER_HORIZONTAL_PADDING,
  MAIN_HEADER_TOP_PADDING,
} from "@/components/navigation/MainSettingsHeaderButton";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =============================================================================
// Types
// =============================================================================

export interface ScreenHeaderProps {
  /** Header title text */
  title: string;

  /** Show a back arrow. Defaults to true. */
  showBack?: boolean;

  /** Custom back handler. Falls back to navigation.goBack(). */
  onBack?: () => void;

  /** Render right-side content (action buttons, badges, etc.) */
  renderRight?: () => React.ReactNode;

  /** Extra style applied to the outer container */
  style?: ViewStyle;
}

// =============================================================================
// Component
// =============================================================================

export function ScreenHeader({
  title,
  showBack = true,
  onBack,
  renderRight,
  style,
}: ScreenHeaderProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          paddingTop:
            Math.max(insets.top, MAIN_HEADER_TOP_PADDING) +
            MAIN_HEADER_TOP_PADDING,
        },
        style,
      ]}
    >
      <View style={styles.left}>
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        )}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>

      {renderRight && <View style={styles.right}>{renderRight()}</View>}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: MAIN_HEADER_HORIZONTAL_PADDING,
    paddingBottom: MAIN_HEADER_BOTTOM_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
  },
});
