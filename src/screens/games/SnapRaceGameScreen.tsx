/**
 * RaceGameScreen — Typing Race
 *
 * How to play:
 * 1. A sentence is displayed at the top
 * 2. Type the sentence as fast as you can
 * 3. Track your WPM and accuracy
 * 4. Compete with your personal best!
 *
 * Supports: Single-player quick play (real-time multiplayer placeholder)
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
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";

// =============================================================================
// Constants
// =============================================================================

const GAME_TYPE = "race_game";
type GameState = "menu" | "countdown" | "playing" | "result";

const SENTENCES = [
  "The quick brown fox jumps over the lazy dog",
  "A journey of a thousand miles begins with a single step",
  "To be or not to be that is the question",
  "All that glitters is not gold but it sure is shiny",
  "The only thing we have to fear is fear itself",
  "In the middle of difficulty lies opportunity",
  "Life is what happens when you are busy making plans",
  "Stay hungry stay foolish and keep on learning",
  "Not all those who wander are lost in the woods",
  "Actions speak louder than words every single time",
  "Practice makes perfect so keep on trying hard",
  "Every moment is a fresh beginning for something new",
  "The best way to predict the future is to create it",
  "Be the change you wish to see in this world today",
  "Success is not final and failure is not fatal",
];

// =============================================================================
// Component
// =============================================================================

export default function RaceGameScreen({
  navigation,
}: {
  navigation: any;
}) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const { showSuccess, showError } = useSnackbar();

  const [gameState, setGameState] = useState<GameState>("menu");
  const [sentence, setSentence] = useState("");
  const [typed, setTyped] = useState("");
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [personalBest, setPersonalBest] = useState<PersonalBest | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);

  const inputRef = useRef<TextInput>(null);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null!);
  const totalKeysRef = useRef(0);
  const correctKeysRef = useRef(0);

  useEffect(() => {
    if (currentFirebaseUser) {
      getPersonalBest(currentFirebaseUser.uid, GAME_TYPE).then(setPersonalBest);
    }
  }, [currentFirebaseUser]);

  const startCountdown = useCallback(() => {
    const s = SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
    setSentence(s);
    setTyped("");
    setWpm(0);
    setAccuracy(100);
    setElapsed(0);
    setCountdown(3);
    setProgress(0);
    totalKeysRef.current = 0;
    correctKeysRef.current = 0;
    setGameState("countdown");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let count = 3;
    const countdownTimer = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(countdownTimer);
        setGameState("playing");
        startTimeRef.current = Date.now();
        timerRef.current = setInterval(() => {
          const ms = Date.now() - startTimeRef.current;
          setElapsed(Math.floor(ms / 1000));
        }, 200);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }, 1000);
  }, []);

  const handleTextChange = useCallback(
    (text: string) => {
      if (gameState !== "playing") return;
      setTyped(text);

      totalKeysRef.current = text.length;
      let correct = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === sentence[i]) correct++;
      }
      correctKeysRef.current = correct;

      // Calculate accuracy
      const acc =
        totalKeysRef.current > 0
          ? Math.round((correctKeysRef.current / totalKeysRef.current) * 100)
          : 100;
      setAccuracy(acc);

      // Calculate progress
      const prog = Math.min(text.length / sentence.length, 1);
      setProgress(prog);

      // Calculate WPM
      const ms = Date.now() - startTimeRef.current;
      const minutes = ms / 60000;
      if (minutes > 0) {
        const words = correctKeysRef.current / 5;
        setWpm(Math.round(words / minutes));
      }

      // Haptic on each keystroke
      if (text.length > 0) {
        const lastChar = text[text.length - 1];
        const expectedChar = sentence[text.length - 1];
        if (lastChar === expectedChar) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
      }

      // Check completion
      if (text.length >= sentence.length) {
        clearInterval(timerRef.current!);
        const finalMs = Date.now() - startTimeRef.current;
        const finalMinutes = finalMs / 60000;
        const finalWords = correctKeysRef.current / 5;
        const finalWpm = Math.round(finalWords / finalMinutes);
        setWpm(finalWpm);
        setElapsed(Math.ceil(finalMs / 1000));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (currentFirebaseUser) {
          recordGameSession(currentFirebaseUser.uid, {
            gameId: GAME_TYPE,
            score: finalWpm,
            duration: finalMs,
          });
        }

        setTimeout(() => setGameState("result"), 500);
      }
    },
    [gameState, sentence, currentFirebaseUser],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Render the sentence with colored characters
  const renderSentence = () => {
    return sentence.split("").map((char, i) => {
      let color = colors.textSecondary;
      let bg = "transparent";
      if (i < typed.length) {
        if (typed[i] === char) {
          color = "#27ae60";
        } else {
          color = "#fff";
          bg = "#e74c3c";
        }
      } else if (i === typed.length) {
        bg = colors.primary + "40";
      }
      return (
        <Text
          key={i}
          style={{
            color,
            backgroundColor: bg,
            fontSize: 20,
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
          }}
        >
          {char}
        </Text>
      );
    });
  };

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
        <Text style={[styles.title, { color: colors.text }]}>🏎️ Snap Race</Text>
        {gameState === "playing" && (
          <Text style={[styles.wpmText, { color: colors.primary }]}>
            {wpm} WPM
          </Text>
        )}
        {gameState !== "playing" && <View style={{ width: 60 }} />}
      </View>

      {gameState === "menu" && (
        <View style={styles.menuContainer}>
          <Text style={[styles.menuTitle, { color: colors.text }]}>
            Snap Race
          </Text>
          <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
            Type the sentence as fast as you can!
          </Text>
          {personalBest && (
            <Text style={[styles.bestText, { color: colors.primary }]}>
              Best: {personalBest.bestScore} WPM
            </Text>
          )}
          <Button
            mode="contained"
            onPress={startCountdown}
            style={{ backgroundColor: colors.primary, marginTop: 24 }}
            labelStyle={{ color: "#fff" }}
          >
            Start Race
          </Button>
        </View>
      )}

      {gameState === "countdown" && (
        <View style={styles.countdownContainer}>
          <Text style={[styles.countdownText, { color: colors.primary }]}>
            {countdown}
          </Text>
          <Text
            style={[styles.countdownLabel, { color: colors.textSecondary }]}
          >
            Get ready...
          </Text>
        </View>
      )}

      {gameState === "playing" && (
        <View style={styles.playArea}>
          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Time
              </Text>
              <Text
                style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}
              >
                {elapsed}s
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Accuracy
              </Text>
              <Text
                style={{
                  color:
                    accuracy >= 90
                      ? "#27ae60"
                      : accuracy >= 70
                        ? "#f39c12"
                        : "#e74c3c",
                  fontSize: 18,
                  fontWeight: "700",
                }}
              >
                {accuracy}%
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                WPM
              </Text>
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 18,
                  fontWeight: "700",
                }}
              >
                {wpm}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View
            style={[styles.progressBar, { backgroundColor: colors.border }]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${progress * 100}%`,
                },
              ]}
            />
            <Text style={styles.carEmoji}>🏎️</Text>
          </View>

          {/* Sentence display */}
          <View
            style={[
              styles.sentenceBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={{ flexWrap: "wrap" }}>{renderSentence()}</Text>
          </View>

          {/* Hidden input */}
          <TextInput
            ref={inputRef}
            value={typed}
            onChangeText={handleTextChange}
            style={[
              styles.hiddenInput,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            placeholder="Start typing here..."
            placeholderTextColor={colors.textSecondary}
          />
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
            🏁 Race Complete!
          </Dialog.Title>
          <Dialog.Content>
            <Text
              style={{
                color: colors.text,
                textAlign: "center",
                fontSize: 28,
                fontWeight: "800",
              }}
            >
              {wpm} WPM
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              Accuracy: {accuracy}% • Time: {elapsed}s
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={startCountdown}>Race Again</Button>
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
              score: wpm,
              playerName: profile?.displayName || "Player",
            });
            showSuccess("WPM shared!");
          } catch {
            showError("Failed to share");
          }
          setIsSending(false);
          setShowFriendPicker(false);
        }}
        currentUserId={currentFirebaseUser?.uid || ""}
        title="Share WPM With"
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
  wpmText: { fontSize: 16, fontWeight: "700" },
  menuContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  menuTitle: { fontSize: 32, fontWeight: "800", marginBottom: 8 },
  menuSub: { fontSize: 16, marginBottom: 16 },
  bestText: { fontSize: 14, fontWeight: "600" },
  countdownContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  countdownText: { fontSize: 72, fontWeight: "800" },
  countdownLabel: { fontSize: 18, marginTop: 8 },
  playArea: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  stat: { alignItems: "center" },
  progressBar: {
    height: 32,
    borderRadius: 16,
    marginBottom: 20,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
  },
  progressFill: { height: "100%", borderRadius: 16 },
  carEmoji: {
    position: "absolute",
    right: 8,
    fontSize: 20,
  },
  sentenceBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    minHeight: 80,
  },
  hiddenInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  dialogActions: { justifyContent: "center" },
});


