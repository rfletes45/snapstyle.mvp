/**
 * DrawGameScreen — Pictionary / Drawing Game
 *
 * How to play:
 * 1. A random word prompt is shown
 * 2. Draw the word on the canvas
 * 3. Share your drawing with friends!
 * 4. Score based on how fast you draw
 *
 * Supports: Single-player drawing with sharing (real-time multiplayer placeholder)
 */

import FriendPickerModal from "@/components/FriendPickerModal";
import {
  getPersonalBest,
  PersonalBest,
  recordGameSession,
  sendScorecard,
} from "@/services/games";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useColors } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  GestureResponderEvent,
  PanResponder,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Canvas,
  Circle as SkiaCircle,
  LinearGradient,
  RadialGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import { Button, Dialog, Portal, Text } from "react-native-paper";

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GAME_TYPE = "draw_game";
const CANVAS_SIZE = SCREEN_WIDTH - 32;
const TIME_LIMIT = 60;

type GameState = "menu" | "playing" | "result";

interface DrawPath {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

const WORD_BANK = [
  "cat",
  "dog",
  "house",
  "tree",
  "sun",
  "moon",
  "star",
  "fish",
  "bird",
  "flower",
  "car",
  "boat",
  "pizza",
  "hat",
  "shoe",
  "phone",
  "book",
  "clock",
  "cloud",
  "rain",
  "snow",
  "fire",
  "heart",
  "smile",
  "mountain",
  "beach",
  "cup",
  "ball",
  "key",
  "cake",
  "apple",
  "banana",
  "guitar",
  "drum",
  "piano",
  "robot",
  "rocket",
  "plane",
  "train",
  "bicycle",
  "bridge",
  "crown",
  "diamond",
  "eye",
  "hand",
  "foot",
  "nose",
  "butterfly",
  "spider",
  "snake",
  "turtle",
  "elephant",
];

const BRUSH_COLORS = [
  "#000000",
  "#e74c3c",
  "#3498db",
  "#27ae60",
  "#f39c12",
  "#8e44ad",
  "#e67e22",
  "#1abc9c",
  "#fff",
];

const BRUSH_SIZES = [3, 6, 10, 16];

// =============================================================================
// Component
// =============================================================================

export default function DrawGameScreen({ navigation }: { navigation: any }) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  const [gameState, setGameState] = useState<GameState>("menu");
  const [word, setWord] = useState("");
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentColor, setCurrentColor] = useState("#000000");
  const [currentWidth, setCurrentWidth] = useState(6);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const currentPathRef = useRef<DrawPath | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null!);
  const canvasRef = useRef<View>(null);
  const canvasLayoutRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(setPersonalBest);
    }
  }, [currentFirebaseUser]);

  useEffect(() => {
    if (gameState === "playing") {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            finishDrawing();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  const startGame = useCallback(() => {
    const w = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    setWord(w);
    setPaths([]);
    setTimeLeft(TIME_LIMIT);
    setCurrentColor("#000000");
    setCurrentWidth(6);
    setGameState("playing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const finishDrawing = useCallback(() => {
    clearInterval(timerRef.current!);
    const elapsed = TIME_LIMIT - timeLeft;
    if (currentFirebaseUser) {
      recordGameSession(currentFirebaseUser.uid, {
        gameId: GAME_TYPE,
        score: paths.length,
        duration: elapsed * 1000,
      });
    }
    setGameState("result");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [timeLeft, paths, currentFirebaseUser]);

  const clearCanvas = useCallback(() => {
    setPaths([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const undoLast = useCallback(() => {
    setPaths((prev) => prev.slice(0, -1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const currentColorRef = useRef(currentColor);
  const currentWidthRef = useRef(currentWidth);
  useEffect(() => {
    currentColorRef.current = currentColor;
  }, [currentColor]);
  useEffect(() => {
    currentWidthRef.current = currentWidth;
  }, [currentWidth]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        const newPath: DrawPath = {
          points: [{ x: locationX, y: locationY }],
          color: currentColorRef.current,
          width: currentWidthRef.current,
        };
        currentPathRef.current = newPath;
        setPaths((prev) => [...prev, newPath]);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (!currentPathRef.current) return;
        currentPathRef.current.points = [
          ...currentPathRef.current.points,
          { x: locationX, y: locationY },
        ];
        const snapshot: DrawPath = {
          points: [...currentPathRef.current.points],
          color: currentPathRef.current.color,
          width: currentPathRef.current.width,
        };
        setPaths((prev) => {
          const updated = prev.slice(0, -1);
          updated.push(snapshot);
          return updated;
        });
      },
      onPanResponderRelease: () => {
        if (currentPathRef.current) {
          const final: DrawPath = {
            points: [...currentPathRef.current.points],
            color: currentPathRef.current.color,
            width: currentPathRef.current.width,
          };
          setPaths((prev) => {
            const updated = prev.slice(0, -1);
            updated.push(final);
            return updated;
          });
          currentPathRef.current = null;
        }
      },
    }),
  ).current;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (timerRef.current) clearInterval(timerRef.current);
            navigation.goBack();
          }}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>🎨 Draw</Text>
        {gameState === "playing" && (
          <Text
            style={[
              styles.timer,
              { color: timeLeft <= 10 ? "#e74c3c" : colors.primary },
            ]}
          >
            {timeLeft}s
          </Text>
        )}
        {gameState !== "playing" && <View style={{ width: 50 }} />}
      </View>

      {gameState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>Draw</Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            Draw the word before time runs out!
          </Text>
          <Button
            mode="contained"
            onPress={startGame}
            style={{ backgroundColor: colors.primary, marginTop: 24 }}
            labelStyle={{ color: "#fff" }}
          >
            Start Drawing
          </Button>
        </View>
      )}

      {gameState === "playing" && (
        <View style={styles.playArea}>
          {/* Word prompt with Skia gradient */}
          <View
            style={[
              styles.wordBox,
              { borderColor: colors.primary },
            ]}
          >
            <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
              <RoundedRect x={0} y={0} width={CANVAS_SIZE} height={60} r={12}>
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(CANVAS_SIZE, 0)}
                  colors={[colors.primary + "20", colors.surface, colors.primary + "20"]}
                />
                <Shadow dx={0} dy={2} blur={8} color={colors.primary + "30"} />
              </RoundedRect>
            </Canvas>
            <Text style={{ color: colors.textSecondary, fontSize: 12, zIndex: 1 }}>
              Draw this:
            </Text>
            <Text
              style={{ color: colors.text, fontSize: 24, fontWeight: "800", zIndex: 1 }}
            >
              {word.toUpperCase()}
            </Text>
          </View>

          {/* Canvas with Skia gradient border glow */}
          <View style={{ position: "relative" }}>
            <Canvas style={{ position: "absolute", top: -4, left: -4, width: CANVAS_SIZE + 8, height: CANVAS_SIZE + 8 }} pointerEvents="none">
              <RoundedRect x={0} y={0} width={CANVAS_SIZE + 8} height={CANVAS_SIZE + 8} r={12}>
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(CANVAS_SIZE + 8, CANVAS_SIZE + 8)}
                  colors={[colors.primary + "60", colors.primary + "20", colors.primary + "60"]}
                />
              </RoundedRect>
            </Canvas>
            <View
              ref={canvasRef}
              style={[
                styles.canvas,
                {
                  width: CANVAS_SIZE,
                  height: CANVAS_SIZE,
                  backgroundColor: "#fff",
                  borderColor: colors.border,
                },
              ]}
              onLayout={(e) => {
                canvasLayoutRef.current = {
                  x: e.nativeEvent.layout.x,
                  y: e.nativeEvent.layout.y,
                };
              }}
              {...panResponder.panHandlers}
            >
              {/* Render paths as dots (simplified SVG-free rendering) */}
              {paths.map((path, pi) => {
                if (!path?.points) return null;
                return path.points.map((pt, i) => {
                  if (i === 0) return null;
                  const prev = path.points[i - 1];
                  const dist = Math.hypot(pt.x - prev.x, pt.y - prev.y);
                  const steps = Math.max(1, Math.floor(dist / 2));
                  return Array.from({ length: steps }).map((_, s) => {
                    const t = s / steps;
                    const x = prev.x + (pt.x - prev.x) * t;
                    const y = prev.y + (pt.y - prev.y) * t;
                    return (
                      <View
                        key={`${pi}-${i}-${s}`}
                        style={{
                          position: "absolute",
                          left: x - path.width / 2,
                          top: y - path.width / 2,
                          width: path.width,
                          height: path.width,
                          borderRadius: path.width / 2,
                          backgroundColor: path.color,
                        }}
                      />
                    );
                  });
                });
              })}
            </View>
          </View>

          {/* Color picker with Skia gradient selected indicator */}
          <View style={styles.colorRow}>
            {BRUSH_COLORS.map((clr) => {
              const isSelected = currentColor === clr;
              return (
                <TouchableOpacity
                  key={clr}
                  onPress={() => setCurrentColor(clr)}
                  style={[
                    styles.colorBtn,
                    {
                      borderColor:
                        isSelected ? colors.primary : colors.border,
                      borderWidth: isSelected ? 3 : 1,
                    },
                  ]}
                >
                  <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                    <SkiaCircle cx={14} cy={14} r={13}>
                      <RadialGradient
                        c={vec(10, 10)}
                        r={20}
                        colors={[clr === "#fff" ? "#FFFFFF" : clr + "FF", clr === "#fff" ? "#E0E0E0" : clr + "CC"]}
                      />
                    </SkiaCircle>
                  </Canvas>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Brush size & actions */}
          <View style={styles.actionRow}>
            {BRUSH_SIZES.map((size) => (
              <TouchableOpacity
                key={size}
                onPress={() => setCurrentWidth(size)}
                style={[
                  styles.sizeBtn,
                  {
                    borderColor:
                      currentWidth === size ? colors.primary : colors.border,
                    borderWidth: currentWidth === size ? 2 : 1,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <View
                  style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: colors.text,
                  }}
                />
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={undoLast} style={styles.actionBtn}>
              <MaterialCommunityIcons
                name="undo"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={clearCanvas} style={styles.actionBtn}>
              <MaterialCommunityIcons name="delete" size={24} color="#e74c3c" />
            </TouchableOpacity>
            <TouchableOpacity onPress={finishDrawing} style={styles.actionBtn}>
              <MaterialCommunityIcons
                name="check-circle"
                size={24}
                color="#27ae60"
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Result */}
      <Portal>
        <Dialog
          visible={gameState === "result"}
          onDismiss={() => {}}
          style={{ backgroundColor: colors.surface }}
        >
          <Dialog.Title style={{ color: colors.text, textAlign: "center" }}>
            🎨 Drawing Complete!
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.textSecondary, textAlign: "center" }}>
              Word: {word.toUpperCase()}
              {"\n"}Strokes: {paths.length}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={startGame}>New Word</Button>
            <Button onPress={() => setShowFriendPicker(true)}>Share</Button>
            <Button onPress={() => setGameState("menu")}>Menu</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FriendPickerModal
        visible={showFriendPicker}
        onDismiss={() => setShowFriendPicker(false)}
        onSelectFriend={async (friend) => {
          if (!currentFirebaseUser || isSending) return;
          setIsSending(true);
          try {
            await sendScorecard(currentFirebaseUser.uid, friend.friendUid, {
              gameId: GAME_TYPE,
              score: paths.length,
              playerName: profile?.displayName || "Player",
            });
            showSuccess("Drawing shared!");
          } catch {
            showError("Failed to share");
          }
          setIsSending(false);
          setShowFriendPicker(false);
        }}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Share Drawing With"
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 8,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: "700" },
  timer: { fontSize: 16, fontWeight: "700" },
  menuContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  menuTitle: { fontSize: 32, fontWeight: "800", marginBottom: 8 },
  menuSub: { fontSize: 16, marginBottom: 16 },
  playArea: { flex: 1, alignItems: "center", paddingTop: 8 },
  wordBox: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    marginBottom: 8,
  },
  canvas: {
    borderWidth: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  colorRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 6,
  },
  colorBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  sizeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtn: { padding: 6 },
  dialogActions: { justifyContent: "center" },
});
