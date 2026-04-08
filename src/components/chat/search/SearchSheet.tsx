/**
 * SearchSheet Component
 *
 * Discord-inspired draggable search modal sheet for the Messages screen.
 * Opens over the Messages screen as a bottom sheet covering ~90% of screen height.
 *
 * Features:
 * - Drag handle for gesture dismissal
 * - Pinned search bar with filter button
 * - List-based filter selection (Discord-like)
 * - Filter-only browsing (no text query required)
 * - Custom date filters (Before / After / Sent on) with native date picker
 * - Compact active filter tokens
 * - Message-first results with conversation context
 * - Recent searches + browse shortcuts in pre-query state
 * - Scrim backdrop with tap-to-dismiss
 *
 * @module components/chat/search/SearchSheet
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { BorderRadius, Spacing } from "@/constants/theme";
import {
  useMessageSearch,
  type ContentFilter,
  type DateRangeFilter,
  type ScopeFilter,
  type SearchResult,
} from "@/hooks/useMessageSearch";
import {
  prepareDmThreadEntry,
  prepareGroupThreadEntry,
} from "@/services/chat/threadIdentityWarmup";
import { useAppTheme } from "@/store/ThemeContext";
import { log } from "@/utils/log";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Chip, IconButton, Searchbar, Text } from "react-native-paper";
import { scheduleOnRN } from "react-native-worklets";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchResultItem } from "./SearchResultItem";

// =============================================================================
// Types
// =============================================================================

interface SearchSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

type FilterView = "none" | "menu" | "datePicker" | "personPicker";
type DatePickerMode = "before" | "after" | "sentOn";

// =============================================================================
// Constants
// =============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_MAX_HEIGHT_RATIO = 0.92;
const DISMISS_THRESHOLD = 120;

/** translateY when sheet is in its open position (top gap ≈ 8% of screen) */
const OPEN_Y = SCREEN_HEIGHT * (1 - SHEET_MAX_HEIGHT_RATIO);
/** translateY when sheet is fully off-screen below the viewport */
const DISMISS_Y = SCREEN_HEIGHT;

/** Spring config — matches DraggableBottomSheet for consistent feel */
const SPRING_CONFIG = {
  damping: 28,
  stiffness: 280,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.5,
  restSpeedThreshold: 0.5,
};

// =============================================================================
// Helpers
// =============================================================================

/** Check if a date range represents a "Sent on" (single-day) filter */
function isSentOnRange(range: DateRangeFilter): boolean {
  if (!range.after || !range.before) return false;
  const diff = range.before - range.after;
  return diff > 0 && diff <= 86_400_000; // ≤ 24 hours
}

/** Format a timestamp for display in filter tokens */
function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Get a label for the active content type filter */
function getContentLabel(f: ContentFilter): string | null {
  switch (f) {
    case "media":
      return "Media";
    case "links":
      return "Links";
    case "files":
      return "Files";
    default:
      return null;
  }
}

/** Get an icon for a content type filter */
function getContentIcon(f: ContentFilter): string {
  switch (f) {
    case "media":
      return "image";
    case "links":
      return "link";
    case "files":
      return "file-document-outline";
    default:
      return "filter";
  }
}

// =============================================================================
// Component
// =============================================================================

export function SearchSheet({ visible, onDismiss }: SearchSheetProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Search hook
  const {
    query,
    setQuery,
    scopeFilter,
    setScopeFilter,
    contentFilter,
    setContentFilter,
    dateRange,
    setDateRange,
    personFilter,
    setPersonFilter,
    results,
    isSearching,
    hasSearched,
    recentSearches,
    saveRecentSearch,
    removeRecentSearchItem,
    clearAllRecentSearches,
    resetSearch,
    allConversations,
  } = useMessageSearch();

  // ---------------------------------------------------------------------------
  // Animation — mirrors DraggableBottomSheet architecture exactly:
  // - translateY drives BOTH sheet position and backdrop opacity
  // - Sheet: transform translateY
  // - Backdrop: opacity interpolated from translateY (fades as sheet moves)
  // - animationType="none" on Modal (no native animation fighting Reanimated)
  // ---------------------------------------------------------------------------
  const translateY = useSharedValue(DISMISS_Y);
  const gestureStartY = useSharedValue(0);
  const isClosing = useRef(false);

  const searchbarRef = useRef<any>(null);

  // Filter UI state
  const [filterView, setFilterView] = useState<FilterView>("none");
  const [datePickerMode, setDatePickerMode] = useState<DatePickerMode>("after");
  const [datePickerValue, setDatePickerValue] = useState(new Date());
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  // =========================================================================
  // Open / Close — close animates out, then calls onDismiss to unmount
  // =========================================================================

  const doFinalClose = useCallback(() => {
    setFilterView("none");
    setShowAndroidPicker(false);
    resetSearch();
    onDismiss();
  }, [resetSearch, onDismiss]);

  const closeSheet = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;
    Keyboard.dismiss();
    translateY.value = withSpring(DISMISS_Y, SPRING_CONFIG, (finished) => {
      if (finished) {
        scheduleOnRN(doFinalClose);
      }
    });
  }, [translateY, doFinalClose]);

  // Open animation: spring from DISMISS_Y → OPEN_Y
  useEffect(() => {
    if (visible) {
      isClosing.current = false;
      translateY.value = withSpring(OPEN_Y, SPRING_CONFIG);
    }
  }, [visible, translateY]);

  // =========================================================================
  // Back Button Handling
  // =========================================================================

  useEffect(() => {
    if (!visible) return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (filterView === "datePicker" || filterView === "personPicker") {
        setFilterView("menu");
        setShowAndroidPicker(false);
        return true;
      }
      if (filterView === "menu") {
        setFilterView("none");
        return true;
      }
      closeSheet();
      return true;
    });
    return () => handler.remove();
  }, [visible, filterView, closeSheet]);

  // =========================================================================
  // Drag Gesture
  // =========================================================================

  const dragGesture = Gesture.Pan()
    .onStart(() => {
      gestureStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      const newY = gestureStartY.value + event.translationY;
      // Clamp: don't go above the open position
      translateY.value = Math.max(OPEN_Y, newY);
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 500) {
        scheduleOnRN(closeSheet);
      } else {
        translateY.value = withSpring(OPEN_Y, SPRING_CONFIG);
      }
    });

  // =========================================================================
  // Animated Styles
  // =========================================================================

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  /** Backdrop opacity fades with sheet position — 1 when open, 0 when dismissed */
  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [OPEN_Y, DISMISS_Y],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  // =========================================================================
  // Result Tap Handlers
  // =========================================================================

  const handleResultPress = useCallback(
    (result: SearchResult) => {
      if (query.trim()) {
        saveRecentSearch(query.trim());
      }

      if (result.type === "conversation") {
        const c = result.conversation;
        closeSheet();
        setTimeout(() => {
          void (async () => {
            if (c.type === "dm") {
              try {
                await prepareDmThreadEntry({
                  avatarUrl: c.profilePictureUrl || c.avatarUrl,
                  decorationId: c.decorationId,
                });
              } catch (error) {
                log.warn("[SearchSheet] Failed to warm DM thread identity", {
                  error,
                });
              }

              navigation.navigate("ChatDetail", {
                friendUid: c.otherUserId,
                initialData: {
                  chatId: c.id,
                  friendName: c.name,
                  friendAvatar: c.profilePictureUrl || c.avatarUrl,
                  friendAvatarConfig: c.avatarConfig,
                  friendDecorationId: c.decorationId,
                },
              });
            } else {
              try {
                await prepareGroupThreadEntry(c.id, {
                  groupAvatarUrl: c.avatarUrl,
                });
              } catch (error) {
                log.warn("[SearchSheet] Failed to warm group thread identity", {
                  error,
                });
              }

              navigation.navigate("GroupChat", {
                groupId: c.id,
                groupName: c.name,
                initialGroupData: { name: c.name, avatarUrl: c.avatarUrl },
              });
            }
          })();
        }, 50);
      } else if (result.type === "message") {
        closeSheet();
        setTimeout(() => {
          void (async () => {
            if (result.conversationScope === "dm") {
              try {
                await prepareDmThreadEntry({
                  avatarUrl: result.conversationAvatar,
                });
              } catch (error) {
                log.warn("[SearchSheet] Failed to warm DM result identity", {
                  error,
                });
              }

              navigation.navigate("ChatDetail", {
                friendUid: result.otherUserId || result.senderId,
                targetMessageId: result.messageId,
                initialData: {
                  chatId: result.conversationId,
                  friendName: result.conversationName,
                  friendAvatar: result.conversationAvatar,
                },
              });
            } else {
              try {
                await prepareGroupThreadEntry(result.conversationId, {
                  groupAvatarUrl: result.conversationAvatar,
                });
              } catch (error) {
                log.warn(
                  "[SearchSheet] Failed to warm group result identity",
                  { error },
                );
              }

              navigation.navigate("GroupChat", {
                groupId: result.conversationId,
                groupName: result.conversationName,
                targetMessageId: result.messageId,
                initialGroupData: {
                  name: result.conversationName,
                  avatarUrl: result.conversationAvatar,
                },
              });
            }
          })();
        }, 50);
      }
    },
    [navigation, query, saveRecentSearch, closeSheet],
  );

  const handleRecentTap = useCallback(
    (term: string) => {
      setQuery(term);
    },
    [setQuery],
  );

  // =========================================================================
  // Filter Handlers
  // =========================================================================

  /** Toggle a scope filter (DMs / Groups) */
  const handleScopeSelect = useCallback(
    (key: ScopeFilter) => {
      Keyboard.dismiss();
      setScopeFilter(scopeFilter === key ? "all" : key);
      setFilterView("none");
    },
    [scopeFilter, setScopeFilter],
  );

  /** Toggle a content filter (Media / Links / Files) */
  const handleContentSelect = useCallback(
    (key: ContentFilter) => {
      Keyboard.dismiss();
      setContentFilter(contentFilter === key ? "all" : key);
      setFilterView("none");
    },
    [contentFilter, setContentFilter],
  );

  /** Open date picker for a specific mode */
  const handleOpenDatePicker = useCallback(
    (mode: DatePickerMode) => {
      let initialDate = new Date();
      if (mode === "after" && dateRange.after) {
        initialDate = new Date(dateRange.after);
      } else if (mode === "before" && dateRange.before) {
        initialDate = new Date(dateRange.before);
      } else if (
        mode === "sentOn" &&
        dateRange.after &&
        isSentOnRange(dateRange)
      ) {
        initialDate = new Date(dateRange.after);
      }
      setDatePickerMode(mode);
      setDatePickerValue(initialDate);
      setFilterView("datePicker");
      if (Platform.OS === "android") {
        setShowAndroidPicker(true);
      }
    },
    [dateRange],
  );

  /** Confirm date picker selection */
  const handleDateConfirm = useCallback(
    (date: Date) => {
      switch (datePickerMode) {
        case "after":
          setDateRange({ ...dateRange, after: date.getTime() });
          break;
        case "before": {
          // Set to end of selected day
          const endOfDay = new Date(date);
          endOfDay.setHours(23, 59, 59, 999);
          setDateRange({ ...dateRange, before: endOfDay.getTime() });
          break;
        }
        case "sentOn": {
          const start = new Date(date);
          start.setHours(0, 0, 0, 0);
          const end = new Date(date);
          end.setHours(23, 59, 59, 999);
          setDateRange({ after: start.getTime(), before: end.getTime() });
          break;
        }
      }
      setFilterView("none");
      setShowAndroidPicker(false);
    },
    [datePickerMode, dateRange, setDateRange],
  );

  /** Handle native picker change event */
  const handleDatePickerChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        setShowAndroidPicker(false);
        if (event.type === "set" && selectedDate) {
          handleDateConfirm(selectedDate);
        } else {
          // Cancelled on Android
          setFilterView("menu");
        }
      } else if (selectedDate) {
        setDatePickerValue(selectedDate);
      }
    },
    [handleDateConfirm],
  );

  /** Select a person from the picker */
  const handlePersonSelect = useCallback(
    (userId: string, displayName: string) => {
      setPersonFilter({ userId, displayName });
      setFilterView("none");
    },
    [setPersonFilter],
  );

  /** Apply a browse shortcut (media/files/links) */
  const handleBrowseShortcut = useCallback(
    (key: ContentFilter) => {
      Keyboard.dismiss();
      setContentFilter(key);
    },
    [setContentFilter],
  );

  /** Clear all filters at once */
  const handleClearAllFilters = useCallback(() => {
    setScopeFilter("all");
    setContentFilter("all");
    setDateRange({});
    setPersonFilter(null);
  }, [setScopeFilter, setContentFilter, setDateRange, setPersonFilter]);

  // =========================================================================
  // Derived Data
  // =========================================================================

  const renderResult = useCallback(
    ({ item }: { item: SearchResult }) => (
      <SearchResultItem
        result={item}
        query={query}
        onPress={handleResultPress}
      />
    ),
    [query, handleResultPress],
  );

  const keyExtractor = useCallback((item: SearchResult, _index: number) => {
    if (item.type === "message") return `msg-${item.messageId}`;
    return `conv-${item.conversation.id}`;
  }, []);

  const messageCount = results.filter((r) => r.type === "message").length;
  const conversationCount = results.filter(
    (r) => r.type === "conversation",
  ).length;

  // Whether any filter beyond "all" is active
  const hasActiveFilters =
    scopeFilter !== "all" ||
    contentFilter !== "all" ||
    !!dateRange.after ||
    !!dateRange.before ||
    !!personFilter;

  const sentOn = isSentOnRange(dateRange);

  // Contacts list for person picker (extracted from DM conversations)
  const contacts = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      decorationId: string | null;
    }> = [];
    for (const c of allConversations) {
      if (c.type === "dm" && c.otherUserId && !seen.has(c.otherUserId)) {
        seen.add(c.otherUserId);
        list.push({
          userId: c.otherUserId,
          displayName: c.name,
          avatarUrl: c.profilePictureUrl || c.avatarUrl || null,
          decorationId: c.decorationId || null,
        });
      }
    }
    return list.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [allConversations]);

  // Token colors
  const tokenBg = colors.surfaceVariant;

  // =========================================================================
  // Render — animationType="none" so Reanimated controls everything.
  // Backdrop and sheet are SIBLINGS inside Modal (not nested).
  // Backdrop fades via opacity interpolated from translateY.
  // Sheet slides via translateY spring animation.
  // =========================================================================

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeSheet}
    >
      {/* Backdrop — absolute fill, opacity only, NO transform/translate */}
      <Animated.View
        style={[styles.scrim, backdropAnimatedStyle]}
        pointerEvents="auto"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
      </Animated.View>

      {/* Sheet — positioned entirely via translateY spring */}
      <GestureDetector gesture={dragGesture}>
        <Animated.View
          style={[
            styles.sheet,
            sheetAnimatedStyle,
            {
              height: SCREEN_HEIGHT,
              backgroundColor: colors.background,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.handleContainer}>
            <View
              style={[
                styles.handle,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.3)"
                    : "rgba(0,0,0,0.2)",
                },
              ]}
            />
          </View>

          {/* Header Row: Title + Close */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Search Messages
            </Text>
            <IconButton
              icon="close"
              iconColor={colors.textSecondary}
              size={22}
              onPress={closeSheet}
              accessibilityLabel="Close search"
              style={styles.closeButton}
            />
          </View>

          {/* Search Bar + Filter Button */}
          <View style={styles.searchBarRow}>
            <View style={styles.searchBarFlex}>
              <Searchbar
                ref={searchbarRef}
                placeholder="Search messages, people, groups…"
                value={query}
                onChangeText={setQuery}
                autoFocus={filterView === "none"}
                style={[
                  styles.searchbar,
                  { backgroundColor: colors.surfaceVariant },
                ]}
                inputStyle={[styles.searchInput, { color: colors.text }]}
                iconColor={colors.textSecondary}
                onSubmitEditing={() => {
                  if (query.trim()) {
                    saveRecentSearch(query.trim());
                  }
                  Keyboard.dismiss();
                }}
              />
            </View>
            <IconButton
              icon="tune"
              iconColor={
                hasActiveFilters ? colors.primary : colors.textSecondary
              }
              size={22}
              onPress={() => {
                Keyboard.dismiss();
                setFilterView(filterView === "none" ? "menu" : "none");
              }}
              accessibilityLabel={
                filterView === "none" ? "Open filters" : "Close filters"
              }
              style={[
                styles.filterButton,
                hasActiveFilters && {
                  backgroundColor: colors.primary + "18",
                  borderRadius: 20,
                },
              ]}
            />
          </View>

          {/* Active Filter Tokens */}
          {hasActiveFilters && filterView === "none" && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.activeTokensScroll}
              contentContainerStyle={styles.activeTokensContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Scope token */}
              {scopeFilter !== "all" && (
                <Chip
                  onClose={() => setScopeFilter("all")}
                  icon={scopeFilter === "dms" ? "account" : "account-group"}
                  style={[styles.activeToken, { backgroundColor: tokenBg }]}
                  textStyle={[styles.tokenText, { color: colors.text }]}
                  closeIconAccessibilityLabel="Clear scope filter"
                >
                  {scopeFilter === "dms" ? "DMs" : "Groups"}
                </Chip>
              )}

              {/* Content token */}
              {contentFilter !== "all" && (
                <Chip
                  onClose={() => setContentFilter("all")}
                  icon={getContentIcon(contentFilter)}
                  style={[styles.activeToken, { backgroundColor: tokenBg }]}
                  textStyle={[styles.tokenText, { color: colors.text }]}
                  closeIconAccessibilityLabel="Clear content filter"
                >
                  Has: {getContentLabel(contentFilter)}
                </Chip>
              )}

              {/* Date tokens */}
              {sentOn ? (
                <Chip
                  onClose={() => setDateRange({})}
                  icon="calendar"
                  style={[styles.activeToken, { backgroundColor: tokenBg }]}
                  textStyle={[styles.tokenText, { color: colors.text }]}
                  closeIconAccessibilityLabel="Clear date filter"
                >
                  On: {formatShortDate(dateRange.after!)}
                </Chip>
              ) : (
                <>
                  {dateRange.after && (
                    <Chip
                      onClose={() =>
                        setDateRange({ ...dateRange, after: undefined })
                      }
                      icon="calendar-arrow-right"
                      style={[styles.activeToken, { backgroundColor: tokenBg }]}
                      textStyle={[styles.tokenText, { color: colors.text }]}
                      closeIconAccessibilityLabel="Clear after-date filter"
                    >
                      After: {formatShortDate(dateRange.after)}
                    </Chip>
                  )}
                  {dateRange.before && (
                    <Chip
                      onClose={() =>
                        setDateRange({ ...dateRange, before: undefined })
                      }
                      icon="calendar-arrow-left"
                      style={[styles.activeToken, { backgroundColor: tokenBg }]}
                      textStyle={[styles.tokenText, { color: colors.text }]}
                      closeIconAccessibilityLabel="Clear before-date filter"
                    >
                      Before: {formatShortDate(dateRange.before)}
                    </Chip>
                  )}
                </>
              )}

              {/* Person token */}
              {personFilter && (
                <Chip
                  onClose={() => setPersonFilter(null)}
                  icon="account"
                  style={[styles.activeToken, { backgroundColor: tokenBg }]}
                  textStyle={[styles.tokenText, { color: colors.text }]}
                  closeIconAccessibilityLabel="Clear person filter"
                >
                  From: {personFilter.displayName}
                </Chip>
              )}
            </ScrollView>
          )}

          {/* ============================================================= */}
          {/* CONTENT AREA — switches based on filterView                    */}
          {/* ============================================================= */}

          {/* --- RESULTS VIEW (default) --- */}
          {filterView === "none" && (
            <View style={styles.resultsContainer}>
              {/* Loading */}
              {isSearching && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text
                    style={[
                      styles.loadingText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Searching…
                  </Text>
                </View>
              )}

              {/* Results list */}
              {!isSearching && hasSearched && results.length > 0 && (
                <>
                  <View style={styles.resultsHeader}>
                    <Text
                      style={[
                        styles.resultsCount,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {results.length} result
                      {results.length !== 1 ? "s" : ""}
                      {messageCount > 0 && conversationCount > 0
                        ? ` · ${messageCount} message${messageCount !== 1 ? "s" : ""}, ${conversationCount} conversation${conversationCount !== 1 ? "s" : ""}`
                        : ""}
                    </Text>
                  </View>

                  <FlatList
                    data={results}
                    renderItem={renderResult}
                    keyExtractor={keyExtractor}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    style={styles.resultsList}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    initialNumToRender={15}
                    maxToRenderPerBatch={10}
                    removeClippedSubviews={Platform.OS === "android"}
                  />
                </>
              )}

              {/* Empty results */}
              {!isSearching && hasSearched && results.length === 0 && (
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons
                    name="magnify-close"
                    size={48}
                    color={colors.textSecondary}
                  />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    No results found
                  </Text>
                  <Text
                    style={[
                      styles.emptySubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Try different keywords or adjust your filters
                  </Text>
                </View>
              )}

              {/* Pre-query state: recent searches + browse shortcuts */}
              {!hasSearched && !isSearching && (
                <ScrollView
                  style={styles.preQueryContainer}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <View style={styles.recentContainer}>
                      <View style={styles.sectionHeader}>
                        <Text
                          style={[
                            styles.sectionTitle,
                            { color: colors.textSecondary },
                          ]}
                        >
                          RECENT SEARCHES
                        </Text>
                        <TouchableOpacity
                          onPress={clearAllRecentSearches}
                          hitSlop={{
                            top: 8,
                            bottom: 8,
                            left: 8,
                            right: 8,
                          }}
                        >
                          <Text
                            style={[
                              styles.clearAllText,
                              { color: colors.primary },
                            ]}
                          >
                            Clear All
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {recentSearches.map((term, index) => (
                        <TouchableOpacity
                          key={`recent-${index}`}
                          style={[
                            styles.recentItem,
                            { borderBottomColor: colors.border },
                          ]}
                          onPress={() => handleRecentTap(term)}
                          accessibilityRole="button"
                          accessibilityLabel={`Search for ${term}`}
                        >
                          <View style={styles.recentItemLeft}>
                            <MaterialCommunityIcons
                              name="history"
                              size={18}
                              color={colors.textSecondary}
                              style={styles.recentIcon}
                            />
                            <Text
                              style={[
                                styles.recentText,
                                { color: colors.text },
                              ]}
                              numberOfLines={1}
                            >
                              {term}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => removeRecentSearchItem(term)}
                            hitSlop={{
                              top: 8,
                              bottom: 8,
                              left: 8,
                              right: 8,
                            }}
                            accessibilityLabel={`Remove ${term}`}
                          >
                            <MaterialCommunityIcons
                              name="close"
                              size={16}
                              color={colors.textSecondary}
                            />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Browse Shortcuts */}
                  <View style={styles.browseSection}>
                    <Text
                      style={[
                        styles.sectionTitle,
                        { color: colors.textSecondary },
                      ]}
                    >
                      BROWSE
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.browseRow,
                        { borderBottomColor: colors.border },
                      ]}
                      onPress={() => handleBrowseShortcut("media")}
                    >
                      <MaterialCommunityIcons
                        name="image-multiple"
                        size={20}
                        color={colors.primary}
                        style={styles.browseIcon}
                      />
                      <Text
                        style={[styles.browseLabel, { color: colors.text }]}
                      >
                        All media
                      </Text>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.browseRow,
                        { borderBottomColor: colors.border },
                      ]}
                      onPress={() => handleBrowseShortcut("links")}
                    >
                      <MaterialCommunityIcons
                        name="link"
                        size={20}
                        color={colors.primary}
                        style={styles.browseIcon}
                      />
                      <Text
                        style={[styles.browseLabel, { color: colors.text }]}
                      >
                        All links
                      </Text>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.browseRow,
                        { borderBottomColor: colors.border },
                      ]}
                      onPress={() => handleBrowseShortcut("files")}
                    >
                      <MaterialCommunityIcons
                        name="file-document-outline"
                        size={20}
                        color={colors.primary}
                        style={styles.browseIcon}
                      />
                      <Text
                        style={[styles.browseLabel, { color: colors.text }]}
                      >
                        All files
                      </Text>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Tip */}
                  {recentSearches.length === 0 && (
                    <View style={styles.tipContainer}>
                      <MaterialCommunityIcons
                        name="text-search"
                        size={48}
                        color={colors.textSecondary}
                        style={{ opacity: 0.4 }}
                      />
                      <Text style={[styles.tipTitle, { color: colors.text }]}>
                        Search your messages
                      </Text>
                      <Text
                        style={[
                          styles.tipSubtitle,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Find messages across all your chats, or browse by
                        content type using the shortcuts above
                      </Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          )}

          {/* --- FILTER MENU VIEW --- */}
          {filterView === "menu" && (
            <View style={styles.filterMenuContainer}>
              {/* Back row */}
              <TouchableOpacity
                style={styles.filterBackRow}
                onPress={() => setFilterView("none")}
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={20}
                  color={colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterBackLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Back to results
                </Text>
              </TouchableOpacity>

              <ScrollView
                style={styles.filterMenuScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* SCOPE */}
                <Text
                  style={[
                    styles.filterSectionTitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  SCOPE
                </Text>
                <FilterMenuItem
                  icon="account"
                  label="DMs only"
                  active={scopeFilter === "dms"}
                  colors={colors}
                  onPress={() => handleScopeSelect("dms")}
                />
                <FilterMenuItem
                  icon="account-group"
                  label="Groups only"
                  active={scopeFilter === "groups"}
                  colors={colors}
                  onPress={() => handleScopeSelect("groups")}
                />

                {/* CONTENT */}
                <Text
                  style={[
                    styles.filterSectionTitle,
                    { color: colors.textSecondary },
                    { marginTop: 16 },
                  ]}
                >
                  CONTENT
                </Text>
                <FilterMenuItem
                  icon="image"
                  label="Has: Media"
                  active={contentFilter === "media"}
                  colors={colors}
                  onPress={() => handleContentSelect("media")}
                />
                <FilterMenuItem
                  icon="link"
                  label="Has: Links"
                  active={contentFilter === "links"}
                  colors={colors}
                  onPress={() => handleContentSelect("links")}
                />
                <FilterMenuItem
                  icon="file-document-outline"
                  label="Has: Files"
                  active={contentFilter === "files"}
                  colors={colors}
                  onPress={() => handleContentSelect("files")}
                />

                {/* FROM */}
                <Text
                  style={[
                    styles.filterSectionTitle,
                    { color: colors.textSecondary },
                    { marginTop: 16 },
                  ]}
                >
                  FROM
                </Text>
                <FilterMenuItem
                  icon="account-search"
                  label="From a person"
                  value={personFilter?.displayName}
                  active={!!personFilter}
                  colors={colors}
                  onPress={() => setFilterView("personPicker")}
                />

                {/* DATE */}
                <Text
                  style={[
                    styles.filterSectionTitle,
                    { color: colors.textSecondary },
                    { marginTop: 16 },
                  ]}
                >
                  DATE
                </Text>
                <FilterMenuItem
                  icon="calendar-arrow-right"
                  label="After a date"
                  value={
                    !sentOn && dateRange.after
                      ? formatShortDate(dateRange.after)
                      : undefined
                  }
                  active={!sentOn && !!dateRange.after}
                  colors={colors}
                  onPress={() => handleOpenDatePicker("after")}
                />
                <FilterMenuItem
                  icon="calendar-arrow-left"
                  label="Before a date"
                  value={
                    !sentOn && dateRange.before
                      ? formatShortDate(dateRange.before)
                      : undefined
                  }
                  active={!sentOn && !!dateRange.before}
                  colors={colors}
                  onPress={() => handleOpenDatePicker("before")}
                />
                <FilterMenuItem
                  icon="calendar"
                  label="Sent on a date"
                  value={sentOn ? formatShortDate(dateRange.after!) : undefined}
                  active={sentOn}
                  colors={colors}
                  onPress={() => handleOpenDatePicker("sentOn")}
                />

                {/* Clear all */}
                {hasActiveFilters && (
                  <TouchableOpacity
                    style={styles.clearAllRow}
                    onPress={handleClearAllFilters}
                  >
                    <MaterialCommunityIcons
                      name="filter-remove"
                      size={20}
                      color={colors.error || "#ef4444"}
                    />
                    <Text
                      style={[
                        styles.clearAllFilterText,
                        { color: colors.error || "#ef4444" },
                      ]}
                    >
                      Clear all filters
                    </Text>
                  </TouchableOpacity>
                )}

                <View style={{ height: 32 }} />
              </ScrollView>
            </View>
          )}

          {/* --- DATE PICKER VIEW --- */}
          {filterView === "datePicker" && (
            <View style={styles.datePickerContainer}>
              {/* Header */}
              <TouchableOpacity
                style={styles.filterBackRow}
                onPress={() => {
                  setFilterView("menu");
                  setShowAndroidPicker(false);
                }}
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={20}
                  color={colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterBackLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Back to filters
                </Text>
              </TouchableOpacity>

              <Text style={[styles.datePickerTitle, { color: colors.text }]}>
                {datePickerMode === "after"
                  ? "After a date"
                  : datePickerMode === "before"
                    ? "Before a date"
                    : "Sent on a date"}
              </Text>

              <Text
                style={[styles.datePickerHint, { color: colors.textSecondary }]}
              >
                {datePickerMode === "after"
                  ? "Show messages sent after this date"
                  : datePickerMode === "before"
                    ? "Show messages sent before this date"
                    : "Show messages sent on this specific date"}
              </Text>

              {/* iOS inline picker */}
              {Platform.OS === "ios" && (
                <View style={styles.datePickerIOS}>
                  <DateTimePicker
                    value={datePickerValue}
                    mode="date"
                    display="inline"
                    onChange={handleDatePickerChange}
                    maximumDate={new Date()}
                    themeVariant={isDark ? "dark" : "light"}
                  />
                  <View style={styles.datePickerActions}>
                    <TouchableOpacity
                      style={[
                        styles.datePickerBtn,
                        { backgroundColor: colors.surfaceVariant },
                      ]}
                      onPress={() => setFilterView("menu")}
                    >
                      <Text
                        style={[
                          styles.datePickerBtnText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.datePickerBtn,
                        { backgroundColor: colors.primary },
                      ]}
                      onPress={() => handleDateConfirm(datePickerValue)}
                    >
                      <Text
                        style={[styles.datePickerBtnText, { color: "#fff" }]}
                      >
                        Apply
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Android modal picker */}
              {Platform.OS === "android" && showAndroidPicker && (
                <DateTimePicker
                  value={datePickerValue}
                  mode="date"
                  display="default"
                  onChange={handleDatePickerChange}
                  maximumDate={new Date()}
                />
              )}

              {/* Android: show selected date + re-pick button */}
              {Platform.OS === "android" && !showAndroidPicker && (
                <View style={styles.androidDateDisplay}>
                  <Text
                    style={[styles.androidDateText, { color: colors.text }]}
                  >
                    {formatShortDate(datePickerValue.getTime())}
                  </Text>
                  <View style={styles.datePickerActions}>
                    <TouchableOpacity
                      style={[
                        styles.datePickerBtn,
                        { backgroundColor: colors.surfaceVariant },
                      ]}
                      onPress={() => setShowAndroidPicker(true)}
                    >
                      <Text
                        style={[
                          styles.datePickerBtnText,
                          { color: colors.text },
                        ]}
                      >
                        Change date
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.datePickerBtn,
                        { backgroundColor: colors.primary },
                      ]}
                      onPress={() => handleDateConfirm(datePickerValue)}
                    >
                      <Text
                        style={[styles.datePickerBtnText, { color: "#fff" }]}
                      >
                        Apply
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* --- PERSON PICKER VIEW --- */}
          {filterView === "personPicker" && (
            <View style={styles.personPickerContainer}>
              {/* Header */}
              <TouchableOpacity
                style={styles.filterBackRow}
                onPress={() => setFilterView("menu")}
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={20}
                  color={colors.textSecondary}
                />
                <Text
                  style={[
                    styles.filterBackLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Back to filters
                </Text>
              </TouchableOpacity>

              <Text style={[styles.personPickerTitle, { color: colors.text }]}>
                From a person
              </Text>

              {/* Clear option */}
              {personFilter && (
                <TouchableOpacity
                  style={[
                    styles.personRow,
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={() => {
                    setPersonFilter(null);
                    setFilterView("none");
                  }}
                >
                  <MaterialCommunityIcons
                    name="account-remove"
                    size={22}
                    color={colors.error || "#ef4444"}
                    style={styles.personIcon}
                  />
                  <Text
                    style={[
                      styles.personName,
                      { color: colors.error || "#ef4444" },
                    ]}
                  >
                    Clear person filter
                  </Text>
                </TouchableOpacity>
              )}

              {/* Contact list */}
              <FlatList
                data={contacts}
                keyExtractor={(item) => item.userId}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.personRow,
                      { borderBottomColor: colors.border },
                    ]}
                    onPress={() =>
                      handlePersonSelect(item.userId, item.displayName)
                    }
                  >
                    <View style={styles.personAvatar}>
                      <ProfilePictureWithDecoration
                        pictureUrl={item.avatarUrl}
                        name={item.displayName}
                        decorationId={item.decorationId}
                        size={32}
                      />
                    </View>
                    <Text
                      style={[
                        styles.personName,
                        {
                          color:
                            personFilter?.userId === item.userId
                              ? colors.primary
                              : colors.text,
                          fontWeight:
                            personFilter?.userId === item.userId
                              ? "600"
                              : "400",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.displayName}
                    </Text>
                    {personFilter?.userId === item.userId && (
                      <MaterialCommunityIcons
                        name="check"
                        size={18}
                        color={colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text
                      style={[
                        styles.emptySubtitle,
                        { color: colors.textSecondary },
                      ]}
                    >
                      No contacts found
                    </Text>
                  </View>
                }
              />
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

// =============================================================================
// FilterMenuItem Sub-component
// =============================================================================

function FilterMenuItem({
  icon,
  label,
  value,
  active,
  colors,
  onPress,
}: {
  icon: string;
  label: string;
  value?: string;
  active: boolean;
  colors: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.filterMenuItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={22}
        color={active ? colors.primary : colors.textSecondary}
        style={styles.filterMenuIcon}
      />
      <Text
        style={[
          styles.filterMenuLabel,
          {
            color: active ? colors.primary : colors.text,
            fontWeight: active ? "600" : "400",
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {value ? (
        <Text
          style={[styles.filterMenuValue, { color: colors.primary }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : (
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={colors.textSecondary}
        />
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 24,
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingTop: 2,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    margin: 0,
  },

  // Search bar
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: 6,
    gap: 4,
  },
  searchBarFlex: {
    flex: 1,
  },
  filterButton: {
    margin: 0,
  },
  searchbar: {
    elevation: 0,
    borderRadius: BorderRadius.lg,
    height: 44,
    justifyContent: "center",
  },
  searchInput: {
    fontSize: 15,
    alignSelf: "center",
    textAlignVertical: "center",
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: -4,
  },

  // Active filter tokens
  activeTokensScroll: {
    maxHeight: 44,
  },
  activeTokensContent: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingBottom: 6,
    gap: 8,
    alignItems: "center",
  },
  activeToken: {
    borderRadius: BorderRadius.full,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenText: {
    fontSize: 12,
    lineHeight: 14,
  },

  // Results
  resultsContainer: {
    flex: 1,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  resultsHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  resultsList: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },

  // Pre-query
  preQueryContainer: {
    flex: 1,
  },
  recentContainer: {
    paddingTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    paddingBottom: 6,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: "500",
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  recentIcon: {
    marginRight: 12,
  },
  recentText: {
    fontSize: 15,
    flex: 1,
  },

  // Browse shortcuts
  browseSection: {
    paddingBottom: 8,
  },
  browseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  browseIcon: {
    marginRight: 14,
    width: 24,
    textAlign: "center",
  },
  browseLabel: {
    flex: 1,
    fontSize: 15,
  },

  // Tip
  tipContainer: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: Spacing.xl,
  },
  tipTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginTop: 16,
  },
  tipSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },

  // Filter menu
  filterMenuContainer: {
    flex: 1,
  },
  filterBackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 8,
  },
  filterBackLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  filterMenuScroll: {
    flex: 1,
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
    paddingBottom: 6,
  },
  filterMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterMenuIcon: {
    marginRight: 14,
    width: 24,
    textAlign: "center",
  },
  filterMenuLabel: {
    flex: 1,
    fontSize: 15,
  },
  filterMenuValue: {
    fontSize: 13,
    fontWeight: "500",
    maxWidth: 140,
  },
  clearAllRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 16,
    gap: 10,
    marginTop: 8,
  },
  clearAllFilterText: {
    fontSize: 14,
    fontWeight: "500",
  },

  // Date picker
  datePickerContainer: {
    flex: 1,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
  },
  datePickerHint: {
    fontSize: 13,
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
    paddingBottom: 12,
  },
  datePickerIOS: {
    paddingHorizontal: Spacing.md,
    alignItems: "center",
  },
  datePickerActions: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: Spacing.md,
    justifyContent: "center",
  },
  datePickerBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    minWidth: 100,
    alignItems: "center",
  },
  datePickerBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  androidDateDisplay: {
    alignItems: "center",
    paddingTop: 32,
  },
  androidDateText: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },

  // Person picker
  personPickerContainer: {
    flex: 1,
  },
  personPickerTitle: {
    fontSize: 18,
    fontWeight: "600",
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
    paddingBottom: 12,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  personIcon: {
    marginRight: 14,
    width: 24,
    textAlign: "center",
  },
  personAvatar: {
    marginRight: 12,
  },
  personName: {
    flex: 1,
    fontSize: 15,
  },
});
