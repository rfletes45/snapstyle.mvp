/**
 * SnapSliceGameScreen — Fruit Ninja / Slice Game
 *
 * How to play:
 * 1. Shapes are tossed from the bottom of the screen
 * 2. Swipe across them to slice!
 * 3. Slice combos for bonus points
 * 4. Avoid bombs — they end the game!
 *
 * Supports: Single-player quick play, high score
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
  View,
} from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const GAME_TYPE = "snap_slice";
const GRAVITY = 0.25;
const SPAWN_INTERVAL = 900; // ms base
const SHAPE_SIZE = 50;
const TOP_OFFSET = Platform.OS === "ios" ? 100 : 80;

type GameState = "menu" | "playing" | "result";

interface FlyingShape {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isBomb: boolean;
  sliced: boolean;
  color: string;
  icon: string;
  size: number;
}

const SHAPE_CONFIGS = [
  { icon: "apple", color: "#e74c3c" },
  { icon: "food-apple", color: "#27ae60" },
  { icon: "fruit-watermelon", color: "#2ecc71" },
  { icon: "fruit-grapes", color: "#8e44ad" },
  { icon: "fruit-cherries", color: "#c0392b" },
  { icon: "fruit-citrus", color: "#f39c12" },
];

// =============================================================================
// Component
// =============================================================================

export default function SnapSliceGameScreen({
  navigation,
}: {
  navigation: any;
}) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  const [gameState, setGameState] = useState<GameState>("menu");
  const [score, setScore] = useState(0);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);

  const shapesRef = useRef<FlyingShape[]>([]);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const comboRef = useRef(0);
  const nextIdRef = useRef(0);
  const loopRef = useRef<number>(null!);
  const spawnRef = useRef<ReturnType<typeof setInterval>>(null!);
  const [renderShapes, setRenderShapes] = useState<FlyingShape[]>([]);
  const sliceTrailRef = useRef<{ x: number; y: number }[]>([]);
  const [sliceTrail, setSliceTrail] = useState<{ x: number; y: number }[]>([]);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(setPersonalBest);
    }
  }, [currentFirebaseUser]);

  const endGame = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);
    setScore(scoreRef.current);
    setGameState("result");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (currentFirebaseUser) {
      const duration = Date.now() - startTimeRef.current;
      recordGameSession(currentFirebaseUser.uid, {
        gameId: GAME_TYPE,
        score: scoreRef.current,
        duration,
      });
    }
  }, [currentFirebaseUser]);

  const spawnShape = useCallback(() => {
    const isBomb = Math.random() < 0.15;
    const shape =
      SHAPE_CONFIGS[Math.floor(Math.random() * SHAPE_CONFIGS.length)];
    const x = SCREEN_WIDTH * 0.2 + Math.random() * SCREEN_WIDTH * 0.6;
    const vx = (Math.random() - 0.5) * 4;
    const vy = -(8 + Math.random() * 4);

    shapesRef.current.push({
      id: nextIdRef.current++,
      x,
      y: SCREEN_HEIGHT,
      vx,
      vy,
      isBomb,
      sliced: false,
      color: isBomb ? "#333" : shape.color,
      icon: isBomb ? "bomb" : shape.icon,
      size: SHAPE_SIZE,
    });
  }, []);

  const startGame = useCallback(() => {
    shapesRef.current = [];
    scoreRef.current = 0;
    livesRef.current = 3;
    comboRef.current = 0;
    nextIdRef.current = 0;
    startTimeRef.current = Date.now();
    setScore(0);
    setLives(3);
    setCombo(0);
    setGameState("playing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Spawn timer
    spawnRef.current = setInterval(() => {
      spawnShape();
      // Occasionally spawn multiple
      if (Math.random() < 0.3) spawnShape();
      if (Math.random() < 0.1) spawnShape();
    }, SPAWN_INTERVAL);

    const loop = () => {
      // Physics
      for (const shape of shapesRef.current) {
        shape.x += shape.vx;
        shape.y += shape.vy;
        shape.vy += GRAVITY;
      }

      // Check for unsliced shapes that fell off bottom
      const fallen = shapesRef.current.filter(
        (s) => !s.sliced && !s.isBomb && s.y > SCREEN_HEIGHT + 50 && s.vy > 0,
      );
      if (fallen.length > 0) {
        livesRef.current -= fallen.length;
        setLives(Math.max(0, livesRef.current));
        comboRef.current = 0;
        setCombo(0);
        if (livesRef.current <= 0) {
          endGame();
          return;
        }
      }

      // Remove off-screen shapes
      shapesRef.current = shapesRef.current.filter(
        (s) => s.y < SCREEN_HEIGHT + 100 || s.vy < 0,
      );

      setRenderShapes([...shapesRef.current]);
      loopRef.current = requestAnimationFrame(loop);
    };

    loopRef.current = requestAnimationFrame(loop);
  }, [endGame, spawnShape]);

  // Slice detection via PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { pageX, pageY } = evt.nativeEvent;
        sliceTrailRef.current = [{ x: pageX, y: pageY }];
        setSliceTrail([{ x: pageX, y: pageY }]);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { pageX, pageY } = evt.nativeEvent;
        sliceTrailRef.current.push({ x: pageX, y: pageY });
        if (sliceTrailRef.current.length > 20) sliceTrailRef.current.shift();
        setSliceTrail([...sliceTrailRef.current]);

        // Check intersections with shapes
        for (const shape of shapesRef.current) {
          if (shape.sliced) continue;
          const dist = Math.hypot(pageX - shape.x, pageY - shape.y);
          if (dist < shape.size) {
            shape.sliced = true;
            if (shape.isBomb) {
              endGame();
              return;
            }
            comboRef.current++;
            const comboBonus = comboRef.current > 1 ? comboRef.current : 0;
            scoreRef.current += 1 + comboBonus;
            setScore(scoreRef.current);
            setCombo(comboRef.current);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }
      },
      onPanResponderRelease: () => {
        sliceTrailRef.current = [];
        setSliceTrail([]);
        comboRef.current = 0;
        setCombo(0);
      },
    }),
  ).current;

  useEffect(() => {
    return () => {
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
      if (spawnRef.current) clearInterval(spawnRef.current);
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.backBtn}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
            onPress={() => {
              if (loopRef.current) cancelAnimationFrame(loopRef.current);
              if (spawnRef.current) clearInterval(spawnRef.current);
              navigation.goBack();
            }}
          />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          🍉 Snap Slice
        </Text>
        {gameState === "playing" ? (
          <View style={styles.headerRight}>
            <Text style={[styles.scoreText, { color: colors.primary }]}>
              {score}
            </Text>
          </View>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      {gameState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>
            Snap Slice
          </Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            Swipe to slice fruit. Avoid bombs! 💣
          </Text>
          {personalBest && (
            <Text style={[styles.bestText, { color: colors.primary }]}>
              Best: {personalBest.bestScore}
            </Text>
          )}
          <Button
            mode="contained"
            onPress={startGame}
            style={{ backgroundColor: colors.primary, marginTop: 24 }}
            labelStyle={{ color: "#fff" }}
          >
            Start Slicing
          </Button>
        </View>
      )}

      {gameState === "playing" && (
        <View style={styles.playArea} {...panResponder.panHandlers}>
          {/* Lives */}
          <View style={styles.livesRow}>
            {Array.from({ length: 3 }).map((_, i) => (
              <MaterialCommunityIcons
                key={i}
                name={i < lives ? "heart" : "heart-broken"}
                size={20}
                color={i < lives ? "#e74c3c" : colors.border}
                style={{ marginRight: 4 }}
              />
            ))}
            {combo > 1 && (
              <Text style={[styles.comboText, { color: colors.primary }]}>
                {combo}x COMBO!
              </Text>
            )}
          </View>

          {/* Shapes */}
          {renderShapes.map((shape) => (
            <View
              key={shape.id}
              style={[
                styles.shape,
                {
                  left: shape.x - shape.size / 2,
                  top: shape.y - shape.size / 2,
                  opacity: shape.sliced ? 0.3 : 1,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={shape.icon as any}
                size={shape.size}
                color={shape.color}
              />
              {shape.sliced && (
                <View style={styles.sliceMark}>
                  <View
                    style={[styles.sliceLine, { backgroundColor: "#fff" }]}
                  />
                </View>
              )}
            </View>
          ))}

          {/* Slice trail */}
          {sliceTrail.length > 1 &&
            sliceTrail.slice(-8).map((pt, i, arr) => {
              if (i === 0) return null;
              return (
                <View
                  key={i}
                  style={[
                    styles.trailDot,
                    {
                      left: pt.x - 2,
                      top: pt.y - 2,
                      opacity: i / arr.length,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              );
            })}
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
            🍉 Game Over!
          </Dialog.Title>
          <Dialog.Content>
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                fontSize: 16,
              }}
            >
              Score: {score}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={startGame}>Play Again</Button>
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
              score: score,
              playerName: profile?.displayName || "Player",
            });
            showSuccess("Score shared!");
          } catch {
            showError("Failed to share");
          }
          setIsSending(false);
          setShowFriendPicker(false);
        }}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Share Score With"
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
    zIndex: 10,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: "700" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  scoreText: { fontSize: 20, fontWeight: "800" },
  menuContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  menuTitle: { fontSize: 32, fontWeight: "800", marginBottom: 8 },
  menuSub: { fontSize: 16, marginBottom: 16 },
  bestText: { fontSize: 14, fontWeight: "600" },
  playArea: { flex: 1, position: "relative" },
  livesRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    zIndex: 10,
  },
  comboText: {
    fontSize: 16,
    fontWeight: "800",
    marginLeft: 12,
  },
  shape: { position: "absolute" },
  sliceMark: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  sliceLine: { width: "100%", height: 2, transform: [{ rotate: "-30deg" }] },
  trailDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dialogActions: { justifyContent: "center" },
});
