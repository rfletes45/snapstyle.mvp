/**
 * GifStickerPicker — Combined GIF + Sticker picker with tab switcher.
 *
 * Opens in a single DraggableBottomSheet with a polished segmented tab bar
 * at the top, allowing the user to switch between GIFs and Stickers.
 *
 * Each tab maintains independent state (search text, scroll position,
 * loading, pagination). Switching tabs preserves per-tab state within
 * the modal session; closing the modal resets everything.
 *
 * Reuses the same KLIPY service functions, grid layouts, and send
 * flows as the standalone GifPicker and StickerPicker.
 *
 * @module components/chat/GifStickerPicker
 */

import {
  fetchTrending,
  getAutocomplete,
  getCategories,
  searchGifs,
} from "@/services/gif/gifService";
import type { GifItem } from "@/services/gif/types";
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
import { CategoryGrid, type CategoryTile } from "./CategoryGrid";
import {
  DraggableBottomSheet,
  type DraggableBottomSheetHandle,
} from "./DraggableBottomSheet";

const log = createLogger("GifStickerPicker");

// =============================================================================
// Types
// =============================================================================

export type GifStickerTab = "gifs" | "stickers";

export interface GifStickerPickerProps {
  /** Whether the picker is visible */
  open: boolean;
  /** Called when the picker should close */
  onClose: () => void;
  /** Called when a GIF is selected */
  onGifSelected: (gif: GifItem) => void;
  /** Called when a sticker is selected */
  onStickerSelected: (sticker: StickerItem) => void;
  /** When provided, the sheet opens to this height first (keyboard replacement). */
  keyboardHeight?: number;
  /** Shared Reanimated value for composer offset coordination. */
  sharedTranslateY?: SharedValue<number>;
  /** Initial tab to show (defaults to "gifs"). */
  initialTab?: GifStickerTab;
}

// =============================================================================
// Layout Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const EXPANDED_SNAP = 0.85;
const FALLBACK_SMALL_SNAP = 0.45;
const GRID_PADDING = 8;
const GIF_GRID_GAP = 4;
const STICKER_GRID_GAP = 6;
const GIF_NUM_COLUMNS = 2;
const STICKER_NUM_COLUMNS = 3;
const GIF_COLUMN_WIDTH =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GIF_GRID_GAP * (GIF_NUM_COLUMNS - 1)) /
  GIF_NUM_COLUMNS;
const STICKER_COLUMN_WIDTH =
  (SCREEN_WIDTH -
    GRID_PADDING * 2 -
    STICKER_GRID_GAP * (STICKER_NUM_COLUMNS - 1)) /
  STICKER_NUM_COLUMNS;
const DEBOUNCE_MS = 400;
const PAGE_SIZE = 30;
const GIF_SKELETON_COUNT = 8;
const STICKER_SKELETON_COUNT = 9;
const TAB_BAR_HEIGHT = 40;

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
// Grid Cells (memo'd for performance)
// =============================================================================

const GifSkeletonCell = memo(function GifSkeletonCell({
  height,
  backgroundColor,
}: {
  height: number;
  backgroundColor: string;
}) {
  return (
    <View
      style={[
        styles.skeletonCell,
        { width: GIF_COLUMN_WIDTH, height, backgroundColor },
      ]}
    />
  );
});

const StickerSkeletonCell = memo(function StickerSkeletonCell({
  backgroundColor,
}: {
  backgroundColor: string;
}) {
  return (
    <View
      style={[
        styles.skeletonCell,
        {
          width: STICKER_COLUMN_WIDTH,
          height: STICKER_COLUMN_WIDTH,
          backgroundColor,
        },
      ]}
    />
  );
});

const GifCell = memo(function GifCell({
  gif,
  onPress,
}: {
  gif: GifItem;
  onPress: (gif: GifItem) => void;
}) {
  const aspectRatio = gif.previewWidth / Math.max(gif.previewHeight, 1);
  const cellHeight = GIF_COLUMN_WIDTH / Math.max(aspectRatio, 0.5);
  const clampedHeight = Math.min(Math.max(cellHeight, 80), 300);

  return (
    <Pressable
      onPress={() => onPress(gif)}
      style={({ pressed }) => [
        styles.gifCell,
        { width: GIF_COLUMN_WIDTH, height: clampedHeight },
        pressed && styles.cellPressed,
      ]}
      accessibilityLabel={gif.title || "GIF"}
      accessibilityRole="button"
      accessibilityHint="Double tap to send this GIF"
    >
      <Image
        source={{ uri: gif.previewUrl }}
        style={[
          styles.gifImage,
          { width: GIF_COLUMN_WIDTH, height: clampedHeight },
        ]}
        resizeMode="cover"
      />
    </Pressable>
  );
});

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
        { width: STICKER_COLUMN_WIDTH, height: STICKER_COLUMN_WIDTH },
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

const SuggestionChip = memo(function SuggestionChip({
  term,
  onPress,
  surfaceColor,
  textColor,
}: {
  term: string;
  onPress: (term: string) => void;
  surfaceColor: string;
  textColor: string;
}) {
  return (
    <TouchableOpacity
      onPress={() => onPress(term)}
      style={[styles.suggestionChip, { backgroundColor: surfaceColor }]}
      accessibilityLabel={`Search for ${term}`}
      accessibilityRole="button"
    >
      <Text style={[styles.suggestionText, { color: textColor }]}>{term}</Text>
    </TouchableOpacity>
  );
});

// =============================================================================
// Tab Bar
// =============================================================================

const TabBar = memo(function TabBar({
  activeTab,
  onTabChange,
  primaryColor,
  surfaceColor,
  textColor,
  inactiveTextColor,
}: {
  activeTab: GifStickerTab;
  onTabChange: (tab: GifStickerTab) => void;
  primaryColor: string;
  surfaceColor: string;
  textColor: string;
  inactiveTextColor: string;
}) {
  return (
    <View style={[styles.tabBar, { backgroundColor: surfaceColor }]}>
      <Pressable
        onPress={() => onTabChange("gifs")}
        style={[
          styles.tab,
          activeTab === "gifs" && [
            styles.tabActive,
            { borderBottomColor: primaryColor },
          ],
        ]}
        accessibilityLabel="GIFs tab"
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === "gifs" }}
      >
        <Text
          style={[
            styles.tabText,
            {
              color: activeTab === "gifs" ? primaryColor : inactiveTextColor,
              fontWeight: activeTab === "gifs" ? "700" : "500",
            },
          ]}
        >
          GIFs
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onTabChange("stickers")}
        style={[
          styles.tab,
          activeTab === "stickers" && [
            styles.tabActive,
            { borderBottomColor: primaryColor },
          ],
        ]}
        accessibilityLabel="Stickers tab"
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === "stickers" }}
      >
        <Text
          style={[
            styles.tabText,
            {
              color:
                activeTab === "stickers" ? primaryColor : inactiveTextColor,
              fontWeight: activeTab === "stickers" ? "700" : "500",
            },
          ]}
        >
          Stickers
        </Text>
      </Pressable>
    </View>
  );
});

// =============================================================================
// Main Component
// =============================================================================

export const GifStickerPicker = forwardRef<
  DraggableBottomSheetHandle,
  GifStickerPickerProps
>(function GifStickerPicker(
  {
    open,
    onClose,
    onGifSelected,
    onStickerSelected,
    keyboardHeight,
    sharedTranslateY,
    initialTab = "gifs",
  },
  ref,
) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<DraggableBottomSheetHandle>(null);

  // Forward imperative handle
  useImperativeHandle(ref, () => ({
    snapToIndex: (index: number) => sheetRef.current?.snapToIndex(index),
  }));

  // ── Tab state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<GifStickerTab>(initialTab);

  // ── Snap points ──────────────────────────────────────────────────────────
  const snapPoints = useMemo(() => {
    if (keyboardHeight && keyboardHeight > 0) {
      const kbFraction = Math.min(
        (keyboardHeight + 7) / SCREEN_HEIGHT,
        EXPANDED_SNAP - 0.05,
      );
      return [kbFraction, EXPANDED_SNAP];
    }
    return [FALLBACK_SMALL_SNAP, EXPANDED_SNAP];
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

  // =========================================================================
  // GIF TAB STATE
  // =========================================================================
  const [gifSearchQuery, setGifSearchQuery] = useState("");
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifLoadingMore, setGifLoadingMore] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [gifNextCursor, setGifNextCursor] = useState<string | undefined>();
  const [gifSuggestions, setGifSuggestions] = useState<string[]>([]);
  const [gifCategories, setGifCategories] = useState<CategoryTile[]>([]);
  const [gifCategoriesLoading, setGifCategoriesLoading] = useState(false);
  const [gifBrowseState, setGifBrowseState] = useState<
    "landing" | "category" | "search"
  >("landing");
  const [gifActiveCategory, setGifActiveCategory] = useState<string | null>(
    null,
  );

  const gifDebouncedQuery = useDebouncedValue(gifSearchQuery, DEBOUNCE_MS);
  const gifAbortRef = useRef<AbortController | null>(null);
  const gifFlatListRef = useRef<FlatList>(null);
  const gifHasLoadedRef = useRef(false);

  // =========================================================================
  // STICKER TAB STATE
  // =========================================================================
  const [stickerSearchQuery, setStickerSearchQuery] = useState("");
  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [stickerLoading, setStickerLoading] = useState(false);
  const [stickerLoadingMore, setStickerLoadingMore] = useState(false);
  const [stickerError, setStickerError] = useState<string | null>(null);
  const [stickerNextPage, setStickerNextPage] = useState<number | undefined>();

  const stickerDebouncedQuery = useDebouncedValue(
    stickerSearchQuery,
    DEBOUNCE_MS,
  );
  const stickerAbortRef = useRef<AbortController | null>(null);
  const stickerFlatListRef = useRef<FlatList>(null);
  const stickerHasLoadedRef = useRef(false);

  // =========================================================================
  // GIF TAB EFFECTS
  // =========================================================================

  // Fetch trending GIFs when tab is active and open
  useEffect(() => {
    if (!open || activeTab !== "gifs") return;
    if (gifHasLoadedRef.current && gifs.length > 0 && !gifSearchQuery) return;

    let cancelled = false;

    async function loadTrending() {
      setGifLoading(true);
      setGifError(null);
      try {
        const page = await fetchTrending({ limit: PAGE_SIZE });
        if (!cancelled) {
          setGifs(page.items);
          setGifNextCursor(page.nextCursor);
          gifHasLoadedRef.current = true;
        }
      } catch (err) {
        if (!cancelled) {
          log.warn("Failed to load trending GIFs", { error: String(err) });
          setGifError("Failed to load trending GIFs");
        }
      } finally {
        if (!cancelled) setGifLoading(false);
      }
    }

    if (!gifSearchQuery) {
      loadTrending();
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab]);

  // Fetch GIF categories
  useEffect(() => {
    if (!open || activeTab !== "gifs" || gifCategories.length > 0) return;

    let cancelled = false;
    setGifCategoriesLoading(true);

    getCategories()
      .then((cats) => {
        if (!cancelled) {
          setGifCategories(
            cats.map((c) => ({ name: c.name, imageUrl: c.imageUrl })),
          );
        }
      })
      .catch((err) => {
        log.warn("Failed to load categories", { error: String(err) });
      })
      .finally(() => {
        if (!cancelled) setGifCategoriesLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab]);

  // GIF search
  useEffect(() => {
    if (!open || activeTab !== "gifs") return;

    if (!gifDebouncedQuery.trim()) {
      if (gifHasLoadedRef.current) {
        fetchTrending({ limit: PAGE_SIZE })
          .then((page) => {
            setGifs(page.items);
            setGifNextCursor(page.nextCursor);
            setGifSuggestions([]);
          })
          .catch(() => {});
      }
      return;
    }

    gifAbortRef.current?.abort();
    const controller = new AbortController();
    gifAbortRef.current = controller;
    let cancelled = false;

    async function executeSearch() {
      setGifLoading(true);
      setGifError(null);
      try {
        const page = await searchGifs({
          query: gifDebouncedQuery.trim(),
          limit: PAGE_SIZE,
        });
        if (!cancelled) {
          setGifs(page.items);
          setGifNextCursor(page.nextCursor);
          gifFlatListRef.current?.scrollToOffset({
            offset: 0,
            animated: false,
          });
        }
      } catch (err) {
        if (!cancelled && !controller.signal.aborted) {
          log.warn("GIF search failed", {
            query: gifDebouncedQuery,
            error: String(err),
          });
          setGifError("Search failed. Tap to retry.");
        }
      } finally {
        if (!cancelled) setGifLoading(false);
      }
    }

    executeSearch();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [gifDebouncedQuery, open, activeTab]);

  // GIF autocomplete
  useEffect(() => {
    if (!open || activeTab !== "gifs" || gifSearchQuery.length < 2) {
      setGifSuggestions([]);
      return;
    }

    let cancelled = false;
    getAutocomplete(gifSearchQuery)
      .then((results) => {
        if (!cancelled) {
          setGifSuggestions(results.map((r) => r.term).slice(0, 6));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [gifSearchQuery, open, activeTab]);

  // =========================================================================
  // STICKER TAB EFFECTS
  // =========================================================================

  // Fetch trending stickers when tab is active and open
  useEffect(() => {
    if (!open || activeTab !== "stickers") return;
    if (
      stickerHasLoadedRef.current &&
      stickers.length > 0 &&
      !stickerSearchQuery
    )
      return;

    let cancelled = false;

    async function loadTrending() {
      setStickerLoading(true);
      setStickerError(null);
      try {
        const page = await fetchTrendingStickers({ limit: PAGE_SIZE });
        if (!cancelled) {
          setStickers(page.items);
          setStickerNextPage(page.nextPage);
          stickerHasLoadedRef.current = true;
        }
      } catch (err) {
        if (!cancelled) {
          log.warn("Failed to load trending stickers", {
            error: String(err),
          });
          setStickerError("Failed to load trending stickers");
        }
      } finally {
        if (!cancelled) setStickerLoading(false);
      }
    }

    if (!stickerSearchQuery) {
      loadTrending();
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab]);

  // Sticker search
  useEffect(() => {
    if (!open || activeTab !== "stickers") return;

    if (!stickerDebouncedQuery.trim()) {
      if (stickerHasLoadedRef.current) {
        fetchTrendingStickers({ limit: PAGE_SIZE })
          .then((page) => {
            setStickers(page.items);
            setStickerNextPage(page.nextPage);
          })
          .catch(() => {});
      }
      return;
    }

    stickerAbortRef.current?.abort();
    const controller = new AbortController();
    stickerAbortRef.current = controller;
    let cancelled = false;

    async function executeSearch() {
      setStickerLoading(true);
      setStickerError(null);
      try {
        const page = await searchStickers({
          query: stickerDebouncedQuery.trim(),
          limit: PAGE_SIZE,
        });
        if (!cancelled) {
          setStickers(page.items);
          setStickerNextPage(page.nextPage);
          stickerFlatListRef.current?.scrollToOffset({
            offset: 0,
            animated: false,
          });
        }
      } catch (err) {
        if (!cancelled && !controller.signal.aborted) {
          log.warn("Sticker search failed", {
            query: stickerDebouncedQuery,
            error: String(err),
          });
          setStickerError("Search failed. Tap to retry.");
        }
      } finally {
        if (!cancelled) setStickerLoading(false);
      }
    }

    executeSearch();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [stickerDebouncedQuery, open, activeTab]);

  // =========================================================================
  // GIF HANDLERS
  // =========================================================================

  const handleGifCategorySelect = useCallback((categoryName: string) => {
    setGifActiveCategory(categoryName);
    setGifSearchQuery(categoryName);
    setGifBrowseState("category");
  }, []);

  const handleGifSearchChange = useCallback((text: string) => {
    setGifSearchQuery(text);
    if (text.trim()) {
      setGifBrowseState("search");
      setGifActiveCategory(null);
    } else {
      setGifBrowseState("landing");
      setGifActiveCategory(null);
    }
  }, []);

  const handleGifLoadMore = useCallback(() => {
    if (gifLoadingMore || gifLoading || !gifNextCursor) return;

    setGifLoadingMore(true);

    const fetchFn = gifDebouncedQuery.trim()
      ? searchGifs({
          query: gifDebouncedQuery.trim(),
          limit: PAGE_SIZE,
          cursor: gifNextCursor,
        })
      : fetchTrending({ limit: PAGE_SIZE, cursor: gifNextCursor });

    fetchFn
      .then((page) => {
        setGifs((prev) => [...prev, ...page.items]);
        setGifNextCursor(page.nextCursor);
      })
      .catch((err) => {
        log.warn("GIF load more failed", { error: String(err) });
      })
      .finally(() => setGifLoadingMore(false));
  }, [gifLoadingMore, gifLoading, gifNextCursor, gifDebouncedQuery]);

  // =========================================================================
  // SHARED HANDLERS (defined early so tab-specific handlers can reference)
  // =========================================================================

  const handleTabChange = useCallback(
    (tab: GifStickerTab) => {
      if (tab === activeTab) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setActiveTab(tab);
    },
    [activeTab],
  );

  const handleClose = useCallback(() => {
    // Reset all state on close
    setGifSearchQuery("");
    setGifSuggestions([]);
    setGifError(null);
    setGifActiveCategory(null);
    setGifBrowseState("landing");
    setStickerSearchQuery("");
    setStickerError(null);
    setActiveTab(initialTab);
    gifHasLoadedRef.current = false;
    stickerHasLoadedRef.current = false;
    onClose();
  }, [onClose, initialTab]);

  const handleGifPress = useCallback(
    (gif: GifItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onGifSelected(gif);
      handleClose();
    },
    [onGifSelected, handleClose],
  );

  const handleGifSuggestionPress = useCallback((term: string) => {
    setGifSearchQuery(term);
    setGifBrowseState("search");
  }, []);

  const handleGifRetry = useCallback(() => {
    setGifError(null);
    if (gifDebouncedQuery.trim()) {
      searchGifs({ query: gifDebouncedQuery.trim(), limit: PAGE_SIZE })
        .then((page) => {
          setGifs(page.items);
          setGifNextCursor(page.nextCursor);
        })
        .catch((err) => setGifError(String(err)));
    } else {
      setGifLoading(true);
      fetchTrending({ limit: PAGE_SIZE })
        .then((page) => {
          setGifs(page.items);
          setGifNextCursor(page.nextCursor);
        })
        .catch((err) => setGifError(String(err)))
        .finally(() => setGifLoading(false));
    }
  }, [gifDebouncedQuery]);

  // =========================================================================
  // STICKER HANDLERS
  // =========================================================================

  const handleStickerLoadMore = useCallback(() => {
    if (stickerLoadingMore || stickerLoading || !stickerNextPage) return;

    setStickerLoadingMore(true);

    const fetchFn = stickerDebouncedQuery.trim()
      ? searchStickers({
          query: stickerDebouncedQuery.trim(),
          limit: PAGE_SIZE,
          page: stickerNextPage,
        })
      : fetchTrendingStickers({ limit: PAGE_SIZE, page: stickerNextPage });

    fetchFn
      .then((page) => {
        setStickers((prev) => [...prev, ...page.items]);
        setStickerNextPage(page.nextPage);
      })
      .catch((err) => {
        log.warn("Sticker load more failed", { error: String(err) });
      })
      .finally(() => setStickerLoadingMore(false));
  }, [
    stickerLoadingMore,
    stickerLoading,
    stickerNextPage,
    stickerDebouncedQuery,
  ]);

  const handleStickerPress = useCallback(
    (sticker: StickerItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onStickerSelected(sticker);
      handleClose();
    },
    [onStickerSelected, handleClose],
  );

  const handleStickerRetry = useCallback(() => {
    setStickerError(null);
    if (stickerDebouncedQuery.trim()) {
      searchStickers({
        query: stickerDebouncedQuery.trim(),
        limit: PAGE_SIZE,
      })
        .then((page) => {
          setStickers(page.items);
          setStickerNextPage(page.nextPage);
        })
        .catch((err) => setStickerError(String(err)));
    } else {
      setStickerLoading(true);
      fetchTrendingStickers({ limit: PAGE_SIZE })
        .then((page) => {
          setStickers(page.items);
          setStickerNextPage(page.nextPage);
        })
        .catch((err) => setStickerError(String(err)))
        .finally(() => setStickerLoading(false));
    }
  }, [stickerDebouncedQuery]);

  // ── GIF masonry layout ───────────────────────────────────────────────────
  const { leftColumn, rightColumn } = useMemo(() => {
    const left: GifItem[] = [];
    const right: GifItem[] = [];
    let leftH = 0;
    let rightH = 0;

    for (const gif of gifs) {
      const aspect = gif.previewWidth / Math.max(gif.previewHeight, 1);
      const h = GIF_COLUMN_WIDTH / Math.max(aspect, 0.5);
      const clampedH = Math.min(Math.max(h, 80), 300);

      if (leftH <= rightH) {
        left.push(gif);
        leftH += clampedH + GIF_GRID_GAP;
      } else {
        right.push(gif);
        rightH += clampedH + GIF_GRID_GAP;
      }
    }

    return { leftColumn: left, rightColumn: right };
  }, [gifs]);

  // ── Skeleton data ────────────────────────────────────────────────────────
  const gifSkeletonHeights = useMemo(
    () =>
      Array.from(
        { length: GIF_SKELETON_COUNT },
        (_, i) => 120 + ((i * 37) % 80),
      ),
    [],
  );

  const stickerSkeletonItems = useMemo(
    () => Array.from({ length: STICKER_SKELETON_COUNT }, (_, i) => i),
    [],
  );

  if (!open) return null;

  // =========================================================================
  // RENDER
  // =========================================================================

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
    >
      {/* ── Tab Switcher Bar ────────────────────────────────────────────── */}
      <TabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        primaryColor={colors.primary}
        surfaceColor={sheetSurface}
        textColor={onSurfaceColor}
        inactiveTextColor={onSurfaceVariantColor}
      />

      {/* ── GIF Tab Content ─────────────────────────────────────────────── */}
      {activeTab === "gifs" && (
        <>
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
              placeholder="Search KLIPY"
              placeholderTextColor={onSurfaceVariantColor}
              value={gifSearchQuery}
              onChangeText={handleGifSearchChange}
              onFocus={handleSearchFocus}
              autoCapitalize="none"
              autoCorrect
              spellCheck={false}
              autoComplete="off"
              returnKeyType="search"
              keyboardAppearance={isDark ? "dark" : "light"}
              selectionColor={colors.primary}
              cursorColor={colors.primary}
              accessibilityLabel="Search for GIFs"
            />
            {gifSearchQuery ? (
              <TouchableOpacity
                onPress={() => {
                  setGifSearchQuery("");
                  setGifActiveCategory(null);
                  setGifBrowseState("landing");
                }}
                accessibilityLabel="Clear search"
                accessibilityRole="button"
              >
                <Text style={{ color: onSurfaceVariantColor, fontSize: 16 }}>
                  ✕
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Suggestion chips */}
          {gifBrowseState !== "landing" && gifSuggestions.length > 0 && (
            <View style={styles.suggestionsRow}>
              {gifSuggestions.map((term) => (
                <SuggestionChip
                  key={term}
                  term={term}
                  onPress={handleGifSuggestionPress}
                  surfaceColor={surfaceVariantColor}
                  textColor={onSurfaceVariantColor}
                />
              ))}
            </View>
          )}

          {/* Content area */}
          {gifBrowseState === "landing" ? (
            <CategoryGrid
              categories={gifCategories}
              loading={gifCategoriesLoading}
              onSelect={handleGifCategorySelect}
              colors={{
                surface: sheetSurface,
                surfaceVariant: surfaceVariantColor,
                text: onSurfaceColor,
              }}
            />
          ) : gifLoading && gifs.length === 0 ? (
            <View style={styles.gifMasonryContainer}>
              <View style={styles.gifMasonryColumn}>
                {gifSkeletonHeights.slice(0, 4).map((h, i) => (
                  <GifSkeletonCell
                    key={`sl-${i}`}
                    height={h}
                    backgroundColor={surfaceVariantColor}
                  />
                ))}
              </View>
              <View style={styles.gifMasonryColumn}>
                {gifSkeletonHeights.slice(4).map((h, i) => (
                  <GifSkeletonCell
                    key={`sr-${i}`}
                    height={h}
                    backgroundColor={surfaceVariantColor}
                  />
                ))}
              </View>
            </View>
          ) : gifError ? (
            <View style={styles.stateContainer}>
              <Text style={{ color: onSurfaceVariantColor, fontSize: 16 }}>
                ⚠️
              </Text>
              <Text
                style={[styles.stateText, { color: onSurfaceVariantColor }]}
              >
                {gifError}
              </Text>
              <TouchableOpacity
                onPress={handleGifRetry}
                style={[styles.retryButton, { borderColor: outlineColor }]}
                accessibilityLabel="Retry loading GIFs"
                accessibilityRole="button"
              >
                <Text style={{ color: onSurfaceColor }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : gifs.length === 0 && gifDebouncedQuery.trim() ? (
            <View style={styles.stateContainer}>
              <Text style={{ fontSize: 40 }}>🤷</Text>
              <Text
                style={[styles.stateText, { color: onSurfaceVariantColor }]}
              >
                No GIFs found for &quot;{gifDebouncedQuery}&quot;
              </Text>
            </View>
          ) : (
            <FlatList
              ref={gifFlatListRef}
              data={[1]}
              keyExtractor={() => "masonry"}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onEndReached={handleGifLoadMore}
              onEndReachedThreshold={0.5}
              contentContainerStyle={styles.flatListContent}
              renderItem={() => (
                <View style={styles.gifMasonryContainer}>
                  <View style={styles.gifMasonryColumn}>
                    {leftColumn.map((gif) => (
                      <GifCell
                        key={gif.id}
                        gif={gif}
                        onPress={handleGifPress}
                      />
                    ))}
                  </View>
                  <View style={styles.gifMasonryColumn}>
                    {rightColumn.map((gif) => (
                      <GifCell
                        key={gif.id}
                        gif={gif}
                        onPress={handleGifPress}
                      />
                    ))}
                  </View>
                </View>
              )}
              ListFooterComponent={
                gifLoadingMore ? (
                  <View style={styles.loadingMore}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : null
              }
            />
          )}
        </>
      )}

      {/* ── Sticker Tab Content ─────────────────────────────────────────── */}
      {activeTab === "stickers" && (
        <>
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
              value={stickerSearchQuery}
              onChangeText={setStickerSearchQuery}
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
            {stickerSearchQuery ? (
              <TouchableOpacity
                onPress={() => setStickerSearchQuery("")}
                accessibilityLabel="Clear search"
                accessibilityRole="button"
              >
                <Text style={{ color: onSurfaceVariantColor, fontSize: 16 }}>
                  ✕
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Content area */}
          {stickerLoading && stickers.length === 0 ? (
            <View style={styles.stickerGridContainer}>
              {stickerSkeletonItems.map((i) => (
                <StickerSkeletonCell
                  key={`sk-${i}`}
                  backgroundColor={surfaceVariantColor}
                />
              ))}
            </View>
          ) : stickerError ? (
            <View style={styles.stateContainer}>
              <Text style={{ color: onSurfaceVariantColor, fontSize: 16 }}>
                ⚠️
              </Text>
              <Text
                style={[styles.stateText, { color: onSurfaceVariantColor }]}
              >
                {stickerError}
              </Text>
              <TouchableOpacity
                onPress={handleStickerRetry}
                style={[styles.retryButton, { borderColor: outlineColor }]}
                accessibilityLabel="Retry loading stickers"
                accessibilityRole="button"
              >
                <Text style={{ color: onSurfaceColor }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : stickers.length === 0 && stickerDebouncedQuery.trim() ? (
            <View style={styles.stateContainer}>
              <Text style={{ fontSize: 40 }}>🤷</Text>
              <Text
                style={[styles.stateText, { color: onSurfaceVariantColor }]}
              >
                No stickers found for &quot;{stickerDebouncedQuery}&quot;
              </Text>
            </View>
          ) : (
            <FlatList
              ref={stickerFlatListRef}
              data={stickers}
              keyExtractor={(item) => item.id}
              numColumns={STICKER_NUM_COLUMNS}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onEndReached={handleStickerLoadMore}
              onEndReachedThreshold={0.5}
              contentContainerStyle={styles.flatListContent}
              columnWrapperStyle={styles.stickerColumnWrapper}
              renderItem={({ item }) => (
                <StickerCell sticker={item} onPress={handleStickerPress} />
              )}
              ListFooterComponent={
                stickerLoadingMore ? (
                  <View style={styles.loadingMore}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : null
              }
            />
          )}
        </>
      )}

      {/* Attribution footer */}
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
  // Tab bar
  tabBar: {
    flexDirection: "row",
    height: TAB_BAR_HEIGHT,
    marginHorizontal: GRID_PADDING,
    marginBottom: 8,
    borderRadius: 10,
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabActive: {
    // borderBottomColor set dynamically
  },
  tabText: {
    fontSize: 14,
    letterSpacing: 0.3,
  },

  // Search
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

  // Suggestions
  suggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: GRID_PADDING,
    gap: 6,
    marginBottom: 8,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: "500",
  },

  // GIF Masonry
  gifMasonryContainer: {
    flexDirection: "row",
    gap: GIF_GRID_GAP,
    flex: 1,
    paddingHorizontal: GRID_PADDING,
  },
  gifMasonryColumn: {
    flex: 1,
    gap: GIF_GRID_GAP,
  },
  gifCell: {
    borderRadius: 8,
    overflow: "hidden",
  },
  gifImage: {
    borderRadius: 8,
  },

  // Sticker Grid
  stickerGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: STICKER_GRID_GAP,
    paddingHorizontal: GRID_PADDING,
    flex: 1,
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
  stickerColumnWrapper: {
    gap: STICKER_GRID_GAP,
    marginBottom: STICKER_GRID_GAP,
  },

  // Shared
  flatListContent: {
    paddingBottom: 8,
  },
  skeletonCell: {
    borderRadius: 8,
    opacity: 0.3,
  },
  cellPressed: {
    opacity: 0.7,
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

export default GifStickerPicker;
