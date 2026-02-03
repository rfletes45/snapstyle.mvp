/**
 * Item Preview Modal
 *
 * Full-screen preview modal for shop items with rotation,
 * zoom, and variation selection.
 *
 * Features:
 * - Gesture-based 3D rotation
 * - Pinch-to-zoom
 * - Color/variation swatches
 * - Item details display
 * - Add to cart/wishlist
 * - Share functionality
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.6
 */

import { useAppTheme } from "@/store/ThemeContext";
import type { PointsShopItem } from "@/types/shop";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ItemVariation,
  getPerspective,
  getPreviewImageUrl,
  getRotationTransform,
  useItemPreview,
} from "../../hooks/useItemPreview";

// =============================================================================
// Types
// =============================================================================

interface ItemPreviewModalProps {
  item: PointsShopItem | null;
  visible: boolean;
  onClose: () => void;
  onAddToCart?: (item: PointsShopItem, variation?: ItemVariation) => void;
  onBuyNow?: (item: PointsShopItem, variation?: ItemVariation) => void;
  onToggleWishlist?: (itemId: string) => void;
  isItemWishlisted?: (itemId: string) => boolean;
  variations?: ItemVariation[];
}

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PREVIEW_SIZE = Math.min(SCREEN_WIDTH - 64, 320);

// Sample variations (would come from item data in production)
const DEFAULT_VARIATIONS: ItemVariation[] = [];

// =============================================================================
// Main Component
// =============================================================================

export function ItemPreviewModal({
  item,
  visible,
  onClose,
  onAddToCart,
  onBuyNow,
  onToggleWishlist,
  isItemWishlisted,
  variations = DEFAULT_VARIATIONS,
}: ItemPreviewModalProps) {
  const { colors } = useAppTheme();
  const {
    selectedVariation,
    rotation,
    zoom,
    rotationX,
    rotationY,
    scale,
    opacity,
    selectVariation,
    resetRotation,
    zoomIn,
    zoomOut,
    resetZoom,
    panResponder,
  } = useItemPreview();

  const [showDetails, setShowDetails] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Get current preview image
  const previewImage = useMemo(() => {
    if (!item) return null;
    return getPreviewImageUrl(item, selectedVariation);
  }, [item, selectedVariation]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (!item) return;

    try {
      await Share.share({
        message: `Check out this item: ${item.name}`,
        title: item.name,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }, [item]);

  // Handle add to cart
  const handleAddToCart = useCallback(() => {
    if (!item) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddToCart?.(item, selectedVariation || undefined);
  }, [item, selectedVariation, onAddToCart]);

  // Handle buy now
  const handleBuyNow = useCallback(() => {
    if (!item) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onBuyNow?.(item, selectedVariation || undefined);
  }, [item, selectedVariation, onBuyNow]);

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setImageLoaded(false);
      resetRotation();
      resetZoom();
    }
  }, [visible, resetRotation, resetZoom]);

  if (!item) return null;

  const perspective = getPerspective(rotation);
  const rotationTransform = getRotationTransform(rotationX, rotationY);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Dark Background Overlay */}
        <View style={[StyleSheet.absoluteFill, styles.darkOverlay]} />

        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Share Button */}
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="share-outline" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Main Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Preview Area */}
          <View style={styles.previewArea}>
            {/* Rarity Glow */}
            <View
              style={[
                styles.rarityGlow,
                { backgroundColor: getRarityGlowColor(item.rarity) },
              ]}
            />

            {/* 3D Preview */}
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.previewContainer,
                {
                  transform: [
                    { perspective: perspective },
                    ...rotationTransform,
                    { scale },
                  ],
                  opacity: imageLoaded ? 1 : 0.5,
                },
              ]}
            >
              <Image
                source={{ uri: previewImage || item.imagePath }}
                style={styles.previewImage}
                resizeMode="contain"
                onLoad={() => setImageLoaded(true)}
              />
            </Animated.View>

            {/* Rotation Indicator */}
            {(rotation.x !== 0 || rotation.y !== 0) && (
              <View style={styles.rotationIndicator}>
                <Text style={styles.rotationText}>
                  {Math.round(rotation.x)}° / {Math.round(rotation.y)}°
                </Text>
              </View>
            )}

            {/* Gesture Hint */}
            {rotation.x === 0 && rotation.y === 0 && (
              <View style={styles.gestureHint}>
                <Ionicons
                  name="hand-left-outline"
                  size={20}
                  color="rgba(255,255,255,0.6)"
                />
                <Text style={styles.gestureHintText}>Drag to rotate</Text>
              </View>
            )}
          </View>

          {/* Zoom Controls */}
          <View style={styles.zoomControls}>
            <TouchableOpacity
              style={styles.zoomButton}
              onPress={zoomOut}
              disabled={zoom <= 0.5}
            >
              <Ionicons
                name="remove"
                size={24}
                color={zoom <= 0.5 ? "rgba(255,255,255,0.3)" : "#fff"}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.zoomReset} onPress={resetZoom}>
              <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.zoomButton}
              onPress={zoomIn}
              disabled={zoom >= 2.0}
            >
              <Ionicons
                name="add"
                size={24}
                color={zoom >= 2.0 ? "rgba(255,255,255,0.3)" : "#fff"}
              />
            </TouchableOpacity>

            <View style={styles.zoomDivider} />

            <TouchableOpacity style={styles.zoomButton} onPress={resetRotation}>
              <Ionicons name="refresh" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Variations */}
          {variations.length > 0 && (
            <View style={styles.variationsSection}>
              <Text style={styles.sectionTitle}>Color Options</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.variationsContainer}
              >
                {variations.map((variation) => (
                  <TouchableOpacity
                    key={variation.id}
                    style={[
                      styles.variationSwatch,
                      selectedVariation?.id === variation.id &&
                        styles.variationSwatchSelected,
                    ]}
                    onPress={() => selectVariation(variation)}
                  >
                    {variation.colorHex ? (
                      <View
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: variation.colorHex },
                        ]}
                      />
                    ) : (
                      <Image
                        source={{ uri: variation.imagePath }}
                        style={styles.variationImage}
                      />
                    )}
                    <Text
                      style={[
                        styles.variationName,
                        selectedVariation?.id === variation.id &&
                          styles.variationNameSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {variation.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Item Details */}
          <View style={styles.detailsSection}>
            {/* Header */}
            <View style={styles.detailsHeader}>
              <View style={styles.detailsTitleRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                {onToggleWishlist && (
                  <TouchableOpacity
                    onPress={() => onToggleWishlist(item.id)}
                    style={styles.wishlistButton}
                  >
                    <Ionicons
                      name={
                        isItemWishlisted?.(item.id) ? "heart" : "heart-outline"
                      }
                      size={24}
                      color={
                        isItemWishlisted?.(item.id)
                          ? "#EF4444"
                          : colors.textSecondary
                      }
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Rarity Badge */}
              <View
                style={[
                  styles.rarityBadge,
                  { backgroundColor: getRarityColor(item.rarity) },
                ]}
              >
                <Text style={styles.rarityText}>
                  {item.rarity?.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Description */}
            <Text style={styles.itemDescription}>{item.description}</Text>

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {item.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Price */}
            <View style={styles.priceSection}>
              <View style={styles.priceContainer}>
                {item.discountPercent && item.discountPercent > 0 ? (
                  <>
                    <Text style={styles.salePrice}>
                      {calculateSalePrice(
                        item.priceTokens,
                        item.discountPercent,
                      ).toLocaleString()}
                    </Text>
                    <Text style={styles.originalPrice}>
                      {item.priceTokens.toLocaleString()}
                    </Text>
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>
                        -{item.discountPercent}%
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.price}>
                    {item.priceTokens.toLocaleString()}
                  </Text>
                )}
                <Ionicons
                  name="logo-bitcoin"
                  size={20}
                  color="#EAB308"
                  style={styles.tokenIcon}
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.actionsContainer}>
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.9)"]}
            style={styles.actionsGradient}
          />
          <View style={styles.actions}>
            {onAddToCart && (
              <TouchableOpacity
                style={[
                  styles.addToCartButton,
                  { borderColor: colors.primary },
                ]}
                onPress={handleAddToCart}
              >
                <Ionicons
                  name="cart-outline"
                  size={22}
                  color={colors.primary}
                />
                <Text style={[styles.addToCartText, { color: colors.primary }]}>
                  Add to Cart
                </Text>
              </TouchableOpacity>
            )}

            {onBuyNow && (
              <TouchableOpacity
                style={[
                  styles.buyNowButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleBuyNow}
              >
                <Text style={styles.buyNowText}>Buy Now</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

function getRarityColor(rarity?: string): string {
  switch (rarity?.toLowerCase()) {
    case "legendary":
      return "#F97316";
    case "epic":
      return "#9333EA";
    case "rare":
      return "#3B82F6";
    case "common":
    default:
      return "#6B7280";
  }
}

function getRarityGlowColor(rarity?: string): string {
  switch (rarity?.toLowerCase()) {
    case "legendary":
      return "rgba(249, 115, 22, 0.3)";
    case "epic":
      return "rgba(147, 51, 234, 0.3)";
    case "rare":
      return "rgba(59, 130, 246, 0.3)";
    case "common":
    default:
      return "rgba(107, 114, 128, 0.2)";
  }
}

function calculateSalePrice(
  originalPrice: number,
  discountPercent: number,
): number {
  return Math.round(originalPrice * (1 - discountPercent / 100));
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 20,
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  shareButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    right: 20,
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingTop: Platform.OS === "ios" ? 120 : 100,
    paddingBottom: 120,
  },
  previewArea: {
    alignItems: "center",
    justifyContent: "center",
    height: PREVIEW_SIZE + 40,
    marginBottom: 20,
  },
  rarityGlow: {
    position: "absolute",
    width: PREVIEW_SIZE * 1.2,
    height: PREVIEW_SIZE * 1.2,
    borderRadius: PREVIEW_SIZE * 0.6,
    opacity: 0.5,
  },
  previewContainer: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  rotationIndicator: {
    position: "absolute",
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rotationText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  gestureHint: {
    position: "absolute",
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  gestureHintText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
  },
  zoomControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    gap: 8,
  },
  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomReset: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  zoomText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  zoomDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginHorizontal: 8,
  },
  variationsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  variationsContainer: {
    gap: 12,
  },
  variationSwatch: {
    alignItems: "center",
    marginRight: 16,
    opacity: 0.7,
  },
  variationSwatchSelected: {
    opacity: 1,
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "transparent",
  },
  variationImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  variationName: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 6,
  },
  variationNameSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  detailsSection: {
    paddingHorizontal: 20,
  },
  detailsHeader: {
    marginBottom: 12,
  },
  detailsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  itemName: {
    flex: 1,
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    marginRight: 12,
  },
  rarityBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rarityText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  itemDescription: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  tag: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
  },
  priceSection: {
    marginTop: 8,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  price: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  salePrice: {
    color: "#10B981",
    fontSize: 28,
    fontWeight: "700",
  },
  originalPrice: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 18,
    textDecorationLine: "line-through",
    marginLeft: 10,
  },
  discountBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 12,
  },
  discountText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  tokenIcon: {
    marginLeft: 8,
  },
  actionsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  actionsGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  actions: {
    flexDirection: "row",
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    gap: 12,
  },
  addToCartButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#8839ef", // Will be overridden by inline style
    gap: 8,
  },
  addToCartText: {
    color: "#8839ef", // Will be overridden by inline style
    fontSize: 16,
    fontWeight: "600",
  },
  buyNowButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8839ef", // Will be overridden by inline style
    paddingVertical: 16,
    borderRadius: 16,
  },
  buyNowText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  wishlistButton: {
    padding: 4,
  },
  darkOverlay: {
    backgroundColor: "rgba(0,0,0,0.9)",
  },
});
