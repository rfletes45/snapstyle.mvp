/**
 * Games V4 — Sketch Party Game Screen
 *
 * Real-time drawing + guessing game screen for 2–8 players.
 * Connects to Colyseus for authoritative state; renders Skia canvas for drawing.
 *
 * Layout (portrait, mobile-first):
 *   ┌─────────────────────┐
 *   │  Round X/Y  │ Timer │
 *   ├─────────────────────┤
 *   │  Player Strip (2-8) │
 *   ├─────────────────────┤
 *   │                     │
 *   │      Canvas         │
 *   │                     │
 *   ├─────────────────────┤
 *   │  Tools (drawer) OR  │
 *   │  Guess Input (guess)│
 *   │  Chat Feed (last 5) │
 *   └─────────────────────┘
 *
 * @module gamesV4/screens/SketchPartyScreenV4
 */

import type { GameShellProps } from "@/gamesV4/components/GameScreenShell";
import { withGameV4Shell } from "@/gamesV4/components/GameScreenShell";
import type {
  ChatEntry,
  SketchPartyRoomState,
  StrokeData,
} from "@/gamesV4/services/sketchPartyClient";
import {
  joinSketchPartyRoom,
  leaveRoom,
  sendClearCanvas,
  sendGuess,
  sendStrokeBegin,
  sendStrokeEnd,
  sendStrokePoints,
  sendUndo,
  sendWordChoice,
} from "@/gamesV4/services/sketchPartyClient";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Room } from "colyseus.js";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { SafeAreaView } from "react-native-safe-area-context";

// =============================================================================
// Constants
// =============================================================================

const SCREEN_WIDTH = Dimensions.get("window").width;
const CANVAS_SIZE = Math.min(SCREEN_WIDTH - 32, 400);
const QUANTIZE_RANGE = 1023;
const STROKE_BATCH_INTERVAL = 40; // ms
const MIN_MOVE_THRESHOLD = 2; // px

const TOOL_COLORS = [
  "#000000",
  "#FF0000",
  "#FF9500",
  "#FFCC00",
  "#34C759",
  "#007AFF",
  "#AF52DE",
  "#FFFFFF",
];
const TOOL_WIDTHS = [2, 4, 8, 12];

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
// Player Status Badge
// =============================================================================

function PlayerBadge({
  uid,
  displayName,
  score,
  isDrawer,
  hasGuessedCorrectly,
  isCurrentUser,
  theme,
}: {
  uid: string;
  displayName: string;
  score: number;
  isDrawer: boolean;
  hasGuessedCorrectly: boolean;
  isCurrentUser: boolean;
  theme: ReturnType<typeof useAppTheme>["theme"];
}) {
  const statusIcon = isDrawer ? "✏️" : hasGuessedCorrectly ? "✅" : "⏳";
  return (
    <View
      style={[
        styles.playerBadge,
        isCurrentUser && { borderColor: theme.colors.primary, borderWidth: 2 },
      ]}
    >
      <Text style={styles.playerBadgeIcon}>{statusIcon}</Text>
      <Text
        style={[styles.playerBadgeName, { color: theme.colors.text }]}
        numberOfLines={1}
      >
        {displayName.slice(0, 8)}
      </Text>
      <Text style={[styles.playerBadgeScore, { color: theme.colors.primary }]}>
        {score}
      </Text>
    </View>
  );
}

// =============================================================================
// Chat Item
// =============================================================================

function ChatItem({
  entry,
  theme,
}: {
  entry: ChatEntry;
  theme: ReturnType<typeof useAppTheme>["theme"];
}) {
  if (entry.isSystem) {
    return (
      <Text style={[styles.chatSystem, { color: theme.colors.primary }]}>
        {entry.text}
      </Text>
    );
  }
  return (
    <Text style={[styles.chatMsg, { color: theme.colors.text }]}>
      <Text style={{ fontWeight: "700" }}>{entry.displayName}: </Text>
      <Text style={entry.isCorrect ? { color: "#34C759" } : undefined}>
        {entry.isCorrect ? "Guessed correctly!" : entry.text}
      </Text>
    </Text>
  );
}

// =============================================================================
// Word Choice Modal
// =============================================================================

function WordChoiceModal({
  visible,
  choices,
  timeRemaining,
  onChoose,
  theme,
}: {
  visible: boolean;
  choices: string[];
  timeRemaining: number;
  onChoose: (index: number) => void;
  theme: ReturnType<typeof useAppTheme>["theme"];
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: theme.isDark ? "#1C1C1E" : "#FFF" },
          ]}
        >
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            Choose a word to draw!
          </Text>
          <Text style={[styles.modalTimer, { color: theme.colors.primary }]}>
            {timeRemaining}s
          </Text>
          <View style={styles.wordChoicesRow}>
            {choices.map((word, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.wordChoiceBtn,
                  { backgroundColor: theme.colors.primary },
                ]}
                onPress={() => onChoose(i)}
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
// Drawing Canvas (simplified — uses View + gesture paths)
// =============================================================================

function DrawingCanvas({
  strokes,
  canvasSize,
  theme,
}: {
  strokes: StrokeData[];
  canvasSize: number;
  theme: ReturnType<typeof useAppTheme>["theme"];
}) {
  return (
    <View
      style={[
        styles.canvas,
        {
          width: canvasSize,
          height: canvasSize,
          backgroundColor: theme.isDark ? "#1A1A1A" : "#FFFFFF",
          borderColor: theme.isDark ? "#333" : "#DDD",
        },
      ]}
    >
      {/* SVG-like stroke rendering using absolute positioned Views */}
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
                    stroke.tool === "eraser"
                      ? theme.isDark
                        ? "#1A1A1A"
                        : "#FFFFFF"
                      : stroke.color,
                  transform: [{ rotate: `${angle}deg` }],
                  transformOrigin: "left center",
                  borderRadius: stroke.width / 2,
                }}
              />
            );
          })}
          {/* Draw dots at each point for smoothness */}
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
                  stroke.tool === "eraser"
                    ? theme.isDark
                      ? "#1A1A1A"
                      : "#FFFFFF"
                    : stroke.color,
              }}
            />
          ))}
        </React.Fragment>
      ))}
    </View>
  );
}

// =============================================================================
// Tool Bar (drawer only)
// =============================================================================

function ToolBar({
  selectedColor,
  selectedWidth,
  selectedTool,
  onColorChange,
  onWidthChange,
  onToolChange,
  onUndo,
  onClear,
  theme,
}: {
  selectedColor: string;
  selectedWidth: number;
  selectedTool: "pen" | "eraser";
  onColorChange: (c: string) => void;
  onWidthChange: (w: number) => void;
  onToolChange: (t: "pen" | "eraser") => void;
  onUndo: () => void;
  onClear: () => void;
  theme: ReturnType<typeof useAppTheme>["theme"];
}) {
  return (
    <View style={styles.toolBar}>
      {/* Tool toggle */}
      <View style={styles.toolRow}>
        <TouchableOpacity
          style={[
            styles.toolBtn,
            selectedTool === "pen" && {
              backgroundColor: theme.colors.primary,
            },
          ]}
          onPress={() => onToolChange("pen")}
        >
          <MaterialCommunityIcons
            name="pencil"
            size={20}
            color={selectedTool === "pen" ? "#FFF" : theme.colors.text}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toolBtn,
            selectedTool === "eraser" && {
              backgroundColor: theme.colors.primary,
            },
          ]}
          onPress={() => onToolChange("eraser")}
        >
          <MaterialCommunityIcons
            name="eraser"
            size={20}
            color={selectedTool === "eraser" ? "#FFF" : theme.colors.text}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={onUndo}>
          <MaterialCommunityIcons
            name="undo"
            size={20}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={onClear}>
          <MaterialCommunityIcons
            name="delete-outline"
            size={20}
            color={theme.colors.text}
          />
        </TouchableOpacity>
      </View>
      {/* Color picker */}
      <View style={styles.toolRow}>
        {TOOL_COLORS.map((c) => (
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
      {/* Width picker */}
      <View style={styles.toolRow}>
        {TOOL_WIDTHS.map((w) => (
          <TouchableOpacity
            key={w}
            style={[
              styles.widthBtn,
              selectedWidth === w && {
                backgroundColor: theme.colors.primary,
              },
            ]}
            onPress={() => onWidthChange(w)}
          >
            <View
              style={{
                width: w * 2,
                height: w * 2,
                borderRadius: w,
                backgroundColor:
                  selectedWidth === w ? "#FFF" : theme.colors.text,
              }}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// =============================================================================
// Main Sketch Party UI
// =============================================================================

function SketchPartyUI({ publicState, myUid, sessionId }: GameShellProps) {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const roomRef = useRef<Room | null>(null);

  // Room state (from Colyseus)
  const [roomState, setRoomState] = useState<SketchPartyRoomState | null>(null);
  const [strokes, setStrokes] = useState<StrokeData[]>([]);
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const [chooseTimeRemaining, setChooseTimeRemaining] = useState(10);

  // Drawing state
  const [selectedTool, setSelectedTool] = useState<"pen" | "eraser">("pen");
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [selectedWidth, setSelectedWidth] = useState(4);
  const [guessText, setGuessText] = useState("");
  const currentStrokeRef = useRef<StrokeData | null>(null);
  const batchBufferRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const batchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const strokeIdCounterRef = useRef(0);

  // Derived state
  const isDrawer = roomState?.drawerId === myUid;
  const phase = roomState?.phase ?? "waiting";
  const isChoosing = phase === "choosing" && isDrawer;
  const isDrawing = phase === "drawing";
  const isMatchEnd = phase === "match_end";

  // ── Colyseus connection ──────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    let room: Room | null = null;

    async function connect() {
      try {
        const token = (await currentFirebaseUser?.getIdToken()) ?? "";
        room = await joinSketchPartyRoom(
          sessionId,
          myUid,
          currentFirebaseUser?.displayName ?? "Player",
          token,
        );
        if (!mounted) {
          room.leave();
          return;
        }
        roomRef.current = room;
        setConnected(true);
        console.log(`[SketchParty] Connected to room ${room.roomId}`);

        // State sync via custom messages (server broadcasts "state_sync")
        room.onMessage("state_sync", (state: SketchPartyRoomState) => {
          if (mounted) {
            setRoomState(state);
          }
        });

        // Messages
        room.onMessage(
          "stroke_begin",
          (
            msg: StrokeData & {
              strokeId: string;
              tool: string;
              color: string;
              width: number;
              x: number;
              y: number;
            },
          ) => {
            if (!mounted) return;
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
          (msg: {
            strokeId: string;
            points: Array<{ x: number; y: number }>;
          }) => {
            if (!mounted) return;
            setStrokes((prev) =>
              prev.map((s) =>
                s.strokeId === msg.strokeId
                  ? { ...s, points: [...s.points, ...msg.points] }
                  : s,
              ),
            );
          },
        );

        room.onMessage("stroke_end", (_msg: { strokeId: string }) => {
          // Stroke is already assembled; nothing to do
        });

        room.onMessage("chat", (msg: ChatEntry) => {
          if (!mounted) return;
          setChatEntries((prev) => [...prev.slice(-49), msg]);
        });

        room.onMessage("clear_canvas", () => {
          if (mounted) setStrokes([]);
        });

        room.onMessage("undo_stroke", (msg: { strokeId: string }) => {
          if (!mounted) return;
          setStrokes((prev) => prev.filter((s) => s.strokeId !== msg.strokeId));
        });

        room.onMessage("board_snapshot", (msg: { strokes: StrokeData[] }) => {
          if (mounted) setStrokes(msg.strokes ?? []);
        });

        room.onMessage(
          "word_choices",
          (msg: { words: string[]; timeRemaining: number }) => {
            if (!mounted) return;
            setWordChoices(msg.words);
            setChooseTimeRemaining(msg.timeRemaining);
          },
        );

        room.onMessage("word_reveal", (_msg: { word: string }) => {
          // Word reveal is handled via state change / chat system message
        });

        room.onMessage("turn_start", () => {
          if (mounted) {
            setStrokes([]);
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
          }
        });

        room.onError((code: number, message?: string) => {
          console.warn(`[SketchParty] Room error ${code}: ${message}`);
        });

        room.onLeave((code: number) => {
          if (mounted) setConnected(false);
        });
      } catch (err) {
        console.warn("[SketchParty] Failed to join room:", err);
        if (mounted) {
          setConnectionError(
            err instanceof Error
              ? err.message
              : "Could not connect to game server",
          );
        }
      }
    }

    connect();

    return () => {
      mounted = false;
      if (roomRef.current) {
        leaveRoom(roomRef.current);
        roomRef.current = null;
      }
      if (batchTimerRef.current) {
        clearInterval(batchTimerRef.current);
      }
    };
  }, [sessionId, myUid]);

  // ── Stroke batching ────────────────────────────────────────────────
  const flushBatch = useCallback(() => {
    const room = roomRef.current;
    const stroke = currentStrokeRef.current;
    const buffer = batchBufferRef.current;
    if (!room || !stroke || buffer.length === 0) return;

    sendStrokePoints(room, {
      strokeId: stroke.strokeId,
      points: buffer.splice(0),
    });
  }, []);

  // ── Drawing gesture (drawer only) ─────────────────────────────────
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isDrawer && isDrawing)
        .minDistance(0)
        .onBegin((e) => {
          const room = roomRef.current;
          if (!room) return;
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

          sendStrokeBegin(room, {
            strokeId,
            tool: selectedTool,
            color: selectedColor,
            width: selectedWidth,
            x,
            y,
            t: Date.now(),
          });

          // Add to local strokes immediately (optimistic)
          setStrokes((prev) => [...prev, { ...currentStrokeRef.current! }]);

          // Start batch timer
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

          // Threshold check
          const lastPt = stroke.points[stroke.points.length - 1];
          if (lastPt) {
            const dx = fromNormalized(x - lastPt.x, CANVAS_SIZE);
            const dy = fromNormalized(y - lastPt.y, CANVAS_SIZE);
            if (Math.sqrt(dx * dx + dy * dy) < MIN_MOVE_THRESHOLD) return;
          }

          stroke.points.push({ x, y });
          batchBufferRef.current.push({ x, y, t: Date.now() });

          // Optimistic local update
          setStrokes((prev) =>
            prev.map((s) =>
              s.strokeId === stroke.strokeId
                ? { ...s, points: [...stroke.points] }
                : s,
            ),
          );
        })
        .onEnd(() => {
          const room = roomRef.current;
          const stroke = currentStrokeRef.current;
          if (!room || !stroke) return;

          // Flush remaining batch
          flushBatch();
          if (batchTimerRef.current) {
            clearInterval(batchTimerRef.current);
            batchTimerRef.current = null;
          }

          sendStrokeEnd(room, { strokeId: stroke.strokeId });
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
    ],
  );

  // ── Actions ────────────────────────────────────────────────────────
  const handleGuessSubmit = useCallback(() => {
    const room = roomRef.current;
    if (!room || !guessText.trim()) return;
    sendGuess(room, guessText.trim());
    setGuessText("");
  }, [guessText]);

  const handleWordChoice = useCallback((index: number) => {
    const room = roomRef.current;
    if (!room) return;
    sendWordChoice(room, index);
    setWordChoices([]);
  }, []);

  const handleUndo = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    sendUndo(room);
  }, []);

  const handleClear = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    sendClearCanvas(room);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────
  const players = roomState?.players ?? [];
  const scores = roomState?.scores ?? {};
  const correctGuessers = roomState?.correctGuessers ?? [];
  const timeRemaining = roomState?.timeRemainingSec ?? 0;
  const currentRound = roomState?.currentRound ?? 1;
  const totalRounds = roomState?.totalRounds ?? 3;
  const maskedWord = roomState?.maskedWord ?? "";

  // "Waiting" state before Colyseus connects
  if (!connected || !roomState) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          {
            backgroundColor: theme.isDark ? "#000" : theme.colors.background,
          },
        ]}
      >
        <Text style={[styles.statusText, { color: theme.colors.primary }]}>
          {connectionError
            ? `Connection failed: ${connectionError}`
            : "Connecting to game server..."}
        </Text>
      </SafeAreaView>
    );
  }

  // Match end
  if (isMatchEnd) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          {
            backgroundColor: theme.isDark ? "#000" : theme.colors.background,
          },
        ]}
      >
        <Text style={[styles.statusText, { color: theme.colors.primary }]}>
          Match Complete! Calculating results...
        </Text>
        <View style={styles.finalScores}>
          {Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .map(([uid, score], i) => {
              const player = players.find((p) => p.uid === uid);
              return (
                <Text
                  key={uid}
                  style={[
                    styles.finalScoreRow,
                    { color: theme.colors.text },
                    i === 0 && { color: "#FFD700", fontWeight: "700" },
                  ]}
                >
                  {i + 1}. {player?.displayName ?? uid} — {score} pts
                </Text>
              );
            })}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <SafeAreaView
          style={[
            styles.container,
            {
              backgroundColor: theme.isDark ? "#000" : theme.colors.background,
            },
          ]}
        >
          {/* Top bar: Round + Timer + Word mask */}
          <View style={styles.topBar}>
            <Text style={[styles.roundText, { color: theme.colors.text }]}>
              Round {currentRound}/{totalRounds}
            </Text>
            <Text
              style={[
                styles.timerText,
                {
                  color: timeRemaining <= 10 ? "#FF3B30" : theme.colors.primary,
                },
              ]}
            >
              {timeRemaining}s
            </Text>
          </View>

          {/* Word display */}
          <View style={styles.wordBar}>
            <Text
              style={[styles.wordText, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {isDrawer && roomState.secretWord
                ? roomState.secretWord
                : maskedWord || "Waiting..."}
            </Text>
          </View>

          {/* Player strip */}
          <View style={styles.playerStrip}>
            {players.map((p) => (
              <PlayerBadge
                key={p.uid}
                uid={p.uid}
                displayName={p.displayName}
                score={scores[p.uid] ?? 0}
                isDrawer={p.uid === roomState.drawerId}
                hasGuessedCorrectly={correctGuessers.includes(p.uid)}
                isCurrentUser={p.uid === myUid}
                theme={theme}
              />
            ))}
          </View>

          {/* Canvas */}
          <View style={styles.canvasContainer}>
            <GestureDetector gesture={panGesture}>
              <View>
                <DrawingCanvas
                  strokes={strokes}
                  canvasSize={CANVAS_SIZE}
                  theme={theme}
                />
              </View>
            </GestureDetector>
          </View>

          {/* Bottom area: tools OR guess input + chat */}
          {isDrawer && isDrawing ? (
            <ToolBar
              selectedColor={selectedColor}
              selectedWidth={selectedWidth}
              selectedTool={selectedTool}
              onColorChange={setSelectedColor}
              onWidthChange={setSelectedWidth}
              onToolChange={setSelectedTool}
              onUndo={handleUndo}
              onClear={handleClear}
              theme={theme}
            />
          ) : (
            <View style={styles.guessArea}>
              {/* Chat feed */}
              <FlatList
                data={chatEntries.slice(-5)}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item }) => (
                  <ChatItem entry={item} theme={theme} />
                )}
                style={styles.chatList}
                inverted={false}
              />
              {/* Guess input (not shown for drawer) */}
              {!isDrawer && isDrawing && (
                <View style={styles.guessInputRow}>
                  <TextInput
                    style={[
                      styles.guessInput,
                      {
                        color: theme.colors.text,
                        borderColor: theme.isDark ? "#444" : "#CCC",
                        backgroundColor: theme.isDark ? "#1C1C1E" : "#F9F9F9",
                      },
                    ]}
                    placeholder="Type your guess..."
                    placeholderTextColor={theme.isDark ? "#666" : "#999"}
                    value={guessText}
                    onChangeText={setGuessText}
                    onSubmitEditing={handleGuessSubmit}
                    returnKeyType="send"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={[
                      styles.guessSendBtn,
                      { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={handleGuessSubmit}
                  >
                    <MaterialCommunityIcons
                      name="send"
                      size={20}
                      color="#FFF"
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Word choice modal (drawer only, choosing phase) */}
          <WordChoiceModal
            visible={isChoosing && wordChoices.length > 0}
            choices={wordChoices}
            timeRemaining={chooseTimeRemaining}
            onChoose={handleWordChoice}
            theme={theme}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  statusText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 40,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  roundText: {
    fontSize: 16,
    fontWeight: "600",
  },
  timerText: {
    fontSize: 24,
    fontWeight: "700",
  },
  wordBar: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    alignItems: "center",
  },
  wordText: {
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  playerStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  playerBadge: {
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 48,
    borderWidth: 1,
    borderColor: "transparent",
  },
  playerBadgeIcon: {
    fontSize: 14,
  },
  playerBadgeName: {
    fontSize: 10,
    fontWeight: "600",
  },
  playerBadgeScore: {
    fontSize: 11,
    fontWeight: "700",
  },
  canvasContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 4,
  },
  canvas: {
    borderWidth: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  toolBar: {
    width: "100%",
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 6,
  },
  toolRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(128,128,128,0.15)",
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#888",
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: "#007AFF",
  },
  widthBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(128,128,128,0.15)",
  },
  guessArea: {
    width: "100%",
    paddingHorizontal: 12,
    paddingBottom: 8,
    maxHeight: 160,
  },
  chatList: {
    maxHeight: 80,
    marginBottom: 4,
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
  guessInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  guessInput: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  guessSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    minWidth: 280,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalTimer: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
  },
  wordChoicesRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  wordChoiceBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  wordChoiceBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  finalScores: {
    marginTop: 24,
    alignItems: "center",
    gap: 8,
  },
  finalScoreRow: {
    fontSize: 18,
    fontWeight: "500",
  },
});

// =============================================================================
// Export with V4 Shell wrapper
// =============================================================================

export default withGameV4Shell(SketchPartyUI, "sketch_party_game");
