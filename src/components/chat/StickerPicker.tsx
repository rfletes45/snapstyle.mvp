/**
 * StickerPicker — Full-featured sticker picker powered by KLIPY.
 *
 * Opens in a DraggableBottomSheet (consistent with GifPicker / FullEmojiPicker).
 * Supports keyboard-replacement mode: when `keyboardHeight` is provided,
 * the sheet opens to a keyboard-equivalent initial height and expands
 * to full height when the search field is focused.
 *
 * Features:
 * - Trending stickers on open
 * - Debounced search with "Search Stickers" placeholder
 * - 3-column uniform grid (stickers are typically square)
 * - Page-based pagination (infinite scroll)
 * - Loading skeletons, empty states, error/retry states
 * - "Powered by KLIPY" attribution line
 * - Dark/light theme support
 * - Accessibility labels
 *
 * @module components/chat/StickerPicker
 */

import {
  fetchTrendingStickers,
  searchStickers,
} from "@/services/sticker/stickerService";
import type { StickerItem } from "@/services/sticker/types";
import { useAppTheme } from "@/store/ThemeContext";
import { createLogger } from "@/utils/log";
import * as Haptics from "expo-haptics";
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DraggableBottomSheet,
  type DraggableBottomSheetHandle,
} from "./DraggableBottomSheet";
import { getKeyboardReplacementSnapFraction } from "./bottomSheetLayout";

const log = createLogger("StickerPicker");

// =============================================================================
// Types
// =============================================================================

export interface StickerPickerProps {
  /** Whether the picker is visible */
  open: boolean;
  /** Called when the picker should close */
  onClose: () => void;
  /** Called when a sticker is selected */
  onStickerSelected: (sticker: StickerItem) => void;
  /** When provided, the sheet opens to this height first (keyboard replacement). */
  keyboardHeight?: number;
  /** Shared Reanimated value for composer offset coordination. */
  sharedTranslateY?: SharedValue<number>;
}

// =============================================================================
// Layout Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: STICKER_SCREEN_HEIGHT } =
  Dimensions.get("window");
/** Expanded snap fraction (85% of screen) */
const STICKER_EXPANDED_SNAP = 0.85;
/** Fallback small snap when no keyboard height is known */
const STICKER_FALLBACK_SMALL_SNAP = 0.45;
const GRID_PADDING = 8;
const GRID_GAP = 6;
const NUM_COLUMNS = 3;
const COLUMN_WIDTH =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) /
  NUM_COLUMNS;
const DEBOUNCE_MS = 400;
const PAGE_SIZE = 30;
const SKELETON_COUNT = 9;

// =============================================================================
// Debounce Hook
// =============================================================================

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value === "") {
      setDebounced("");
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// =============================================================================
// Skeleton Placeholder (memo'd for performance)
// =============================================================================

const SkeletonCell = memo(function SkeletonCell({
  backgroundColor,
}: {
  backgroundColor: string;
}) {
  return (
    <View
      style={[
        styles.skeletonCell,
        { width: COLUMN_WIDTH, height: COLUMN_WIDTH, backgroundColor },
      ]}
    />
  );
});

// =============================================================================
// Sticker Grid Cell
// =============================================================================

const StickerCell = memo(function StickerCell({
  sticker,
  onPress,
}: {
  sticker: StickerItem;
  onPress: (sticker: StickerItem) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(sticker)}
      style={({ pressed }) => [
        styles.stickerCell,
        { width: COLUMN_WIDTH, height: COLUMN_WIDTH },
        pressed && styles.stickerCellPressed,
      ]}
      accessibilityLabel={sticker.title || "Sticker"}
      accessibilityRole="button"
      accessibilityHint="Double tap to send this sticker"
    >
      <Image
        source={{ uri: sticker.previewUrl }}
        style={styles.stickerImage}
        resizeMode="contain"
      />
    </Pressable>
  );
});

// =============================================================================
// Main Component
// =============================================================================

export const StickerPicker = forwardRef<
  DraggableBottomSheetHandle,
  StickerPickerProps
>(function StickerPicker(
  { open, onClose, onStickerSelected, keyboardHeight, sharedTranslateY },
  ref,
) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<DraggableBottomSheetHandle>(null);

  // Forward imperative handle
  useImperativeHandle(ref, () => ({
    snapToIndex: (index: number) => sheetRef.current?.snapToIndex(index),
  }));

  // ── Snap points — keyboard-equivalent initial, expanded secondary ───────
  const snapPoints = useMemo(() => {
    if (keyboardHeight && keyboardHeight > 0) {
      const kbFraction = getKeyboardReplacementSnapFraction(
        keyboardHeight,
        STICKER_SCREEN_HEIGHT,
        STICKER_EXPANDED_SNAP,
      );
      return [kbFraction, STICKER_EXPANDED_SNAP];
    }
    return [STICKER_FALLBACK_SMALL_SNAP, STICKER_EXPANDED_SNAP];
  }, [keyboardHeight]);

  const initialSnapIndex = keyboardHeight ? 0 : 1;

  // ── Search focus handler — auto-expand sheet ─────────────────────────────
  const handleSearchFocus = useCallback(() => {
    sheetRef.current?.snapToIndex(1);
  }, []);

  // ── Theme color aliases ──────────────────────────────────────────────────
  const surfaceVariantColor = colors.inputBackground ?? colors.surfaceVariant;
  const onSurfaceColor = colors.text;
  const onSurfaceVariantColor = colors.textSecondary;
  const outlineColor = colors.outline;
  const sheetSurface = colors.keyboardSurface ?? colors.surface;

  // ── State ──────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPage, setNextPage] = useState<number | undefined>();

  const debouncedQuery = useDebouncedValue(searchQuery, DEBOUNCE_MS);
  const abortRef = useRef<AbortController | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const hasLoadedRef = useRef(false);

  // ── Fetch trending on open ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    // Only load trending if we haven't already or stickers are empty
    if (hasLoadedRef.current && stickers.length > 0 && !searchQuery) return;

    let cancelled = false;

    async function loadTrending() {
      setLoading(true);
      setError(null);
      try {
        const page = await fetchTrendingStickers({ limit: PAGE_SIZE });
        if (!cancelled) {
          setStickers(page.items);
          setNextPage(page.nextPage);
          hasLoadedRef.current = true;
        }
      } catch (err) {
        if (!cancelled) {
          log.warn("Failed to load trending", { error: String(err) });
          setError("Failed to load trending stickers");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!searchQuery) {
      loadTrending();
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Search when debounced query changes ────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    // Empty query → reload trending
    if (!debouncedQuery.trim()) {
      if (hasLoadedRef.current) {
        fetchTrendingStickers({ limit: PAGE_SIZE })
          .then((page) => {
            setStickers(page.items);
            setNextPage(page.nextPage);
          })
          .catch(() => {});
      }
      return;
    }

    // Cancel previous search
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    async function executeSearch() {
      setLoading(true);
      setError(null);

      try {
        const page = await searchStickers({
          query: debouncedQuery.trim(),
          limit: PAGE_SIZE,
        });
        if (!cancelled) {
          setStickers(page.items);
          setNextPage(page.nextPage);
          flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        }
      } catch (err) {
        if (!cancelled && !controller.signal.aborted) {
          log.warn("Search failed", {
            query: debouncedQuery,
            error: String(err),
          });
          setError("Search failed. Tap to retry.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    executeSearch();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedQuery, open]);

  // ── Load more (pagination) ─────────────────────────────────────────────────
  const handleLoadMore = useCallback(() => {
    if (loadingMore || loading || !nextPage) return;

    setLoadingMore(true);

    const fetchFn = debouncedQuery.trim()
      ? searchStickers({
          query: debouncedQuery.trim(),
          limit: PAGE_SIZE,
          page: nextPage,
        })
      : fetchTrendingStickers({ limit: PAGE_SIZE, page: nextPage });

    fetchFn
      .then((page) => {
        setStickers((prev) => [...prev, ...page.items]);
        setNextPage(page.nextPage);
      })
      .catch((err) => {
        log.warn("Load more failed", { error: String(err) });
      })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, loading, nextPage, debouncedQuery]);

  // ── Sticker selection ──────────────────────────────────────────────────────
  const handleStickerPress = useCallback(
    (sticker: StickerItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onStickerSelected(sticker);
      onClose();
    },
    [onStickerSelected, onClose],
  );

  // ── Close and reset ────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setSearchQuery("");
    setError(null);

    onClose();
  }, [onClose]);

  // ── Retry on error ─────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setError(null);
    if (debouncedQuery.trim()) {
      searchStickers({ query: debouncedQuery.trim(), limit: PAGE_SIZE })
        .then((page) => {
          setStickers(page.items);
          setNextPage(page.nextPage);
        })
        .catch((err) => setError(String(err)));
    } else {
      setLoading(true);
      fetchTrendingStickers({ limit: PAGE_SIZE })
        .then((page) => {
          setStickers(page.items);
          setNextPage(page.nextPage);
        })
        .catch((err) => setError(String(err)))
        .finally(() => setLoading(false));
    }
  }, [debouncedQuery]);

  // ── Skeleton data ──────────────────────────────────────────────────────────
  const skeletonItems = useMemo(
    () => Array.from({ length: SKELETON_COUNT }, (_, i) => i),
    [],
  );

  if (!open) return null;

  return (
    <DraggableBottomSheet
      ref={sheetRef}
      open={open}
      onClose={handleClose}
      snapPoints={snapPoints}
      initialSnapIndex={initialSnapIndex}
      sharedTranslateY={sharedTranslateY}
      surfaceColor={sheetSurface}
      handleColor={colors.divider}
      dragGestureArea="handle"
    >
      {/* Search bar */}
      <View
        style={[
          styles.searchContainer,
          { backgroundColor: surfaceVariantColor },
        ]}
      >
        <Text
          style={{
            color: onSurfaceVariantColor,
            fontSize: 16,
            marginRight: 8,
          }}
        >
          🔍
        </Text>
        <TextInput
          style={[styles.searchInput, { color: onSurfaceColor }]}
          placeholder="Search Stickers"
          placeholderTextColor={onSurfaceVariantColor}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={handleSearchFocus}
          autoCapitalize="none"
          autoCorrect
          spellCheck={false}
          autoComplete="off"
          returnKeyType="search"
          keyboardAppearance={isDark ? "dark" : "light"}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          accessibilityLabel="Search for stickers"
        />
        {searchQuery ? (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            accessibilityLabel="Clear search"
            accessibilityRole="button"
          >
            <Text style={{ color: onSurfaceVariantColor, fontSize: 16 }}>
              ✕
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.sheetBody}>
        <View style={styles.scrollRegion}>
          {/* Content area */}
          {loading && stickers.length === 0 ? (
            /* Loading skeleton — 3-column uniform grid */
            <View style={styles.gridContainer}>
              {skeletonItems.map((i) => (
                <SkeletonCell
                  key={`sk-${i}`}
                  backgroundColor={surfaceVariantColor}
                />
              ))}
            </View>
          ) : error ? (
            /* Error state */
            <View style={styles.stateContainer}>
              <Text style={{ color: onSurfaceVariantColor, fontSize: 16 }}>
                ⚠️
              </Text>
              <Text
                style={[styles.stateText, { color: onSurfaceVariantColor }]}
              >
                {error}
              </Text>
              <TouchableOpacity
                onPress={handleRetry}
                style={[styles.retryButton, { borderColor: outlineColor }]}
                accessibilityLabel="Retry loading stickers"
                accessibilityRole="button"
              >
                <Text style={{ color: onSurfaceColor }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : stickers.length === 0 && debouncedQuery.trim() ? (
            /* Empty search results */
            <View style={styles.stateContainer}>
              <Text style={{ fontSize: 40 }}>🤷</Text>
              <Text
                style={[styles.stateText, { color: onSurfaceVariantColor }]}
              >
                No stickers found for &quot;{debouncedQuery}&quot;
              </Text>
            </View>
          ) : (
            /* 3-column grid */
            <FlatList
              ref={flatListRef}
              data={stickers}
              keyExtractor={(item) => item.id}
              numColumns={NUM_COLUMNS}
              style={styles.flexFill}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              contentContainerStyle={styles.flatListContent}
              columnWrapperStyle={styles.columnWrapper}
              renderItem={({ item }) => (
                <StickerCell sticker={item} onPress={handleStickerPress} />
              )}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.loadingMore}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </View>

      {/* Attribution footer — "Powered by KLIPY" */}
      <View
        style={[
          styles.attributionBar,
          {
            backgroundColor: sheetSurface,
            borderTopColor: colors.divider,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Text
          style={[styles.attributionText, { color: onSurfaceVariantColor }]}
        >
          Powered by KLIPY
        </Text>
      </View>
    </DraggableBottomSheet>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: GRID_PADDING,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "android" ? 6 : 10,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  sheetBody: {
    flex: 1,
    minHeight: 0,
  },
  scrollRegion: {
    flex: 1,
    minHeight: 0,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    paddingHorizontal: GRID_PADDING,
    flex: 1,
  },
  flexFill: {
    flex: 1,
    minHeight: 0,
  },
  flatListContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 8,
  },
  columnWrapper: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  stickerCell: {
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  stickerCellPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  stickerImage: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
  },
  skeletonCell: {
    borderRadius: 8,
    opacity: 0.3,
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  stateText: {
    fontSize: 15,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: "center",
  },
  attributionBar: {
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attributionText: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
});

export default StickerPicker;
