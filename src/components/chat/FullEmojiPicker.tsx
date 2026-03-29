/**
 * FullEmojiPicker — Custom vertical-scroll emoji picker modal.
 *
 * Single continuous list with section dividers, search bar at top,
 * category navigation at bottom. Draggable to dismiss.
 */

import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useRef, useState } from "react";
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
import { Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DraggableBottomSheet } from "./DraggableBottomSheet";

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
const { width: SCREEN_WIDTH } = Dimensions.get("window");
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

export function FullEmojiPicker({
  open,
  onClose,
  onEmojiSelected,
}: FullEmojiPickerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const sectionListRef = useRef<SectionList>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);

  const close = useCallback(() => {
    setSearchQuery("");
    setActiveCategoryIndex(0);
    onClose();
  }, [onClose]);

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
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <Text
          variant="labelLarge"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {section.displayTitle}
        </Text>
      </View>
    ),
    [theme],
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
      open={open}
      onClose={close}
      snapPoints={[0.45, 0.85]}
      initialSnapIndex={1}
    >
      {/* Search bar */}
      <View
        style={[
          styles.searchContainer,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <Text
          style={{
            color: theme.colors.onSurfaceVariant,
            fontSize: 16,
            marginRight: 8,
          }}
        >
          🔍
        </Text>
        <TextInput
          style={[styles.searchInput, { color: theme.colors.onSurface }]}
          placeholder="Search emoji..."
          placeholderTextColor={theme.colors.onSurfaceVariant}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Text
              style={{ color: theme.colors.onSurfaceVariant, fontSize: 16 }}
            >
              ✕
            </Text>
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
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.dark
              ? "rgba(255,255,255,0.1)"
              : "rgba(0,0,0,0.1)",
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
                backgroundColor: theme.colors.primaryContainer,
              },
            ]}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </DraggableBottomSheet>
  );
}

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
