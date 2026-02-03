/**
 * PurchaseConfirmationModal Component
 *
 * Confirms purchase before proceeding with payment.
 * Shows item details, price, and payment method options.
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md Phase 6
 */

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
  /** Whether modal is visible */
  visible: boolean;
  /** Handler to close modal */
  onDismiss: () => void;
  /** Handler when purchase is confirmed */
  onConfirm: (paymentMethod: PaymentMethod) => void;
  /** Purchase type */
  type: PurchaseType;
  /** Item being purchased (for single items) */
  item?: ShopItemWithStatus;
  /** Bundle being purchased */
  bundle?: CosmeticBundle;
  /** Token pack info */
  tokenPack?: {
    tokens: number;
    bonusTokens: number;
    priceUSD: number;
  };
  /** User's current token balance */
  tokenBalance: number;
  /** Whether purchase is in progress */
  purchasing?: boolean;
  /** Error message to display */
  error?: string | null;
}

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

  // Determine prices and availability
  const priceTokens = item?.priceTokens ?? bundle?.priceTokens ?? 0;
  const priceUSD = item?.priceUSD ?? bundle?.priceUSD ?? tokenPack?.priceUSD;
  const canAffordTokens = tokenBalance >= priceTokens;
  const hasIAPOption = !!priceUSD;

  // Auto-select payment method based on availability
  React.useEffect(() => {
    if (!canAffordTokens && hasIAPOption) {
      setPaymentMethod("iap");
    } else if (!hasIAPOption) {
      setPaymentMethod("tokens");
    }
  }, [canAffordTokens, hasIAPOption]);

  // Get item details for display
  const itemName = item?.name ?? bundle?.name ?? "Token Pack";
  const itemDescription =
    item?.description ?? bundle?.description ?? "Get more tokens!";
  const itemImage = item?.imagePath ?? bundle?.imagePath ?? "🪙";
  const itemRarity = item?.rarity ?? bundle?.rarity ?? "common";
  const rarityColor = RARITY_COLORS[itemRarity] || "#9E9E9E";

  // Gradient colors based on rarity
  const gradientColors: readonly [string, string, ...string[]] = [
    rarityColor + "40",
    rarityColor + "10",
  ];

  const renderItemPreview = () => (
    <LinearGradient
      colors={gradientColors}
      style={styles.previewContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text style={styles.previewEmoji}>{itemImage}</Text>
      <Text style={[styles.itemName, { color: theme.colors.onSurface }]}>
        {itemName}
      </Text>
      {itemDescription && (
        <Text
          style={[
            styles.itemDescription,
            { color: theme.colors.onSurfaceVariant },
          ]}
          numberOfLines={2}
        >
          {itemDescription}
        </Text>
      )}

      {/* Bundle items preview */}
      {bundle && (
        <View style={styles.bundleItems}>
          <Text
            style={[
              styles.bundleItemsLabel,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Includes {bundle.items.length} items
          </Text>
          <View style={styles.bundleItemsRow}>
            {bundle.items.slice(0, 4).map((bundleItem) => (
              <View
                key={bundleItem.cosmeticId}
                style={[
                  styles.bundleItemBubble,
                  {
                    backgroundColor:
                      RARITY_COLORS[bundleItem.rarity] + "30" || "#9E9E9E30",
                  },
                ]}
              >
                <Text style={styles.bundleItemEmoji}>
                  {bundleItem.imagePath}
                </Text>
              </View>
            ))}
            {bundle.items.length > 4 && (
              <Text
                style={[
                  styles.moreItems,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                +{bundle.items.length - 4} more
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Token pack display */}
      {tokenPack && (
        <View style={styles.tokenPackInfo}>
          <Text style={styles.tokenAmount}>
            {tokenPack.tokens.toLocaleString()} 🪙
          </Text>
          {tokenPack.bonusTokens > 0 && (
            <Text style={[styles.bonusTokens, { color: "#4CAF50" }]}>
              +{tokenPack.bonusTokens.toLocaleString()} Bonus!
            </Text>
          )}
        </View>
      )}
    </LinearGradient>
  );

  const renderPriceSection = () => (
    <View style={styles.priceSection}>
      <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Price
      </Text>

      {/* Original price (if discounted) */}
      {bundle && bundle.discountPercent > 0 && (
        <View style={styles.originalPriceRow}>
          <Text
            style={[
              styles.originalPrice,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Original: {bundle.originalPriceTokens.toLocaleString()} 🪙
          </Text>
          <View style={[styles.savingsBadge, { backgroundColor: "#4CAF50" }]}>
            <Text style={styles.savingsText}>
              Save {bundle.discountPercent}%
            </Text>
          </View>
        </View>
      )}

      {/* Current price */}
      {priceTokens > 0 && (
        <View style={styles.priceRow}>
          <Text style={[styles.priceValue, { color: rarityColor }]}>
            {priceTokens.toLocaleString()} 🪙
          </Text>
          {!canAffordTokens && (
            <Text
              style={[styles.insufficientFunds, { color: theme.colors.error }]}
            >
              (Need {(priceTokens - tokenBalance).toLocaleString()} more)
            </Text>
          )}
        </View>
      )}

      {/* USD price option */}
      {priceUSD && (
        <Text
          style={[styles.usdPrice, { color: theme.colors.onSurfaceVariant }]}
        >
          or ${priceUSD.toFixed(2)} USD
        </Text>
      )}
    </View>
  );

  const renderPaymentOptions = () => {
    // Only show options if both are available
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
          {/* Tokens option */}
          <View
            style={[
              styles.paymentOption,
              paymentMethod === "tokens" && {
                backgroundColor: theme.colors.primaryContainer,
              },
              !canAffordTokens && { opacity: 0.5 },
            ]}
          >
            <RadioButton.Android
              value="tokens"
              disabled={!canAffordTokens}
              color={theme.colors.primary}
            />
            <View style={styles.paymentOptionContent}>
              <Text
                style={[
                  styles.paymentOptionTitle,
                  { color: theme.colors.onSurface },
                ]}
              >
                Pay with Tokens
              </Text>
              <Text
                style={[
                  styles.paymentOptionSubtitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Balance: {tokenBalance.toLocaleString()} 🪙
              </Text>
            </View>
            {!canAffordTokens && (
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={20}
                color={theme.colors.error}
              />
            )}
          </View>

          {/* Real money option */}
          <View
            style={[
              styles.paymentOption,
              paymentMethod === "iap" && {
                backgroundColor: theme.colors.primaryContainer,
              },
            ]}
          >
            <RadioButton.Android value="iap" color={theme.colors.primary} />
            <View style={styles.paymentOptionContent}>
              <Text
                style={[
                  styles.paymentOptionTitle,
                  { color: theme.colors.onSurface },
                ]}
              >
                Pay ${priceUSD?.toFixed(2)}
              </Text>
              <Text
                style={[
                  styles.paymentOptionSubtitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Credit card / App Store
              </Text>
            </View>
          </View>
        </RadioButton.Group>
      </View>
    );
  };

  const renderError = () => {
    if (!error) return null;

    return (
      <View
        style={[
          styles.errorContainer,
          { backgroundColor: theme.colors.errorContainer },
        ]}
      >
        <MaterialCommunityIcons
          name="alert-circle"
          size={20}
          color={theme.colors.error}
        />
        <Text
          style={[styles.errorText, { color: theme.colors.onErrorContainer }]}
        >
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
        contentContainerStyle={[
          styles.modal,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              Confirm Purchase
            </Text>
            <Pressable onPress={onDismiss} style={styles.closeButton}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={theme.colors.onSurfaceVariant}
              />
            </Pressable>
          </View>

          <Divider />

          {/* Item Preview */}
          {renderItemPreview()}

          {/* Price Section */}
          {renderPriceSection()}

          <Divider style={styles.divider} />

          {/* Payment Options */}
          {renderPaymentOptions()}

          {/* Error */}
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
            >
              {purchasing
                ? "Processing..."
                : paymentMethod === "tokens"
                  ? `Pay ${priceTokens.toLocaleString()} 🪙`
                  : `Pay $${priceUSD?.toFixed(2)}`}
            </Button>
          </View>

          {/* Disclaimer */}
          <Text
            style={[
              styles.disclaimer,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {paymentMethod === "iap"
              ? "Payment will be processed through your app store account."
              : "Tokens will be deducted from your balance immediately."}
          </Text>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    borderRadius: 16,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  closeButton: {
    padding: 4,
  },
  previewContainer: {
    padding: 24,
    alignItems: "center",
  },
  previewEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  itemName: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  itemDescription: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
  },
  bundleItems: {
    marginTop: 16,
    alignItems: "center",
  },
  bundleItemsLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  bundleItemsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bundleItemBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  bundleItemEmoji: {
    fontSize: 18,
  },
  moreItems: {
    fontSize: 12,
  },
  tokenPackInfo: {
    marginTop: 16,
    alignItems: "center",
  },
  tokenAmount: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFD700",
  },
  bonusTokens: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  priceSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
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
    paddingVertical: 2,
    borderRadius: 8,
  },
  savingsText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
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
    marginVertical: 8,
  },
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
    fontSize: 16,
    fontWeight: "600",
  },
  paymentOptionSubtitle: {
    fontSize: 12,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
  },
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
  },
});

export const PurchaseConfirmationModal = memo(PurchaseConfirmationModalBase);
export default PurchaseConfirmationModal;
