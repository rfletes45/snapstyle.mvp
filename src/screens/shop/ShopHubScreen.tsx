/**
 * ShopHubScreen — Unified Daily Shop
 *
 * Single token-only Shop screen, restructured as a "Daily Shop":
 *   - Existing app-level Shop header is preserved (title + wallet pill).
 *   - Below the header, a "Daily Shop" section header with a live
 *     reset-countdown timer on the far side.
 *   - Beneath that, one subheader per decoration category, each showing
 *     exactly two deterministically-selected items for the current day.
 *   - "View Purchase History" button opens the existing modal.
 *
 * Inventory and equip behavior are unchanged: owned items deep-link to
 * the existing Customization screen, purchases call the atomic Cloud
 * Function `purchaseCosmeticWithTokens` via the unified shop service.
 *
 * @module screens/shop/ShopHubScreen
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { PurchaseConfirmSheet } from "@/components/shop/PurchaseConfirmSheet";
import { PurchaseHistoryModal } from "@/components/shop/PurchaseHistoryModal";
import {
  ItemActionState,
  UnifiedShopItemCard,
} from "@/components/shop/UnifiedShopItemCard";
import { getShopCosmetics } from "@/cosmetics/catalog";
import type { CosmeticDefinition, Entitlement } from "@/cosmetics/types";
import { subscribeToWallet } from "@/services/economy";
import { subscribeEntitlements } from "@/services/entitlements";
import {
  DAILY_SHOP_CATEGORIES,
  DAILY_SHOP_ITEMS_PER_CATEGORY,
  formatDailyShopCountdown,
  getDailyShopResetTime,
  getDailyShopSeed,
  groupShopItemsByDecorationCategory,
  selectDailyItemsForCategory,
} from "@/services/shop/dailyShop";
import {
  purchaseShopItem,
  UnifiedPurchaseResult,
} from "@/services/shop/unifiedShop";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { Wallet } from "@/types/models";
import { createLogger } from "@/utils/log";

const logger = createLogger("screens/shop/ShopHubScreen");

const NUM_COLUMNS = DAILY_SHOP_ITEMS_PER_CATEGORY;

// =============================================================================
// Countdown hook — isolated so item selection doesn't recompute every tick.
// =============================================================================

function useDailyShopCountdown(): {
  remainingMs: number;
  seed: string;
  resetAt: number;
} {
  // Snapshot once per "day". When the timer crosses the reset boundary we bump
  // the seed which causes downstream selection to recompute. The label itself
  // updates via remainingMs.
  const [resetAt, setResetAt] = useState<number>(() =>
    getDailyShopResetTime(new Date()),
  );
  const [seed, setSeed] = useState<string>(() => getDailyShopSeed(new Date()));
  const [remainingMs, setRemainingMs] = useState<number>(() =>
    Math.max(0, resetAt - Date.now()),
  );

  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function update() {
      const now = Date.now();
      const ms = resetAt - now;
      if (ms <= 0) {
        // Crossed boundary — recompute reset + seed and refresh remaining.
        const nextReset = getDailyShopResetTime(new Date());
        const nextSeed = getDailyShopSeed(new Date());
        setResetAt(nextReset);
        setSeed(nextSeed);
        setRemainingMs(Math.max(0, nextReset - Date.now()));
      } else {
        setRemainingMs(ms);
      }
    }
    update();
    tick.current = setInterval(update, 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
      tick.current = null;
    };
  }, [resetAt]);

  return { remainingMs, seed, resetAt };
}

// =============================================================================
// Component
// =============================================================================

export default function ShopHubScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid ?? null;

  // Wallet
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState(false);

  // Entitlements (ownership)
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());

  // UI state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState<CosmeticDefinition | null>(
    null,
  );
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Daily reset / countdown
  const { remainingMs, seed } = useDailyShopCountdown();
  const countdownLabel = useMemo(
    () => formatDailyShopCountdown(remainingMs),
    [remainingMs],
  );

  // Wallet subscription
  useEffect(() => {
    if (!uid) return;
    setWalletLoading(true);
    setWalletError(false);
    const unsub = subscribeToWallet(
      uid,
      (w) => {
        setWallet(w);
        setWalletLoading(false);
        setWalletError(false);
      },
      (err) => {
        logger.error("Wallet error:", err);
        setWalletLoading(false);
        setWalletError(true);
      },
    );
    return unsub;
  }, [uid]);

  // Entitlements subscription
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeEntitlements(
      uid,
      (ents: Entitlement[]) => {
        setOwnedIds(new Set(ents.map((e) => e.cosmeticId)));
      },
      (err) => logger.error("Entitlements error:", err),
    );
    return unsub;
  }, [uid]);

  // Catalog (token-priced shop items only).
  const catalog = useMemo<CosmeticDefinition[]>(() => {
    try {
      return getShopCosmetics().filter(
        (i) => typeof i.priceTokens === "number" && (i.priceTokens ?? 0) > 0,
      );
    } catch (err) {
      logger.error("Failed to load catalog:", err);
      return [];
    }
  }, []);

  // Group catalog into Daily Shop categories. Re-runs only when catalog changes.
  const grouped = useMemo(
    () => groupShopItemsByDecorationCategory(catalog),
    [catalog],
  );

  // Per-category daily selection. Recomputes only when the daily seed
  // (or the catalog) changes — NOT on every countdown tick.
  const dailySections = useMemo(() => {
    return DAILY_SHOP_CATEGORIES.map((cat) => {
      const pool = grouped[cat.id] ?? [];
      const picks = selectDailyItemsForCategory(
        pool,
        cat.id,
        seed,
        DAILY_SHOP_ITEMS_PER_CATEGORY,
      );
      return { category: cat, items: picks };
    }).filter((s) => s.items.length === DAILY_SHOP_ITEMS_PER_CATEGORY);
    // Categories that cannot supply exactly two items are hidden.
  }, [grouped, seed]);

  const balance = wallet?.tokensBalance ?? 0;

  const itemState = useCallback(
    (item: CosmeticDefinition): ItemActionState => {
      if (ownedIds.has(item.id)) return "owned";
      const price = item.priceTokens ?? 0;
      if (balance < price) return "insufficient";
      return "buy";
    },
    [ownedIds, balance],
  );

  const handleItemPress = useCallback(
    (item: CosmeticDefinition) => {
      if (ownedIds.has(item.id)) {
        Alert.alert(
          "Owned",
          "You already own this item. Equip it from the Customization screen.",
          [
            { text: "Close", style: "cancel" },
            {
              text: "Open Customization",
              onPress: () => {
                try {
                  navigation.navigate("Customization");
                } catch (err) {
                  logger.error("Nav to Customization failed:", err);
                }
              },
            },
          ],
        );
        return;
      }
      setPurchaseError(null);
      setPendingItem(item);
    },
    [navigation, ownedIds],
  );

  const handleConfirmPurchase = useCallback(async () => {
    if (!pendingItem || !uid) return;
    setPurchasing(true);
    setPurchaseError(null);
    try {
      const result: UnifiedPurchaseResult = await purchaseShopItem(
        pendingItem.id,
      );
      if (!result.success) {
        setPurchaseError(result.error || "Purchase failed.");
        setPurchasing(false);
        return;
      }
      setPurchasing(false);
      setPendingItem(null);
    } catch (err: any) {
      logger.error("Purchase exception:", err);
      setPurchaseError(err?.message || "Purchase failed.");
      setPurchasing(false);
    }
  }, [pendingItem, uid]);

  const handleCancelPurchase = useCallback(() => {
    if (purchasing) return;
    setPendingItem(null);
    setPurchaseError(null);
  }, [purchasing]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* App-level Shop header (preserved) */}
      <ScreenHeader
        title="Shop"
        renderRight={() => (
          <Pressable
            style={[
              styles.walletPill,
              { backgroundColor: "rgba(255, 215, 0, 0.15)" },
            ]}
            onPress={() => {
              try {
                navigation.navigate("Wallet");
              } catch {
                /* not in stack */
              }
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Token balance: ${balance.toLocaleString()}`}
          >
            <MaterialCommunityIcons
              name="star-circle"
              size={18}
              color="#FFD700"
            />
            <Text
              style={[
                styles.walletText,
                {
                  color: walletError
                    ? (colors.error ?? "#ff4444")
                    : colors.text,
                },
              ]}
            >
              {walletLoading
                ? "..."
                : walletError
                  ? "Error"
                  : balance.toLocaleString()}
            </Text>
          </Pressable>
        )}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Wallet summary card */}
        <View
          style={[
            styles.walletCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.walletCardLeft}>
            <Text
              style={[styles.walletCardLabel, { color: colors.textSecondary }]}
            >
              Your Tokens
            </Text>
            <View style={styles.walletCardBalance}>
              <MaterialCommunityIcons
                name="star-circle"
                size={22}
                color="#FFD700"
              />
              <Text style={[styles.walletCardValue, { color: colors.text }]}>
                {walletLoading ? "..." : balance.toLocaleString()}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              try {
                navigation.navigate("Wallet");
              } catch {
                /* not in stack */
              }
            }}
            style={[styles.walletCardCta, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Open wallet"
          >
            <Text
              style={[
                styles.walletCardCtaText,
                { color: colors.textSecondary },
              ]}
            >
              Wallet
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>

        {/* Daily Shop header */}
        <View style={styles.dailyHeader}>
          <Text
            style={[styles.dailyTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            Daily Shop
          </Text>
          <View
            style={[
              styles.dailyTimerPill,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            accessibilityLabel={`Daily Shop resets in ${countdownLabel}`}
          >
            <MaterialCommunityIcons
              name="timer-sand"
              size={14}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.dailyTimerText, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              Resets in {countdownLabel}
            </Text>
          </View>
        </View>

        {/* Empty state */}
        {dailySections.length === 0 ? (
          <View
            style={[
              styles.empty,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <MaterialCommunityIcons
              name="package-variant"
              size={36}
              color={colors.textMuted}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No items available right now. Check back after the next reset.
            </Text>
          </View>
        ) : null}

        {/* Daily Shop category sections */}
        {dailySections.map(({ category, items }) => (
          <View key={category.id} style={styles.categorySection}>
            <View style={styles.gridRow}>
              {items.map((item) => (
                <View key={item.id} style={styles.gridCell}>
                  <UnifiedShopItemCard
                    item={item}
                    state={itemState(item)}
                    colors={colors}
                    onPress={handleItemPress}
                  />
                </View>
              ))}
              {/* Pad if fewer than NUM_COLUMNS (defensive — selection guarantees 2). */}
              {items.length < NUM_COLUMNS
                ? Array.from({ length: NUM_COLUMNS - items.length }).map(
                    (_, i) => (
                      <View
                        key={`pad-${category.id}-${i}`}
                        style={styles.gridCell}
                      />
                    ),
                  )
                : null}
            </View>
          </View>
        ))}

        {/* Purchase history button (preserved) */}
        <Pressable
          onPress={() => setHistoryOpen(true)}
          style={({ pressed }) => [
            styles.historyBtn,
            {
              backgroundColor: pressed ? colors.surfaceVariant : colors.surface,
              borderColor: colors.border,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="View purchase history"
        >
          <MaterialCommunityIcons
            name="history"
            size={20}
            color={colors.textSecondary}
          />
          <Text
            style={[styles.historyBtnText, { color: colors.textSecondary }]}
          >
            View Purchase History
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={colors.textSecondary}
          />
        </Pressable>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          Daily Shop selections refresh every day at midnight (local time). Earn
          tokens through achievements and tasks.
        </Text>
      </ScrollView>

      <PurchaseConfirmSheet
        visible={!!pendingItem}
        item={pendingItem}
        balance={balance}
        loading={purchasing}
        errorMessage={purchaseError}
        onConfirm={handleConfirmPurchase}
        onCancel={handleCancelPurchase}
      />

      <PurchaseHistoryModal
        visible={historyOpen}
        uid={uid}
        onClose={() => setHistoryOpen(false)}
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },

  walletPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  walletText: { fontSize: 15, fontWeight: "700" },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 18 },

  walletCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  walletCardLeft: { gap: 4 },
  walletCardLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  walletCardBalance: { flexDirection: "row", alignItems: "center", gap: 8 },
  walletCardValue: { fontSize: 26, fontWeight: "800" },
  walletCardCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  walletCardCtaText: { fontSize: 13, fontWeight: "600" },

  // --- Daily Shop header ---
  dailyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  dailyTitle: {
    fontSize: 22,
    fontWeight: "800",
    flexShrink: 1,
  },
  dailyTimerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
    maxWidth: "55%",
  },
  dailyTimerText: { fontSize: 12, fontWeight: "600" },

  // --- Category sections ---
  categorySection: { gap: 10 },
  categoryTitle: {
    fontSize: 15,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  gridRow: { flexDirection: "row", gap: 12 },
  gridCell: { flex: 1 },

  empty: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 36,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: { fontSize: 13, textAlign: "center" },

  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  historyBtnText: { flex: 1, fontSize: 14, fontWeight: "600" },

  footer: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 8,
  },
});
