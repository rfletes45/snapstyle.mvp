/**
 * QuickAddSheet — Bottom sheet for adding by phone, email, or username
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { ThemedTextInput } from "@/components/ui";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { MatchedUser } from "@/services/contacts";
import { lookupUserByEmail, lookupUserByPhone } from "@/services/contacts";
import { createLogger } from "@/utils/log";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  IconButton,
  SegmentedButtons,
  Text,
  useTheme,
} from "react-native-paper";

const logger = createLogger("components/friends/QuickAddSheet");

type QuickAddMode = "phone" | "email" | "username";

interface QuickAddSheetProps {
  visible: boolean;
  currentUid: string;
  onClose: () => void;
  onAddUser: (uid: string, username: string) => void;
  onInviteContact: (name: string) => void;
  onSearchUsername: (query: string) => void;
}

export default function QuickAddSheet({
  visible,
  currentUid,
  onClose,
  onAddUser,
  onInviteContact,
  onSearchUsername,
}: QuickAddSheetProps) {
  const { colors } = useTheme();

  const [mode, setMode] = useState<QuickAddMode>("phone");
  const [inputValue, setInputValue] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<MatchedUser | null>(null);
  const [notFound, setNotFound] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetState = useCallback(() => {
    setInputValue("");
    setResult(null);
    setNotFound(false);
    setSearching(false);
  }, []);

  const handleModeChange = useCallback(
    (value: string) => {
      setMode(value as QuickAddMode);
      resetState();
    },
    [resetState],
  );

  const handleSearch = useCallback(async () => {
    if (!inputValue.trim()) return;

    setSearching(true);
    setResult(null);
    setNotFound(false);

    try {
      let found: MatchedUser | null = null;

      if (mode === "phone") {
        found = await lookupUserByPhone(inputValue, currentUid);
      } else if (mode === "email") {
        found = await lookupUserByEmail(inputValue, currentUid);
      } else {
        // Username mode — delegate to parent search
        onSearchUsername(inputValue.trim());
        onClose();
        return;
      }

      if (found) {
        setResult(found);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      logger.error("Quick add search error:", err);
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  }, [inputValue, mode, currentUid, onSearchUsername, onClose]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const placeholder =
    mode === "phone"
      ? "Enter phone number"
      : mode === "email"
        ? "Enter email address"
        : "Enter username";

  const keyboardType =
    mode === "phone"
      ? ("phone-pad" as const)
      : mode === "email"
        ? ("email-address" as const)
        : ("default" as const);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {/* Drag handle */}
          <View style={styles.dragHandle}>
            <View
              style={[
                styles.dragBar,
                { backgroundColor: colors.outlineVariant },
              ]}
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text
              variant="headlineSmall"
              style={{ fontWeight: "600", color: colors.onSurface }}
            >
              Quick Add
            </Text>
            <IconButton icon="close" size={22} onPress={handleClose} />
          </View>

          {/* Mode selector */}
          <SegmentedButtons
            value={mode}
            onValueChange={handleModeChange}
            buttons={[
              { value: "phone", label: "Phone", icon: "phone-outline" },
              { value: "email", label: "Email", icon: "email-outline" },
              { value: "username", label: "Username", icon: "at" },
            ]}
            style={styles.segmented}
          />

          {/* Input */}
          <View style={styles.inputRow}>
            <ThemedTextInput
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={placeholder}
              keyboardType={keyboardType}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              style={styles.input}
            />
            <Button
              mode="contained"
              compact
              onPress={handleSearch}
              disabled={!inputValue.trim() || searching}
              loading={searching}
              style={styles.searchBtn}
            >
              Search
            </Button>
          </View>

          {/* Results area */}
          <View style={styles.resultsArea}>
            {searching && (
              <View style={styles.centered}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text
                  variant="bodySmall"
                  style={{ color: colors.onSurfaceVariant, marginLeft: 8 }}
                >
                  Searching…
                </Text>
              </View>
            )}

            {result && !searching && (
              <View style={styles.resultCard}>
                <ProfilePictureWithDecoration
                  pictureUrl={result.profilePictureUrl}
                  name={result.displayName || result.username}
                  decorationId={result.decorationId}
                  size={48}
                />
                <View style={styles.resultInfo}>
                  <Text
                    variant="bodyMedium"
                    style={{ color: colors.onSurface, fontWeight: "600" }}
                    numberOfLines={1}
                  >
                    {result.displayName || result.username}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: colors.onSurfaceVariant }}
                    numberOfLines={1}
                  >
                    @{result.username}
                  </Text>
                </View>
                <Button
                  mode="contained"
                  compact
                  onPress={() => onAddUser(result.uid, result.username)}
                  labelStyle={{ fontSize: 12 }}
                >
                  Add
                </Button>
              </View>
            )}

            {notFound && !searching && (
              <View style={styles.centered}>
                <MaterialCommunityIcons
                  name="account-search-outline"
                  size={36}
                  color={colors.onSurfaceVariant}
                />
                <Text
                  variant="bodyMedium"
                  style={{
                    color: colors.onSurfaceVariant,
                    textAlign: "center",
                    marginTop: 8,
                  }}
                >
                  No user found
                </Text>
                {mode !== "username" && (
                  <Button
                    mode="outlined"
                    compact
                    onPress={() =>
                      onInviteContact(
                        mode === "phone" ? inputValue : inputValue,
                      )
                    }
                    style={{ marginTop: 12 }}
                    icon="share-variant-outline"
                  >
                    Invite to SnapStyle
                  </Button>
                )}
              </View>
            )}

            {!searching && !result && !notFound && (
              <View style={styles.centered}>
                <MaterialCommunityIcons
                  name={
                    mode === "phone"
                      ? "phone-outline"
                      : mode === "email"
                        ? "email-outline"
                        : "at"
                  }
                  size={36}
                  color={colors.onSurfaceVariant}
                />
                <Text
                  variant="bodySmall"
                  style={{
                    color: colors.onSurfaceVariant,
                    textAlign: "center",
                    marginTop: 8,
                  }}
                >
                  {mode === "phone"
                    ? "Enter a phone number to find someone"
                    : mode === "email"
                      ? "Enter an email to find someone"
                      : "Enter a username to search"}
                </Text>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: "75%",
    minHeight: 340,
    paddingBottom: 32,
  },
  dragHandle: {
    alignItems: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  dragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  segmented: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    gap: 8,
  },
  input: {
    flex: 1,
  },
  searchBtn: {
    minWidth: 80,
  },
  resultsArea: {
    flex: 1,
    minHeight: 120,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  centered: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 12,
  },
  resultInfo: {
    flex: 1,
  },
});
