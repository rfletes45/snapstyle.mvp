/**
 * PurchaseConfirmationModal Component
 *
 * Premium-styled confirmation modal before purchase.
 * Shows larger item preview, clear price breakdown, and payment method options.
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md Phase 6
 */

import AppImage from "@/components/AppImage";
import type { CosmeticBundle } from "@/data/cosmeticBundles";
import type { ShopItemWithStatus } from "@/types/models";
import { RARITY_COLORS } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Divider,
  Modal,
  Portal,
  RadioButton,
  Text,
  useTheme,
} from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

export type PurchaseType = "item" | "bundle" | "tokens";
export type PaymentMethod = "tokens" | "iap";

export interface PurchaseConfirmationModalProps {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: (paymentMethod: PaymentMethod) => void;
  type: PurchaseType;
  item?: ShopItemWithStatus;
  bundle?: CosmeticBundle;
  tokenPack?: {
    tokens: number;
    bonusTokens: number;
    priceUSD: number;
  };
  tokenBalance: number;
  purchasing?: boolean;
  error?: string | null;
}

// =============================================================================
// Helpers
// =============================================================================

function isImageUri(path?: string): boolean {
  if (!path) return false;
  return (
    path.startsWith("http") ||
    path.startsWith("/") ||
    path.startsWith("file") ||
    path.includes(".png") ||
    path.includes(".jpg") ||
    path.includes(".webp") ||
    path.includes(".svg")
  );
}

// =============================================================================
// Component
// =============================================================================

function PurchaseConfirmationModalBase({
  visible,
  onDismiss,
  onConfirm,
  type,
  item,
  bundle,
  tokenPack,
  tokenBalance,
  purchasing = false,
  error = null,
}: PurchaseConfirmationModalProps) {
  const theme = useTheme();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("tokens");

  const priceTokens = item?.priceTokens ?? bundle?.priceTokens ?? 0;
  const priceUSD = item?.priceUSD ?? bundle?.priceUSD ?? tokenPack?.priceUSD;
  const canAffordTokens = tokenBalance >= priceTokens;
  const hasIAPOption = !!priceUSD;

  React.useEffect(() => {
    if (!canAffordTokens && hasIAPOption) {
      setPaymentMethod("iap");
    } else if (!hasIAPOption) {
      setPaymentMethod("tokens");
    }
  }, [canAffordTokens, hasIAPOption]);

  const itemName = item?.name ?? bundle?.name ?? "Token Pack";
  const itemDescription =
    item?.description ?? bundle?.description ?? "Get more tokens!";
  const itemImage = item?.imagePath ?? bundle?.imagePath ?? "\u{1FA99}";
  const itemRarity = item?.rarity ?? bundle?.rarity ?? "common";
  const rarityColor = RARITY_COLORS[itemRarity] || "#9E9E9E";
  const hasRealImage = isImageUri(itemImage);

  // === Item Preview ===
  const renderItemPreview = () => (
    <View style={styles.previewSection}>
      <LinearGradient
        colors={[rarityColor + "30", rarityColor + "08"]}
        style={styles.previewContainer}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        {/* Rarity glow */}
        <View style={[styles.previewGlow, { backgroundColor: rarityColor + "20" }]} />

        {/* Preview frame */}
        <View style={[styles.previewFrame, { borderColor: rarityColor + "40" }]}>
          {hasRealImage ? (
            <AppImage
              source={{ uri: itemImage }}
              style={styles.previewImage}
              contentFit="contain"
              debugLabel="PurchasePreview"
            />
          ) : (
            <Text style={styles.previewEmoji}>{itemImage}</Text>
          )}
        </View>

        {/* Item name + rarity */}
        <View style={styles.previewInfo}>
          <Text style={[styles.itemName, { color: theme.colors.onSurface }]}>
            {itemName}
          </Text>
          <View style={[styles.rarityPill, { backgroundColor: rarityColor + "20" }]}>
            <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
            <Text style={[styles.rarityText, { color: rarityColor }]}>
              {itemRarity.charAt(0).toUpperCase() + itemRarity.slice(1)}
            </Text>
          </View>
          {itemDescription && (
            <Text
              style={[styles.itemDescription, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={2}
            >
              {itemDescription}
            </Text>
          )}
        </View>
      </LinearGradient>

      {/* Bundle items preview */}
      {bundle && bundle.items.length > 0 && (
        <View style={styles.bundleItemsSection}>
          <Text style={[styles.bundleLabel, { color: theme.colors.onSurfaceVariant }]}>
            Includes {bundle.items.length} items
          </Text>
          <View style={styles.bundleItemsRow}>
            {bundle.items.slice(0, 5).map((bundleItem) => {
              const bColor = RARITY_COLORS[bundleItem.rarity] || "#9E9E9E";
              const bHasImage = isImageUri(bundleItem.imagePath);
              return (
                <View
                  key={bundleItem.cosmeticId}
                  style={[styles.bundleItemBubble, { borderColor: bColor + "40" }]}
                >
                  {bHasImage ? (
                    <AppImage
                      source={{ uri: bundleItem.imagePath }}
                      style={styles.bundleItemImage}
                      contentFit="contain"
                      debugLabel="BundleConfirmItem"
                    />
                  ) : (
                    <Text style={styles.bundleItemEmoji}>{bundleItem.imagePath}</Text>
                  )}
                </View>
              );
            })}
            {bundle.items.length > 5 && (
              <Text style={[styles.moreItems, { color: theme.colors.onSurfaceVariant }]}>
                +{bundle.items.length - 5}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Token pack display */}
      {tokenPack && (
        <View style={styles.tokenPackInfo}>
          <View style={styles.tokenPackRow}>
            <Text style={styles.tokenPackEmoji}>{"\u{1FA99}"}</Text>
            <Text style={styles.tokenAmount}>
              {tokenPack.tokens.toLocaleString()}
            </Text>
          </View>
          {tokenPack.bonusTokens > 0 && (
            <Text style={styles.bonusTokens}>
              +{tokenPack.bonusTokens.toLocaleString()} Bonus Tokens
            </Text>
          )}
        </View>
      )}
    </View>
  );

  // === Price Section ===
  const renderPriceSection = () => (
    <View style={styles.priceSection}>
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Price
      </Text>

      {bundle && bundle.discountPercent > 0 && (
        <View style={styles.originalPriceRow}>
          <Text style={[styles.originalPrice, { color: theme.colors.onSurfaceVariant }]}>
            Original: {bundle.originalPriceTokens.toLocaleString()} {"\u{1FA99}"}
          </Text>
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>Save {bundle.discountPercent}%</Text>
          </View>
        </View>
      )}

      {priceTokens > 0 && (
        <View style={styles.priceRow}>
          <Text style={[styles.priceValue, { color: rarityColor }]}>
            {priceTokens.toLocaleString()} {"\u{1FA99}"}
          </Text>
          {!canAffordTokens && (
            <Text style={[styles.insufficientFunds, { color: theme.colors.error }]}>
              (Need {(priceTokens - tokenBalance).toLocaleString()} more)
            </Text>
          )}
        </View>
      )}

      {priceUSD && (
        <Text style={[styles.usdPrice, { color: theme.colors.onSurfaceVariant }]}>
          or ${priceUSD.toFixed(2)} USD
        </Text>
      )}
    </View>
  );

  // === Payment Options ===
  const renderPaymentOptions = () => {
    if (!hasIAPOption || type === "tokens") {
      return null;
    }
    return (
      <View style={styles.paymentSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          Payment Method
        </Text>
        <RadioButton.Group
          onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
          value={paymentMethod}
        >
          <Pressable
            onPress={() => canAffordTokens && setPaymentMethod("tokens")}
            style={[
              styles.paymentOption,
              paymentMethod === "tokens" && { backgroundColor: theme.colors.primaryContainer },
              !canAffordTokens && { opacity: 0.5 },
            ]}
          >
            <RadioButton.Android value="tokens" disabled={!canAffordTokens} color={theme.colors.primary} />
            <View style={styles.paymentOptionContent}>
              <Text style={[styles.paymentOptionTitle, { color: theme.colors.onSurface }]}>
                Pay with Tokens
              </Text>
              <Text style={[styles.paymentOptionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Balance: {tokenBalance.toLocaleString()} {"\u{1FA99}"}
              </Text>
            </View>
            {!canAffordTokens && (
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.colors.error} />
            )}
          </Pressable>

          <Pressable
            onPress={() => setPaymentMethod("iap")}
            style={[
              styles.paymentOption,
              paymentMethod === "iap" && { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <RadioButton.Android value="iap" color={theme.colors.primary} />
            <View style={styles.paymentOptionContent}>
              <Text style={[styles.paymentOptionTitle, { color: theme.colors.onSurface }]}>
                Pay ${priceUSD?.toFixed(2)}
              </Text>
              <Text style={[styles.paymentOptionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Credit card / App Store
              </Text>
            </View>
          </Pressable>
        </RadioButton.Group>
      </View>
    );
  };

  // === Error ===
  const renderError = () => {
    if (!error) return null;
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.errorContainer }]}>
        <MaterialCommunityIcons name="alert-circle" size={20} color={theme.colors.error} />
        <Text style={[styles.errorText, { color: theme.colors.onErrorContainer }]}>
          {error}
        </Text>
      </View>
    );
  };

  const isConfirmDisabled =
    purchasing ||
    (paymentMethod === "tokens" && !canAffordTokens && !hasIAPOption);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons name="diamond-stone" size={20} color={rarityColor} />
              <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                Confirm Purchase
              </Text>
            </View>
            <Pressable onPress={onDismiss} style={styles.closeButton} hitSlop={8}>
              <MaterialCommunityIcons name="close" size={22} color={theme.colors.onSurfaceVariant} />
            </Pressable>
          </View>

          <Divider />

          {renderItemPreview()}
          {renderPriceSection()}
          <Divider style={styles.divider} />
          {renderPaymentOptions()}
          {renderError()}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={onDismiss}
              style={styles.cancelButton}
              disabled={purchasing}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => onConfirm(paymentMethod)}
              style={styles.confirmButton}
              disabled={isConfirmDisabled}
              loading={purchasing}
              icon={paymentMethod === "iap" ? "diamond-stone" : undefined}
            >
              {purchasing
                ? "Processing..."
                : paymentMethod === "tokens"
                  ? `Pay ${priceTokens.toLocaleString()} \u{1FA99}`
                  : `Pay $${priceUSD?.toFixed(2)}`}
            </Button>
          </View>

          {/* Disclaimer */}
          <Text style={[styles.disclaimer, { color: theme.colors.onSurfaceVariant }]}>
            {paymentMethod === "iap"
              ? "Payment will be processed through your app store account."
              : "Tokens will be deducted from your balance immediately."}
          </Text>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    borderRadius: 20,
    maxHeight: "85%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    padding: 4,
  },

  // Preview
  previewSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  previewContainer: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  previewGlow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    top: "10%",
  },
  previewFrame: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
    marginBottom: 14,
  },
  previewImage: {
    width: 80,
    height: 80,
  },
  previewEmoji: {
    fontSize: 52,
  },
  previewInfo: {
    alignItems: "center",
  },
  itemName: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  rarityPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
    marginBottom: 8,
  },
  rarityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rarityText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  itemDescription: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },

  // Bundle items
  bundleItemsSection: {
    marginTop: 16,
    alignItems: "center",
  },
  bundleLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 10,
  },
  bundleItemsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bundleItemBubble: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    overflow: "hidden",
  },
  bundleItemImage: {
    width: 34,
    height: 34,
  },
  bundleItemEmoji: {
    fontSize: 20,
  },
  moreItems: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Token pack
  tokenPackInfo: {
    marginTop: 16,
    alignItems: "center",
  },
  tokenPackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tokenPackEmoji: {
    fontSize: 28,
  },
  tokenAmount: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFD700",
  },
  bonusTokens: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4CAF50",
    marginTop: 4,
  },

  // Price
  priceSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  originalPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  originalPrice: {
    fontSize: 14,
    textDecorationLine: "line-through",
  },
  savingsBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
  },
  savingsText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  insufficientFunds: {
    fontSize: 12,
    marginLeft: 8,
  },
  usdPrice: {
    fontSize: 14,
    marginTop: 4,
  },
  divider: {
    marginVertical: 4,
  },

  // Payment
  paymentSection: {
    padding: 16,
    paddingTop: 8,
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  paymentOptionContent: {
    flex: 1,
    marginLeft: 8,
  },
  paymentOptionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  paymentOptionSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },

  // Error
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
  },

  // Actions
  actions: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 2,
  },
  disclaimer: {
    fontSize: 11,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    lineHeight: 15,
  },
});

export const PurchaseConfirmationModal = memo(PurchaseConfirmationModalBase);
export default PurchaseConfirmationModal;
