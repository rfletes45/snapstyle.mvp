/**
 * TapTapGameScreen — Piano Tiles / Rhythm Tap
 *
 * How to play:
 * 1. Tiles scroll down across 4 columns
 * 2. Tap tiles before they pass the bottom
 * 3. Don't tap empty lanes — that's a miss!
 * 4. Speed increases over time
 *
 * Supports: Single-player quick play, score = tiles hit
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
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const GAME_TYPE = "tap_tap_game";
const COLS = 4;
const COL_WIDTH = (SCREEN_WIDTH - 32) / COLS;
const TILE_HEIGHT = 100;
const PLAY_HEIGHT = SCREEN_HEIGHT - 200;
const INITIAL_SPEED = 2.5; // px per frame
const SPEED_INCREMENT = 0.003;

type GameState = "menu" | "playing" | "result";

interface Tile {
  id: number;
  col: number;
  y: number;
  tapped: boolean;
  missed: boolean;
}

// =============================================================================
// Component
// =============================================================================

export default function TapTapGameScreen({
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

  const tilesRef = useRef<Tile[]>([]);
  const scoreRef = useRef(0);
  const speedRef = useRef(INITIAL_SPEED);
  const nextIdRef = useRef(0);
  const frameRef = useRef(0);
  const loopRef = useRef<number>(null!);
  const [renderTiles, setRenderTiles] = useState<Tile[]>([]);
  const [lives, setLives] = useState(3);
  const livesRef = useRef(3);

  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(setPersonalBest);
    }
  }, [currentFirebaseUser]);

  const endGame = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    setScore(scoreRef.current);
    setGameState("result");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (currentFirebaseUser) {
      recordGameSession(currentFirebaseUser.uid, {
        gameId: GAME_TYPE,
        score: scoreRef.current,
        duration: (scoreRef.current / (INITIAL_SPEED * 60)) * 1000,
      });
    }
  }, [currentFirebaseUser]);

  const startGame = useCallback(() => {
    tilesRef.current = [];
    scoreRef.current = 0;
    speedRef.current = INITIAL_SPEED;
    nextIdRef.current = 0;
    frameRef.current = 0;
    livesRef.current = 3;
    setLives(3);
    setScore(0);
    setGameState("playing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Spawn first tiles
    for (let i = 0; i < 4; i++) {
      tilesRef.current.push({
        id: nextIdRef.current++,
        col: Math.floor(Math.random() * COLS),
        y: -TILE_HEIGHT * (i + 1) * 1.5,
        tapped: false,
        missed: false,
      });
    }

    const loop = () => {
      frameRef.current++;
      speedRef.current += SPEED_INCREMENT;

      // Move tiles
      for (const tile of tilesRef.current) {
        tile.y += speedRef.current;
      }

      // Check for missed tiles
      const missed = tilesRef.current.filter(
        (t) => !t.tapped && !t.missed && t.y > PLAY_HEIGHT,
      );
      if (missed.length > 0) {
        missed.forEach((t) => (t.missed = true));
        livesRef.current -= missed.length;
        setLives(Math.max(0, livesRef.current));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (livesRef.current <= 0) {
          endGame();
          return;
        }
      }

      // Remove tiles that are far off screen
      tilesRef.current = tilesRef.current.filter(
        (t) => t.y < PLAY_HEIGHT + TILE_HEIGHT * 2,
      );

      // Spawn new tiles
      const topTile = tilesRef.current.reduce(
        (min, t) => (t.y < min ? t.y : min),
        Infinity,
      );
      if (topTile > -TILE_HEIGHT) {
        tilesRef.current.push({
          id: nextIdRef.current++,
          col: Math.floor(Math.random() * COLS),
          y: topTile - TILE_HEIGHT * 1.5,
          tapped: false,
          missed: false,
        });
      }

      setRenderTiles([...tilesRef.current]);
      loopRef.current = requestAnimationFrame(loop);
    };

    loopRef.current = requestAnimationFrame(loop);
  }, [endGame]);

  const tapTile = useCallback(
    (col: number) => {
      if (gameState !== "playing") return;

      // Find the lowest untapped tile in this column
      const candidates = tilesRef.current
        .filter(
          (t) =>
            t.col === col &&
            !t.tapped &&
            !t.missed &&
            t.y > 0 &&
            t.y < PLAY_HEIGHT,
        )
        .sort((a, b) => b.y - a.y);

      if (candidates.length > 0) {
        candidates[0].tapped = true;
        scoreRef.current++;
        setScore(scoreRef.current);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        // Tapped empty — penalty
        livesRef.current--;
        setLives(Math.max(0, livesRef.current));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        if (livesRef.current <= 0) {
          endGame();
        }
      }
    },
    [gameState, endGame],
  );

  useEffect(() => {
    return () => {
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (loopRef.current) cancelAnimationFrame(loopRef.current);
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
        <Text style={[styles.title, { color: colors.text }]}>
          🎹 Tap Tap Snap
        </Text>
        {gameState === "playing" && (
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreText, { color: colors.primary }]}>
              {score}
            </Text>
          </View>
        )}
        {gameState !== "playing" && <View style={{ width: 50 }} />}
      </View>

      {gameState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>
            Tap Tap Snap
          </Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            Tap the tiles as they scroll down!
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
            Start Game
          </Button>
        </View>
      )}

      {gameState === "playing" && (
        <View style={styles.playArea}>
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
          </View>

          {/* Play field */}
          <View style={[styles.field, { height: PLAY_HEIGHT }]}>
            {/* Column dividers */}
            {Array.from({ length: COLS - 1 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.divider,
                  {
                    left: COL_WIDTH * (i + 1),
                    backgroundColor: colors.border,
                  },
                ]}
              />
            ))}

            {/* Tiles */}
            {renderTiles.map((tile) => (
              <View
                key={tile.id}
                style={[
                  styles.tile,
                  {
                    left: tile.col * COL_WIDTH + 1,
                    top: tile.y,
                    width: COL_WIDTH - 2,
                    height: TILE_HEIGHT,
                    backgroundColor: tile.tapped
                      ? "#27ae6080"
                      : tile.missed
                        ? "#e74c3c80"
                        : colors.text,
                    borderRadius: 4,
                  },
                ]}
              />
            ))}

            {/* Tap zones */}
            {Array.from({ length: COLS }).map((_, col) => (
              <TouchableOpacity
                key={col}
                onPress={() => tapTile(col)}
                style={[
                  styles.tapZone,
                  {
                    left: col * COL_WIDTH,
                    width: COL_WIDTH,
                    height: PLAY_HEIGHT,
                  },
                ]}
                activeOpacity={1}
              />
            ))}
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
            🎹 Game Over!
          </Dialog.Title>
          <Dialog.Content>
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                fontSize: 16,
              }}
            >
              Tiles tapped: {score}
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
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: "700" },
  scoreRow: { flexDirection: "row", alignItems: "center" },
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
  playArea: { flex: 1, paddingHorizontal: 16 },
  livesRow: { flexDirection: "row", justifyContent: "center", marginBottom: 8 },
  field: { position: "relative", overflow: "hidden", borderRadius: 8 },
  divider: { position: "absolute", top: 0, bottom: 0, width: 1 },
  tile: { position: "absolute" },
  tapZone: { position: "absolute", top: 0 },
  dialogActions: { justifyContent: "center" },
});


