/**
 * AnimalPickerBubble
 *
 * Anchored bubble overlay that appears above the animal button in the composer.
 * Shows owned animals in a 2×2 scrollable grid.
 * Selecting an animal equips it instantly with no confirmation.
 *
 * Design:
 * - Large rounded rectangle with a downward stem pointing at the anchor button
 * - Width: most of screen width (with side margins)
 * - Height: exactly 2 animal images tall (2 visible rows)
 * - 2 columns × 2 visible rows; vertical scroll for more
 * - Green checkmark overlay on the currently equipped animal
 * - Tap outside (above) closes the picker
 *
 * @module components/chat/AnimalPickerBubble
 */

import {
  DEFAULT_ANIMAL_THEME_ID,
  getAnimalImage,
  getAnimalThemeIds,
} from "@/cosmetics/animalAssets";
import { getCosmeticById } from "@/cosmetics/catalog";
import { hasEntitlement } from "@/services/entitlements";
import { equipChatAnimalTheme } from "@/services/profileService";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

export interface AnimalPickerBubbleProps {
  /** Whether the picker is currently visible */
  visible: boolean;
  /** Close the picker */
  onClose: () => void;
  /** Current user ID */
  uid: string;
  /** Currently equipped animal theme ID */
  equippedAnimalId: string | null;
  /** Called after an animal is equipped (so parent can refresh state) */
  onEquipped: (animalId: string) => void;
  /** Anchor position: { x, y, width, height } of the animal button (from measureInWindow) */
  anchorLayout: { x: number; y: number; width: number; height: number } | null;
  /** Current keyboard height (0 if closed) */
  keyboardHeight: number;
  /** Safe area inset bottom */
  safeAreaBottom: number;
}

// =============================================================================
// Constants
// =============================================================================

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const BUBBLE_MARGIN_H = 16;
const BUBBLE_WIDTH = SCREEN_WIDTH - BUBBLE_MARGIN_H * 2;
const TILE_GAP = 10;
const COLUMNS = 2;
const TILE_SIZE = (BUBBLE_WIDTH - TILE_GAP * 3 - 2) / COLUMNS; // 2 columns with gap
const VISIBLE_ROWS = 2;
const GRID_HEIGHT = TILE_SIZE * VISIBLE_ROWS + TILE_GAP * (VISIBLE_ROWS + 1);
const BUBBLE_PADDING_TOP = 12;
const BUBBLE_PADDING_BOTTOM = 8;
const BUBBLE_HEADER_HEIGHT = 32;
const BUBBLE_HEIGHT =
  GRID_HEIGHT +
  BUBBLE_PADDING_TOP +
  BUBBLE_PADDING_BOTTOM +
  BUBBLE_HEADER_HEIGHT;
const STEM_SIZE = 12;
const BUBBLE_RADIUS = 20;

// =============================================================================
// Component
// =============================================================================

export function AnimalPickerBubble({
  visible,
  onClose,
  uid,
  equippedAnimalId,
  onEquipped,
  anchorLayout,
  keyboardHeight,
  safeAreaBottom,
}: AnimalPickerBubbleProps) {
  const theme = useTheme();
  const [ownedAnimals, setOwnedAnimals] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipping, setEquipping] = useState<string | null>(null);

  // Pre-load owned animals eagerly so data is ready when the picker opens
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;

    async function loadOwned() {
      setLoading(true);
      const allIds = getAnimalThemeIds();
      const owned: string[] = [];

      await Promise.all(
        allIds.map(async (id) => {
          const def = getCosmeticById(id);
          const isFree =
            def?.type === "chat_animal_theme" &&
            (def.source === "free" || def.source === "starter");
          if (isFree) {
            owned.push(id);
            return;
          }
          const has = await hasEntitlement(uid, id);
          if (has) owned.push(id);
        }),
      );

      if (!cancelled) {
        // Sort: equipped first, then alphabetical
        const effectiveEquipped = equippedAnimalId ?? DEFAULT_ANIMAL_THEME_ID;
        owned.sort((a, b) => {
          if (a === effectiveEquipped) return -1;
          if (b === effectiveEquipped) return 1;
          return a.localeCompare(b);
        });
        setOwnedAnimals(owned);
        setLoading(false);
      }
    }

    loadOwned();
    return () => {
      cancelled = true;
    };
  }, [uid, equippedAnimalId]);

  // Handle equip
  // Resolve null (default) → duck for equipped state checks
  const effectiveEquippedId = equippedAnimalId ?? DEFAULT_ANIMAL_THEME_ID;

  const handleSelect = useCallback(
    async (animalId: string) => {
      if (animalId === effectiveEquippedId || equipping) return;
      try {
        setEquipping(animalId);
        await equipChatAnimalTheme(uid, animalId);
        onEquipped(animalId);
      } catch (e: any) {
        // Silently fail — ownership gating should prevent this
      } finally {
        setEquipping(null);
      }
    },
    [uid, effectiveEquippedId, equipping, onEquipped],
  );

  if (!visible || !anchorLayout) return null;

  // Compute position — bubble appears ABOVE the anchor
  const anchorCenterX = anchorLayout.x + anchorLayout.width / 2;
  const bubbleLeft = Math.max(
    BUBBLE_MARGIN_H,
    Math.min(
      anchorCenterX - BUBBLE_WIDTH / 2,
      SCREEN_WIDTH - BUBBLE_WIDTH - BUBBLE_MARGIN_H,
    ),
  );

  // Stem position relative to bubble
  const stemLeftRelative = anchorCenterX - bubbleLeft - STEM_SIZE;

  // Bubble bottom sits above the anchor.
  // The parent re-measures anchorLayout when the keyboard state changes,
  // so this calculation stays correct regardless of keyboard transitions.
  const bubbleBottom = SCREEN_HEIGHT - anchorLayout.y + 12;

  // Cap bubble height so it doesn't float near the top of the screen when
  // the keyboard pushes the anchor high up.  The header + stem + a small
  // margin define the minimum clearance from the top edge.
  const TOP_CLEARANCE = 60; // min gap from screen top
  const availableHeight = anchorLayout.y - TOP_CLEARANCE - STEM_SIZE - 12; // space above anchor
  const effectiveBubbleHeight = Math.max(
    BUBBLE_HEADER_HEIGHT +
      BUBBLE_PADDING_TOP +
      BUBBLE_PADDING_BOTTOM +
      TILE_SIZE +
      TILE_GAP * 2,
    Math.min(BUBBLE_HEIGHT, availableHeight),
  );
  const effectiveGridHeight =
    effectiveBubbleHeight -
    BUBBLE_PADDING_TOP -
    BUBBLE_PADDING_BOTTOM -
    BUBBLE_HEADER_HEIGHT;

  const bubbleBg = theme.dark ? theme.colors.elevation.level2 : "#FFFFFF";
  const stemColor = bubbleBg;
  const tileBg = theme.dark ? theme.colors.elevation.level3 : "#F5F5F5";

  return (
    <>
      {/* Backdrop: tap to close */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Close animal picker"
        accessibilityRole="button"
      />

      {/* Bubble container */}
      <View
        style={[
          styles.bubbleContainer,
          {
            left: bubbleLeft,
            bottom: bubbleBottom,
            width: BUBBLE_WIDTH,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Main bubble */}
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: bubbleBg,
              shadowColor: theme.dark ? "#000" : "#666",
            },
          ]}
        >
          {/* Header */}
          <View style={styles.bubbleHeader}>
            <Text
              variant="labelLarge"
              style={[styles.bubbleTitle, { color: theme.colors.onSurface }]}
            >
              Choose Animal
            </Text>
          </View>

          {/* Grid */}
          {loading ? (
            <View
              style={[styles.loadingContainer, { height: effectiveGridHeight }]}
            >
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : ownedAnimals.length === 0 ? (
            <View
              style={[styles.emptyContainer, { height: effectiveGridHeight }]}
            >
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                No animals owned yet
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: effectiveGridHeight }}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
            >
              <View style={styles.gridRow}>
                {ownedAnimals.map((animalId) => {
                  const isEquipped = animalId === effectiveEquippedId;
                  const isEquipping = equipping === animalId;
                  const imageSource = getAnimalImage(animalId);

                  return (
                    <TouchableOpacity
                      key={animalId}
                      style={[
                        styles.tile,
                        {
                          backgroundColor: tileBg,
                          borderColor: isEquipped ? "#4CAF50" : "transparent",
                          borderWidth: isEquipped ? 2.5 : 0,
                        },
                      ]}
                      onPress={() => handleSelect(animalId)}
                      activeOpacity={0.7}
                      disabled={isEquipping}
                      accessibilityLabel={`Select ${animalId.replace("animal_", "")}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isEquipped }}
                    >
                      <Image
                        source={imageSource}
                        style={styles.tileImage}
                        resizeMode="cover"
                      />

                      {/* Green check overlay */}
                      {isEquipped && (
                        <View style={styles.checkOverlay}>
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={24}
                            color="#4CAF50"
                          />
                        </View>
                      )}

                      {/* Loading overlay while equipping */}
                      {isEquipping && (
                        <View style={styles.equippingOverlay}>
                          <ActivityIndicator size="small" color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Stem (downward triangle) — pulled up to seamlessly join the bubble */}
        <View
          style={[
            styles.stemWrapper,
            {
              left: Math.max(16, Math.min(stemLeftRelative, BUBBLE_WIDTH - 32)),
            },
          ]}
        >
          {/* Bridge rectangle — fills the gap caused by bubbleRadius */}
          <View style={[styles.stemBridge, { backgroundColor: stemColor }]} />
          {/* Triangular point */}
          <View style={[styles.stemTriangle, { borderTopColor: stemColor }]} />
        </View>
      </View>
    </>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  bubbleContainer: {
    position: "absolute",
    zIndex: 9999,
    elevation: 20,
  },
  bubble: {
    borderRadius: BUBBLE_RADIUS,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  bubbleHeader: {
    paddingHorizontal: TILE_GAP,
    paddingTop: BUBBLE_PADDING_TOP,
    paddingBottom: 4,
  },
  bubbleTitle: {
    fontWeight: "600",
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  gridContent: {
    paddingHorizontal: TILE_GAP,
    paddingBottom: BUBBLE_PADDING_BOTTOM,
  },
  gridRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: TILE_GAP,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  tileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  checkOverlay: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 12,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  equippingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stemWrapper: {
    alignSelf: "flex-start",
    alignItems: "center",
    marginTop: -2,
  },
  stemBridge: {
    width: STEM_SIZE * 2,
    height: 3,
  },
  stemTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: STEM_SIZE,
    borderRightWidth: STEM_SIZE,
    borderTopWidth: STEM_SIZE,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    // borderTopColor set dynamically
  },
});

export default AnimalPickerBubble;
