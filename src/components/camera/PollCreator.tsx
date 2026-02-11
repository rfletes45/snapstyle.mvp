/**
 * POLL CREATOR
 * Bottom-sheet style modal for creating polls to overlay on snaps.
 * Supports: Yes/No, Multiple Choice, Slider, and Open Question types.
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { PollElement, PollOption, PollType } from "@/types/camera";
import { generateUUID } from "@/utils/uuid";

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreatePoll: (poll: PollElement) => void;
}

const POLL_TYPES: { type: PollType; label: string; icon: string }[] = [
  { type: "yes_no", label: "Yes / No", icon: "thumbs-up-outline" },
  { type: "multiple_choice", label: "Multiple Choice", icon: "list-outline" },
  { type: "slider", label: "Slider", icon: "options-outline" },
  { type: "question", label: "Question", icon: "help-circle-outline" },
];

const PollCreator: React.FC<Props> = ({ visible, onClose, onCreatePoll }) => {
  const [pollType, setPollType] = useState<PollType>("yes_no");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [minLabel, setMinLabel] = useState("");
  const [maxLabel, setMaxLabel] = useState("");

  const resetForm = useCallback(() => {
    setQuestion("");
    setOptions(["", ""]);
    setMinLabel("");
    setMaxLabel("");
  }, []);

  const handleAddOption = useCallback(() => {
    if (options.length < 6) {
      setOptions((prev) => [...prev, ""]);
    }
  }, [options.length]);

  const handleRemoveOption = useCallback(
    (index: number) => {
      if (options.length > 2) {
        setOptions((prev) => prev.filter((_, i) => i !== index));
      }
    },
    [options.length],
  );

  const handleOptionChange = useCallback((text: string, index: number) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  }, []);

  const handleCreate = useCallback(() => {
    if (!question.trim()) return;

    const pollOptions: PollOption[] | undefined =
      pollType === "multiple_choice"
        ? options
            .filter((o) => o.trim())
            .map((text) => ({
              id: generateUUID(),
              text: text.trim(),
              responses: 0,
            }))
        : undefined;

    const poll: PollElement = {
      id: generateUUID(),
      type: "poll",
      pollType,
      position: { x: 0.5, y: 0.4 }, // Centre-ish (normalised 0-1)
      question: question.trim(),
      ...(pollType === "yes_no" && { yesResponses: 0, noResponses: 0 }),
      ...(pollType === "multiple_choice" && { options: pollOptions }),
      ...(pollType === "slider" && {
        minLabel: minLabel.trim() || "😞",
        maxLabel: maxLabel.trim() || "😍",
      }),
      createdAt: Date.now(),
      resultsVisible: true,
    };

    onCreatePoll(poll);
    resetForm();
    onClose();
  }, [
    pollType,
    question,
    options,
    minLabel,
    maxLabel,
    onCreatePoll,
    onClose,
    resetForm,
  ]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Poll</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Poll Type Selector */}
            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {POLL_TYPES.map((pt) => (
                <TouchableOpacity
                  key={pt.type}
                  style={[
                    styles.typeChip,
                    pollType === pt.type && styles.typeChipActive,
                  ]}
                  onPress={() => setPollType(pt.type)}
                >
                  <Ionicons
                    name={pt.icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={pollType === pt.type ? "#fff" : "#aaa"}
                  />
                  <Text
                    style={[
                      styles.typeChipText,
                      pollType === pt.type && styles.typeChipTextActive,
                    ]}
                  >
                    {pt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Question Input */}
            <Text style={styles.label}>Question</Text>
            <TextInput
              style={styles.input}
              placeholder="Ask something..."
              placeholderTextColor="#666"
              value={question}
              onChangeText={setQuestion}
              maxLength={150}
              multiline
            />

            {/* Multiple Choice Options */}
            {pollType === "multiple_choice" && (
              <>
                <Text style={styles.label}>Options</Text>
                {options.map((opt, i) => (
                  <View key={`opt-${i}`} style={styles.optionRow}>
                    <TextInput
                      style={[styles.input, styles.optionInput]}
                      placeholder={`Option ${i + 1}`}
                      placeholderTextColor="#666"
                      value={opt}
                      onChangeText={(t) => handleOptionChange(t, i)}
                      maxLength={60}
                    />
                    {options.length > 2 && (
                      <TouchableOpacity
                        onPress={() => handleRemoveOption(i)}
                        style={styles.removeOptionBtn}
                      >
                        <Ionicons
                          name="close-circle"
                          size={22}
                          color="#FF453A"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {options.length < 6 && (
                  <TouchableOpacity
                    style={styles.addOptionBtn}
                    onPress={handleAddOption}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={20}
                      color="#007AFF"
                    />
                    <Text style={styles.addOptionText}>Add Option</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Slider Labels */}
            {pollType === "slider" && (
              <>
                <Text style={styles.label}>Labels</Text>
                <View style={styles.sliderLabelsRow}>
                  <TextInput
                    style={[styles.input, styles.sliderLabelInput]}
                    placeholder="Min (e.g. 😞)"
                    placeholderTextColor="#666"
                    value={minLabel}
                    onChangeText={setMinLabel}
                    maxLength={20}
                  />
                  <Text style={styles.sliderArrow}>→</Text>
                  <TextInput
                    style={[styles.input, styles.sliderLabelInput]}
                    placeholder="Max (e.g. 😍)"
                    placeholderTextColor="#666"
                    value={maxLabel}
                    onChangeText={setMaxLabel}
                    maxLength={20}
                  />
                </View>
              </>
            )}
          </ScrollView>

          {/* Create Button */}
          <TouchableOpacity
            style={[
              styles.createBtn,
              !question.trim() && styles.createBtnDisabled,
            ]}
            onPress={handleCreate}
            disabled={!question.trim()}
          >
            <Text style={styles.createBtnText}>Add Poll</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
    zIndex: 50,
  },
  keyboardView: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 34,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.15)",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  label: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 14,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  typeChipActive: {
    backgroundColor: "rgba(0,122,255,0.25)",
    borderColor: "#007AFF",
  },
  typeChipText: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
  },
  typeChipTextActive: {
    color: "#fff",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    fontSize: 15,
    minHeight: 44,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  optionInput: {
    flex: 1,
    marginBottom: 0,
  },
  removeOptionBtn: {
    marginLeft: 8,
    padding: 4,
  },
  addOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
  },
  addOptionText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "600",
  },
  sliderLabelsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sliderLabelInput: {
    flex: 1,
  },
  sliderArrow: {
    color: "#666",
    fontSize: 20,
  },
  createBtn: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  createBtnDisabled: {
    opacity: 0.4,
  },
  createBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default React.memo(PollCreator);
