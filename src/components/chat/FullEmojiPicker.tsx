/**
 * FullEmojiPicker — Custom vertical-scroll emoji picker modal.
 *
 * Single continuous list with section dividers, search bar at top,
 * category navigation at bottom. Draggable to dismiss.
 *
 * Supports keyboard-replacement mode: when `keyboardHeight` is provided,
 * the sheet opens to a keyboard-equivalent initial height and expands
 * to full height when the search field is focused.
 */

import { useColors, useIsDark } from "@/store/ThemeContext";
import * as Haptics from "expo-haptics";
import React, {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  SectionList,
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

// Emoji data — use the library's public export
import { emojisByCategory as rawEmojisByCategory } from "rn-emoji-keyboard";

// ─── Types ───────────────────────────────────────────────────────────────────

interface JsonEmoji {
  emoji: string;
  name: string;
  v: string;
  toneEnabled: boolean;
  keywords?: string[];
}

interface EmojiSection {
  title: string;
  displayTitle: string;
  icon: string;
  data: JsonEmoji[][];
}

export interface FullEmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onEmojiSelected: (emoji: string) => void;
  /** When provided, the sheet opens to this height first (keyboard replacement). */
  keyboardHeight?: number;
  /** Shared Reanimated value for composer offset coordination. */
  sharedTranslateY?: SharedValue<number>;
}

// ─── Category config ─────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { display: string; icon: string }> = {
  smileys_emotion: { display: "Smileys & Emotion", icon: "😀" },
  people_body: { display: "People & Body", icon: "👋" },
  animals_nature: { display: "Animals & Nature", icon: "🐻" },
  food_drink: { display: "Food & Drink", icon: "🍔" },
  travel_places: { display: "Travel & Places", icon: "✈️" },
  activities: { display: "Activities", icon: "⚽" },
  objects: { display: "Objects", icon: "💡" },
  symbols: { display: "Symbols", icon: "❤️" },
  flags: { display: "Flags", icon: "🏁" },
};

// ─── Layout constants ────────────────────────────────────────────────────────

const EMOJI_SIZE = 42;
const EMOJI_GAP = 2;
const H_PADDING = 12;
const { width: SCREEN_WIDTH, height: EMOJI_SCREEN_HEIGHT } =
  Dimensions.get("window");

/** Expanded snap fraction (85% of screen) */
const EXPANDED_SNAP = 0.85;
/** Fallback small snap when no keyboard height is known */
const FALLBACK_SMALL_SNAP = 0.45;
const NUM_COLUMNS = Math.floor(
  (SCREEN_WIDTH - H_PADDING * 2) / (EMOJI_SIZE + EMOJI_GAP),
);

function chunkArray<T>(arr: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size) as T[]);
  }
  return chunks;
}

// Pre-process sections (static, computed once)
const ALL_SECTIONS: EmojiSection[] = (rawEmojisByCategory ?? []).map((cat) => ({
  title: cat.title,
  displayTitle: CATEGORY_CONFIG[cat.title]?.display ?? cat.title,
  icon: CATEGORY_CONFIG[cat.title]?.icon ?? "❓",
  data: chunkArray(cat.data ?? [], NUM_COLUMNS),
}));

// ─── Component ───────────────────────────────────────────────────────────────

export const FullEmojiPicker = forwardRef<
  DraggableBottomSheetHandle,
  FullEmojiPickerProps
>(function FullEmojiPicker(
  { open, onClose, onEmojiSelected, keyboardHeight, sharedTranslateY },
  ref,
) {
  const colors = useColors();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const sectionListRef = useRef<SectionList>(null);
  const sheetRef = useRef<DraggableBottomSheetHandle>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);

  // Forward imperative handle
  React.useImperativeHandle(ref, () => ({
    snapToIndex: (index: number) => sheetRef.current?.snapToIndex(index),
  }));

  // ── Snap points — keyboard-equivalent initial, expanded secondary ───────
  const snapPoints = useMemo(() => {
    if (keyboardHeight && keyboardHeight > 0) {
      // +8 aligns the modal with the keyboard height
      const kbFraction = Math.min(
        (keyboardHeight + 7) / EMOJI_SCREEN_HEIGHT,
        EXPANDED_SNAP - 0.05, // ensure there's room for an expanded snap above
      );
      return [kbFraction, EXPANDED_SNAP];
    }
    return [FALLBACK_SMALL_SNAP, EXPANDED_SNAP];
  }, [keyboardHeight]);

  // When keyboardHeight is provided, open to index 0 (keyboard-equivalent)
  const initialSnapIndex = keyboardHeight ? 0 : 1;

  const close = useCallback(() => {
    setSearchQuery("");
    setActiveCategoryIndex(0);
    onClose();
  }, [onClose]);

  // ── Search focus handler — auto-expand sheet ────────────────────────────
  const handleSearchFocus = useCallback(() => {
    // Expand to the full snap point when the user taps the search bar
    sheetRef.current?.snapToIndex(1);
  }, []);

  // ── Search filtering ───────────────────────────────────────────────────────

  const sections = useMemo(() => {
    if (!searchQuery.trim()) return ALL_SECTIONS;
    const q = searchQuery.toLowerCase();
    return ALL_SECTIONS.map((section) => {
      const flat = section.data.flat();
      const filtered = flat.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.keywords?.some((k) => k.toLowerCase().includes(q)),
      );
      if (filtered.length === 0) return null;
      return { ...section, data: chunkArray(filtered, NUM_COLUMNS) };
    }).filter(Boolean) as EmojiSection[];
  }, [searchQuery]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleEmojiPress = useCallback(
    (emoji: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onEmojiSelected(emoji);
    },
    [onEmojiSelected],
  );

  const handleCategoryPress = useCallback(
    (index: number) => {
      if (searchQuery) setSearchQuery("");
      setActiveCategoryIndex(index);
      try {
        sectionListRef.current?.scrollToLocation({
          sectionIndex: index,
          itemIndex: 0,
          animated: true,
        });
      } catch {
        // scrollToLocation can throw if layout isn't ready
      }
    },
    [searchQuery],
  );

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderSectionHeader = useCallback(
    ({ section }: { section: any }) => (
      <View
        style={[
          styles.sectionHeader,
          { backgroundColor: colors.keyboardSurface ?? colors.surface },
        ]}
      >
        <Text variant="labelLarge" style={{ color: colors.textSecondary }}>
          {section.displayTitle}
        </Text>
      </View>
    ),
    [colors],
  );

  const renderRow = useCallback(
    ({ item: row }: { item: JsonEmoji[] }) => {
      if (!Array.isArray(row)) return null;
      return (
        <View style={styles.emojiRow}>
          {row.map((e) => (
            <Pressable
              key={e.emoji}
              onPress={() => handleEmojiPress(e.emoji)}
              style={({ pressed }) => [
                styles.emojiCell,
                pressed && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.emojiText}>{e.emoji}</Text>
            </Pressable>
          ))}
        </View>
      );
    },
    [handleEmojiPress],
  );

  const keyExtractor = useCallback(
    (item: JsonEmoji[], index: number) =>
      Array.isArray(item) ? item.map((e) => e.emoji).join("") : `row-${index}`,
    [],
  );

  // Track visible section for category highlight
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const firstSection = viewableItems[0]?.section;
      if (firstSection) {
        const idx = ALL_SECTIONS.findIndex(
          (s) => s.title === firstSection.title,
        );
        if (idx >= 0) setActiveCategoryIndex(idx);
      }
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  if (!open) return null;

  return (
    <DraggableBottomSheet
      ref={sheetRef}
      open={open}
      onClose={close}
      snapPoints={snapPoints}
      initialSnapIndex={initialSnapIndex}
      sharedTranslateY={sharedTranslateY}
      surfaceColor={colors.keyboardSurface ?? colors.surface}
      handleColor={colors.divider}
    >
      {/* Search bar */}
      <View
        style={[
          styles.searchContainer,
          { backgroundColor: colors.inputBackground ?? colors.surfaceVariant },
        ]}
      >
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 16,
            marginRight: 8,
          }}
        >
          🔍
        </Text>
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search emoji..."
          placeholderTextColor={colors.inputPlaceholder ?? colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={handleSearchFocus}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          returnKeyType="search"
          keyboardAppearance={isDark ? "dark" : "light"}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Text style={{ color: colors.textMuted, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Emoji list */}
      <SectionList
        ref={sectionListRef}
        sections={sections}
        renderItem={renderRow}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 8 }}
        initialNumToRender={8}
        maxToRenderPerBatch={12}
      />

      {/* Category navigation bar */}
      <View
        style={[
          styles.categoryBar,
          {
            backgroundColor: colors.keyboardSurface ?? colors.surface,
            borderTopColor: colors.divider,
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
      >
        {ALL_SECTIONS.map((cat, index) => (
          <TouchableOpacity
            key={cat.title}
            onPress={() => handleCategoryPress(index)}
            style={[
              styles.categoryBtn,
              activeCategoryIndex === index && {
                backgroundColor: colors.primaryContainer,
              },
            ]}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </DraggableBottomSheet>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: H_PADDING,
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
  list: {
    flex: 1,
  },
  sectionHeader: {
    paddingHorizontal: H_PADDING,
    paddingVertical: 8,
  },
  emojiRow: {
    flexDirection: "row",
    paddingHorizontal: H_PADDING,
  },
  emojiCell: {
    width: EMOJI_SIZE,
    height: EMOJI_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginRight: EMOJI_GAP,
    marginBottom: EMOJI_GAP,
  },
  emojiText: {
    fontSize: 28,
  },
  categoryBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  categoryBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryIcon: {
    fontSize: 20,
  },
});

export default FullEmojiPicker;
