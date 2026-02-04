/**
 * ThemePicker - Component for selecting themes
 * Can be used as a full screen or embedded in settings
 */

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { JSX, useCallback, useMemo } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BorderRadius, Spacing } from "../../constants/theme";
import {
  ThemeId,
  ThemeMeta,
  useAppTheme,
  useColors,
} from "../store/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.lg * 3) / 2;
const CARD_HEIGHT = 140;

interface ThemePickerProps {
  /** Show as a full-screen picker with header */
  fullScreen?: boolean;
  /** Callback when a theme is selected (for navigation purposes) */
  onThemeSelected?: (themeId: ThemeId) => void;
  /** Show category headers */
  showCategories?: boolean;
}

/**
 * Theme preview card showing the color palette
 */
interface ThemeCardProps {
  theme: ThemeMeta;
  isSelected: boolean;
  onPress: () => void;
}

function ThemeCard({
  theme,
  isSelected,
  onPress,
}: ThemeCardProps): JSX.Element {
  const colors = useColors();
  // previewColors is [background, primary, accent]
  const [bgColor, primaryColor, accentColor] = theme.previewColors;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isSelected ? colors.primary : colors.border,
          borderWidth: isSelected ? 2 : 1,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      accessibilityLabel={`Select ${theme.name} theme`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      {/* Color Preview */}
      <View style={styles.colorPreview}>
        {/* Background layer */}
        <View style={[styles.previewBackground, { backgroundColor: bgColor }]}>
          {/* Primary accent bar */}
          <View
            style={[styles.previewAccent, { backgroundColor: primaryColor }]}
          />
          {/* Text preview lines */}
          <View style={styles.previewContent}>
            <View
              style={[
                styles.previewTextLine,
                {
                  backgroundColor: theme.isDark ? "#ffffff" : "#000000",
                  width: "70%",
                  opacity: 0.8,
                },
              ]}
            />
            <View
              style={[
                styles.previewTextLine,
                {
                  backgroundColor: theme.isDark ? "#ffffff" : "#000000",
                  width: "50%",
                  opacity: 0.5,
                },
              ]}
            />
          </View>
          {/* Surface card preview */}
          <View style={[styles.previewCard, { backgroundColor: accentColor }]}>
            <View
              style={[
                styles.previewTextLineSmall,
                {
                  backgroundColor: theme.isDark ? "#ffffff" : "#000000",
                  opacity: 0.8,
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Theme Info */}
      <View style={styles.cardInfo}>
        <View style={styles.cardHeader}>
          <Text
            style={[styles.themeName, { color: colors.text }]}
            numberOfLines={1}
          >
            {theme.name}
          </Text>
          {isSelected && (
            <View
              style={[styles.checkmark, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
          )}
        </View>
        <Text
          style={[styles.themeDescription, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {theme.description}
        </Text>
        {/* Theme badges */}
        <View style={styles.badges}>
          {theme.isDark ? (
            <View
              style={[styles.badge, { backgroundColor: colors.surfaceVariant }]}
            >
              <Ionicons name="moon" size={10} color={colors.textSecondary} />
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                Dark
              </Text>
            </View>
          ) : (
            <View
              style={[styles.badge, { backgroundColor: colors.surfaceVariant }]}
            >
              <Ionicons name="sunny" size={10} color={colors.textSecondary} />
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                Light
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Section header for theme categories
 */
interface CategoryHeaderProps {
  category: ThemeMeta["category"];
  count: number;
}

function CategoryHeader({ category, count }: CategoryHeaderProps): JSX.Element {
  const colors = useColors();

  const categoryInfo = useMemo(() => {
    switch (category) {
      case "light":
        return { icon: "sunny-outline" as const, label: "Light Themes" };
      case "dark":
        return { icon: "moon-outline" as const, label: "Dark Themes" };
      case "amoled":
        return { icon: "contrast-outline" as const, label: "AMOLED Themes" };
      case "pastel":
        return {
          icon: "color-palette-outline" as const,
          label: "Pastel Themes",
        };
      case "vibrant":
        return { icon: "flash-outline" as const, label: "Vibrant Themes" };
      default:
        return { icon: "albums-outline" as const, label: "Other" };
    }
  }, [category]);

  return (
    <View style={styles.categoryHeader}>
      <Ionicons name={categoryInfo.icon} size={20} color={colors.primary} />
      <Text style={[styles.categoryTitle, { color: colors.text }]}>
        {categoryInfo.label}
      </Text>
      <Text style={[styles.categoryCount, { color: colors.textSecondary }]}>
        {count}
      </Text>
    </View>
  );
}

/**
 * System theme toggle option
 */
function SystemThemeOption(): JSX.Element {
  const { useSystemTheme, setUseSystemTheme, isDark } = useAppTheme();
  const colors = useColors();

  return (
    <Pressable
      onPress={() => setUseSystemTheme(!useSystemTheme)}
      style={({ pressed }) => [
        styles.systemOption,
        {
          backgroundColor: colors.surface,
          borderColor: useSystemTheme ? colors.primary : colors.border,
          borderWidth: useSystemTheme ? 2 : 1,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.systemOptionContent}>
        <MaterialCommunityIcons
          name="theme-light-dark"
          size={24}
          color={colors.primary}
        />
        <View style={styles.systemOptionText}>
          <Text style={[styles.systemOptionTitle, { color: colors.text }]}>
            Follow System
          </Text>
          <Text
            style={[styles.systemOptionDesc, { color: colors.textSecondary }]}
          >
            Automatically switch based on device settings
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.toggleOuter,
          {
            backgroundColor: useSystemTheme
              ? colors.primary
              : colors.surfaceVariant,
          },
        ]}
      >
        <View
          style={[
            styles.toggleInner,
            {
              backgroundColor: "#fff",
              transform: [{ translateX: useSystemTheme ? 18 : 2 }],
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

/**
 * Quick toggle for light/dark mode
 */
function QuickToggle(): JSX.Element {
  const { isDark, toggleDarkMode, useSystemTheme } = useAppTheme();
  const colors = useColors();

  if (useSystemTheme) return <></>;

  return (
    <Pressable
      onPress={toggleDarkMode}
      style={({ pressed }) => [
        styles.quickToggle,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Ionicons
        name={isDark ? "sunny" : "moon"}
        size={20}
        color={colors.primary}
      />
      <Text style={[styles.quickToggleText, { color: colors.text }]}>
        Switch to {isDark ? "Light" : "Dark"} Mode
      </Text>
      <Ionicons name="swap-horizontal" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

export function ThemePicker({
  fullScreen = false,
  onThemeSelected,
  showCategories = true,
}: ThemePickerProps): JSX.Element {
  const { themeId, setTheme, availableThemes, getThemesByCategory } =
    useAppTheme();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const handleSelectTheme = useCallback(
    (id: ThemeId) => {
      setTheme(id);
      onThemeSelected?.(id);
    },
    [setTheme, onThemeSelected],
  );

  // Group themes by category
  const categorizedThemes = useMemo(() => {
    if (!showCategories) {
      return [{ category: "all" as const, themes: availableThemes }];
    }

    const categories: ThemeMeta["category"][] = [
      "light",
      "dark",
      "amoled",
      "pastel",
      "vibrant",
    ];

    return categories
      .map((category) => ({
        category,
        themes: getThemesByCategory(category),
      }))
      .filter((group) => group.themes.length > 0);
  }, [availableThemes, getThemesByCategory, showCategories]);

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: fullScreen ? insets.top : 0,
        },
      ]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {fullScreen && (
        <Text style={[styles.title, { color: colors.text }]}>
          Choose a Theme
        </Text>
      )}

      {/* System Theme Toggle */}
      <SystemThemeOption />

      {/* Quick Toggle */}
      <QuickToggle />

      {/* Theme Categories */}
      {categorizedThemes.map(({ category, themes }) => (
        <View key={category} style={styles.categorySection}>
          {showCategories && category !== "all" && (
            <CategoryHeader category={category} count={themes.length} />
          )}
          <View style={styles.grid}>
            {themes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isSelected={theme.id === themeId}
                onPress={() => handleSelectTheme(theme.id)}
              />
            ))}
          </View>
        </View>
      ))}

      {/* Bottom padding */}
      <View style={{ height: insets.bottom + Spacing.xl }} />
    </ScrollView>
  );
}

/**
 * Compact theme picker for inline use (e.g., in settings row)
 */
export function CompactThemePicker(): JSX.Element {
  const { themeId, availableThemes, setTheme } = useAppTheme();
  const colors = useColors();

  const currentTheme = useMemo(
    () => availableThemes.find((t) => t.id === themeId),
    [availableThemes, themeId],
  );

  return (
    <View style={styles.compactContainer}>
      <FlatList
        horizontal
        data={availableThemes}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.compactList}
        renderItem={({ item }) => {
          const [bgColor, primaryColor] = item.previewColors;
          return (
            <Pressable
              onPress={() => setTheme(item.id)}
              style={({ pressed }) => [
                styles.compactCard,
                {
                  borderColor:
                    item.id === themeId ? colors.primary : colors.border,
                  borderWidth: item.id === themeId ? 2 : 1,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={styles.compactPreview}>
                <View
                  style={[
                    styles.compactPreviewBg,
                    { backgroundColor: bgColor },
                  ]}
                >
                  <View
                    style={[
                      styles.compactPreviewAccent,
                      { backgroundColor: primaryColor },
                    ]}
                  />
                </View>
              </View>
              <Text
                style={[
                  styles.compactLabel,
                  {
                    color: item.id === themeId ? colors.primary : colors.text,
                  },
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: Spacing.lg,
  },

  // System option
  systemOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  systemOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  systemOptionText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  systemOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  systemOptionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  toggleOuter: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
  },
  toggleInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },

  // Quick toggle
  quickToggle: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  quickToggleText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },

  // Category
  categorySection: {
    marginBottom: Spacing.lg,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  categoryCount: {
    fontSize: 14,
  },

  // Grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },

  // Card
  card: {
    width: CARD_WIDTH,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  colorPreview: {
    height: 80,
    overflow: "hidden",
  },
  previewBackground: {
    flex: 1,
    padding: Spacing.sm,
  },
  previewAccent: {
    height: 4,
    width: "40%",
    borderRadius: 2,
    marginBottom: Spacing.xs,
  },
  previewContent: {
    gap: 4,
  },
  previewTextLine: {
    height: 6,
    borderRadius: 3,
  },
  previewCard: {
    position: "absolute",
    bottom: Spacing.sm,
    right: Spacing.sm,
    width: 50,
    height: 30,
    borderRadius: BorderRadius.sm,
    padding: 6,
    justifyContent: "center",
  },
  previewTextLineSmall: {
    height: 4,
    width: "80%",
    borderRadius: 2,
  },
  cardInfo: {
    padding: Spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  themeName: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  checkmark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  themeDescription: {
    fontSize: 11,
    marginTop: 2,
  },
  badges: {
    flexDirection: "row",
    marginTop: Spacing.xs,
    gap: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "500",
  },

  // Compact picker
  compactContainer: {
    marginVertical: Spacing.sm,
  },
  compactList: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  compactCard: {
    width: 80,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginRight: Spacing.sm,
  },
  compactPreview: {
    height: 50,
  },
  compactPreviewBg: {
    flex: 1,
    padding: 6,
  },
  compactPreviewAccent: {
    height: 3,
    width: "50%",
    borderRadius: 2,
  },
  compactLabel: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
});

export default ThemePicker;
