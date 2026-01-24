/**
 * AvatarCustomizer Component - Modal for customizing avatar
 * Phase 7: Avatar + Cosmetics
 */

import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { Text, Button, ActivityIndicator, useTheme } from "react-native-paper";
import { Latte, AppColors } from "../../constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { AvatarConfig, CosmeticItem } from "@/types/models";
import Avatar from "./Avatar";
import { getItemsBySlot, getRequiredStreak } from "@/data/cosmetics";
import { getAccessibleItems, updateAvatarConfig } from "@/services/cosmetics";

// Avatar base colors
const AVATAR_COLORS = [
  Latte.peach, // Catppuccin Peach (replaces yellow)
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#FFA07A", // Salmon
  "#98D8C8", // Mint
  "#DDA0DD", // Plum
  "#87CEEB", // Sky Blue
];

interface AvatarCustomizerProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  currentConfig: AvatarConfig;
  onSave: (newConfig: AvatarConfig) => void | Promise<void>;
}

export default function AvatarCustomizer({
  visible,
  onClose,
  userId,
  currentConfig,
  onSave,
}: AvatarCustomizerProps) {
  const theme = useTheme();
  // Local state for preview
  const [previewConfig, setPreviewConfig] =
    useState<AvatarConfig>(currentConfig);
  const [accessibleItems, setAccessibleItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "background" | "hat" | "glasses" | "color"
  >("color");

  // Load user's accessible items
  useEffect(() => {
    const loadItems = async () => {
      setLoading(true);
      try {
        const items = await getAccessibleItems(userId);
        setAccessibleItems(items);
      } catch (error) {
        console.error("Error loading accessible items:", error);
      } finally {
        setLoading(false);
      }
    };

    if (visible) {
      loadItems();
      setPreviewConfig(currentConfig);
    }
  }, [visible, userId, currentConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await updateAvatarConfig(userId, previewConfig);
      if (success) {
        // Wait for parent's onSave to complete (e.g., refreshProfile)
        await onSave(previewConfig);
        onClose();
      }
    } catch (error) {
      console.error("Error saving avatar config:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPreviewConfig(currentConfig);
    onClose();
  };

  const selectColor = (color: string) => {
    setPreviewConfig((prev) => ({ ...prev, baseColor: color }));
  };

  const selectItem = (item: CosmeticItem) => {
    // Check if user has access
    const isDefaultItem = item.id.includes("_none") || item.id === "bg_default";
    if (!isDefaultItem && !accessibleItems.includes(item.id)) {
      return; // Locked item
    }

    setPreviewConfig((prev) => {
      const newConfig = { ...prev };
      switch (item.slot) {
        case "hat":
          newConfig.hat = item.id === "hat_none" ? undefined : item.id;
          break;
        case "glasses":
          newConfig.glasses = item.id === "glasses_none" ? undefined : item.id;
          break;
        case "background":
          newConfig.background = item.id === "bg_default" ? undefined : item.id;
          break;
      }
      return newConfig;
    });
  };

  const isItemSelected = (item: CosmeticItem): boolean => {
    switch (item.slot) {
      case "hat":
        return item.id === "hat_none"
          ? !previewConfig.hat
          : previewConfig.hat === item.id;
      case "glasses":
        return item.id === "glasses_none"
          ? !previewConfig.glasses
          : previewConfig.glasses === item.id;
      case "background":
        return item.id === "bg_default"
          ? !previewConfig.background
          : previewConfig.background === item.id;
      default:
        return false;
    }
  };

  const isItemLocked = (item: CosmeticItem): boolean => {
    const isDefaultItem = item.id.includes("_none") || item.id === "bg_default";
    return !isDefaultItem && !accessibleItems.includes(item.id);
  };

  const getRarityColor = (rarity: string): string => {
    switch (rarity) {
      case "common":
        return "#9e9e9e";
      case "rare":
        return "#2196f3";
      case "epic":
        return "#9c27b0";
      default:
        return "#9e9e9e";
    }
  };

  const renderItemGrid = (slot: "hat" | "glasses" | "background") => {
    const items = getItemsBySlot(slot);

    return (
      <View style={styles.itemGrid}>
        {items.map((item) => {
          const selected = isItemSelected(item);
          const locked = isItemLocked(item);
          const requiredStreak = getRequiredStreak(item.id);

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.itemCard,
                selected && styles.itemCardSelected,
                locked && styles.itemCardLocked,
              ]}
              onPress={() => selectItem(item)}
              disabled={locked}
            >
              {/* Item icon/emoji */}
              <View style={styles.itemIconContainer}>
                {item.imagePath ? (
                  <Text style={styles.itemEmoji}>{item.imagePath}</Text>
                ) : (
                  <MaterialCommunityIcons
                    name="cancel"
                    size={32}
                    color="#666"
                  />
                )}
              </View>

              {/* Item name */}
              <Text
                style={[styles.itemName, locked && styles.itemNameLocked]}
                numberOfLines={1}
              >
                {item.name}
              </Text>

              {/* Rarity indicator */}
              <View
                style={[
                  styles.rarityDot,
                  { backgroundColor: getRarityColor(item.rarity) },
                ]}
              />

              {/* Lock overlay */}
              {locked && (
                <View style={styles.lockOverlay}>
                  <MaterialCommunityIcons name="lock" size={20} color="#666" />
                  {requiredStreak && (
                    <Text style={styles.lockText}>{requiredStreak}🔥</Text>
                  )}
                </View>
              )}

              {/* Selected checkmark */}
              {selected && (
                <View style={styles.selectedBadge}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={20}
                    color="#4CAF50"
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderColorGrid = () => (
    <View style={styles.colorGrid}>
      {AVATAR_COLORS.map((color) => (
        <TouchableOpacity
          key={color}
          style={[
            styles.colorButton,
            { backgroundColor: color },
            previewConfig.baseColor === color && styles.colorButtonSelected,
          ]}
          onPress={() => selectColor(color)}
        >
          {previewConfig.baseColor === color && (
            <MaterialCommunityIcons name="check" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const tabs = [
    { key: "color", label: "Color", icon: "palette" },
    { key: "background", label: "BG", icon: "image" },
    { key: "hat", label: "Hat", icon: "hat-fedora" },
    { key: "glasses", label: "Glasses", icon: "glasses" },
  ] as const;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Customize Avatar</Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <>
              {/* Avatar Preview */}
              <View style={styles.previewSection}>
                <Avatar config={previewConfig} size={120} />
              </View>

              {/* Tab Bar */}
              <View style={styles.tabBar}>
                {tabs.map((tab) => (
                  <Pressable
                    key={tab.key}
                    style={[
                      styles.tab,
                      activeTab === tab.key && styles.tabActive,
                    ]}
                    onPress={() => setActiveTab(tab.key)}
                  >
                    <MaterialCommunityIcons
                      name={tab.icon as any}
                      size={20}
                      color={
                        activeTab === tab.key ? theme.colors.primary : "#666"
                      }
                    />
                    <Text
                      style={[
                        styles.tabLabel,
                        activeTab === tab.key && styles.tabLabelActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Content */}
              <ScrollView style={styles.contentScroll}>
                {activeTab === "color" && renderColorGrid()}
                {activeTab === "background" && renderItemGrid("background")}
                {activeTab === "hat" && renderItemGrid("hat")}
                {activeTab === "glasses" && renderItemGrid("glasses")}
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <Button
                  mode="outlined"
                  onPress={handleCancel}
                  style={styles.actionButton}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSave}
                  buttonColor={theme.colors.primary}
                  textColor="#000"
                  style={styles.actionButton}
                  loading={saving}
                  disabled={saving}
                >
                  Save
                </Button>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    padding: 60,
    alignItems: "center",
  },
  previewSection: {
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "#f5f5f5",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: AppColors.primary,
  },
  tabLabel: {
    fontSize: 12,
    color: "#666",
  },
  tabLabelActive: {
    color: "#000",
    fontWeight: "600",
  },
  contentScroll: {
    maxHeight: 280,
    padding: 16,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
  },
  colorButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorButtonSelected: {
    borderColor: "#000",
    borderWidth: 3,
  },
  itemGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  itemCard: {
    width: "30%",
    aspectRatio: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative",
  },
  itemCardSelected: {
    borderColor: AppColors.primary,
    backgroundColor: "#fffde7",
  },
  itemCardLocked: {
    opacity: 0.6,
  },
  itemIconContainer: {
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  itemEmoji: {
    fontSize: 32,
  },
  itemName: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
    color: "#333",
  },
  itemNameLocked: {
    color: "#999",
  },
  rarityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: "absolute",
    top: 6,
    right: 6,
  },
  lockOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  lockText: {
    fontSize: 10,
    color: "#666",
    marginTop: 2,
  },
  selectedBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  actionButton: {
    flex: 1,
  },
});
