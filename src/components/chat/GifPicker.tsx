/**
 * GifPicker — Full-featured GIF picker powered by KLIPY.
 *
 * Opens in a DraggableBottomSheet (consistent with FullEmojiPicker).
 * Supports keyboard-replacement mode: when `keyboardHeight` is provided,
 * the sheet opens to a keyboard-equivalent initial height and expands
 * to full height when the search field is focused.
 *
 * Features:
 * - Trending GIFs on open
 * - Debounced search with "Search KLIPY" placeholder (required attribution)
 * - Autocomplete suggestions while typing
 * - 2-column staggered masonry grid
 * - Cursor-based pagination (infinite scroll)
 * - Loading skeletons, empty states, error/retry states
 * - "Powered by KLIPY" attribution line
 * - Dark/light theme support
 * - Accessibility labels
 *
 * @module components/chat/GifPicker
 */

import {
  fetchTrending,
  getAutocomplete,
  searchGifs,
} from "@/services/gif/gifService";
import type { GifItem } from "@/services/gif/types";
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

const log = createLogger("GifPicker");

// =============================================================================
// Types
// =============================================================================

export interface GifPickerProps {
  /** Whether the picker is visible */
  open: boolean;
  /** Called when the picker should close */
  onClose: () => void;
  /** Called when a GIF is selected */
  onGifSelected: (gif: GifItem) => void;
  /** When provided, the sheet opens to this height first (keyboard replacement). */
  keyboardHeight?: number;
  /** Shared Reanimated value for composer offset coordination. */
  sharedTranslateY?: SharedValue<number>;
}

// =============================================================================
// Layout Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: GIF_SCREEN_HEIGHT } =
  Dimensions.get("window");
/** Expanded snap fraction (85% of screen) */
const GIF_EXPANDED_SNAP = 0.85;
/** Fallback small snap when no keyboard height is known */
const GIF_FALLBACK_SMALL_SNAP = 0.45;
const GRID_PADDING = 8;
const GRID_GAP = 4;
const NUM_COLUMNS = 2;
const COLUMN_WIDTH =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) /
  NUM_COLUMNS;
const DEBOUNCE_MS = 400;
const PAGE_SIZE = 30;
const SKELETON_COUNT = 8;

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
        { width: COLUMN_WIDTH, height, backgroundColor },
      ]}
    />
  );
});

// =============================================================================
// GIF Grid Cell
// =============================================================================

const GifCell = memo(function GifCell({
  gif,
  onPress,
}: {
  gif: GifItem;
  onPress: (gif: GifItem) => void;
}) {
  const aspectRatio = gif.previewWidth / Math.max(gif.previewHeight, 1);
  const cellHeight = COLUMN_WIDTH / Math.max(aspectRatio, 0.5);
  // Clamp height to reasonable bounds
  const clampedHeight = Math.min(Math.max(cellHeight, 80), 300);

  return (
    <Pressable
      onPress={() => onPress(gif)}
      style={({ pressed }) => [
        styles.gifCell,
        { width: COLUMN_WIDTH, height: clampedHeight },
        pressed && styles.gifCellPressed,
      ]}
      accessibilityLabel={gif.title || "GIF"}
      accessibilityRole="button"
      accessibilityHint="Double tap to send this GIF"
    >
      <Image
        source={{ uri: gif.previewUrl }}
        style={[
          styles.gifImage,
          { width: COLUMN_WIDTH, height: clampedHeight },
        ]}
        resizeMode="cover"
      />
    </Pressable>
  );
});

// =============================================================================
// Suggestion Chip
// =============================================================================

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
// Main Component
// =============================================================================

export const GifPicker = forwardRef<DraggableBottomSheetHandle, GifPickerProps>(
  function GifPicker(
    { open, onClose, onGifSelected, keyboardHeight, sharedTranslateY },
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
    // Add HANDLE_ZONE_HEIGHT so the visible content area (below the drag handle)
    // exactly matches the keyboard height. Without this, the handle eats into
    // the content space, making the modal ~23px shorter than the keyboard.
    const snapPoints = useMemo(() => {
      if (keyboardHeight && keyboardHeight > 0) {
        const kbFraction = Math.min(
          keyboardHeight / GIF_SCREEN_HEIGHT,
          GIF_EXPANDED_SNAP - 0.05,
        );
        return [kbFraction, GIF_EXPANDED_SNAP];
      }
      return [GIF_FALLBACK_SMALL_SNAP, GIF_EXPANDED_SNAP];
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
    const [gifs, setGifs] = useState<GifItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nextCursor, setNextCursor] = useState<string | undefined>();
    const [suggestions, setSuggestions] = useState<string[]>([]);

    const debouncedQuery = useDebouncedValue(searchQuery, DEBOUNCE_MS);
    const abortRef = useRef<AbortController | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const hasLoadedRef = useRef(false);

    // ── Fetch trending on open ─────────────────────────────────────────────────
    useEffect(() => {
      if (!open) {
        // Reset on close — but keep gifs cached for re-open
        return;
      }

      // Only load trending if we haven't already or gifs are empty
      if (hasLoadedRef.current && gifs.length > 0 && !searchQuery) return;

      let cancelled = false;

      async function loadTrending() {
        setLoading(true);
        setError(null);
        try {
          const page = await fetchTrending({ limit: PAGE_SIZE });
          if (!cancelled) {
            setGifs(page.items);
            setNextCursor(page.nextCursor);
            hasLoadedRef.current = true;
          }
        } catch (err) {
          if (!cancelled) {
            log.warn("Failed to load trending", { error: String(err) });
            setError("Failed to load trending GIFs");
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
          // Re-fetch trending (will use cache if valid)
          fetchTrending({ limit: PAGE_SIZE })
            .then((page) => {
              setGifs(page.items);
              setNextCursor(page.nextCursor);
              setSuggestions([]);
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
          const page = await searchGifs({
            query: debouncedQuery.trim(),
            limit: PAGE_SIZE,
          });
          if (!cancelled) {
            setGifs(page.items);
            setNextCursor(page.nextCursor);
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

    // ── Autocomplete suggestions while typing ──────────────────────────────────
    useEffect(() => {
      if (!open || searchQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      let cancelled = false;

      getAutocomplete(searchQuery)
        .then((results) => {
          if (!cancelled) {
            setSuggestions(results.map((r) => r.term).slice(0, 6));
          }
        })
        .catch(() => {
          // Autocomplete failures are non-critical
        });

      return () => {
        cancelled = true;
      };
    }, [searchQuery, open]);

    // ── Load more (pagination) ─────────────────────────────────────────────────
    const handleLoadMore = useCallback(() => {
      if (loadingMore || loading || !nextCursor) return;

      setLoadingMore(true);

      const fetchFn = debouncedQuery.trim()
        ? searchGifs({
            query: debouncedQuery.trim(),
            limit: PAGE_SIZE,
            cursor: nextCursor,
          })
        : fetchTrending({ limit: PAGE_SIZE, cursor: nextCursor });

      fetchFn
        .then((page) => {
          setGifs((prev) => [...prev, ...page.items]);
          setNextCursor(page.nextCursor);
        })
        .catch((err) => {
          log.warn("Load more failed", { error: String(err) });
        })
        .finally(() => setLoadingMore(false));
    }, [loadingMore, loading, nextCursor, debouncedQuery]);

    // ── GIF selection ──────────────────────────────────────────────────────────
    const handleGifPress = useCallback(
      (gif: GifItem) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onGifSelected(gif);
        onClose();
      },
      [onGifSelected, onClose],
    );

    // ── Suggestion tap ─────────────────────────────────────────────────────────
    const handleSuggestionPress = useCallback((term: string) => {
      setSearchQuery(term);
    }, []);

    // ── Close and reset ────────────────────────────────────────────────────────
    const handleClose = useCallback(() => {
      setSearchQuery("");
      setSuggestions([]);
      setError(null);
      onClose();
    }, [onClose]);

    // ── Retry on error ─────────────────────────────────────────────────────────
    const handleRetry = useCallback(() => {
      setError(null);
      if (debouncedQuery.trim()) {
        searchGifs({ query: debouncedQuery.trim(), limit: PAGE_SIZE })
          .then((page) => {
            setGifs(page.items);
            setNextCursor(page.nextCursor);
          })
          .catch((err) => setError(String(err)));
      } else {
        setLoading(true);
        fetchTrending({ limit: PAGE_SIZE })
          .then((page) => {
            setGifs(page.items);
            setNextCursor(page.nextCursor);
          })
          .catch((err) => setError(String(err)))
          .finally(() => setLoading(false));
      }
    }, [debouncedQuery]);

    // ── Masonry layout: split items into 2 columns by aspect ratio ─────────────
    const { leftColumn, rightColumn } = useMemo(() => {
      const left: GifItem[] = [];
      const right: GifItem[] = [];
      let leftH = 0;
      let rightH = 0;

      for (const gif of gifs) {
        const aspect = gif.previewWidth / Math.max(gif.previewHeight, 1);
        const h = COLUMN_WIDTH / Math.max(aspect, 0.5);
        const clampedH = Math.min(Math.max(h, 80), 300);

        if (leftH <= rightH) {
          left.push(gif);
          leftH += clampedH + GRID_GAP;
        } else {
          right.push(gif);
          rightH += clampedH + GRID_GAP;
        }
      }

      return { leftColumn: left, rightColumn: right };
    }, [gifs]);

    // ── Skeleton data ──────────────────────────────────────────────────────────
    const skeletonHeights = useMemo(
      () =>
        Array.from({ length: SKELETON_COUNT }, (_, i) => 120 + ((i * 37) % 80)),
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
      >
        {/* Search bar — "Search KLIPY" placeholder per attribution requirement */}
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
            accessibilityLabel="Search for GIFs"
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

        {/* Suggestion chips */}
        {suggestions.length > 0 && (
          <View style={styles.suggestionsRow}>
            {suggestions.map((term) => (
              <SuggestionChip
                key={term}
                term={term}
                onPress={handleSuggestionPress}
                surfaceColor={surfaceVariantColor}
                textColor={onSurfaceVariantColor}
              />
            ))}
          </View>
        )}

        {/* Content area */}
        {loading && gifs.length === 0 ? (
          /* Loading skeleton */
          <View style={styles.masonryContainer}>
            <View style={styles.masonryColumn}>
              {skeletonHeights.slice(0, 4).map((h, i) => (
                <SkeletonCell
                  key={`sl-${i}`}
                  height={h}
                  backgroundColor={surfaceVariantColor}
                />
              ))}
            </View>
            <View style={styles.masonryColumn}>
              {skeletonHeights.slice(4).map((h, i) => (
                <SkeletonCell
                  key={`sr-${i}`}
                  height={h}
                  backgroundColor={surfaceVariantColor}
                />
              ))}
            </View>
          </View>
        ) : error ? (
          /* Error state */
          <View style={styles.stateContainer}>
            <Text style={{ color: onSurfaceVariantColor, fontSize: 16 }}>
              ⚠️
            </Text>
            <Text style={[styles.stateText, { color: onSurfaceVariantColor }]}>
              {error}
            </Text>
            <TouchableOpacity
              onPress={handleRetry}
              style={[styles.retryButton, { borderColor: outlineColor }]}
              accessibilityLabel="Retry loading GIFs"
              accessibilityRole="button"
            >
              <Text style={{ color: onSurfaceColor }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : gifs.length === 0 && debouncedQuery.trim() ? (
          /* Empty search results */
          <View style={styles.stateContainer}>
            <Text style={{ fontSize: 40 }}>🤷</Text>
            <Text style={[styles.stateText, { color: onSurfaceVariantColor }]}>
              No GIFs found for "{debouncedQuery}"
            </Text>
          </View>
        ) : (
          /* Masonry grid */
          <FlatList
            ref={flatListRef}
            data={[1]} // Single item wrapper for masonry
            keyExtractor={() => "masonry"}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            contentContainerStyle={styles.flatListContent}
            renderItem={() => (
              <View style={styles.masonryContainer}>
                <View style={styles.masonryColumn}>
                  {leftColumn.map((gif) => (
                    <GifCell key={gif.id} gif={gif} onPress={handleGifPress} />
                  ))}
                </View>
                <View style={styles.masonryColumn}>
                  {rightColumn.map((gif) => (
                    <GifCell key={gif.id} gif={gif} onPress={handleGifPress} />
                  ))}
                </View>
              </View>
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
  },
);

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
  flatListContent: {
    paddingBottom: 8,
  },
  masonryContainer: {
    flexDirection: "row",
    gap: GRID_GAP,
    flex: 1,
    paddingHorizontal: GRID_PADDING,
  },
  masonryColumn: {
    flex: 1,
    gap: GRID_GAP,
  },
  gifCell: {
    borderRadius: 8,
    overflow: "hidden",
  },
  gifCellPressed: {
    opacity: 0.7,
  },
  gifImage: {
    borderRadius: 8,
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

export default GifPicker;
