/**
 * CustomizationModal Component
 *
 * Full customization modal for profile overhaul Phase 4.
 * Replaces the legacy AvatarCustomizer with extended functionality:
 * - Avatar appearance (base color, hat, glasses, background)
 * - Clothing (tops, bottoms)
 * - Accessories (neck, ear, hand)
 * - Profile frames
 * - Live preview
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md
 */

import Avatar from "@/components/Avatar";
import { CHAT_BUBBLE_STYLES, getBubbleStyleById } from "@/data/chatBubbles";
import { COSMETIC_ITEMS, getItemById } from "@/data/cosmetics";
import {
  getExtendedItemById,
  getExtendedItemsBySlot,
  getFrameById,
  PROFILE_FRAMES,
  RARITY_COLORS,
} from "@/data/extendedCosmetics";
import { getThemeById, PROFILE_THEMES } from "@/data/profileThemes";
import type { AvatarConfig, CosmeticItem } from "@/types/models";
import type {
  ChatBubbleStyle,
  ExtendedAvatarConfig,
  ExtendedCosmeticItem,
  ProfileCustomizationTab,
  ProfileFrame,
  ProfileTheme,
} from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Appbar, Button, Chip, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { PROFILE_FEATURES } from "../../../constants/featureFlags";
import { ChatBubblePreview } from "./ChatBubblePreview";
import { ThemePreview } from "./ThemePreview";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export interface CustomizationModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Close handler */
  onClose: () => void;
  /** Current avatar configuration */
  currentConfig: AvatarConfig | ExtendedAvatarConfig;
  /** Owned item IDs */
  ownedItems?: string[];
  /** Save handler - receives the new config */
  onSave: (config: ExtendedAvatarConfig) => Promise<void>;
  /** User's token balance (for showing affordability) */
  tokenBalance?: number;
}

// Tab configuration
const TABS: { id: ProfileCustomizationTab; label: string; icon: string }[] = [
  { id: "avatar", label: "Avatar", icon: "account-circle" },
  { id: "clothing", label: "Clothing", icon: "tshirt-crew" },
  { id: "accessories", label: "Accessories", icon: "diamond-stone" },
  { id: "frame", label: "Frame", icon: "image-frame" },
  { id: "theme", label: "Theme", icon: "palette" },
  { id: "chat", label: "Chat", icon: "message" },
];

// Base color options
const BASE_COLORS = [
  "#FFD93D", // Yellow
  "#6BCB77", // Green
  "#4D96FF", // Blue
  "#FF6B6B", // Red
  "#C9B1FF", // Purple
  "#FFB4B4", // Pink
  "#B4F8C8", // Mint
  "#FBE7C6", // Peach
  "#A0E7E5", // Teal
  "#FFAEBC", // Coral
];

function CustomizationModalBase({
  visible,
  onClose,
  currentConfig,
  ownedItems = [],
  onSave,
  tokenBalance = 0,
}: CustomizationModalProps) {
  const theme = useTheme();

  // Preview state (not saved yet)
  const [previewConfig, setPreviewConfig] = useState<ExtendedAvatarConfig>(() =>
    normalizeConfig(currentConfig),
  );
  const [activeTab, setActiveTab] = useState<ProfileCustomizationTab>("avatar");
  const [saving, setSaving] = useState(false);

  // Check if there are changes
  const hasChanges = useMemo(() => {
    const current = normalizeConfig(currentConfig);
    return JSON.stringify(current) !== JSON.stringify(previewConfig);
  }, [currentConfig, previewConfig]);

  // Reset preview when modal opens
  React.useEffect(() => {
    if (visible) {
      setPreviewConfig(normalizeConfig(currentConfig));
      setActiveTab("avatar");
    }
  }, [visible, currentConfig]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await onSave(previewConfig);
      onClose();
    } catch (error) {
      console.error("[CustomizationModal] Save error:", error);
    } finally {
      setSaving(false);
    }
  }, [hasChanges, previewConfig, onSave, onClose]);

  // Handle discard
  const handleDiscard = useCallback(() => {
    setPreviewConfig(normalizeConfig(currentConfig));
    onClose();
  }, [currentConfig, onClose]);

  // Update preview config
  const updatePreview = useCallback(
    (slot: keyof ExtendedAvatarConfig, value: string | undefined) => {
      setPreviewConfig((prev) => ({
        ...prev,
        [slot]: value,
      }));
    },
    [],
  );

  // Check if item is owned
  const isOwned = useCallback(
    (itemId: string): boolean => {
      // Check explicit ownership
      if (ownedItems.includes(itemId)) return true;

      // Check if free or starter item
      const item = getItemById(itemId) || getExtendedItemById(itemId);
      if (item) {
        return item.unlock.type === "free" || item.unlock.type === "starter";
      }

      // Check frames
      const frame = getFrameById(itemId);
      if (frame) {
        return frame.unlock.type === "free" || frame.unlock.type === "starter";
      }

      // Check themes
      const theme = getThemeById(itemId);
      if (theme) {
        return theme.unlock.type === "free" || theme.unlock.type === "starter";
      }

      // Check bubble styles
      const bubbleStyle = getBubbleStyleById(itemId);
      if (bubbleStyle) {
        return (
          bubbleStyle.unlock.type === "free" ||
          bubbleStyle.unlock.type === "starter"
        );
      }

      return false;
    },
    [ownedItems],
  );

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case "avatar":
        return (
          <AvatarTabContent
            previewConfig={previewConfig}
            updatePreview={updatePreview}
            isOwned={isOwned}
          />
        );
      case "clothing":
        return (
          <ClothingTabContent
            previewConfig={previewConfig}
            updatePreview={updatePreview}
            isOwned={isOwned}
          />
        );
      case "accessories":
        return (
          <AccessoriesTabContent
            previewConfig={previewConfig}
            updatePreview={updatePreview}
            isOwned={isOwned}
          />
        );
      case "frame":
        return (
          <FrameTabContent
            previewConfig={previewConfig}
            updatePreview={updatePreview}
            isOwned={isOwned}
          />
        );
      case "theme":
        return (
          <ThemeTabContent
            previewConfig={previewConfig}
            updatePreview={updatePreview}
            isOwned={isOwned}
          />
        );
      case "chat":
        return (
          <ChatBubbleTabContent
            previewConfig={previewConfig}
            updatePreview={updatePreview}
            isOwned={isOwned}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleDiscard}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["top"]}
      >
        {/* Header */}
        <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
          <Appbar.Action icon="close" onPress={handleDiscard} />
          <Appbar.Content title="Customize" />
          <Appbar.Action
            icon="check"
            onPress={handleSave}
            disabled={!hasChanges || saving}
          />
        </Appbar.Header>

        {/* Preview */}
        <View
          style={[
            styles.previewContainer,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Avatar config={previewConfig} size={120} />
          {hasChanges && (
            <Text style={[styles.unsavedText, { color: theme.colors.primary }]}>
              Unsaved changes
            </Text>
          )}
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {TABS.filter((tab) => {
            // Hide frame tab if feature flag is off
            if (tab.id === "frame" && !PROFILE_FEATURES.PROFILE_FRAMES) {
              return false;
            }
            // Hide clothing/accessories if extended cosmetics is off
            if (
              (tab.id === "clothing" || tab.id === "accessories") &&
              !PROFILE_FEATURES.EXTENDED_COSMETICS
            ) {
              return false;
            }
            // Hide theme tab if feature flag is off
            if (tab.id === "theme" && !PROFILE_FEATURES.PROFILE_THEMES) {
              return false;
            }
            // Hide chat tab if feature flag is off
            if (tab.id === "chat" && !PROFILE_FEATURES.CHAT_BUBBLES) {
              return false;
            }
            return true;
          }).map((tab) => (
            <Chip
              key={tab.id}
              selected={activeTab === tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={styles.tabChip}
              icon={tab.icon}
              mode={activeTab === tab.id ? "flat" : "outlined"}
            >
              {tab.label}
            </Chip>
          ))}
        </ScrollView>

        {/* Tab Content */}
        <View style={styles.contentContainer}>{renderTabContent()}</View>

        {/* Footer */}
        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.outline,
            },
          ]}
        >
          <Button
            mode="outlined"
            onPress={handleDiscard}
            style={styles.footerButton}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={!hasChanges || saving}
            style={styles.footerButton}
          >
            Save Changes
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// =============================================================================
// Tab Content Components
// =============================================================================

interface TabContentProps {
  previewConfig: ExtendedAvatarConfig;
  updatePreview: (
    slot: keyof ExtendedAvatarConfig,
    value: string | undefined,
  ) => void;
  isOwned: (itemId: string) => boolean;
}

/**
 * Avatar Tab - Base color, hat, glasses, background
 */
const AvatarTabContent = memo(function AvatarTabContent({
  previewConfig,
  updatePreview,
  isOwned,
}: TabContentProps) {
  const theme = useTheme();

  // Get legacy cosmetic items by slot
  const hats = COSMETIC_ITEMS.filter((i) => i.slot === "hat");
  const glasses = COSMETIC_ITEMS.filter((i) => i.slot === "glasses");
  const backgrounds = COSMETIC_ITEMS.filter((i) => i.slot === "background");

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {/* Base Color */}
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Base Color
      </Text>
      <View style={styles.colorGrid}>
        {BASE_COLORS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              previewConfig.baseColor === color && styles.colorSwatchSelected,
            ]}
            onPress={() => updatePreview("baseColor", color)}
          >
            {previewConfig.baseColor === color && (
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Hats */}
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Hat
      </Text>
      <CosmeticItemGrid
        items={hats}
        selectedId={previewConfig.hat}
        onSelect={(id) => updatePreview("hat", id || undefined)}
        isOwned={isOwned}
      />

      {/* Glasses */}
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Glasses
      </Text>
      <CosmeticItemGrid
        items={glasses}
        selectedId={previewConfig.glasses}
        onSelect={(id) => updatePreview("glasses", id || undefined)}
        isOwned={isOwned}
      />

      {/* Backgrounds */}
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Background
      </Text>
      <CosmeticItemGrid
        items={backgrounds}
        selectedId={previewConfig.background}
        onSelect={(id) => updatePreview("background", id || undefined)}
        isOwned={isOwned}
      />
    </ScrollView>
  );
});

/**
 * Clothing Tab - Tops, bottoms
 */
const ClothingTabContent = memo(function ClothingTabContent({
  previewConfig,
  updatePreview,
  isOwned,
}: TabContentProps) {
  const theme = useTheme();

  const tops = getExtendedItemsBySlot("clothing_top");
  const bottoms = getExtendedItemsBySlot("clothing_bottom");

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {/* Tops */}
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Top
      </Text>
      <ExtendedCosmeticGrid
        items={tops}
        selectedId={previewConfig.clothingTop}
        onSelect={(id) => updatePreview("clothingTop", id || undefined)}
        isOwned={isOwned}
      />

      {/* Bottoms */}
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Bottom
      </Text>
      <ExtendedCosmeticGrid
        items={bottoms}
        selectedId={previewConfig.clothingBottom}
        onSelect={(id) => updatePreview("clothingBottom", id || undefined)}
        isOwned={isOwned}
      />
    </ScrollView>
  );
});

/**
 * Accessories Tab - Neck, ear, hand
 */
const AccessoriesTabContent = memo(function AccessoriesTabContent({
  previewConfig,
  updatePreview,
  isOwned,
}: TabContentProps) {
  const theme = useTheme();

  const neck = getExtendedItemsBySlot("accessory_neck");
  const ear = getExtendedItemsBySlot("accessory_ear");
  const hand = getExtendedItemsBySlot("accessory_hand");

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {/* Neck */}
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Neck
      </Text>
      <ExtendedCosmeticGrid
        items={neck}
        selectedId={previewConfig.accessoryNeck}
        onSelect={(id) => updatePreview("accessoryNeck", id || undefined)}
        isOwned={isOwned}
      />

      {/* Ear */}
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Ear
      </Text>
      <ExtendedCosmeticGrid
        items={ear}
        selectedId={previewConfig.accessoryEar}
        onSelect={(id) => updatePreview("accessoryEar", id || undefined)}
        isOwned={isOwned}
      />

      {/* Hand */}
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Hand / Wrist
      </Text>
      <ExtendedCosmeticGrid
        items={hand}
        selectedId={previewConfig.accessoryHand}
        onSelect={(id) => updatePreview("accessoryHand", id || undefined)}
        isOwned={isOwned}
      />
    </ScrollView>
  );
});

/**
 * Frame Tab - Profile frames
 */
const FrameTabContent = memo(function FrameTabContent({
  previewConfig,
  updatePreview,
  isOwned,
}: TabContentProps) {
  const theme = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Profile Frame
      </Text>
      <FrameGrid
        frames={PROFILE_FRAMES}
        selectedId={previewConfig.profileFrame}
        onSelect={(id) => updatePreview("profileFrame", id || undefined)}
        isOwned={isOwned}
      />
    </ScrollView>
  );
});

/**
 * Theme Tab - Profile themes
 */
const ThemeTabContent = memo(function ThemeTabContent({
  previewConfig,
  updatePreview,
  isOwned,
}: TabContentProps) {
  const theme = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Profile Theme
      </Text>
      <Text
        style={[
          styles.sectionDescription,
          { color: theme.colors.onSurfaceVariant },
        ]}
      >
        Customize how your profile looks to others
      </Text>
      <ThemeGrid
        themes={PROFILE_THEMES}
        selectedId={previewConfig.profileTheme}
        onSelect={(id) => updatePreview("profileTheme", id || undefined)}
        isOwned={isOwned}
      />
    </ScrollView>
  );
});

/**
 * Chat Bubble Tab - Chat bubble styles
 */
const ChatBubbleTabContent = memo(function ChatBubbleTabContent({
  previewConfig,
  updatePreview,
  isOwned,
}: TabContentProps) {
  const theme = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Chat Bubble Style
      </Text>
      <Text
        style={[
          styles.sectionDescription,
          { color: theme.colors.onSurfaceVariant },
        ]}
      >
        Customize how your messages appear in chat
      </Text>
      <ChatBubbleGrid
        styles={CHAT_BUBBLE_STYLES}
        selectedId={previewConfig.chatBubble}
        onSelect={(id) => updatePreview("chatBubble", id || undefined)}
        isOwned={isOwned}
      />
    </ScrollView>
  );
});

// =============================================================================
// Grid Components
// =============================================================================

interface CosmeticItemGridProps {
  items: CosmeticItem[];
  selectedId?: string;
  onSelect: (id: string | null) => void;
  isOwned: (id: string) => boolean;
}

const CosmeticItemGrid = memo(function CosmeticItemGrid({
  items,
  selectedId,
  onSelect,
  isOwned,
}: CosmeticItemGridProps) {
  const theme = useTheme();

  return (
    <View style={styles.itemGrid}>
      {items.map((item) => {
        const owned = isOwned(item.id);
        const selected = selectedId === item.id;

        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.itemCard,
              {
                backgroundColor: selected
                  ? theme.colors.primaryContainer
                  : theme.colors.surfaceVariant,
                borderColor: selected ? theme.colors.primary : "transparent",
                opacity: owned ? 1 : 0.5,
              },
            ]}
            onPress={() => onSelect(selected ? null : item.id)}
            disabled={!owned}
          >
            <Text style={styles.itemEmoji}>{item.imagePath || "❌"}</Text>
            <Text
              style={[styles.itemName, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {!owned && (
              <MaterialCommunityIcons
                name="lock"
                size={16}
                color={theme.colors.onSurfaceVariant}
                style={styles.lockIcon}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

interface ExtendedCosmeticGridProps {
  items: ExtendedCosmeticItem[];
  selectedId?: string;
  onSelect: (id: string | null) => void;
  isOwned: (id: string) => boolean;
}

const ExtendedCosmeticGrid = memo(function ExtendedCosmeticGrid({
  items,
  selectedId,
  onSelect,
  isOwned,
}: ExtendedCosmeticGridProps) {
  const theme = useTheme();

  return (
    <View style={styles.itemGrid}>
      {items.map((item) => {
        const owned = isOwned(item.id);
        const selected = selectedId === item.id;
        const rarityColor = RARITY_COLORS[item.rarity];

        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.itemCard,
              {
                backgroundColor: selected
                  ? theme.colors.primaryContainer
                  : theme.colors.surfaceVariant,
                borderColor: selected ? theme.colors.primary : "transparent",
                opacity: owned ? 1 : 0.5,
              },
            ]}
            onPress={() => onSelect(selected ? null : item.id)}
            disabled={!owned}
          >
            <View
              style={[styles.rarityDot, { backgroundColor: rarityColor }]}
            />
            <Text style={styles.itemEmoji}>{item.imagePath || "❌"}</Text>
            <Text
              style={[styles.itemName, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {!owned && (
              <MaterialCommunityIcons
                name="lock"
                size={16}
                color={theme.colors.onSurfaceVariant}
                style={styles.lockIcon}
              />
            )}
            {item.unlock.priceTokens && !owned && (
              <Text style={[styles.priceText, { color: theme.colors.primary }]}>
                {item.unlock.priceTokens}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

interface FrameGridProps {
  frames: ProfileFrame[];
  selectedId?: string;
  onSelect: (id: string | null) => void;
  isOwned: (id: string) => boolean;
}

const FrameGrid = memo(function FrameGrid({
  frames,
  selectedId,
  onSelect,
  isOwned,
}: FrameGridProps) {
  const theme = useTheme();

  return (
    <View style={styles.itemGrid}>
      {frames.map((frame) => {
        const owned = isOwned(frame.id);
        const selected = selectedId === frame.id;
        const rarityColor = RARITY_COLORS[frame.rarity];

        // Get border color for preview
        const borderColor =
          frame.effects?.border?.color &&
          typeof frame.effects.border.color === "string"
            ? frame.effects.border.color
            : rarityColor;

        return (
          <TouchableOpacity
            key={frame.id}
            style={[
              styles.frameCard,
              {
                backgroundColor: selected
                  ? theme.colors.primaryContainer
                  : theme.colors.surfaceVariant,
                borderColor: selected ? theme.colors.primary : "transparent",
                opacity: owned ? 1 : 0.5,
              },
            ]}
            onPress={() => onSelect(selected ? null : frame.id)}
            disabled={!owned}
          >
            {/* Frame preview */}
            <View
              style={[
                styles.framePreview,
                {
                  borderColor: borderColor,
                  borderWidth: frame.effects?.border?.width || 2,
                },
                frame.effects?.glow && {
                  shadowColor: frame.effects.glow.color,
                  shadowOpacity: frame.effects.glow.intensity * 0.5,
                  shadowRadius: 6,
                  elevation: 4,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="account"
                size={24}
                color={borderColor}
              />
            </View>
            <Text
              style={[styles.itemName, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {frame.name}
            </Text>
            {!owned && (
              <MaterialCommunityIcons
                name="lock"
                size={16}
                color={theme.colors.onSurfaceVariant}
                style={styles.lockIcon}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

interface ThemeGridProps {
  themes: ProfileTheme[];
  selectedId?: string;
  onSelect: (id: string | null) => void;
  isOwned: (id: string) => boolean;
}

const ThemeGrid = memo(function ThemeGrid({
  themes,
  selectedId,
  onSelect,
  isOwned,
}: ThemeGridProps) {
  return (
    <View style={styles.themeGrid}>
      {themes.map((theme) => {
        const owned = isOwned(theme.id);
        const selected = selectedId === theme.id;

        return (
          <ThemePreview
            key={theme.id}
            theme={theme}
            selected={selected}
            owned={owned}
            equipped={false}
            onPress={() => onSelect(selected ? null : theme.id)}
            compact={false}
          />
        );
      })}
    </View>
  );
});

interface ChatBubbleGridProps {
  styles: ChatBubbleStyle[];
  selectedId?: string;
  onSelect: (id: string | null) => void;
  isOwned: (id: string) => boolean;
}

const ChatBubbleGrid = memo(function ChatBubbleGrid({
  styles: bubbleStyles,
  selectedId,
  onSelect,
  isOwned,
}: ChatBubbleGridProps) {
  return (
    <View style={styles.bubbleGrid}>
      {bubbleStyles.map((bubbleStyle) => {
        const owned = isOwned(bubbleStyle.id);
        const selected = selectedId === bubbleStyle.id;

        return (
          <ChatBubblePreview
            key={bubbleStyle.id}
            style={bubbleStyle}
            selected={selected}
            owned={owned}
            equipped={false}
            onPress={() => onSelect(selected ? null : bubbleStyle.id)}
            compact={false}
          />
        );
      })}
    </View>
  );
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalize config to extended format
 */
function normalizeConfig(
  config: AvatarConfig | ExtendedAvatarConfig,
): ExtendedAvatarConfig {
  return {
    baseColor: config.baseColor,
    hat: config.hat,
    glasses: config.glasses,
    background: config.background,
    clothingTop: "clothingTop" in config ? config.clothingTop : undefined,
    clothingBottom:
      "clothingBottom" in config ? config.clothingBottom : undefined,
    accessoryNeck: "accessoryNeck" in config ? config.accessoryNeck : undefined,
    accessoryEar: "accessoryEar" in config ? config.accessoryEar : undefined,
    accessoryHand: "accessoryHand" in config ? config.accessoryHand : undefined,
    profileFrame: "profileFrame" in config ? config.profileFrame : undefined,
    profileBanner: "profileBanner" in config ? config.profileBanner : undefined,
    profileTheme: "profileTheme" in config ? config.profileTheme : undefined,
    chatBubble: "chatBubble" in config ? config.chatBubble : undefined,
    nameEffect: "nameEffect" in config ? config.nameEffect : undefined,
    featuredBadges: "featuredBadges" in config ? config.featuredBadges : [],
  };
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  previewContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  unsavedText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tabChip: {
    marginRight: 8,
  },
  contentContainer: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 8,
  },
  sectionDescription: {
    fontSize: 13,
    marginBottom: 16,
    marginTop: -8,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  itemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  itemCard: {
    width: (SCREEN_WIDTH - 32 - 36) / 4,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    padding: 4,
    position: "relative",
  },
  itemEmoji: {
    fontSize: 24,
  },
  itemName: {
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
  },
  lockIcon: {
    position: "absolute",
    top: 4,
    right: 4,
  },
  rarityDot: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priceText: {
    fontSize: 10,
    fontWeight: "700",
    position: "absolute",
    bottom: 4,
  },
  frameCard: {
    width: (SCREEN_WIDTH - 32 - 24) / 3,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
    position: "relative",
  },
  framePreview: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  bubbleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  footer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
  },
});

export const CustomizationModal = memo(CustomizationModalBase);
export default CustomizationModal;
