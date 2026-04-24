/**
 * Games V4 — GamePickerModal
 *
 * Bottom-sheet game picker that opens as a keyboard-replacement sheet,
 * consistent with the GIF and Sticker pickers. Uses DraggableBottomSheet
 * and syncs with the composer via sharedTranslateY.
 *
 * @module gamesV4/components/GamePickerModal
 */

import {
  DraggableBottomSheet,
  type DraggableBottomSheetHandle,
} from "@/components/chat/DraggableBottomSheet";
import { getKeyboardReplacementSnapFraction } from "@/components/chat/bottomSheetLayout";
import {
  GAME_METADATA,
  IMPLEMENTED_GAME_IDS,
  type GameMetadata,
} from "@/gamesV4/constants";
import type { GameId } from "@/gamesV4/types";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =============================================================================
// Constants
// =============================================================================

const { height: GAME_SCREEN_HEIGHT } = Dimensions.get("window");
const GAME_EXPANDED_SNAP = 0.85;
const GAME_FALLBACK_SMALL_SNAP = 0.45;

// =============================================================================
// Types
// =============================================================================

export interface GamePickerModalProps {
  /** Whether the picker is visible */
  open: boolean;
  onSelect: (gameId: GameId) => void;
  onClose: () => void;
  /** If set, only show multiplayer games (for group/DM contexts). */
  multiplayerOnly?: boolean;
  /** When provided, the sheet opens to this height first (keyboard replacement). */
  keyboardHeight?: number;
  /** Shared Reanimated value for composer offset coordination. */
  sharedTranslateY?: SharedValue<number>;
}

interface GameSection {
  title: string;
  data: GameMetadata[];
}

// =============================================================================
// Component
// =============================================================================

export const GamePickerModal = forwardRef<
  DraggableBottomSheetHandle,
  GamePickerModalProps
>(function GamePickerModal(
  {
    open,
    onSelect,
    onClose,
    multiplayerOnly = false,
    keyboardHeight,
    sharedTranslateY,
  },
  ref,
) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<DraggableBottomSheetHandle>(null);

  useImperativeHandle(ref, () => ({
    snapToIndex: (index: number) => sheetRef.current?.snapToIndex(index),
  }));

  // ── Snap points — keyboard-equivalent initial, expanded secondary ─────
  const snapPoints = useMemo(() => {
    if (keyboardHeight && keyboardHeight > 0) {
      const kbFraction = getKeyboardReplacementSnapFraction(
        keyboardHeight,
        GAME_SCREEN_HEIGHT,
        GAME_EXPANDED_SNAP,
      );
      return [kbFraction, GAME_EXPANDED_SNAP];
    }
    return [GAME_FALLBACK_SMALL_SNAP, GAME_EXPANDED_SNAP];
  }, [keyboardHeight]);

  const initialSnapIndex = keyboardHeight ? 0 : 1;

  const sections = useMemo(() => {
    const all = Object.values(GAME_METADATA).filter((g) =>
      IMPLEMENTED_GAME_IDS.has(g.gameId),
    );
    const filtered = multiplayerOnly
      ? all.filter((g) => g.maxPlayers > 1)
      : all;

    const solo = filtered.filter((g) => g.runtimeType === "solo");
    const turnBased = filtered.filter((g) => g.runtimeType === "turnBased");
    const realtime = filtered.filter((g) => g.runtimeType === "realtime");

    const result: GameSection[] = [];
    if (turnBased.length > 0)
      result.push({ title: "Turn-Based", data: turnBased });
    if (realtime.length > 0) result.push({ title: "Realtime", data: realtime });
    if (solo.length > 0) result.push({ title: "Solo", data: solo });
    return result;
  }, [multiplayerOnly]);

  const textColor = isDark ? "#FFF" : "#000";
  const subtextColor = isDark ? "#999" : "#666";
  const borderColor = isDark ? "#333" : "#E0E0E0";
  const sheetSurface = isDark ? "#1C1C1E" : "#FFFFFF";

  const renderGame = (game: GameMetadata) => {
    const isImplemented = IMPLEMENTED_GAME_IDS.has(game.gameId);
    return (
      <TouchableOpacity
        key={game.gameId}
        style={[
          styles.gameItem,
          { borderBottomColor: borderColor },
          !isImplemented && { opacity: 0.45 },
        ]}
        onPress={() => {
          if (!isImplemented) return;
          onSelect(game.gameId);
          onClose();
        }}
        activeOpacity={isImplemented ? 0.6 : 1}
      >
        <View
          style={[
            styles.gameIcon,
            { backgroundColor: isDark ? "#2C2C2E" : "#F2F2F7" },
          ]}
        >
          <MaterialCommunityIcons
            name={game.icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={24}
            color={isImplemented ? colors.primary : subtextColor}
          />
        </View>
        <View style={styles.gameInfo}>
          <Text style={[styles.gameName, { color: textColor }]}>
            {game.displayName}
          </Text>
          {isImplemented ? (
            <Text style={[styles.gamePlayers, { color: subtextColor }]}>
              {game.minPlayers === game.maxPlayers
                ? `${game.minPlayers} player`
                : `${game.minPlayers}–${game.maxPlayers} players`}
              {game.supportsSpectate ? " · Spectating" : ""}
            </Text>
          ) : (
            <Text
              style={[
                styles.gamePlayers,
                { color: subtextColor, fontStyle: "italic" },
              ]}
            >
              Coming Soon
            </Text>
          )}
        </View>
        {isImplemented ? (
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={subtextColor}
          />
        ) : (
          <MaterialCommunityIcons
            name="clock-outline"
            size={18}
            color={subtextColor}
          />
        )}
      </TouchableOpacity>
    );
  };

  const renderSection = (section: GameSection) => (
    <View key={section.title}>
      <Text style={[styles.sectionTitle, { color: subtextColor }]}>
        {section.title}
      </Text>
      {section.data.map(renderGame)}
    </View>
  );

  if (!open) return null;

  return (
    <DraggableBottomSheet
      ref={sheetRef}
      open={open}
      onClose={onClose}
      snapPoints={snapPoints}
      initialSnapIndex={initialSnapIndex}
      sharedTranslateY={sharedTranslateY}
      surfaceColor={sheetSurface}
      handleColor={colors.divider}
      dragGestureArea="handle"
    >
      {/* Header */}
      <View style={[styles.headerRow, { borderBottomColor: borderColor }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>
          Choose a Game
        </Text>
      </View>

      <View style={styles.scrollRegion}>
        <FlatList
          data={sections}
          renderItem={({ item }) => renderSection(item)}
          keyExtractor={(item) => item.title}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 16) + 600 },
          ]}
          style={styles.flexFill}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        />
      </View>
    </DraggableBottomSheet>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  scrollRegion: {
    flex: 1,
    minHeight: 0,
  },
  flexFill: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    paddingBottom: 800,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  gameItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  gameIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  gameInfo: {
    flex: 1,
  },
  gameName: {
    fontSize: 16,
    fontWeight: "600",
  },
  gamePlayers: {
    fontSize: 13,
    marginTop: 2,
  },
});
