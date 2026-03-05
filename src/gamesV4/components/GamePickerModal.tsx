/**
 * Games V4 — GamePickerModal
 *
 * Bottom-sheet style modal allowing users to pick a game to send as an invite.
 * Groups games by category (Solo, Turn-based, Realtime) with icons and names.
 *
 * @module gamesV4/components/GamePickerModal
 */

import {
  GAME_METADATA,
  IMPLEMENTED_GAME_IDS,
  type GameMetadata,
} from "@/gamesV4/constants";
import type { GameId } from "@/gamesV4/types";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// =============================================================================
// Types
// =============================================================================

interface GamePickerModalProps {
  visible: boolean;
  onSelect: (gameId: GameId) => void;
  onClose: () => void;
  /** If set, only show multiplayer games (for group/DM contexts). */
  multiplayerOnly?: boolean;
}

interface GameSection {
  title: string;
  data: GameMetadata[];
}

// =============================================================================
// Component
// =============================================================================

export function GamePickerModal({
  visible,
  onSelect,
  onClose,
  multiplayerOnly = false,
}: GamePickerModalProps) {
  const { theme } = useAppTheme();

  const sections = useMemo(() => {
    const all = Object.values(GAME_METADATA);
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

  const bgColor = theme.isDark ? "#1C1C1E" : "#FFFFFF";
  const overlayColor = "rgba(0,0,0,0.5)";
  const textColor = theme.isDark ? "#FFF" : "#000";
  const subtextColor = theme.isDark ? "#999" : "#666";
  const borderColor = theme.isDark ? "#333" : "#E0E0E0";

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
            { backgroundColor: theme.isDark ? "#2C2C2E" : "#F2F2F7" },
          ]}
        >
          <MaterialCommunityIcons
            name={game.icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={24}
            color={isImplemented ? theme.colors.primary : subtextColor}
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.overlay, { backgroundColor: overlayColor }]}
        onPress={onClose}
      >
        <Pressable
          style={[styles.sheet, { backgroundColor: bgColor }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View style={styles.handleRow}>
            <View
              style={[
                styles.handle,
                { backgroundColor: theme.isDark ? "#555" : "#CCC" },
              ]}
            />
          </View>

          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: borderColor }]}>
            <Text style={[styles.headerTitle, { color: textColor }]}>
              Choose a Game
            </Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={subtextColor}
              />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <FlatList
            data={sections}
            renderItem={({ item }) => renderSection(item)}
            keyExtractor={(item) => item.title}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "70%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // home indicator
  },
  handleRow: {
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
  content: {
    paddingBottom: 16,
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
