/**
 * CustomizationHubScreen
 *
 * Equip-only customization screen where users can browse owned cosmetics
 * and equip them (Decorations, Backgrounds, Badges, Themes, plus chat
 * Bubble Colors and Animal Themes). All purchasing happens in the Shop tab.
 *
 * Layout (top → bottom):
 *   1. Section filter bar (Profile / Chat) — Games-screen styling
 *   2. Search input — Games-screen styling
 *   3. Divider line
 *   4. Category filter bar (section-aware) — Games-screen styling
 *   5. Scrollable item grid (owned items only, equipped-first / rarity-desc)
 *
 * Note: Profile previews were intentionally removed from the top of this
 * screen so the customization browse experience stays focused. Fonts and
 * Font Colors were also removed from the customization UI; their underlying
 * catalogs and equip pipelines are retained for backward compatibility.
 *
 * @module screens/customization/CustomizationHubScreen
 */

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Searchbar, Text } from "react-native-paper";

import {
  BubbleColorPreviewSurface,
  ThemeModeBadge,
  ThemePreviewSurface,
  getBubblePreviewColor,
  getThemePreviewMeta,
} from "@/components/customization/CosmeticPreviewSurfaces";
import { ScreenHeader } from "@/components/shared/ScreenHeader";

import { CosmeticImage } from "@/components/CosmeticImage";
import { BorderRadius, Spacing } from "@/constants/theme";
import {
  DEFAULT_ANIMAL_THEME_ID,
  getAnimalImage,
} from "@/cosmetics/animalAssets";
import { getCosmeticAsset, hasCosmeticAsset } from "@/cosmetics/assetRegistry";
import type { ChatAppearance, CosmeticDefinition } from "@/cosmetics/types";
import {
  CHAT_TABS,
  PROFILE_TABS,
  useCustomizationHub,
} from "@/hooks/useCustomizationHub";
import { useProfileData } from "@/hooks/useProfileData";
import { useProfilePicture } from "@/hooks/useProfilePicture";
import { prefetchCustomizationCategory } from "@/services/cosmeticsAssetCache";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme, useColors } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import { ItemDetailSheet } from "./ItemDetailSheet";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_COLUMNS = 3;
const GRID_GAP = Spacing.sm;
const GRID_PADDING = Spacing.lg;
const ITEM_SIZE =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) /
  GRID_COLUMNS;

// Theme card sizing (2-column like ThemePicker)
const THEME_CARD_GAP = Spacing.md;
const THEME_CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - THEME_CARD_GAP) / 2;

// =============================================================================
// Types
// =============================================================================

interface CustomizationHubScreenProps {
  navigation: any;
  route?: {
    params?: { initialTab?: string; initialSection?: "profile" | "chat" };
  };
}

type CustomizationSection = "profile" | "chat";

// =============================================================================
// Rarity Colors
// =============================================================================

/**
 * Convert a color (hex like #RRGGBB / #RGB or rgb()/rgba()) to its
 * fully-transparent rgba() equivalent. Used so the LinearGradient edge
 * fade ends in the same hue as the background instead of fading toward
 * gray (which `'transparent'` causes on iOS).
 */
function hexToTransparent(color: string): string {
  if (!color) return "rgba(0,0,0,0)";
  if (color.startsWith("rgba")) {
    return color.replace(/rgba\(([^)]+)\)/, (_m, inner) => {
      const parts = inner.split(",").map((p: string) => p.trim());
      return `rgba(${parts[0]},${parts[1]},${parts[2]},0)`;
    });
  }
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", ",0)");
  }
  if (color.startsWith("#")) {
    const full =
      color.length === 4
        ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
        : color;
    const r = parseInt(full.slice(1, 3), 16);
    const g = parseInt(full.slice(3, 5), 16);
    const b = parseInt(full.slice(5, 7), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      return "rgba(0,0,0,0)";
    }
    return `rgba(${r},${g},${b},0)`;
  }
  return "rgba(0,0,0,0)";
}

const RARITY_COLORS: Record<string, string> = {
  common: "#9E9E9E",
  uncommon: "#4CAF50",
  rare: "#2196F3",
  epic: "#9C27B0",
  legendary: "#FF9800",
  mythic: "#F44336",
};

// =============================================================================
// Grid Item
// =============================================================================

interface GridItemProps {
  item: CosmeticDefinition;
  isEquipped: boolean;
  onPress: (item: CosmeticDefinition) => void;
}

const GridItem = React.memo(function GridItem({
  item,
  isEquipped,
  onPress,
}: GridItemProps) {
  const colors = useColors();
  const isDecoration = item.type === "decoration";
  const hasAsset = hasCosmeticAsset(item.type, item.assetKey ?? item.id);
  const assetSource = hasAsset
    ? getCosmeticAsset(item.type, item.assetKey ?? item.id)
    : null;
  const rarityColor = RARITY_COLORS[item.rarity] ?? colors.textSecondary;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.gridItem,
        {
          backgroundColor: colors.surfaceVariant,
          borderColor: isEquipped ? colors.primary : rarityColor + "30",
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {/* Image or placeholder */}
      <View
        style={[
          styles.gridItemPreview,
          isDecoration && styles.gridItemPreviewDecoration,
        ]}
      >
        {assetSource ? (
          <CosmeticImage
            source={assetSource}
            style={styles.gridItemImage}
            contentFit={isDecoration ? "contain" : "cover"}
            recyclingKey={item.id}
            debugLabel={`custom-grid-${item.id}`}
          />
        ) : (
          <View
            style={[
              styles.gridItemPlaceholder,
              { backgroundColor: rarityColor + "15" },
            ]}
          >
            <MaterialCommunityIcons
              name={
                item.type === "badge"
                  ? "shield-star"
                  : item.type === "theme"
                    ? "palette"
                    : "image"
              }
              size={28}
              color={rarityColor}
            />
          </View>
        )}
      </View>

      {/* Name */}
      <Text
        style={[styles.gridItemName, { color: colors.text }]}
        numberOfLines={1}
      >
        {item.name}
      </Text>

      {/* Equipped badge */}
      {isEquipped && (
        <View style={[styles.statusBadge, { backgroundColor: colors.primary }]}>
          <MaterialCommunityIcons name="check" size={10} color="#fff" />
        </View>
      )}

      {/* Rarity dot */}
      <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
    </Pressable>
  );
});

// =============================================================================
// Theme Card (ThemePicker-style with color preview)
// =============================================================================

interface ThemeCardProps {
  item: CosmeticDefinition;
  isEquipped: boolean;
  onPress: (item: CosmeticDefinition) => void;
}

const ThemeCard = React.memo(function ThemeCard({
  item,
  isEquipped,
  onPress,
}: ThemeCardProps) {
  const colors = useColors();
  const meta = getThemePreviewMeta(item.id);

  // Fallback if theme metadata somehow missing
  if (!meta) {
    return <GridItem item={item} isEquipped={isEquipped} onPress={onPress} />;
  }

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.themeCard,
        {
          backgroundColor: colors.surface,
          borderColor: isEquipped ? colors.primary : colors.border,
          borderWidth: isEquipped ? 2 : 1,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {/* Color Preview */}
      <View style={styles.themePreview}>
        <ThemePreviewSurface meta={meta} />
      </View>

      {/* Theme Info */}
      <View style={styles.themeCardInfo}>
        <View style={styles.themeCardHeader}>
          <Text
            style={[styles.themeCardName, { color: colors.text }]}
            numberOfLines={1}
          >
            {meta.name}
          </Text>
          {isEquipped && (
            <View
              style={[
                styles.themeCheckmark,
                { backgroundColor: colors.primary },
              ]}
            >
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
          )}
        </View>
        <Text
          style={[styles.themeCardDesc, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {meta.description}
        </Text>
        {/* Light / Dark badge */}
        <View style={styles.themeCardBadges}>
          <ThemeModeBadge isDark={meta.isDark} colors={colors} />
        </View>
      </View>
    </Pressable>
  );
});

// =============================================================================
// Bubble Color Card (swatch + mini bubble preview)
// =============================================================================

interface BubbleColorCardProps {
  item: CosmeticDefinition;
  isEquipped: boolean;
  onPress: (item: CosmeticDefinition) => void;
}

const BubbleColorCard = React.memo(function BubbleColorCard({
  item,
  isEquipped,
  onPress,
}: BubbleColorCardProps) {
  const colors = useColors();
  const bubbleHex = getBubblePreviewColor(item);
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} bubble color${isEquipped ? ", currently equipped" : ""}`}
      accessibilityState={{ selected: isEquipped }}
      style={({ pressed }) => [
        styles.bubbleCard,
        {
          borderColor: isEquipped ? colors.primary : colors.border,
          borderWidth: isEquipped ? 2 : 1,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {/* Color swatch */}
      <View style={styles.bubbleSwatch}>
        <BubbleColorPreviewSurface colorHex={bubbleHex} />
      </View>
      {/* Label */}
      <View style={styles.bubbleCardInfo}>
        <Text
          style={[styles.bubbleCardName, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {isEquipped && (
          <View
            style={[
              styles.bubbleCheckmark,
              { backgroundColor: colors.primary },
            ]}
          >
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        )}
      </View>
    </Pressable>
  );
});

// =============================================================================
// Animal Theme Card (animal image preview)
// =============================================================================

interface AnimalThemeCardProps {
  item: CosmeticDefinition;
  isEquipped: boolean;
  onPress: (item: CosmeticDefinition) => void;
}

const AnimalThemeCard = React.memo(function AnimalThemeCard({
  item,
  isEquipped,
  onPress,
}: AnimalThemeCardProps) {
  const colors = useColors();
  const imageSource = getAnimalImage(item.id);

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} animal theme${isEquipped ? ", currently equipped" : ""}`}
      accessibilityState={{ selected: isEquipped }}
      style={({ pressed }) => [
        styles.animalCard,
        {
          borderColor: isEquipped ? colors.primary : colors.border,
          borderWidth: isEquipped ? 2 : 1,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {/* Animal image preview */}
      <View style={styles.animalImageWrap}>
        {imageSource ? (
          <CosmeticImage
            source={imageSource}
            style={styles.animalImage}
            debugLabel={`custom-animal-${item.id}`}
          />
        ) : (
          <MaterialCommunityIcons
            name="paw"
            size={40}
            color={colors.textSecondary}
          />
        )}
      </View>
      {/* Label */}
      <View style={styles.animalCardInfo}>
        <Text
          style={[styles.animalCardName, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {isEquipped && (
          <View
            style={[
              styles.animalCheckmark,
              { backgroundColor: colors.primary },
            ]}
          >
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        )}
      </View>
    </Pressable>
  );
});

// =============================================================================
// Screen
// =============================================================================

export default function CustomizationHubScreen({
  navigation,
  route,
}: CustomizationHubScreenProps) {
  const colors = useColors();
  const { setTheme: setAppTheme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid ?? "";
  const { profile: baseProfile, refreshProfile } = useUser();
  const { profile } = useProfileData(uid);
  const { decoration, refresh: refreshPicture } = useProfilePicture({
    userId: uid,
    seed: {
      picture: baseProfile?.profilePicture,
      decoration: baseProfile?.avatarDecoration,
    },
  });

  // Section & tab from route params
  const initialTab = route?.params?.initialTab;
  const initialSection = route?.params?.initialSection;

  // Section state: "profile" or "chat"
  const [section, setSection] = useState<CustomizationSection>(
    initialSection === "chat" ? "chat" : "profile",
  );

  // Current equipped state — profile
  const currentDecorationId = decoration?.decorationId ?? null;
  const currentBackgroundId = profile?.equippedBackgroundId ?? null;
  const currentThemeId = (profile as any)?.theme?.equippedThemeId ?? "default";
  const currentBadgeIds = useMemo<string[]>(
    () => (profile as any)?.featuredBadges?.badgeIds ?? [],
    [profile],
  );

  // Current equipped state — chat
  const currentChatAppearance: ChatAppearance = baseProfile?.chatAppearance ?? {
    bubbleColorId: null,
    fontId: null,
    fontColorId: null,
    animalThemeId: null,
  };
  const currentBubbleColorId = currentChatAppearance.bubbleColorId;
  const currentFontId = currentChatAppearance.fontId;
  const currentFontColorId = currentChatAppearance.fontColorId;
  const currentAnimalThemeId = currentChatAppearance.animalThemeId;

  // Hub hook
  const hub = useCustomizationHub({
    uid,
    currentDecorationId,
    currentBackgroundId,
    currentThemeId,
    currentBadgeIds,
    currentBubbleColorId,
    currentFontId,
    currentFontColorId,
    currentAnimalThemeId,
    setAppTheme,
  });

  const sectionTabs = section === "chat" ? CHAT_TABS : PROFILE_TABS;

  // ── Dev-only performance metrics ──

  // ── Prefetch cosmetic assets on mount for fast grid rendering ──
  useEffect(() => {
    prefetchCustomizationCategory("background");
    prefetchCustomizationCategory("decoration");
    prefetchCustomizationCategory("badge");
    prefetchCustomizationCategory("chat_animal_theme");
  }, []);

  // Apply initialTab / initialSection from route params on mount
  useEffect(() => {
    if (initialSection === "chat") {
      setSection("chat");
      // If an initialTab matches a chat tab, set it. Fonts/Font Colors are
      // intentionally no longer surfaced — fall through to default.
      if (
        initialTab &&
        ["chat_bubble_color", "chat_animal_theme"].includes(initialTab)
      ) {
        hub.setActiveTab(initialTab as any);
      } else {
        hub.setActiveTab("chat_bubble_color");
      }
    } else if (
      initialTab &&
      ["decoration", "background", "badge", "theme"].includes(initialTab)
    ) {
      hub.setActiveTab(
        initialTab as "decoration" | "background" | "badge" | "theme",
      );
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Item detail sheet
  const [selectedItem, setSelectedItem] = useState<CosmeticDefinition | null>(
    null,
  );
  const [detailVisible, setDetailVisible] = useState(false);

  const handleItemPress = useCallback((item: CosmeticDefinition) => {
    setSelectedItem(item);
    setDetailVisible(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailVisible(false);
  }, []);

  const handleEquip = useCallback(
    async (item: CosmeticDefinition) => {
      try {
        await hub.equipItem(item);
        await Promise.all([refreshProfile(), refreshPicture()]);
        setDetailVisible(false);
      } catch (error: any) {
        Alert.alert("Error", error?.message || "Failed to equip item");
      }
    },
    [hub, refreshProfile, refreshPicture],
  );

  /** Direct theme equip — tap card to apply immediately (no detail sheet). */
  const handleThemeDirectEquip = useCallback(
    async (item: CosmeticDefinition) => {
      try {
        await hub.equipItem(item);
        await Promise.all([refreshProfile(), refreshPicture()]);
      } catch (error: any) {
        Alert.alert("Error", error?.message || "Failed to equip theme");
      }
    },
    [hub, refreshProfile, refreshPicture],
  );

  /** Direct chat cosmetic equip — tap card to equip immediately. */
  const handleChatDirectEquip = useCallback(
    async (item: CosmeticDefinition) => {
      try {
        await hub.equipItem(item);
        await refreshProfile();
      } catch (error: any) {
        Alert.alert("Error", error?.message || "Failed to equip item");
      }
    },
    [hub, refreshProfile],
  );

  // Determine if selected item is equipped
  const isSelectedEquipped = useMemo(() => {
    if (!selectedItem) return false;
    switch (selectedItem.type) {
      case "decoration":
        return currentDecorationId === selectedItem.id;
      case "background":
        return currentBackgroundId === selectedItem.id;
      case "theme":
        return currentThemeId === selectedItem.id;
      case "badge":
        return currentBadgeIds.includes(selectedItem.id);
      case "chat_bubble_color":
        return currentBubbleColorId === selectedItem.id;
      case "chat_font":
        return currentFontId === selectedItem.id;
      case "chat_font_color":
        return currentFontColorId === selectedItem.id;
      case "chat_animal_theme":
        return (
          (currentAnimalThemeId ?? DEFAULT_ANIMAL_THEME_ID) === selectedItem.id
        );
      default:
        return false;
    }
  }, [
    selectedItem,
    currentDecorationId,
    currentBackgroundId,
    currentThemeId,
    currentBadgeIds,
    currentBubbleColorId,
    currentFontId,
    currentFontColorId,
    currentAnimalThemeId,
  ]);

  // ── Render ────────────────────────────────────────────────────────────────

  const renderGridItem = useCallback(
    ({ item }: { item: CosmeticDefinition }) => {
      const isEquipped = (() => {
        switch (item.type) {
          case "decoration":
            return currentDecorationId === item.id;
          case "background":
            return currentBackgroundId === item.id;
          case "theme":
            return currentThemeId === item.id;
          case "badge":
            return currentBadgeIds.includes(item.id);
          case "chat_bubble_color":
            return currentBubbleColorId === item.id;
          case "chat_font":
            return currentFontId === item.id;
          case "chat_font_color":
            return currentFontColorId === item.id;
          case "chat_animal_theme":
            return (
              (currentAnimalThemeId ?? DEFAULT_ANIMAL_THEME_ID) === item.id
            );
          default:
            return false;
        }
      })();

      return (
        <GridItem
          item={item}
          isEquipped={isEquipped}
          onPress={handleItemPress}
        />
      );
    },
    [
      handleItemPress,
      currentDecorationId,
      currentBackgroundId,
      currentThemeId,
      currentBadgeIds,
      currentBubbleColorId,
      currentFontId,
      currentFontColorId,
      currentAnimalThemeId,
    ],
  );

  const keyExtractor = useCallback((item: CosmeticDefinition) => item.id, []);

  const renderAnimalThemeItem = useCallback(
    ({ item }: { item: CosmeticDefinition }) => (
      <AnimalThemeCard
        item={item}
        isEquipped={
          (currentAnimalThemeId ?? DEFAULT_ANIMAL_THEME_ID) === item.id
        }
        onPress={handleChatDirectEquip}
      />
    ),
    [currentAnimalThemeId, handleChatDirectEquip],
  );

  if (!baseProfile) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* App bar */}
      <ScreenHeader
        title="Customize"
        style={styles.headerNoBorder}
        onBack={() => navigation.goBack()}
        renderRight={() => (
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => navigation.navigate("Shop" as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Open shop"
              accessibilityRole="button"
              style={styles.headerActionButton}
            >
              <MaterialCommunityIcons
                name="store"
                size={22}
                color={colors.text}
              />
            </Pressable>
          </View>
        )}
      />

      {/* ── Filters + Search (Games-screen styling) ── */}
      <View
        style={[
          styles.stickyFilterContainer,
          { backgroundColor: colors.background },
        ]}
      >
        {/* Section filter (Profile / Chat) */}
        <View
          style={[styles.filterTabBar, { borderBottomColor: colors.border }]}
        >
          {(["profile", "chat"] as const).map((s) => {
            const isActive = section === s;
            return (
              <Pressable
                key={s}
                onPress={() => {
                  setSection(s);
                  // Switch to first tab of the new section
                  if (s === "chat") {
                    hub.setActiveTab("chat_bubble_color");
                  } else {
                    hub.setActiveTab("theme");
                  }
                  hub.setSearchQuery("");
                }}
                accessibilityRole="tab"
                accessibilityLabel={`${s === "profile" ? "Profile" : "Chat"} section`}
                accessibilityState={{ selected: isActive }}
                style={[
                  styles.filterTab,
                  isActive && {
                    borderBottomColor: colors.primary,
                    borderBottomWidth: 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterTabLabel,
                    {
                      color: isActive ? colors.primary : colors.textSecondary,
                      fontWeight: isActive ? "600" : "400",
                    },
                  ]}
                >
                  {s === "profile" ? "Profile" : "Chat"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder={`Search ${sectionTabs.find((t) => t.id === hub.activeTab)?.label ?? "items"}…`}
            value={hub.searchQuery}
            onChangeText={hub.setSearchQuery}
            style={[
              styles.searchBar,
              { backgroundColor: colors.surfaceVariant ?? colors.surface },
            ]}
            inputStyle={[styles.searchInput, { color: colors.text }]}
            iconColor={colors.textSecondary}
            placeholderTextColor={colors.textSecondary}
            elevation={0}
          />
        </View>

        <View
          style={[styles.searchDivider, { backgroundColor: colors.border }]}
        />

        {/* Category pill filter (section-aware, horizontally scrollable with edge fades) */}
        <View style={styles.pillRowWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRowContent}
          >
            {sectionTabs.map((tab) => {
              const isActive = hub.activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => hub.setActiveTab(tab.id)}
                  accessibilityRole="tab"
                  accessibilityLabel={`${tab.label} filter`}
                  accessibilityState={{ selected: isActive }}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: isActive
                        ? colors.primary
                        : (colors.surfaceVariant ?? colors.surface),
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillLabel,
                      {
                        color: isActive
                          ? (colors.onPrimary ?? "#FFFFFF")
                          : colors.textSecondary,
                        fontWeight: isActive ? "600" : "500",
                      },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <LinearGradient
            pointerEvents="none"
            colors={[colors.background, hexToTransparent(colors.background)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.pillFadeLeft}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[hexToTransparent(colors.background), colors.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.pillFadeRight}
          />
        </View>
      </View>

      {/* Item Count */}
      <View style={styles.itemCountRow}>
        <Text style={[styles.itemCount, { color: colors.textSecondary }]}>
          {hub.filteredItems.length} item
          {hub.filteredItems.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Item Grid */}
      {hub.entitlementsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading your items…
          </Text>
        </View>
      ) : hub.activeTab === "chat_bubble_color" ? (
        /* ── Bubble Color cards (2-column, swatch preview, tap to equip) ── */
        <ScrollView
          contentContainerStyle={styles.themeGridContent}
          showsVerticalScrollIndicator={false}
        >
          {hub.filteredItems.length > 0 ? (
            <View style={styles.themeGrid}>
              {hub.filteredItems.map((item) => (
                <BubbleColorCard
                  key={item.id}
                  item={item}
                  isEquipped={currentBubbleColorId === item.id}
                  onPress={handleChatDirectEquip}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="chat-outline"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No bubble colors owned yet.
              </Text>
              <Pressable
                onPress={() => navigation.navigate("Shop" as any)}
                style={[
                  styles.goToShopButton,
                  { backgroundColor: colors.primary },
                ]}
              >
                <MaterialCommunityIcons name="store" size={16} color="#fff" />
                <Text style={styles.goToShopText}>Browse Shop</Text>
              </Pressable>
            </View>
          )}
          {/* Unequip / reset to default */}
          {currentBubbleColorId && (
            <Pressable
              onPress={async () => {
                try {
                  await hub.unequipSlot("chat_bubble_color");
                  await refreshProfile();
                } catch (error: any) {
                  Alert.alert("Error", error?.message || "Failed to reset");
                }
              }}
              style={[
                styles.themeShopHint,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <MaterialCommunityIcons
                name="restore"
                size={18}
                color={colors.primary}
              />
              <Text style={[styles.themeShopHintText, { color: colors.text }]}>
                Reset to default bubble color
              </Text>
            </Pressable>
          )}
          {/* Shop upsell */}
          <Pressable
            onPress={() => navigation.navigate("Shop" as any)}
            style={[
              styles.themeShopHint,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <MaterialCommunityIcons
              name="store"
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.themeShopHintText, { color: colors.text }]}>
              Want more colors? Visit the Shop
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
        </ScrollView>
      ) : hub.activeTab === "chat_animal_theme" ? (
        /* ── Animal theme cards (2-column, image preview, tap to equip) ── */
        <FlatList
          key="grid-2col"
          data={hub.filteredItems}
          renderItem={renderAnimalThemeItem}
          keyExtractor={keyExtractor}
          numColumns={2}
          columnWrapperStyle={styles.animalGridRow}
          contentContainerStyle={styles.themeGridContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          windowSize={5}
          maxToRenderPerBatch={4}
          removeClippedSubviews={Platform.OS === "android"}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="paw"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No animal themes owned yet.
              </Text>
              <Pressable
                onPress={() => navigation.navigate("Shop" as any)}
                style={[
                  styles.goToShopButton,
                  { backgroundColor: colors.primary },
                ]}
              >
                <MaterialCommunityIcons name="store" size={16} color="#fff" />
                <Text style={styles.goToShopText}>Browse Shop</Text>
              </Pressable>
            </View>
          }
          ListFooterComponent={
            <>
              {/* Unequip / reset to default duck */}
              {currentAnimalThemeId && (
                <Pressable
                  onPress={async () => {
                    try {
                      await hub.unequipSlot("chat_animal_theme");
                      await refreshProfile();
                    } catch (error: any) {
                      Alert.alert("Error", error?.message || "Failed to reset");
                    }
                  }}
                  style={[
                    styles.themeShopHint,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="restore"
                    size={18}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.themeShopHintText, { color: colors.text }]}
                  >
                    Reset to default (Duck)
                  </Text>
                </Pressable>
              )}
              {/* Shop upsell */}
              <Pressable
                onPress={() => navigation.navigate("Shop" as any)}
                style={[
                  styles.themeShopHint,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <MaterialCommunityIcons
                  name="store"
                  size={18}
                  color={colors.primary}
                />
                <Text
                  style={[styles.themeShopHintText, { color: colors.text }]}
                >
                  Want more animals? Visit the Shop
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            </>
          }
        />
      ) : hub.activeTab === "theme" ? (
        /* ── Theme cards (2-column, ThemePicker-style, tap to equip) ── */
        <ScrollView
          contentContainerStyle={styles.themeGridContent}
          showsVerticalScrollIndicator={false}
        >
          {hub.filteredItems.length > 0 ? (
            <View style={styles.themeGrid}>
              {hub.filteredItems.map((item) => (
                <ThemeCard
                  key={item.id}
                  item={item}
                  isEquipped={currentThemeId === item.id}
                  onPress={handleThemeDirectEquip}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="palette-outline"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No themes match your search.
              </Text>
            </View>
          )}
          {/* Shop upsell for premium themes */}
          <Pressable
            onPress={() => navigation.navigate("Shop" as any)}
            style={[
              styles.themeShopHint,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <MaterialCommunityIcons
              name="store"
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.themeShopHintText, { color: colors.text }]}>
              Want more themes? Visit the Shop
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
        </ScrollView>
      ) : (
        /* ── Standard grid (3-column for decorations, backgrounds, badges) ── */
        <FlatList
          key="grid-3col"
          data={hub.filteredItems}
          renderItem={renderGridItem}
          keyExtractor={keyExtractor}
          numColumns={GRID_COLUMNS}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          windowSize={7}
          maxToRenderPerBatch={6}
          removeClippedSubviews={Platform.OS === "android"}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name={
                  hub.activeTab === "badge"
                    ? "shield-star-outline"
                    : "treasure-chest"
                }
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {hub.activeTab === "badge"
                  ? "No badges earned yet."
                  : "No items owned in this category yet."}
              </Text>
              {hub.activeTab === "badge" ? (
                <Text
                  style={[
                    styles.emptyText,
                    { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
                  ]}
                >
                  Complete all achievements for a game to earn its badge.
                </Text>
              ) : (
                <Pressable
                  onPress={() => navigation.navigate("Shop" as any)}
                  style={[
                    styles.goToShopButton,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <MaterialCommunityIcons name="store" size={16} color="#fff" />
                  <Text style={styles.goToShopText}>Open Shop</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}

      {/* Item Detail Sheet */}
      <ItemDetailSheet
        visible={detailVisible}
        item={selectedItem}
        isOwned={selectedItem ? hub.isOwned(selectedItem.id) : true}
        isEquipped={isSelectedEquipped}
        onClose={handleCloseDetail}
        onEquip={handleEquip}
        onUnequip={async (type) => {
          try {
            await hub.unequipSlot(type);
            await Promise.all([refreshProfile(), refreshPicture()]);
          } catch (error: any) {
            Alert.alert("Error", error?.message || "Failed to unequip item");
          }
          setDetailVisible(false);
        }}
        onPreview={(item) => {
          hub.previewItem(item);
        }}
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerActionButton: {
    padding: 4,
  },
  // Suppress ScreenHeader's hairline so the title and the sticky filter bar
  // read as one continuous sheet (matches GamesHub).
  headerNoBorder: {
    borderBottomWidth: 0,
  },

  // ── Sticky filter + search container (GamesHub-style) ─────────────────
  stickyFilterContainer: {
    paddingTop: 0,
    paddingBottom: 0,
    zIndex: 3,
  },
  filterTabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  filterTabLabel: {
    fontSize: 13,
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  searchBar: {
    borderRadius: 12,
    height: 36,
  },
  searchInput: {
    fontSize: 13,
    minHeight: 0,
  },
  searchDivider: {
    height: StyleSheet.hairlineWidth,
  },
  // ── Category pill row (below search bar) ─────────────────────────────
  pillRowWrapper: {
    position: "relative",
    paddingTop: 8,
    paddingBottom: 10,
  },
  pillRowContent: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  pill: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  pillLabel: {
    fontSize: 12.5,
    lineHeight: 16,
    includeFontPadding: false,
  },
  pillFadeLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 16,
  },
  pillFadeRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 16,
  },
  itemCountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  itemCount: {
    fontSize: 12,
  },
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 80,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  animalGridRow: {
    gap: THEME_CARD_GAP,
    marginBottom: THEME_CARD_GAP,
  },
  gridItem: {
    width: ITEM_SIZE,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  gridItemPreview: {
    width: "100%",
    height: ITEM_SIZE * 0.75,
    justifyContent: "center",
    alignItems: "center",
  },
  gridItemPreviewDecoration: {
    padding: Spacing.xs + 2,
  },
  gridItemImage: {
    width: "100%",
    height: "100%",
  },
  gridItemPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  gridItemName: {
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  statusBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  rarityDot: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 48,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  goToShopButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
  },
  goToShopText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  // ── Theme card grid (2-column, ThemePicker-style) ─────────────────────
  themeGridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 80,
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: THEME_CARD_GAP,
  },
  themeCard: {
    width: THEME_CARD_WIDTH,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  themePreview: {
    height: 80,
    overflow: "hidden",
  },
  themeCardInfo: {
    padding: Spacing.sm,
  },
  themeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  themeCardName: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  themeCheckmark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  themeCardDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  themeCardBadges: {
    flexDirection: "row",
    marginTop: Spacing.xs,
    gap: 4,
  },
  themeShopHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  themeShopHintText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },

  // ── Bubble Color Card ──────────────────────────────────────────────────
  bubbleCard: {
    width: THEME_CARD_WIDTH,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  bubbleSwatch: {
    height: 64,
  },
  bubbleCardInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  bubbleCardName: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  bubbleCheckmark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Animal Theme Card ──────────────────────────────────────────────────
  animalCard: {
    width: THEME_CARD_WIDTH,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  animalImageWrap: {
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  animalImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  animalCardInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  animalCardName: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  animalCheckmark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
});
