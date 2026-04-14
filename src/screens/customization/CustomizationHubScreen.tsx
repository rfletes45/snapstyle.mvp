/**
 * CustomizationHubScreen
 *
 * Equip-only customization screen where users can browse owned cosmetics,
 * preview, and equip them (Decorations, Backgrounds, Badges, Themes).
 * All purchasing happens in the Shop tab.
 *
 * Layout (top → bottom):
 *   1. Live-preview (ProfileHeaderVisual or ChatPreview — fixed 220px)
 *   2. Profile / Chat section toggle
 *   3. Category tab bar (section-aware)
 *   4. Search input
 *   5. Scrollable item grid (owned items only)
 *
 * @module screens/customization/CustomizationHubScreen
 */

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/shared/ScreenHeader";

import { AnimalIcon } from "@/components/chat/AnimalIcon";
import { CosmeticImage } from "@/components/CosmeticImage";
import { ProfileHeaderVisual } from "@/components/profile/ProfileHeaderVisual";
import { BorderRadius, Spacing, THEME_METADATA } from "@/constants/theme";
import {
  DEFAULT_ANIMAL_THEME_ID,
  getAnimalImage,
} from "@/cosmetics/animalAssets";
import { getCosmeticAsset, hasCosmeticAsset } from "@/cosmetics/assetRegistry";
import {
  relativeLuminance,
  resolveOutgoingChatStyle,
} from "@/cosmetics/chatAppearanceResolver";
import {
  CHAT_BUBBLE_COLORS,
  CHAT_FONT_COLORS,
  CHAT_FONT_FAMILIES,
} from "@/cosmetics/chatDefaults";
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

import { createLogger } from "@/utils/log";
import { ActivityIndicator } from "react-native";

const logger = createLogger("screens/customization/CustomizationHubScreen");

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
      {assetSource ? (
        <CosmeticImage
          source={assetSource}
          style={styles.gridItemImage}
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
  const meta = THEME_METADATA[item.id as keyof typeof THEME_METADATA];

  // Fallback if theme metadata somehow missing
  if (!meta) {
    return <GridItem item={item} isEquipped={isEquipped} onPress={onPress} />;
  }

  const [bgColor, primaryColor, accentColor] = meta.previewColors;

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
        <View style={[styles.themePreviewBg, { backgroundColor: bgColor }]}>
          {/* Primary accent bar */}
          <View
            style={[
              styles.themePreviewAccent,
              { backgroundColor: primaryColor },
            ]}
          />
          {/* Text preview lines */}
          <View style={styles.themePreviewContent}>
            <View
              style={[
                styles.themePreviewLine,
                {
                  backgroundColor: meta.isDark ? "#ffffff" : "#000000",
                  width: "70%",
                  opacity: 0.8,
                },
              ]}
            />
            <View
              style={[
                styles.themePreviewLine,
                {
                  backgroundColor: meta.isDark ? "#ffffff" : "#000000",
                  width: "50%",
                  opacity: 0.5,
                },
              ]}
            />
          </View>
          {/* Surface card preview */}
          <View
            style={[
              styles.themePreviewSwatch,
              { backgroundColor: accentColor },
            ]}
          >
            <View
              style={[
                styles.themePreviewLineSm,
                {
                  backgroundColor: meta.isDark ? "#ffffff" : "#000000",
                  opacity: 0.8,
                },
              ]}
            />
          </View>
        </View>
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
          <View
            style={[
              styles.themeCardBadge,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <Ionicons
              name={meta.isDark ? "moon" : "sunny"}
              size={10}
              color={colors.textSecondary}
            />
            <Text
              style={[
                styles.themeCardBadgeText,
                { color: colors.textSecondary },
              ]}
            >
              {meta.isDark ? "Dark" : "Light"}
            </Text>
          </View>
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
  const bubbleHex =
    (item.metadata?.bubbleColorValue as string) ??
    CHAT_BUBBLE_COLORS[item.id] ??
    "#1976D2";
  // Compute contrast text for the swatch preview
  const textColor = relativeLuminance(bubbleHex) > 0.179 ? "#000" : "#FFF";

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
      <View style={[styles.bubbleSwatch, { backgroundColor: bubbleHex }]}>
        <View style={styles.bubblePreviewRow}>
          <View
            style={[
              styles.bubbleMini,
              { backgroundColor: bubbleHex, borderColor: textColor + "22" },
            ]}
          >
            <Text style={[styles.bubbleMiniText, { color: textColor }]}>
              Hello!
            </Text>
          </View>
        </View>
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
// Font Card (font preview)
// =============================================================================

interface FontCardProps {
  item: CosmeticDefinition;
  isEquipped: boolean;
  onPress: (item: CosmeticDefinition) => void;
}

const FontCard = React.memo(function FontCard({
  item,
  isEquipped,
  onPress,
}: FontCardProps) {
  const colors = useColors();
  const fontFamily =
    (item.metadata?.fontFamily as string) ??
    CHAT_FONT_FAMILIES[item.id] ??
    undefined;

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} font${isEquipped ? ", currently equipped" : ""}`}
      accessibilityState={{ selected: isEquipped }}
      style={({ pressed }) => [
        styles.fontCard,
        {
          borderColor: isEquipped ? colors.primary : colors.border,
          borderWidth: isEquipped ? 2 : 1,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {/* Font sample */}
      <View style={styles.fontSample}>
        <Text
          style={[styles.fontSampleTitle, { color: colors.text, fontFamily }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text
          style={[
            styles.fontSampleBody,
            { color: colors.textSecondary, fontFamily },
          ]}
          numberOfLines={2}
        >
          The quick brown fox jumps over the lazy dog
        </Text>
      </View>
      {/* Equipped indicator */}
      {isEquipped && (
        <View
          style={[styles.fontCheckmark, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="checkmark" size={10} color="#fff" />
        </View>
      )}
    </Pressable>
  );
});

// =============================================================================
// Font Color Card (color swatch preview)
// =============================================================================

interface FontColorCardProps {
  item: CosmeticDefinition;
  isEquipped: boolean;
  isDefault: boolean;
  onPress: (item: CosmeticDefinition) => void;
}

const FontColorCard = React.memo(function FontColorCard({
  item,
  isEquipped,
  isDefault,
  onPress,
}: FontColorCardProps) {
  const colors = useColors();
  const fontColorHex =
    (item.metadata?.fontColorValue as string) ??
    CHAT_FONT_COLORS[item.id] ??
    colors.text;

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} font color${isEquipped ? ", currently equipped" : ""}`}
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
      {/* Color swatch preview */}
      <View
        style={[
          styles.fontColorSwatch,
          {
            backgroundColor: isDefault
              ? colors.surfaceVariant
              : colors.background,
          },
        ]}
      >
        <Text
          style={[
            styles.fontColorPreviewText,
            { color: isDefault ? colors.text : fontColorHex },
          ]}
        >
          Aa
        </Text>
      </View>
      {/* Label */}
      <View style={styles.bubbleCardInfo}>
        <Text
          style={[styles.bubbleCardName, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {isDefault && (
          <Text
            style={[styles.fontColorHint, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            Adapts to theme
          </Text>
        )}
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
// Chat Preview (mini conversation showing current chat style)
// =============================================================================

interface ChatPreviewProps {
  chatAppearance: ChatAppearance | null;
  isDark: boolean;
}

function ChatPreview({ chatAppearance, isDark }: ChatPreviewProps) {
  const colors = useColors();
  const style = resolveOutgoingChatStyle({
    chatAppearance,
    appearanceMode: isDark ? "dark" : "light",
  });

  const composerInputBg = isDark ? colors.surface : "#f0f0f0";
  const composerBorderColor = isDark ? colors.border : "#e0e0e0";
  const composerPlaceholderColor = isDark ? colors.textMuted : "#999";

  return (
    <View
      style={[styles.chatPreviewWrap, { backgroundColor: colors.background }]}
      accessibilityLabel="Chat style preview"
      accessibilityRole="summary"
    >
      {/* ── Chat bubbles area ── */}
      <View style={styles.chatPreviewBubblesArea}>
        {/* Received bubble */}
        <View style={styles.chatPreviewReceived}>
          <View
            style={[
              styles.chatPreviewBubble,
              styles.chatPreviewReceivedBubble,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <Text style={[styles.chatPreviewText, { color: colors.text }]}>
              Hey, love the new style! 🎨
            </Text>
          </View>
        </View>
        {/* Sent bubble — uses chatAppearance */}
        <View style={styles.chatPreviewSent}>
          <View
            style={[
              styles.chatPreviewBubble,
              styles.chatPreviewSentBubble,
              { backgroundColor: style.bubbleBgColor },
            ]}
          >
            <Text
              style={[
                styles.chatPreviewText,
                {
                  color: style.fontColorHex ?? style.bubbleTextColor,
                  ...(style.fontFamily ? { fontFamily: style.fontFamily } : {}),
                },
              ]}
            >
              Thanks! Just customized it ✨
            </Text>
          </View>
        </View>
      </View>

      {/* ── Static composer bar ── */}
      <View
        style={[
          styles.chatPreviewComposer,
          { borderTopColor: composerBorderColor },
        ]}
      >
        {/* Attachment icon */}
        <Ionicons
          name="image-outline"
          size={20}
          color={composerPlaceholderColor}
          style={styles.chatPreviewComposerIcon}
        />
        {/* Input pill placeholder */}
        <View
          style={[
            styles.chatPreviewComposerInput,
            { backgroundColor: composerInputBg },
          ]}
        >
          <Text
            style={[
              styles.chatPreviewComposerPlaceholder,
              { color: composerPlaceholderColor },
            ]}
          >
            Message…
          </Text>
        </View>
        {/* Send icon */}
        <MaterialCommunityIcons
          name="send-circle"
          size={28}
          color={colors.primary}
          style={styles.chatPreviewComposerSend}
        />
        {/* Animal icon — matches real composer's animal button */}
        <View style={styles.chatPreviewAnimalBtn}>
          <AnimalIcon animalId={chatAppearance?.animalThemeId} size={22} wide />
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// Screen
// =============================================================================

export default function CustomizationHubScreen({
  navigation,
  route,
}: CustomizationHubScreenProps) {
  const colors = useColors();
  const { setTheme: setAppTheme, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid ?? "";
  const { profile: baseProfile, refreshProfile } = useUser();
  const { profile } = useProfileData(uid);
  const {
    picture,
    decoration,
    refresh: refreshPicture,
  } = useProfilePicture({ userId: uid });

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
  const currentBadgeIds: string[] =
    (profile as any)?.featuredBadges?.badgeIds ?? [];

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

  // Tabs for the current section
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
      // If an initialTab matches a chat tab, set it
      if (
        initialTab &&
        [
          "chat_bubble_color",
          "chat_font",
          "chat_font_color",
          "chat_animal_theme",
        ].includes(initialTab)
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
        onBack={() => navigation.goBack()}
        renderRight={() => (
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => navigation.navigate("CosmeticsShop" as any)}
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
            {hub.hasPreview && (
              <Pressable
                onPress={async () => {
                  try {
                    await hub.applyPreview();
                  } catch (error: any) {
                    Alert.alert("Error", error?.message || "Failed to apply");
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Apply preview"
                accessibilityRole="button"
                style={styles.headerActionButton}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={22}
                  color={colors.text}
                />
              </Pressable>
            )}
            {hub.hasPreview && (
              <Pressable
                onPress={hub.clearPreview}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Clear preview"
                accessibilityRole="button"
                style={styles.headerActionButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={colors.text}
                />
              </Pressable>
            )}
          </View>
        )}
      />

      {/* ── Live Preview (fixed height — same for Profile & Chat) ── */}
      <View style={styles.previewContainer}>
        {section === "profile" ? (
          <ProfileHeaderVisual
            displayName={baseProfile.displayName}
            username={baseProfile.username}
            pictureUrl={picture?.url ?? null}
            decorationId={currentDecorationId}
            backgroundId={currentBackgroundId}
            level={
              profile?.level ?? {
                current: 1,
                xp: 0,
                xpToNextLevel: 100,
                totalXp: 0,
              }
            }
            previewOverrides={hub.previewOverrides}
          />
        ) : (
          <ChatPreview chatAppearance={currentChatAppearance} isDark={isDark} />
        )}
      </View>

      {/* ── Section Toggle: Profile / Chat (below preview) ── */}
      <View style={styles.sectionToggleContainer}>
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
                  hub.setActiveTab("decoration");
                }
                hub.setSearchQuery("");
              }}
              accessibilityRole="tab"
              accessibilityLabel={`${s === "profile" ? "Profile" : "Chat"} section`}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.sectionToggle,
                {
                  backgroundColor: isActive
                    ? colors.primary
                    : colors.surfaceVariant,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={s === "profile" ? "account" : "chat"}
                size={16}
                color={isActive ? "#fff" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.sectionToggleText,
                  {
                    color: isActive ? "#fff" : colors.textSecondary,
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

      {/* Category Tabs (section-aware) */}
      <View style={styles.tabsContainer}>
        {sectionTabs.map((tab) => {
          const isActive = hub.activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => hub.setActiveTab(tab.id)}
              accessibilityRole="tab"
              accessibilityLabel={`${tab.label} tab`}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.tabItem,
                {
                  backgroundColor: isActive
                    ? colors.primary + "18"
                    : "transparent",
                  borderColor: isActive ? colors.primary : "transparent",
                },
              ]}
            >
              <MaterialCommunityIcons
                name={tab.icon as any}
                size={18}
                color={isActive ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? colors.primary : colors.textSecondary,
                    fontWeight: isActive ? "600" : "400",
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Searchbar
          placeholder={`Search ${sectionTabs.find((t) => t.id === hub.activeTab)?.label ?? "items"}...`}
          value={hub.searchQuery}
          onChangeText={hub.setSearchQuery}
          style={[styles.searchbar, { backgroundColor: colors.surfaceVariant }]}
          inputStyle={styles.searchInput}
          elevation={0}
        />
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
                onPress={() => navigation.navigate("CosmeticsShop" as any)}
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
            onPress={() => navigation.navigate("CosmeticsShop" as any)}
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
      ) : hub.activeTab === "chat_font" ? (
        /* ── Font cards (single-column, font sample, tap to equip) ── */
        <ScrollView
          contentContainerStyle={styles.themeGridContent}
          showsVerticalScrollIndicator={false}
        >
          {hub.filteredItems.length > 0 ? (
            <View style={styles.fontGrid}>
              {hub.filteredItems.map((item) => (
                <FontCard
                  key={item.id}
                  item={item}
                  isEquipped={currentFontId === item.id}
                  onPress={handleChatDirectEquip}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="format-font"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No fonts owned yet.
              </Text>
              <Pressable
                onPress={() => navigation.navigate("CosmeticsShop" as any)}
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
          {/* Unequip / reset font */}
          {currentFontId && (
            <Pressable
              onPress={async () => {
                try {
                  await hub.unequipSlot("chat_font");
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
                Reset to default font
              </Text>
            </Pressable>
          )}
          {/* Shop upsell */}
          <Pressable
            onPress={() => navigation.navigate("CosmeticsShop" as any)}
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
              Want more fonts? Visit the Shop
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
        </ScrollView>
      ) : hub.activeTab === "chat_font_color" ? (
        /* ── Font Color cards (2-column, swatch preview, tap to equip) ── */
        <ScrollView
          contentContainerStyle={styles.themeGridContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Default (theme-adaptive) option */}
          <View style={styles.fontColorDefaultSection}>
            <Pressable
              onPress={async () => {
                try {
                  await hub.unequipSlot("chat_font_color");
                  await refreshProfile();
                } catch (error: any) {
                  Alert.alert("Error", error?.message || "Failed to reset");
                }
              }}
              style={({ pressed }) => [
                styles.fontColorDefaultCard,
                {
                  borderColor: !currentFontColorId
                    ? colors.primary
                    : colors.border,
                  borderWidth: !currentFontColorId ? 2 : 1,
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.fontColorDefaultSwatch,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <Text
                  style={[
                    styles.fontColorDefaultLetter,
                    { color: colors.text },
                  ]}
                >
                  Aa
                </Text>
                <MaterialCommunityIcons
                  name="theme-light-dark"
                  size={14}
                  color={colors.textSecondary}
                  style={styles.fontColorAdaptiveIcon}
                />
              </View>
              <View style={styles.fontColorDefaultInfo}>
                <Text
                  style={[styles.fontColorDefaultTitle, { color: colors.text }]}
                >
                  Default
                </Text>
                <Text
                  style={[
                    styles.fontColorDefaultDesc,
                    { color: colors.textSecondary },
                  ]}
                >
                  Adapts automatically to your theme
                </Text>
              </View>
              {!currentFontColorId && (
                <View
                  style={[
                    styles.bubbleCheckmark,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </Pressable>
          </View>

          {/* Custom colors */}
          {hub.filteredItems.length > 0 ? (
            <>
              <Text
                style={[
                  styles.fontColorSectionLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Custom Colors — Stay the same across themes
              </Text>
              <View style={styles.themeGrid}>
                {hub.filteredItems.map((item) => (
                  <FontColorCard
                    key={item.id}
                    item={item}
                    isEquipped={currentFontColorId === item.id}
                    isDefault={false}
                    onPress={handleChatDirectEquip}
                  />
                ))}
              </View>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="format-color-text"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No custom font colors owned yet.
              </Text>
              <Pressable
                onPress={() => navigation.navigate("CosmeticsShop" as any)}
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
          {/* Shop upsell */}
          <Pressable
            onPress={() => navigation.navigate("CosmeticsShop" as any)}
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
              Want more font colors? Visit the Shop
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
                onPress={() => navigation.navigate("CosmeticsShop" as any)}
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
                onPress={() => navigation.navigate("CosmeticsShop" as any)}
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
            onPress={() => navigation.navigate("CosmeticsShop" as any)}
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
                  onPress={() => navigation.navigate("CosmeticsShop" as any)}
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
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  tabLabel: {
    fontSize: 11,
    includeFontPadding: false,
  },
  searchRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  searchbar: {
    height: 40,
    borderRadius: BorderRadius.sm,
  },
  searchInput: {
    fontSize: 14,
    minHeight: 40,
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
  gridItemImage: {
    width: "100%",
    height: ITEM_SIZE * 0.75,
  },
  gridItemPlaceholder: {
    width: "100%",
    height: ITEM_SIZE * 0.75,
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
  themePreviewBg: {
    flex: 1,
    padding: Spacing.sm,
  },
  themePreviewAccent: {
    height: 4,
    width: "40%",
    borderRadius: 2,
    marginBottom: Spacing.xs,
  },
  themePreviewContent: {
    gap: 4,
  },
  themePreviewLine: {
    height: 6,
    borderRadius: 3,
  },
  themePreviewSwatch: {
    position: "absolute",
    bottom: Spacing.sm,
    right: Spacing.sm,
    width: 50,
    height: 30,
    borderRadius: BorderRadius.sm,
    padding: 6,
    justifyContent: "center",
  },
  themePreviewLineSm: {
    height: 4,
    width: "80%",
    borderRadius: 2,
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
  themeCardBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  themeCardBadgeText: {
    fontSize: 10,
    fontWeight: "500",
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

  // ── Section Toggle ─────────────────────────────────────────────────────
  sectionToggleContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  sectionToggle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  sectionToggleText: {
    fontSize: 14,
  },

  // ── Chat Preview ───────────────────────────────────────────────────────
  previewContainer: {
    height: 220,
    overflow: "hidden",
  },
  chatPreviewWrap: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 0,
    gap: 0,
  },
  chatPreviewBubblesArea: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  chatPreviewReceived: {
    alignItems: "flex-start",
  },
  chatPreviewSent: {
    alignItems: "flex-end",
  },
  chatPreviewBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: "75%",
  },
  chatPreviewReceivedBubble: {
    borderBottomLeftRadius: 4,
  },
  chatPreviewSentBubble: {
    borderBottomRightRadius: 4,
  },
  chatPreviewText: {
    fontSize: 15,
    lineHeight: 20,
  },
  // Composer bar (static placeholder)
  chatPreviewComposer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  chatPreviewComposerIcon: {
    paddingHorizontal: 2,
  },
  chatPreviewComposerInput: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: "center",
  },
  chatPreviewComposerPlaceholder: {
    fontSize: 14,
  },
  chatPreviewComposerSend: {
    paddingHorizontal: 2,
  },
  chatPreviewAnimalBtn: {
    width: 32,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 2,
  },

  // ── Bubble Color Card ──────────────────────────────────────────────────
  bubbleCard: {
    width: THEME_CARD_WIDTH,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  bubbleSwatch: {
    height: 64,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.sm,
  },
  bubblePreviewRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  bubbleMini: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderBottomRightRadius: 3,
    borderWidth: 1,
  },
  bubbleMiniText: {
    fontSize: 12,
    fontWeight: "500",
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

  // ── Font Card ──────────────────────────────────────────────────────────
  fontGrid: {
    gap: Spacing.sm,
  },
  fontCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    padding: Spacing.md,
  },
  fontSample: {
    gap: 4,
  },
  fontSampleTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  fontSampleBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  fontCheckmark: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Font Color Card ──────────────────────────────────────────────────
  fontColorSwatch: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
  },
  fontColorPreviewText: {
    fontSize: 28,
    fontWeight: "700",
  },
  fontColorHint: {
    fontSize: 10,
    marginTop: 2,
  },
  fontColorDefaultSection: {
    marginBottom: Spacing.md,
  },
  fontColorDefaultCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  fontColorDefaultSwatch: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  fontColorDefaultLetter: {
    fontSize: 24,
    fontWeight: "700",
  },
  fontColorAdaptiveIcon: {
    position: "absolute",
    bottom: 2,
    right: 2,
  },
  fontColorDefaultInfo: {
    flex: 1,
    gap: 2,
  },
  fontColorDefaultTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  fontColorDefaultDesc: {
    fontSize: 12,
  },
  fontColorSectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    paddingHorizontal: 2,
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
