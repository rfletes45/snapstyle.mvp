/**
 * PurchaseHistoryModal
 *
 * In-app modal showing the current user's purchase history, sourced
 * from `Users/{uid}/PurchaseHistory` via `subscribePurchaseHistory`.
 *
 * Includes loading, empty, and error states.
 *
 * @module components/shop/PurchaseHistoryModal
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  PurchaseRecord,
  subscribePurchaseHistory,
} from "@/services/shop/unifiedShop";
import { useAppTheme } from "@/store/ThemeContext";

export interface PurchaseHistoryModalProps {
  visible: boolean;
  uid: string | null;
  onClose: () => void;
}

function formatDate(ms: number): string {
  try {
    const d = new Date(ms);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function prettyType(type: string): string {
  switch (type) {
    case "decoration":
      return "Frame";
    case "background":
      return "Background";
    case "badge":
      return "Badge";
    case "theme":
      return "Theme";
    case "chat_bubble_color":
      return "Chat Bubble";
    case "chat_font":
      return "Chat Font";
    case "chat_animal_theme":
      return "Animal Theme";
    case "chat_font_color":
      return "Chat Font Color";
    default:
      return type ? type[0].toUpperCase() + type.slice(1) : "Item";
  }
}

export function PurchaseHistoryModal({
  visible,
  uid,
  onClose,
}: PurchaseHistoryModalProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [records, setRecords] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!visible || !uid) return;
    setLoading(true);
    setError(null);
    const unsubscribe = subscribePurchaseHistory(
      uid,
      (items) => {
        setRecords(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setLoading(false);
        setError(err?.message || "Could not load purchase history.");
      },
    );
    return unsubscribe;
  }, [visible, uid, reloadKey]);

  const handleRetry = () => setReloadKey((k) => k + 1);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons
                name="history"
                size={22}
                color={colors.text}
              />
              <Text style={[styles.title, { color: colors.text }]}>
                Purchase History
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Close purchase history"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          {/* Body */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.dim, { color: colors.textSecondary }]}>
                Loading purchases...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={36}
                color={colors.error ?? "#ff4444"}
              />
              <Text style={[styles.dim, { color: colors.textSecondary }]}>
                {error}
              </Text>
              <Pressable
                onPress={handleRetry}
                style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Retry"
              >
                <Text
                  style={[
                    styles.retryText,
                    { color: colors.onPrimary ?? "#fff" },
                  ]}
                >
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : records.length === 0 ? (
            <View style={styles.center}>
              <MaterialCommunityIcons
                name="cart-outline"
                size={42}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No purchases yet
              </Text>
              <Text style={[styles.dim, { color: colors.textSecondary }]}>
                Items you buy in the Shop will show up here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={records}
              keyExtractor={(r) => r.id}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => (
                <View
                  style={[styles.sep, { backgroundColor: colors.border }]}
                />
              )}
              renderItem={({ item }) => (
                <View style={styles.recordRow}>
                  <View
                    style={[
                      styles.recordIcon,
                      { backgroundColor: colors.surfaceVariant },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.recordMid}>
                    <Text
                      style={[styles.recordName, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.itemName}
                    </Text>
                    <Text
                      style={[
                        styles.recordMeta,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {prettyType(item.itemType)} ·{" "}
                      {formatDate(item.purchasedAt)}
                    </Text>
                  </View>
                  <View style={styles.recordRight}>
                    <View style={styles.priceRow}>
                      <MaterialCommunityIcons
                        name="star-circle"
                        size={14}
                        color="#FFD700"
                      />
                      <Text
                        style={[styles.recordPrice, { color: colors.text }]}
                      >
                        {item.priceTokens.toLocaleString()}
                      </Text>
                    </View>
                    <Text
                      style={[styles.statusLabel, { color: colors.primary }]}
                    >
                      Completed
                    </Text>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    height: "85%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 17, fontWeight: "700" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  dim: { fontSize: 13, textAlign: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { fontSize: 14, fontWeight: "700" },
  listContent: { paddingVertical: 8 },
  sep: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  recordIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  recordMid: { flex: 1, gap: 2 },
  recordName: { fontSize: 14, fontWeight: "600" },
  recordMeta: { fontSize: 12 },
  recordRight: { alignItems: "flex-end", gap: 2 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  recordPrice: { fontSize: 14, fontWeight: "700" },
  statusLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
});
