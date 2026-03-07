/**
 * Chess UI — Settings Modal
 *
 * Full options sheet with all chess-specific toggles:
 * - Input mode (tap/drag)
 * - Confirm move
 * - Queue move (premove)
 * - Show legal moves / highlight last move / highlight check
 * - Coordinates
 * - Haptics level
 * - Sounds
 * - Board theme selector
 * - Display preset
 * - Reduced motion
 *
 * @module gamesV4/screens/chess/ChessSettings
 */

import { Spacing } from "@/constants/theme";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { BOARD_THEMES } from "./chessThemes";
import type {
  ChessSettings as ChessSettingsType,
  DisplayPreset,
  HapticsLevel,
  InputMode,
} from "./useChessSettings";

// =============================================================================
// Props
// =============================================================================

interface ChessSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  settings: ChessSettingsType;
  onUpdate: (patch: Partial<ChessSettingsType>) => void;
  onApplyPreset: (preset: DisplayPreset) => void;
}

// =============================================================================
// Segment Picker
// =============================================================================

function SegmentPicker<T extends string>({
  options,
  value,
  onChange,
  isDark,
  primaryColor,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  isDark: boolean;
  primaryColor: string;
}) {
  return (
    <View
      style={[
        segStyles.row,
        {
          backgroundColor: isDark
            ? "rgba(255,255,255,0.06)"
            : "rgba(0,0,0,0.04)",
        },
      ]}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[
              segStyles.option,
              active && { backgroundColor: primaryColor },
            ]}
            onPress={() => onChange(opt.value)}
          >
            <Text
              style={[
                segStyles.optionText,
                {
                  color: active
                    ? "#FFF"
                    : isDark
                      ? "rgba(255,255,255,0.5)"
                      : "rgba(0,0,0,0.45)",
                },
                active && segStyles.optionActive,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const segStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 2,
  },
  option: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
  },
  optionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  optionActive: {
    fontWeight: "700",
  },
});

// =============================================================================
// Toggle Row
// =============================================================================

function ToggleRow({
  label,
  value,
  onToggle,
  isDark,
  primaryColor,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
  isDark: boolean;
  primaryColor: string;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: isDark ? "#DDD" : "#333" }]}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{
          false: isDark ? "#444" : "#CCC",
          true: primaryColor,
        }}
        thumbColor={Platform.OS === "android" ? "#FFF" : undefined}
      />
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ChessSettingsModal({
  visible,
  onClose,
  settings,
  onUpdate,
  onApplyPreset,
}: ChessSettingsModalProps) {
  const { theme } = useAppTheme();
  const isDark = theme.isDark;
  const primaryColor = theme.colors.primary;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dimBg} onPress={onClose} />

        <Animated.View
          entering={SlideInDown.duration(250).springify()}
          style={[styles.card, { backgroundColor: isDark ? "#222" : "#FFF" }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? "#EEE" : "#222" }]}>
              Chess Settings
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={isDark ? "#888" : "#666"}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
          >
            {/* Input Mode */}
            <Text
              style={[styles.sectionLabel, { color: isDark ? "#999" : "#777" }]}
            >
              Input Mode
            </Text>
            <SegmentPicker<InputMode>
              options={[
                { label: "Tap", value: "tap" },
                { label: "Drag", value: "drag" },
              ]}
              value={settings.inputMode}
              onChange={(v) => onUpdate({ inputMode: v })}
              isDark={isDark}
              primaryColor={primaryColor}
            />

            {/* Confirm Move */}
            <ToggleRow
              label="Confirm each move"
              value={settings.confirmMove}
              onToggle={() => onUpdate({ confirmMove: !settings.confirmMove })}
              isDark={isDark}
              primaryColor={primaryColor}
            />

            {/* Queue Move */}
            <ToggleRow
              label="Queue move while waiting"
              value={settings.queueMove}
              onToggle={() => onUpdate({ queueMove: !settings.queueMove })}
              isDark={isDark}
              primaryColor={primaryColor}
            />

            {/* Display Preset */}
            <Text
              style={[
                styles.sectionLabel,
                { color: isDark ? "#999" : "#777", marginTop: Spacing.md },
              ]}
            >
              Display
            </Text>
            <SegmentPicker<DisplayPreset>
              options={[
                { label: "Minimal", value: "minimal" },
                { label: "Standard", value: "standard" },
                { label: "Assisted", value: "assisted" },
              ]}
              value={settings.displayPreset}
              onChange={onApplyPreset}
              isDark={isDark}
              primaryColor={primaryColor}
            />

            {/* Individual display toggles */}
            <ToggleRow
              label="Show legal moves"
              value={settings.showLegalMoves}
              onToggle={() =>
                onUpdate({ showLegalMoves: !settings.showLegalMoves })
              }
              isDark={isDark}
              primaryColor={primaryColor}
            />
            <ToggleRow
              label="Highlight last move"
              value={settings.highlightLastMove}
              onToggle={() =>
                onUpdate({ highlightLastMove: !settings.highlightLastMove })
              }
              isDark={isDark}
              primaryColor={primaryColor}
            />
            <ToggleRow
              label="Highlight check"
              value={settings.highlightCheck}
              onToggle={() =>
                onUpdate({ highlightCheck: !settings.highlightCheck })
              }
              isDark={isDark}
              primaryColor={primaryColor}
            />
            <ToggleRow
              label="Coordinates (A-H, 1-8)"
              value={settings.showCoordinates}
              onToggle={() =>
                onUpdate({ showCoordinates: !settings.showCoordinates })
              }
              isDark={isDark}
              primaryColor={primaryColor}
            />

            {/* Feedback */}
            <Text
              style={[
                styles.sectionLabel,
                { color: isDark ? "#999" : "#777", marginTop: Spacing.md },
              ]}
            >
              Feedback
            </Text>
            <Text
              style={[styles.subLabel, { color: isDark ? "#888" : "#999" }]}
            >
              Haptics
            </Text>
            <SegmentPicker<HapticsLevel>
              options={[
                { label: "Off", value: "off" },
                { label: "Light", value: "light" },
                { label: "Normal", value: "normal" },
              ]}
              value={settings.haptics}
              onChange={(v) => onUpdate({ haptics: v })}
              isDark={isDark}
              primaryColor={primaryColor}
            />
            <ToggleRow
              label="Sounds"
              value={settings.sounds}
              onToggle={() => onUpdate({ sounds: !settings.sounds })}
              isDark={isDark}
              primaryColor={primaryColor}
            />

            {/* Board Theme */}
            <Text
              style={[
                styles.sectionLabel,
                { color: isDark ? "#999" : "#777", marginTop: Spacing.md },
              ]}
            >
              Board Theme
            </Text>
            <View style={styles.themesGrid}>
              {BOARD_THEMES.map((bt) => {
                const active = bt.id === settings.boardTheme;
                return (
                  <Pressable
                    key={bt.id}
                    style={[
                      styles.themeCard,
                      active && { borderColor: primaryColor, borderWidth: 2 },
                    ]}
                    onPress={() => onUpdate({ boardTheme: bt.id })}
                  >
                    <View style={styles.themePreview}>
                      <View
                        style={[
                          styles.themeSquare,
                          { backgroundColor: bt.lightSquare },
                        ]}
                      />
                      <View
                        style={[
                          styles.themeSquare,
                          { backgroundColor: bt.darkSquare },
                        ]}
                      />
                      <View
                        style={[
                          styles.themeSquare,
                          { backgroundColor: bt.darkSquare },
                        ]}
                      />
                      <View
                        style={[
                          styles.themeSquare,
                          { backgroundColor: bt.lightSquare },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.themeLabel,
                        {
                          color: active
                            ? primaryColor
                            : isDark
                              ? "#AAA"
                              : "#666",
                        },
                        active && { fontWeight: "700" },
                      ]}
                    >
                      {bt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Accessibility */}
            <Text
              style={[
                styles.sectionLabel,
                { color: isDark ? "#999" : "#777", marginTop: Spacing.md },
              ]}
            >
              Accessibility
            </Text>
            <ToggleRow
              label="Reduced motion"
              value={settings.reducedMotion}
              onToggle={() =>
                onUpdate({ reducedMotion: !settings.reducedMotion })
              }
              isDark={isDark}
              primaryColor={primaryColor}
            />

            <View style={{ height: Spacing.xl }} />
          </ScrollView>
        </Animated.View>
      </View>
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
  dimBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  card: {
    maxHeight: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    flexGrow: 0,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 6,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    marginRight: 12,
  },
  themesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  themeCard: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.2)",
    padding: 6,
    width: 76,
  },
  themePreview: {
    width: 40,
    height: 40,
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 4,
    overflow: "hidden",
  },
  themeSquare: {
    width: 20,
    height: 20,
  },
  themeLabel: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 4,
    textAlign: "center",
  },
});
