/**
 * Games V4 — Sketch Party Game Screen
 *
 * Real-time drawing + guessing game screen for 2–8 players.
 * Connects to Colyseus for authoritative state; renders drawing canvas.
 *
 * Layout (mobile-first, portrait):
 *   ┌──────────────────────────┐
 *   │   Round X/Y  ⚙️  Timer  │  ← HUD bar
 *   ├──────────────────────────┤
 *   │ ████████████████░░░░░░░░ │  ← Animated timer bar
 *   ├──────────────────────────┤
 *   │   _ _ _ _ _ _ _ _ _ _ _  │  ← Word display
 *   ├──────────────────────────┤
 *   │  👤👤👤👤 (2/4 guessed)  │  ← Player strip
 *   ├──────────────────────────┤
 *   │                          │
 *   │        Canvas            │  ← Drawing area
 *   │                          │
 *   ├──────────────────────────┤
 *   │  [Tools] or [Chat+Input] │  ← Control dock (thumb zone)
 *   └──────────────────────────┘
 *
 * @module gamesV4/screens/SketchPartyScreenV4
 */

import type { GameShellProps } from "@/gamesV4/components/GameScreenShell";
import { withGameV4Shell } from "@/gamesV4/components/GameScreenShell";
import { SKETCH_PARTY_CLIENT_DEF } from "@/gamesV4/realtime/games/sketchPartyDef";
import type {
  ChatEntry,
  ReactionEvent,
  ReactionKind,
  SketchPartyRealtimeState,
  StrokeData,
} from "@/gamesV4/realtime/games/sketchPartyTypes";
import { useRealtimeRoom } from "@/gamesV4/realtime/useRealtimeRoom";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import * as haptics from "@/utils/haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// =============================================================================
// Constants
// =============================================================================

const SCREEN_WIDTH = Dimensions.get("window").width;
const CANVAS_SIZE = Math.min(SCREEN_WIDTH - 32, 400);
const TIMER_BAR_WIDTH = SCREEN_WIDTH - 32;
const QUANTIZE_RANGE = 1023;
const STROKE_BATCH_INTERVAL = 40; // ms
const MIN_MOVE_THRESHOLD = 2; // px
const GUESS_RATE_LIMIT_MS = 400;

const COLOR_PALETTE_PRIMARY = [
  "#000000",
  "#FFFFFF",
  "#808080",
  "#FF0000",
  "#FF9500",
  "#FFCC00",
  "#34C759",
  "#007AFF",
];

const COLOR_PALETTE_EXTENDED = [
  "#C0C0C0",
  "#FF6B6B",
  "#FFD93D",
  "#A8D8B9",
  "#00B4D8",
  "#AF52DE",
  "#FF2D55",
  "#8B4513",
];

const BRUSH_SIZES: Array<{ label: string; width: number }> = [
  { label: "S", width: 2 },
  { label: "M", width: 4 },
  { label: "L", width: 8 },
  { label: "XL", width: 14 },
];

// =============================================================================
// Canvas coordinate helpers
// =============================================================================

function toNormalized(px: number, canvasSize: number): number {
  return Math.round((px / canvasSize) * QUANTIZE_RANGE);
}

function fromNormalized(q: number, canvasSize: number): number {
  return (q / QUANTIZE_RANGE) * canvasSize;
}

// =============================================================================
// AnimatedTimerBar
// =============================================================================

function AnimatedTimerBar({
  timeRemaining,
  totalTime,
}: {
  timeRemaining: number;
  totalTime: number;
}) {
  const progress = useSharedValue(
    totalTime > 0 ? timeRemaining / totalTime : 0,
  );
  const isUrgent = timeRemaining <= 10 && timeRemaining > 0;

  useEffect(() => {
    const ratio = totalTime > 0 ? Math.max(0, timeRemaining / totalTime) : 0;
    progress.value = withTiming(ratio, {
      duration: 900,
      easing: Easing.linear,
    });
  }, [timeRemaining, totalTime, progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: progress.value * TIMER_BAR_WIDTH,
  }));

  return (
    <View style={styles.timerBarContainer}>
      <Animated.View
        style={[
          styles.timerBarFill,
          barStyle,
          { backgroundColor: isUrgent ? "#FF3B30" : "#34C759" },
        ]}
      />
    </View>
  );
}

// =============================================================================
// PlayerChip (memo'd)
// =============================================================================

interface PlayerChipProps {
  uid: string;
  displayName: string;
  score: number;
  isDrawer: boolean;
  hasGuessedCorrectly: boolean;
  isCurrentUser: boolean;
  isDark: boolean;
  primaryColor: string;
  textColor: string;
}

const PlayerChip = memo(function PlayerChip({
  displayName,
  score,
  isDrawer,
  hasGuessedCorrectly,
  isCurrentUser,
  isDark,
  primaryColor,
  textColor,
}: PlayerChipProps) {
  const initial = displayName.charAt(0).toUpperCase();
  const bgColor = isDrawer
    ? primaryColor
    : hasGuessedCorrectly
      ? "#34C759"
      : isDark
        ? "#2C2C2E"
        : "#F0F0F0";
  const textOnBg = isDrawer || hasGuessedCorrectly ? "#FFF" : textColor;

  return (
    <View
      style={[
        styles.playerChip,
        isCurrentUser && { borderColor: primaryColor, borderWidth: 2 },
      ]}
    >
      <View style={[styles.playerAvatar, { backgroundColor: bgColor }]}>
        <Text style={[styles.playerAvatarText, { color: textOnBg }]}>
          {initial}
        </Text>
        {isDrawer && (
          <View style={styles.playerStatusBadge}>
            <Text style={{ fontSize: 8 }}>✏️</Text>
          </View>
        )}
        {hasGuessedCorrectly && !isDrawer && (
          <View style={styles.playerStatusBadge}>
            <Text style={{ fontSize: 8 }}>✅</Text>
          </View>
        )}
      </View>
      <Text
        style={[styles.playerChipName, { color: textColor }]}
        numberOfLines={1}
      >
        {displayName.slice(0, 8)}
      </Text>
      <Text style={[styles.playerChipScore, { color: primaryColor }]}>
        {score}
      </Text>
    </View>
  );
});

// =============================================================================
// ChatBubble (memo'd)
// =============================================================================

const ChatBubble = memo(function ChatBubble({
  entry,
  primaryColor,
  textColor,
}: {
  entry: ChatEntry;
  primaryColor: string;
  textColor: string;
}) {
  if (entry.isSystem) {
    return (
      <Text style={[styles.chatSystem, { color: primaryColor }]}>
        {entry.text}
      </Text>
    );
  }
  return (
    <Text style={[styles.chatMsg, { color: textColor }]}>
      <Text style={{ fontWeight: "700" }}>{entry.displayName}: </Text>
      <Text
        style={
          entry.isCorrect ? { color: "#34C759", fontWeight: "600" } : undefined
        }
      >
        {entry.isCorrect ? "Guessed correctly! 🎉" : entry.text}
      </Text>
    </Text>
  );
});

// =============================================================================
// CorrectGuessToast
// =============================================================================

function CorrectGuessToast({
  visible,
  points,
}: {
  visible: boolean;
  points: number;
}) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 400 });
      }, 1800);
      return () => clearTimeout(timer);
    } else {
      opacity.value = 0;
    }
  }, [visible, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.correctGuessToast, animStyle]}>
      <Text style={styles.correctGuessToastText}>
        🎉 Correct! +{points} pts
      </Text>
    </Animated.View>
  );
}

// =============================================================================
// TurnRecapCard
// =============================================================================

function TurnRecapCard({
  word,
  guessers,
  totalGuessers,
  topGuessers,
  drawerName,
  isDark,
  primaryColor,
  textColor,
}: {
  word: string;
  guessers: number;
  totalGuessers: number;
  topGuessers: Array<{ displayName: string; uid: string }>;
  drawerName: string;
  isDark: boolean;
  primaryColor: string;
  textColor: string;
}) {
  return (
    <View
      style={[
        styles.recapCard,
        { backgroundColor: isDark ? "#1C1C2E" : "#FFF" },
      ]}
    >
      <Text style={[styles.recapTitle, { color: primaryColor }]}>
        Turn Recap
      </Text>
      <Text style={[styles.recapWord, { color: textColor }]}>
        The word was: <Text style={{ fontWeight: "800" }}>{word}</Text>
      </Text>
      <Text style={[styles.recapClarity, { color: textColor }]}>
        {drawerName}&apos;s clarity: {guessers}/{totalGuessers} guessed
      </Text>
      {topGuessers.length > 0 && (
        <View style={styles.recapGuessers}>
          <Text style={[styles.recapGuesserLabel, { color: primaryColor }]}>
            Fastest guessers:
          </Text>
          {topGuessers.slice(0, 3).map((g, i) => (
            <Text
              key={g.uid}
              style={[styles.recapGuesserName, { color: textColor }]}
            >
              {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"} {g.displayName}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

// =============================================================================
// MatchSettingsSheet
// =============================================================================

function MatchSettingsSheet({
  visible,
  onClose,
  settings,
  isDark,
  primaryColor,
  textColor,
}: {
  visible: boolean;
  onClose: () => void;
  settings: SketchPartyRealtimeState["effectiveSettings"] | null;
  isDark: boolean;
  primaryColor: string;
  textColor: string;
}) {
  if (!settings) return null;

  const rows: Array<{ label: string; value: string }> = [
    { label: "Rounds", value: String(settings.rounds) },
    { label: "Draw Time", value: `${settings.drawTimeSec}s` },
    { label: "Choose Time", value: `${settings.turnChooseTimeSec}s` },
    { label: "Word Choices", value: String(settings.wordChoices) },
    { label: "Hints per Turn", value: String(settings.hints) },
    { label: "Max Players", value: String(settings.maxPlayers) },
    {
      label: "Custom Words",
      value: settings.customWordsEnabled ? "On" : "Off",
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View
          style={[
            styles.settingsSheet,
            { backgroundColor: isDark ? "#1C1C2E" : "#FFF" },
          ]}
        >
          <Text style={[styles.settingsTitle, { color: primaryColor }]}>
            Match Settings
          </Text>
          {rows.map((r) => (
            <View key={r.label} style={styles.settingsRow}>
              <Text style={[styles.settingsLabel, { color: textColor }]}>
                {r.label}
              </Text>
              <Text
                style={[
                  styles.settingsValue,
                  { color: primaryColor, fontWeight: "700" },
                ]}
              >
                {r.value}
              </Text>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.settingsCloseBtn, { backgroundColor: primaryColor }]}
            onPress={onClose}
          >
            <Text style={styles.settingsCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

// =============================================================================
// Word Choice Modal (enhanced)
// =============================================================================

function WordChoiceModal({
  visible,
  choices,
  timeRemaining,
  onChoose,
  isDark,
  primaryColor,
  textColor,
}: {
  visible: boolean;
  choices: string[];
  timeRemaining: number;
  onChoose: (index: number) => void;
  isDark: boolean;
  primaryColor: string;
  textColor: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: isDark ? "#1C1C2E" : "#FFF" },
          ]}
        >
          <Text style={[styles.modalTitle, { color: textColor }]}>
            Choose a word to draw!
          </Text>
          <Text style={[styles.modalTimer, { color: primaryColor }]}>
            {timeRemaining}s
          </Text>
          <View style={styles.wordChoicesRow}>
            {choices.map((word, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.wordChoiceBtn,
                  { backgroundColor: primaryColor },
                ]}
                onPress={() => {
                  haptics.buttonPress();
                  onChoose(i);
                }}
              >
                <Text style={styles.wordChoiceBtnText}>{word}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Drawing Canvas
// =============================================================================

const DrawingCanvas = memo(function DrawingCanvas({
  strokes,
  canvasSize,
  isDark,
}: {
  strokes: StrokeData[];
  canvasSize: number;
  isDark: boolean;
}) {
  const canvasBg = isDark ? "#1A1A1A" : "#FFFFFF";
  const canvasBorder = isDark ? "#333" : "#DDD";

  return (
    <View
      style={[
        styles.canvas,
        {
          width: canvasSize,
          height: canvasSize,
          backgroundColor: canvasBg,
          borderColor: canvasBorder,
        },
      ]}
    >
      {strokes.map((stroke) => (
        <React.Fragment key={stroke.strokeId}>
          {stroke.points.map((pt, i) => {
            if (i === 0) return null;
            const prev = stroke.points[i - 1];
            const x1 = fromNormalized(prev.x, canvasSize);
            const y1 = fromNormalized(prev.y, canvasSize);
            const x2 = fromNormalized(pt.x, canvasSize);
            const y2 = fromNormalized(pt.y, canvasSize);
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            const eraserColor = canvasBg;

            return (
              <View
                key={`${stroke.strokeId}-${i}`}
                style={{
                  position: "absolute",
                  left: x1,
                  top: y1 - stroke.width / 2,
                  width: Math.max(len, 1),
                  height: stroke.width,
                  backgroundColor:
                    stroke.tool === "eraser" ? eraserColor : stroke.color,
                  transform: [{ rotate: `${angle}deg` }],
                  transformOrigin: "left center",
                  borderRadius: stroke.width / 2,
                }}
              />
            );
          })}
          {/* Round dot at each point for smooth joins */}
          {stroke.points.map((pt, i) => (
            <View
              key={`${stroke.strokeId}-dot-${i}`}
              style={{
                position: "absolute",
                left: fromNormalized(pt.x, canvasSize) - stroke.width / 2,
                top: fromNormalized(pt.y, canvasSize) - stroke.width / 2,
                width: stroke.width,
                height: stroke.width,
                borderRadius: stroke.width / 2,
                backgroundColor:
                  stroke.tool === "eraser" ? canvasBg : stroke.color,
              }}
            />
          ))}
        </React.Fragment>
      ))}
    </View>
  );
});

// =============================================================================
// Drawer Tool Bar (enhanced — 16 colors, 4 named sizes, brush preview)
// =============================================================================

function DrawerToolBar({
  selectedColor,
  selectedWidth,
  selectedTool,
  onColorChange,
  onWidthChange,
  onToolChange,
  onUndo,
  onClear,
  isDark,
  primaryColor,
  textColor,
}: {
  selectedColor: string;
  selectedWidth: number;
  selectedTool: "pen" | "eraser";
  onColorChange: (c: string) => void;
  onWidthChange: (w: number) => void;
  onToolChange: (t: "pen" | "eraser") => void;
  onUndo: () => void;
  onClear: () => void;
  isDark: boolean;
  primaryColor: string;
  textColor: string;
}) {
  const [showExtendedColors, setShowExtendedColors] = useState(false);

  return (
    <View style={styles.toolBar}>
      {/* Row 1: Tools + Brush Preview */}
      <View style={styles.toolRow}>
        <TouchableOpacity
          style={[
            styles.toolBtn,
            selectedTool === "pen" && { backgroundColor: primaryColor },
          ]}
          onPress={() => onToolChange("pen")}
        >
          <MaterialCommunityIcons
            name="pencil"
            size={20}
            color={selectedTool === "pen" ? "#FFF" : textColor}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toolBtn,
            selectedTool === "eraser" && { backgroundColor: primaryColor },
          ]}
          onPress={() => onToolChange("eraser")}
        >
          <MaterialCommunityIcons
            name="eraser"
            size={20}
            color={selectedTool === "eraser" ? "#FFF" : textColor}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={onUndo}>
          <MaterialCommunityIcons name="undo" size={20} color={textColor} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={onClear}>
          <MaterialCommunityIcons
            name="delete-outline"
            size={20}
            color={textColor}
          />
        </TouchableOpacity>
        {/* Active brush preview */}
        <View style={styles.brushPreview}>
          <View
            style={{
              width: Math.min(selectedWidth * 2, 24),
              height: Math.min(selectedWidth * 2, 24),
              borderRadius: Math.min(selectedWidth, 12),
              backgroundColor:
                selectedTool === "eraser" ? "#CCC" : selectedColor,
            }}
          />
        </View>
      </View>

      {/* Row 2: Primary colors */}
      <View style={styles.colorRow}>
        {COLOR_PALETTE_PRIMARY.map((c) => (
          <TouchableOpacity
            key={c}
            style={[
              styles.colorSwatch,
              { backgroundColor: c },
              selectedColor === c && styles.colorSwatchSelected,
              c === "#FFFFFF" && { borderColor: "#CCC", borderWidth: 1 },
            ]}
            onPress={() => onColorChange(c)}
          />
        ))}
        <TouchableOpacity
          style={[
            styles.colorExpandBtn,
            { backgroundColor: isDark ? "#333" : "#E0E0E0" },
          ]}
          onPress={() => setShowExtendedColors((p) => !p)}
        >
          <MaterialCommunityIcons
            name={showExtendedColors ? "chevron-up" : "palette"}
            size={16}
            color={textColor}
          />
        </TouchableOpacity>
      </View>

      {/* Row 3: Extended colors (collapsible) */}
      {showExtendedColors && (
        <View style={styles.colorRow}>
          {COLOR_PALETTE_EXTENDED.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorSwatch,
                { backgroundColor: c },
                selectedColor === c && styles.colorSwatchSelected,
              ]}
              onPress={() => onColorChange(c)}
            />
          ))}
        </View>
      )}

      {/* Row 4: Brush size chips */}
      <View style={styles.toolRow}>
        {BRUSH_SIZES.map((bs) => (
          <TouchableOpacity
            key={bs.label}
            style={[
              styles.sizeChip,
              selectedWidth === bs.width && { backgroundColor: primaryColor },
              selectedWidth !== bs.width && {
                backgroundColor: isDark ? "#2C2C2E" : "#E8E8E8",
              },
            ]}
            onPress={() => onWidthChange(bs.width)}
          >
            <View
              style={{
                width: Math.min(bs.width * 1.5, 16),
                height: Math.min(bs.width * 1.5, 16),
                borderRadius: Math.min(bs.width * 0.75, 8),
                backgroundColor:
                  selectedWidth === bs.width ? "#FFF" : textColor,
                marginBottom: 2,
              }}
            />
            <Text
              style={[
                styles.sizeChipLabel,
                {
                  color: selectedWidth === bs.width ? "#FFF" : textColor,
                },
              ]}
            >
              {bs.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// =============================================================================
// Guesser Input (enhanced — word length hint, lock when correct)
// =============================================================================

function GuesserInput({
  wordLength,
  hasGuessedCorrectly,
  onSubmit,
  isDark,
  primaryColor,
  textColor,
  keyboardVisible,
}: {
  wordLength: number;
  hasGuessedCorrectly: boolean;
  onSubmit: (text: string) => void;
  isDark: boolean;
  primaryColor: string;
  textColor: string;
  keyboardVisible: boolean;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText("");
  }, [text, onSubmit]);

  const handleDismissKeyboard = useCallback(() => {
    inputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  if (hasGuessedCorrectly) {
    return (
      <View style={styles.guessLockedRow}>
        <Text style={[styles.guessLockedText, { color: "#34C759" }]}>
          ✅ You guessed correctly!
        </Text>
      </View>
    );
  }

  const placeholder =
    wordLength > 0
      ? `Guess a ${wordLength}-letter word…`
      : "Type your guess...";

  return (
    <View style={styles.guessInputRow}>
      <TextInput
        ref={inputRef}
        style={[
          styles.guessInput,
          {
            color: textColor,
            borderColor: isDark ? "#444" : "#CCC",
            backgroundColor: isDark ? "#1C1C2E" : "#F9F9F9",
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={isDark ? "#666" : "#999"}
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleSubmit}
        returnKeyType="send"
        autoCorrect={true}
        spellCheck={true}
        autoCapitalize="none"
        keyboardType="default"
        textContentType="none"
      />
      {keyboardVisible && (
        <TouchableOpacity
          style={styles.keyboardDismissBtn}
          onPress={handleDismissKeyboard}
        >
          <MaterialCommunityIcons
            name="chevron-down"
            size={22}
            color={primaryColor}
          />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.guessSendBtn, { backgroundColor: primaryColor }]}
        onPress={handleSubmit}
      >
        <MaterialCommunityIcons name="send" size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

// =============================================================================
// Collapsible Chat Feed
// =============================================================================

function CollapsibleChatFeed({
  entries,
  expanded,
  onToggle,
  primaryColor,
  textColor,
  isDark,
}: {
  entries: ChatEntry[];
  expanded: boolean;
  onToggle: () => void;
  primaryColor: string;
  textColor: string;
  isDark: boolean;
}) {
  const visibleEntries = expanded ? entries.slice(-20) : entries.slice(-3);

  const glassBg = isDark
    ? "rgba(28, 28, 46, 0.82)"
    : "rgba(255, 255, 255, 0.78)";
  const glassBorder = isDark
    ? "rgba(255, 255, 255, 0.08)"
    : "rgba(0, 0, 0, 0.08)";

  return (
    <View
      style={[
        styles.chatContainer,
        {
          backgroundColor: glassBg,
          borderColor: glassBorder,
          borderWidth: 1,
          borderRadius: 12,
          padding: 8,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
            },
            android: { elevation: 2 },
          }),
        },
      ]}
    >
      <Pressable onPress={onToggle} style={styles.chatToggle}>
        <MaterialCommunityIcons
          name={expanded ? "chevron-down" : "chat-outline"}
          size={14}
          color={primaryColor}
        />
        <Text style={[styles.chatToggleText, { color: primaryColor }]}>
          {expanded ? "Hide Chat" : `Chat (${entries.length})`}
        </Text>
      </Pressable>
      <ScrollView
        style={[styles.chatScroll, expanded && styles.chatScrollExpanded]}
        nestedScrollEnabled
      >
        {visibleEntries.map((entry, i) => (
          <ChatBubble
            key={`${entry.timestamp}-${i}`}
            entry={entry}
            primaryColor={primaryColor}
            textColor={textColor}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// Main Sketch Party UI
// =============================================================================

function SketchPartyUI({
  publicState,
  myUid,
  sessionId,
  settings,
}: GameShellProps) {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const isDark = theme.isDark;
  const primaryColor = theme.colors.primary;
  const textColor = theme.colors.text;
  const bgColor = isDark ? "#000" : theme.colors.background;
  // ── Auth token for Colyseus connection ────────────────────────────
  const [authToken, setAuthToken] = useState("");
  useEffect(() => {
    let cancelled = false;
    currentFirebaseUser?.getIdToken().then((t) => {
      if (!cancelled) setAuthToken(t ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [currentFirebaseUser]);

  // ── Realtime room (generalized framework) ─────────────────────────
  const {
    room,
    connectionStatus,
    gameState: roomState,
    send,
    error: connectionError,
  } = useRealtimeRoom(SKETCH_PARTY_CLIENT_DEF, {
    sessionId,
    uid: myUid,
    displayName: currentFirebaseUser?.displayName ?? "Player",
    token: authToken,
    autoConnect: !!authToken,
  });

  // ── Local game state (not from Colyseus state_sync) ───────────────
  const [strokes, setStrokes] = useState<StrokeData[]>([]);
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const [chooseTimeRemaining, setChooseTimeRemaining] = useState(10);

  // ── UI state ──────────────────────────────────────────────────────
  const [selectedTool, setSelectedTool] = useState<"pen" | "eraser">("pen");
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [selectedWidth, setSelectedWidth] = useState(4);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [settingsSheetVisible, setSettingsSheetVisible] = useState(false);
  const [correctGuessToastVisible, setCorrectGuessToastVisible] =
    useState(false);
  const [correctGuessPoints, setCorrectGuessPoints] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [reactionBubbles, setReactionBubbles] = useState<
    Array<ReactionEvent & { id: string }>
  >([]);
  const lastGuessTimeRef = useRef(0);

  // ── Keyboard visibility tracking ──────────────────────────────────
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setChatExpanded(false); // auto-collapse chat when keyboard opens
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ── Drawing refs ──────────────────────────────────────────────────
  const currentStrokeRef = useRef<StrokeData | null>(null);
  const batchBufferRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const batchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const strokeIdCounterRef = useRef(0);

  // ── Derived state ─────────────────────────────────────────────────
  const isDrawer = roomState?.drawerId === myUid;
  const phase = roomState?.phase ?? "waiting";
  const isChoosing = phase === "choosing" && isDrawer;
  const isDrawing = phase === "drawing";
  const isTurnEnd = phase === "turn_end";
  const isMatchEnd = phase === "match_end";
  const hasGuessedCorrectly =
    roomState?.correctGuessers?.includes(myUid) ?? false;

  const players = roomState?.players ?? [];
  const scores = roomState?.scores ?? {};
  const correctGuessers = roomState?.correctGuessers ?? [];
  const timeRemaining = roomState?.timeRemainingSec ?? 0;
  const drawTimeSec = roomState?.drawTimeSec ?? 80;
  const currentRound = roomState?.currentRound ?? 1;
  const totalRounds = roomState?.totalRounds ?? 3;
  const maskedWord = roomState?.maskedWord ?? "";
  const wordLength = roomState?.wordLength ?? 0;
  const effectiveSettings = roomState?.effectiveSettings ?? null;

  const drawerPlayer = players.find((p) => p.uid === roomState?.drawerId);

  const guessedCount = correctGuessers.length;
  const totalGuessers = players.filter(
    (p) => p.uid !== roomState?.drawerId,
  ).length;

  // ── Turn recap data ───────────────────────────────────────────────
  const turnRecapWord = useRef("");
  const turnRecapGuessers = useRef<Array<{ displayName: string; uid: string }>>(
    [],
  );
  const turnRecapDrawerName = useRef("");

  // ── Game-specific message handlers (re-registered on reconnect) ───
  useEffect(() => {
    if (!room) return;

    // ── Settings applied (debug/display) ──
    room.onMessage("settings_applied", (s: Record<string, unknown>) => {
      console.log("[SketchParty] Server settings:", s);
    });

    // ── Stroke relay ──
    room.onMessage(
      "stroke_begin",
      (msg: {
        strokeId: string;
        tool: string;
        color: string;
        width: number;
        x: number;
        y: number;
      }) => {
        setStrokes((prev) => [
          ...prev,
          {
            strokeId: msg.strokeId,
            tool: msg.tool as "pen" | "eraser",
            color: msg.color,
            width: msg.width,
            points: [{ x: msg.x, y: msg.y }],
          },
        ]);
      },
    );

    room.onMessage(
      "stroke_points",
      (msg: { strokeId: string; points: Array<{ x: number; y: number }> }) => {
        setStrokes((prev) =>
          prev.map((s) =>
            s.strokeId === msg.strokeId
              ? { ...s, points: [...s.points, ...msg.points] }
              : s,
          ),
        );
      },
    );

    room.onMessage("stroke_end", () => {
      /* stroke already assembled */
    });

    // ── Chat ──
    room.onMessage("chat", (msg: ChatEntry) => {
      setChatEntries((prev) => [...prev.slice(-49), msg]);

      // Detect personal correct guess → toast + haptic
      if (msg.isCorrect && msg.uid === myUid) {
        setCorrectGuessToastVisible(true);
        setCorrectGuessPoints(50); // approximate
        haptics.success();
        setTimeout(() => {
          setCorrectGuessToastVisible(false);
        }, 2200);
      }
    });

    // ── Reactions ──
    room.onMessage("reaction_event", (msg: ReactionEvent) => {
      const id = `${msg.uid}_${msg.ts}`;
      setReactionBubbles((prev) => [...prev.slice(-4), { ...msg, id }]);
      haptics.light();
      setTimeout(() => {
        setReactionBubbles((prev) => prev.filter((r) => r.id !== id));
      }, 2500);
    });

    // ── Canvas / undo ──
    room.onMessage("clear_canvas", () => {
      setStrokes([]);
    });

    room.onMessage("undo_stroke", (msg: { strokeId: string }) => {
      setStrokes((prev) => prev.filter((s) => s.strokeId !== msg.strokeId));
    });

    room.onMessage("board_snapshot", (msg: { strokes: StrokeData[] }) => {
      setStrokes(msg.strokes ?? []);
    });

    // ── Word choices (drawer only) ──
    room.onMessage(
      "word_choices",
      (msg: { words: string[]; timeRemaining: number }) => {
        setWordChoices(msg.words);
        setChooseTimeRemaining(msg.timeRemaining);
        haptics.light();
      },
    );

    room.onMessage("word_reveal", (msg: { word: string }) => {
      turnRecapWord.current = msg.word;
    });

    // ── Turn start ──
    room.onMessage("turn_start", () => {
      setStrokes([]);
      haptics.light();
      setChatEntries((prev) => [
        ...prev,
        {
          uid: "system",
          displayName: "System",
          text: "New turn started!",
          isCorrect: false,
          isSystem: true,
          timestamp: Date.now(),
        },
      ]);
    });

    // ── Turn scores ──
    room.onMessage(
      "turn_scores",
      (_msg: { scores: Record<string, number> }) => {
        /* scores already in state_sync */
      },
    );
  }, [room, myUid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Batch timer cleanup ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearInterval(batchTimerRef.current);
      }
    };
  }, []);

  // ── Track recap data on phase changes ─────────────────────────────
  useEffect(() => {
    if (isTurnEnd && roomState) {
      turnRecapGuessers.current = correctGuessers.map((uid) => {
        const p = players.find((pl) => pl.uid === uid);
        return { uid, displayName: p?.displayName ?? uid };
      });
      turnRecapDrawerName.current =
        players.find((p) => p.uid === roomState.drawerId)?.displayName ??
        "Drawer";
    }
  }, [isTurnEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stroke batching ───────────────────────────────────────────────
  const flushBatch = useCallback(() => {
    const stroke = currentStrokeRef.current;
    const buffer = batchBufferRef.current;
    if (!stroke || buffer.length === 0) return;

    send("stroke_points", {
      strokeId: stroke.strokeId,
      points: buffer.splice(0),
    });
  }, [send]);

  // ── Drawing gesture ───────────────────────────────────────────────
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(isDrawer && isDrawing)
        .minDistance(0)
        .onBegin((e) => {
          const strokeId = `s_${myUid}_${++strokeIdCounterRef.current}`;
          const x = toNormalized(e.x, CANVAS_SIZE);
          const y = toNormalized(e.y, CANVAS_SIZE);

          currentStrokeRef.current = {
            strokeId,
            tool: selectedTool,
            color: selectedColor,
            width: selectedWidth,
            points: [{ x, y }],
          };
          batchBufferRef.current = [];

          send("stroke_begin", {
            strokeId,
            tool: selectedTool,
            color: selectedColor,
            width: selectedWidth,
            x,
            y,
            t: Date.now(),
          });

          setStrokes((prev) => [...prev, { ...currentStrokeRef.current! }]);

          if (batchTimerRef.current) clearInterval(batchTimerRef.current);
          batchTimerRef.current = setInterval(
            flushBatch,
            STROKE_BATCH_INTERVAL,
          );
        })
        .onUpdate((e) => {
          const stroke = currentStrokeRef.current;
          if (!stroke) return;
          const x = toNormalized(e.x, CANVAS_SIZE);
          const y = toNormalized(e.y, CANVAS_SIZE);

          const lastPt = stroke.points[stroke.points.length - 1];
          if (lastPt) {
            const dx = fromNormalized(x - lastPt.x, CANVAS_SIZE);
            const dy = fromNormalized(y - lastPt.y, CANVAS_SIZE);
            if (Math.sqrt(dx * dx + dy * dy) < MIN_MOVE_THRESHOLD) return;
          }

          stroke.points.push({ x, y });
          batchBufferRef.current.push({ x, y, t: Date.now() });

          setStrokes((prev) =>
            prev.map((s) =>
              s.strokeId === stroke.strokeId
                ? { ...s, points: [...stroke.points] }
                : s,
            ),
          );
        })
        .onEnd(() => {
          const stroke = currentStrokeRef.current;
          if (!stroke) return;

          flushBatch();
          if (batchTimerRef.current) {
            clearInterval(batchTimerRef.current);
            batchTimerRef.current = null;
          }

          send("stroke_end", { strokeId: stroke.strokeId });
          currentStrokeRef.current = null;
        }),
    [
      isDrawer,
      isDrawing,
      selectedTool,
      selectedColor,
      selectedWidth,
      myUid,
      flushBatch,
      send,
    ],
  );

  // ── Actions ───────────────────────────────────────────────────────
  const handleGuessSubmit = useCallback(
    (text: string) => {
      // Client-side rate limit
      const now = Date.now();
      if (now - lastGuessTimeRef.current < GUESS_RATE_LIMIT_MS) return;
      lastGuessTimeRef.current = now;

      send("guess", { text });
    },
    [send],
  );

  const handleWordChoice = useCallback(
    (index: number) => {
      send("word_choice", { wordIndex: index });
      setWordChoices([]);
    },
    [send],
  );

  const handleUndo = useCallback(() => {
    send("undo", {});
  }, [send]);

  const handleClear = useCallback(() => {
    send("clear", {});
  }, [send]);

  const handleReaction = useCallback(
    (kind: ReactionKind) => {
      send("reaction", { kind });
      haptics.light();
    },
    [send],
  );

  // ── Render: Connecting ────────────────────────────────────────────
  if (
    connectionStatus === "connecting" ||
    connectionStatus === "idle" ||
    connectionStatus === "reconnecting"
  ) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
        <View style={styles.connectingContainer}>
          <Text style={[styles.statusText, { color: primaryColor }]}>
            {connectionError
              ? `Connection failed: ${connectionError}`
              : connectionStatus === "reconnecting"
                ? "Reconnecting..."
                : "Connecting to game server..."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Match End ─────────────────────────────────────────────
  if (isMatchEnd) {
    const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
        <Text style={[styles.matchEndTitle, { color: primaryColor }]}>
          🏆 Match Complete!
        </Text>
        <View style={styles.finalScores}>
          {sortedScores.map(([uid, score], i) => {
            const player = players.find((p) => p.uid === uid);
            const medal =
              i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
            return (
              <View key={uid} style={styles.finalScoreItem}>
                <Text
                  style={[
                    styles.finalScoreRow,
                    { color: textColor },
                    i === 0 && {
                      color: "#FFD700",
                      fontWeight: "800",
                      fontSize: 22,
                    },
                  ]}
                >
                  {medal} {player?.displayName ?? uid}
                </Text>
                <Text
                  style={[
                    styles.finalScorePoints,
                    { color: primaryColor },
                    i === 0 && { fontSize: 22 },
                  ]}
                >
                  {score} pts
                </Text>
              </View>
            );
          })}
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Game ──────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <View
          style={[
            styles.container,
            {
              backgroundColor: bgColor,
              paddingTop: insets.top,
              paddingBottom: keyboardVisible ? 0 : insets.bottom,
              paddingLeft: insets.left,
              paddingRight: insets.right,
            },
          ]}
        >
          {/* Tap non-canvas areas to dismiss keyboard */}
          <Pressable
            onPress={() => keyboardVisible && Keyboard.dismiss()}
            style={styles.hudTouchDismiss}
          >
            {/* ── HUD Bar ── */}
            <View style={styles.hudBar}>
              <View style={styles.hudLeft}>
                <Text style={[styles.roundText, { color: textColor }]}>
                  Round {currentRound}/{totalRounds}
                </Text>
              </View>

              {/* Settings gear — centered */}
              <TouchableOpacity
                onPress={() => setSettingsSheetVisible(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons
                  name="cog-outline"
                  size={20}
                  color={primaryColor}
                />
              </TouchableOpacity>

              <View style={styles.hudRight}>
                <Text
                  style={[
                    styles.timerText,
                    {
                      color:
                        timeRemaining <= 10 && isDrawing
                          ? "#FF3B30"
                          : primaryColor,
                    },
                  ]}
                >
                  {isDrawing
                    ? `${timeRemaining}s`
                    : phase === "choosing"
                      ? "⏳"
                      : ""}
                </Text>
              </View>
            </View>
          </Pressable>

          {/* ── Drawer Info Strip ── */}
          {drawerPlayer && (isDrawing || phase === "choosing") && (
            <View style={styles.drawerInfoStrip}>
              <View
                style={[
                  styles.drawerInfoAvatar,
                  { backgroundColor: primaryColor },
                ]}
              >
                <Text style={styles.drawerInfoAvatarText}>
                  {drawerPlayer.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text
                style={[styles.drawerInfoName, { color: textColor }]}
                numberOfLines={1}
              >
                {isDrawer
                  ? "You are drawing!"
                  : `${drawerPlayer.displayName} is drawing`}
              </Text>
              <MaterialCommunityIcons
                name="pencil"
                size={14}
                color={primaryColor}
              />
            </View>
          )}

          {/* ── Timer Bar ── */}
          {isDrawing && (
            <AnimatedTimerBar
              timeRemaining={timeRemaining}
              totalTime={drawTimeSec}
            />
          )}

          {/* ── Word Display ── */}
          <Pressable
            onPress={() => keyboardVisible && Keyboard.dismiss()}
            style={styles.wordBar}
          >
            <Text
              style={[styles.wordText, { color: textColor }]}
              numberOfLines={1}
            >
              {isDrawer && roomState.secretWord
                ? roomState.secretWord
                : maskedWord ||
                  (phase === "waiting" ? "Waiting for players..." : "...")}
            </Text>
          </Pressable>

          {/* ── Player Strip ── */}
          <View style={styles.playerStrip}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.playerScrollContent}
            >
              {players.map((p) => (
                <PlayerChip
                  key={p.uid}
                  uid={p.uid}
                  displayName={p.displayName}
                  score={scores[p.uid] ?? 0}
                  isDrawer={p.uid === roomState.drawerId}
                  hasGuessedCorrectly={correctGuessers.includes(p.uid)}
                  isCurrentUser={p.uid === myUid}
                  isDark={isDark}
                  primaryColor={primaryColor}
                  textColor={textColor}
                />
              ))}
            </ScrollView>
            {isDrawing && totalGuessers > 0 && (
              <Text style={[styles.guessedCounter, { color: primaryColor }]}>
                {guessedCount}/{totalGuessers} guessed
              </Text>
            )}
          </View>

          {/* ── Canvas ── */}
          <View style={styles.canvasContainer}>
            {isTurnEnd ? (
              <TurnRecapCard
                word={turnRecapWord.current || maskedWord}
                guessers={guessedCount}
                totalGuessers={totalGuessers}
                topGuessers={turnRecapGuessers.current}
                drawerName={turnRecapDrawerName.current}
                isDark={isDark}
                primaryColor={primaryColor}
                textColor={textColor}
              />
            ) : (
              <GestureDetector gesture={panGesture}>
                <View>
                  <DrawingCanvas
                    strokes={strokes}
                    canvasSize={CANVAS_SIZE}
                    isDark={isDark}
                  />
                </View>
              </GestureDetector>
            )}
          </View>

          {/* ── Bottom Control Dock ── */}
          {isDrawer && isDrawing ? (
            <DrawerToolBar
              selectedColor={selectedColor}
              selectedWidth={selectedWidth}
              selectedTool={selectedTool}
              onColorChange={setSelectedColor}
              onWidthChange={setSelectedWidth}
              onToolChange={setSelectedTool}
              onUndo={handleUndo}
              onClear={handleClear}
              isDark={isDark}
              primaryColor={primaryColor}
              textColor={textColor}
            />
          ) : (
            <View style={styles.guesserDock}>
              {/* Chat feed (collapsed by default) */}
              <CollapsibleChatFeed
                entries={chatEntries}
                expanded={chatExpanded}
                onToggle={() => setChatExpanded((p) => !p)}
                primaryColor={primaryColor}
                textColor={textColor}
                isDark={isDark}
              />

              {/* Reaction buttons */}
              {isDrawing && (
                <View style={styles.reactionRow}>
                  {(
                    [
                      { kind: "thumbsup", emoji: "👍" },
                      { kind: "thumbsdown", emoji: "👎" },
                      { kind: "fire", emoji: "🔥" },
                      { kind: "laugh", emoji: "😂" },
                    ] as const
                  ).map(({ kind, emoji }) => (
                    <TouchableOpacity
                      key={kind}
                      onPress={() => handleReaction(kind)}
                      style={[
                        styles.reactionBtn,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(0,0,0,0.05)",
                        },
                      ]}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Guess input (non-drawer, drawing phase only) */}
              {!isDrawer && isDrawing && (
                <GuesserInput
                  wordLength={wordLength}
                  hasGuessedCorrectly={hasGuessedCorrectly}
                  onSubmit={handleGuessSubmit}
                  isDark={isDark}
                  primaryColor={primaryColor}
                  textColor={textColor}
                  keyboardVisible={keyboardVisible}
                />
              )}
            </View>
          )}

          {/* ── Reaction Bubbles (floating overlay) ── */}
          {reactionBubbles.length > 0 && (
            <View style={styles.reactionBubblesContainer} pointerEvents="none">
              {reactionBubbles.map((r, i) => {
                const EMOJI_MAP: Record<string, string> = {
                  thumbsup: "👍",
                  thumbsdown: "👎",
                  fire: "🔥",
                  laugh: "😂",
                };
                return (
                  <View
                    key={r.id}
                    style={[styles.reactionBubble, { bottom: 80 + i * 36 }]}
                  >
                    <Text style={styles.reactionBubbleEmoji}>
                      {EMOJI_MAP[r.kind] ?? "👍"}
                    </Text>
                    <Text
                      style={[styles.reactionBubbleName, { color: textColor }]}
                      numberOfLines={1}
                    >
                      {r.displayName}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Overlays ── */}
          <WordChoiceModal
            visible={isChoosing && wordChoices.length > 0}
            choices={wordChoices}
            timeRemaining={chooseTimeRemaining}
            onChoose={handleWordChoice}
            isDark={isDark}
            primaryColor={primaryColor}
            textColor={textColor}
          />

          <MatchSettingsSheet
            visible={settingsSheetVisible}
            onClose={() => setSettingsSheetVisible(false)}
            settings={effectiveSettings}
            isDark={isDark}
            primaryColor={primaryColor}
            textColor={textColor}
          />

          <CorrectGuessToast
            visible={correctGuessToastVisible}
            points={correctGuessPoints}
          />
        </View>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // ── Layout ──
  container: {
    flex: 1,
    alignItems: "center",
  },
  connectingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  statusText: {
    fontSize: 18,
    fontWeight: "600",
  },

  // ── HUD ──
  hudTouchDismiss: {
    width: "100%",
  },
  hudBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  hudLeft: {
    flex: 1,
    alignItems: "flex-start" as const,
  },
  hudRight: {
    flex: 1,
    alignItems: "flex-end" as const,
  },
  roundText: {
    fontSize: 15,
    fontWeight: "700",
  },
  timerText: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "right" as const,
  },

  // ── Timer Bar ──
  timerBarContainer: {
    width: TIMER_BAR_WIDTH,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(128,128,128,0.15)",
    overflow: "hidden",
    marginBottom: 4,
  },
  timerBarFill: {
    height: "100%",
    borderRadius: 3,
  },

  // ── Word Display ──
  wordBar: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    alignItems: "center",
  },
  wordText: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },

  // ── Player Strip ──
  playerStrip: {
    width: "100%",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  playerScrollContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  guessedCounter: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
  },
  playerChip: {
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 52,
    borderWidth: 1,
    borderColor: "transparent",
  },
  playerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  playerAvatarText: {
    fontSize: 14,
    fontWeight: "700",
  },
  playerStatusBadge: {
    position: "absolute",
    bottom: -2,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
  },
  playerChipName: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  playerChipScore: {
    fontSize: 11,
    fontWeight: "800",
  },

  // ── Canvas ──
  canvasContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 4,
  },
  canvas: {
    borderWidth: 2,
    borderRadius: 12,
    overflow: "hidden",
    // Subtle shadow
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  // ── Tool Bar ──
  toolBar: {
    width: "100%",
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 5,
  },
  toolRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  colorRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  toolBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(128,128,128,0.12)",
  },
  brushPreview: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(128,128,128,0.08)",
    marginLeft: 4,
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "transparent",
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: "#007AFF",
    transform: [{ scale: 1.15 }],
  },
  colorExpandBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  sizeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: "center",
    minWidth: 48,
  },
  sizeChipLabel: {
    fontSize: 10,
    fontWeight: "700",
  },

  // ── Guesser Dock ──
  guesserDock: {
    width: "100%",
    paddingHorizontal: 12,
  },

  // ── Chat ──
  chatContainer: {
    marginBottom: 6,
    overflow: "hidden",
  },
  chatToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
  },
  chatToggleText: {
    fontSize: 11,
    fontWeight: "600",
  },
  chatScroll: {
    maxHeight: 48,
  },
  chatScrollExpanded: {
    maxHeight: 120,
  },
  chatMsg: {
    fontSize: 13,
    paddingVertical: 1,
  },
  chatSystem: {
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 1,
  },

  // ── Guess Input ──
  guessInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  guessInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  guessSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  keyboardDismissBtn: {
    width: 36,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
  },
  guessLockedRow: {
    paddingVertical: 10,
    alignItems: "center",
  },
  guessLockedText: {
    fontSize: 15,
    fontWeight: "600",
  },

  // ── Word Choice Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    minWidth: 280,
    maxWidth: SCREEN_WIDTH - 48,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalTimer: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 16,
  },
  wordChoicesRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  wordChoiceBtn: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 80,
    alignItems: "center",
  },
  wordChoiceBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },

  // ── Settings Sheet ──
  settingsSheet: {
    padding: 24,
    borderRadius: 20,
    minWidth: 280,
    maxWidth: SCREEN_WIDTH - 48,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  settingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  settingsValue: {
    fontSize: 14,
  },
  settingsCloseBtn: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  settingsCloseBtnText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "600",
  },

  // ── Correct Guess Toast ──
  correctGuessToast: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    backgroundColor: "rgba(52, 199, 89, 0.95)",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 20,
    zIndex: 999,
  },
  correctGuessToastText: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "800",
  },

  // ── Turn Recap Card ──
  recapCard: {
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    minWidth: 260,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  recapTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  recapWord: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 8,
  },
  recapClarity: {
    fontSize: 14,
    marginBottom: 8,
  },
  recapGuessers: {
    alignItems: "center",
    gap: 2,
  },
  recapGuesserLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  recapGuesserName: {
    fontSize: 14,
  },

  // ── Match End ──
  matchEndTitle: {
    fontSize: 28,
    fontWeight: "800",
    marginTop: 40,
    marginBottom: 20,
  },
  finalScores: {
    alignItems: "stretch",
    gap: 12,
    paddingHorizontal: 32,
    width: "100%",
  },
  finalScoreItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  finalScoreRow: {
    fontSize: 18,
    fontWeight: "600",
  },
  finalScorePoints: {
    fontSize: 18,
    fontWeight: "700",
  },

  // ── Drawer Info Strip ──
  drawerInfoStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  drawerInfoAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  drawerInfoAvatarText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "800",
  },
  drawerInfoName: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },

  // ── Reaction Buttons ──
  reactionRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 4,
  },
  reactionBtn: {
    width: 38,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  reactionEmoji: {
    fontSize: 18,
  },

  // ── Reaction Bubbles (floating) ──
  reactionBubblesContainer: {
    position: "absolute",
    right: 12,
    bottom: 0,
    alignItems: "flex-end",
    zIndex: 900,
  },
  reactionBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    position: "absolute",
    right: 0,
  },
  reactionBubbleEmoji: {
    fontSize: 16,
  },
  reactionBubbleName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFF",
    maxWidth: 80,
  },
});

// =============================================================================
// Export with V4 Shell wrapper
// =============================================================================

export default withGameV4Shell(SketchPartyUI, "sketch_party_game");
