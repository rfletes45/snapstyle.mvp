/**
 * SketchPartyChat — Chat log + guess input for Sketch Party
 *
 * Shows system messages and player guesses with styled differentiation.
 * Guess input is enabled only when canGuess is true.
 * Local rate limit: 1 guess per 500ms (server is authoritative).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet, TextInput, View } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";

import type { ChatMessage } from "@/hooks/useSketchPartyGame";

// =============================================================================
// Constants
// =============================================================================

/** Local rate limit between guesses (ms) */
const LOCAL_GUESS_COOLDOWN_MS = 500;

// =============================================================================
// Types
// =============================================================================

export interface SketchPartyChatProps {
  messages: ChatMessage[];
  canGuess: boolean;
  onSendGuess: (text: string) => void;
  /** Placeholder override */
  placeholder?: string;
}

// =============================================================================
// Component
// =============================================================================

export function SketchPartyChat({
  messages,
  canGuess,
  onSendGuess,
  placeholder = "Type your guess...",
}: SketchPartyChatProps) {
  const theme = useTheme();
  const [inputText, setInputText] = useState("");
  const lastSendRef = useRef(0);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [messages.length]);

  const handleSubmit = useCallback(() => {
    const text = inputText.trim();
    if (!text || !canGuess) return;

    const now = Date.now();
    if (now - lastSendRef.current < LOCAL_GUESS_COOLDOWN_MS) return;
    lastSendRef.current = now;

    onSendGuess(text);
    setInputText("");
  }, [inputText, canGuess, onSendGuess]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isSystem = item.isSystem || item.sessionId === "__system__";
      const isCorrect = item.kind === "correct";
      const isWarning = item.kind === "warning" || item.kind === "error";

      let textColor = theme.colors.onSurface;
      if (isSystem && isCorrect) textColor = "#4CAF50";
      else if (isSystem && isWarning) textColor = theme.colors.error;
      else if (isSystem) textColor = theme.colors.onSurfaceVariant;

      return (
        <View style={styles.messageRow}>
          {isSystem ? (
            <Text
              style={[
                styles.messageText,
                { color: textColor, fontStyle: "italic" },
              ]}
            >
              {item.text}
            </Text>
          ) : (
            <Text style={[styles.messageText, { color: textColor }]}>
              <Text style={{ fontWeight: "700" }}>{item.displayName}: </Text>
              {item.text}
            </Text>
          )}
        </View>
      );
    },
    [theme],
  );

  return (
    <View style={styles.container}>
      {/* Message list */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderMessage}
        style={[styles.messageList, { backgroundColor: theme.colors.surface }]}
        contentContainerStyle={styles.messageListContent}
      />

      {/* Input row */}
      <View
        style={[
          styles.inputRow,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              borderColor: theme.colors.outline,
              color: theme.colors.onSurface,
              backgroundColor: theme.colors.surface,
            },
          ]}
          placeholder={canGuess ? placeholder : "Waiting..."}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
          editable={canGuess}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <IconButton
          icon="send"
          size={20}
          disabled={!canGuess || !inputText.trim()}
          onPress={handleSubmit}
          iconColor={theme.colors.primary}
        />
      </View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageList: {
    flex: 1,
    borderRadius: 8,
    marginBottom: 4,
  },
  messageListContent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  messageRow: {
    paddingVertical: 2,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingLeft: 4,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
  },
});
