/**
 * PurchaseConfirmSheet
 *
 * Confirmation modal shown before completing a token purchase.
 * Shows item preview, price, current balance, and projected balance.
 *
 * @module components/shop/PurchaseConfirmSheet
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getCosmeticAsset } from "@/cosmetics/assetRegistry";
import type { CosmeticDefinition } from "@/cosmetics/types";
import { useAppTheme } from "@/store/ThemeContext";

export interface PurchaseConfirmSheetProps {
  visible: boolean;
  item: CosmeticDefinition | null;
  balance: number;
  loading: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PurchaseConfirmSheet({
  visible,
  item,
  balance,
  loading,
  errorMessage,
  onConfirm,
  onCancel,
}: PurchaseConfirmSheetProps) {
  const { colors } = useAppTheme();

  if (!item) return null;

  const price = item.priceTokens ?? 0;
  const after = balance - price;
  const canAfford = after >= 0;
  const asset = getCosmeticAsset(item.type, item.assetKey ?? item.id);
  const swatchColor =
    typeof item.metadata?.bubbleColorValue === "string"
      ? (item.metadata.bubbleColorValue as string)
      : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        style={styles.backdrop}
        onPress={loading ? undefined : onCancel}
      >
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => {
            /* swallow */
          }}
        >
          <View style={styles.handleRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              Confirm Purchase
            </Text>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              hitSlop={10}
              accessibilityLabel="Close"
            >
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          {/* Preview */}
          <View
            style={[
              styles.previewWrap,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            {swatchColor ? (
              <View style={[styles.swatch, { backgroundColor: swatchColor }]} />
            ) : asset ? (
              <Image source={asset} style={styles.preview} resizeMode="cover" />
            ) : (
              <MaterialCommunityIcons
                name="image-outline"
                size={36}
                color={colors.textMuted}
              />
            )}
          </View>

          {/* Item info */}
          <Text
            style={[styles.itemName, { color: colors.text }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          {item.description ? (
            <Text
              style={[styles.itemDesc, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          ) : null}

          {/* Balance breakdown */}
          <View
            style={[
              styles.breakdown,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <Row
              label="Item price"
              value={`-${price.toLocaleString()}`}
              colors={colors}
              valueColor={colors.text}
              icon
            />
            <Row
              label="Current balance"
              value={balance.toLocaleString()}
              colors={colors}
              valueColor={colors.textSecondary}
              icon
            />
            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />
            <Row
              label="Balance after"
              value={Math.max(0, after).toLocaleString()}
              colors={colors}
              valueColor={canAfford ? colors.text : (colors.error ?? "#ff4444")}
              icon
              bold
            />
          </View>

          {/* Error */}
          {errorMessage ? (
            <Text style={[styles.error, { color: colors.error ?? "#ff4444" }]}>
              {errorMessage}
            </Text>
          ) : null}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={[
                styles.btn,
                styles.btnSecondary,
                { borderColor: colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cancel purchase"
            >
              <Text style={[styles.btnText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading || !canAfford}
              style={[
                styles.btn,
                styles.btnPrimary,
                {
                  backgroundColor:
                    !canAfford || loading
                      ? colors.surfaceVariant
                      : colors.primary,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                canAfford ? "Confirm purchase" : "Not enough tokens"
              }
            >
              {loading ? (
                <ActivityIndicator
                  color={colors.onPrimary ?? "#fff"}
                  size="small"
                />
              ) : (
                <Text
                  style={[
                    styles.btnText,
                    {
                      color: canAfford
                        ? (colors.onPrimary ?? "#fff")
                        : colors.textMuted,
                    },
                  ]}
                >
                  {canAfford ? "Confirm" : "Not enough tokens"}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({
  label,
  value,
  colors,
  valueColor,
  icon,
  bold,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
  valueColor: string;
  icon?: boolean;
  bold?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <View style={styles.rowValue}>
        {icon ? (
          <MaterialCommunityIcons
            name="star-circle"
            size={14}
            color="#FFD700"
          />
        ) : null}
        <Text
          style={[
            styles.rowText,
            { color: valueColor, fontWeight: bold ? "700" : "600" },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  sheet: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 12,
  },
  handleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  previewWrap: {
    aspectRatio: 1.2,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    maxHeight: 180,
  },
  preview: { width: "100%", height: "100%" },
  swatch: { width: "60%", height: "60%", borderRadius: 12 },
  itemName: { fontSize: 18, fontWeight: "700" },
  itemDesc: { fontSize: 13, lineHeight: 18 },
  breakdown: {
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLabel: { fontSize: 13 },
  rowValue: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowText: { fontSize: 14 },
  divider: { height: StyleSheet.hairlineWidth },
  error: { fontSize: 13, textAlign: "center" },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: {},
  btnSecondary: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnText: { fontSize: 15, fontWeight: "700" },
});
