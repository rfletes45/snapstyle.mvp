/**
 * SeenBySheet Component
 *
 * Shows a bottom sheet listing which group members have seen a message.
 * Displayed when a user taps on a "Seen by X" indicator in group chat.
 *
 * @module components/chat/SeenBySheet
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { getUserProfileByUid } from "@/services/friends";
import React, { memo, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";

import { createLogger } from "@/utils/log";
const logger = createLogger("SeenBySheet");

// =============================================================================
// Types
// =============================================================================

interface SeenBySheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Called when the sheet should close */
  onClose: () => void;
  /** Array of UIDs who have seen the message */
  seenByUids: string[];
  /** Current user UID (to label as "You") */
  currentUid: string;
  /** Timestamp when the message was sent */
  messageTimestamp?: number;
}

interface UserInfo {
  uid: string;
  username?: string;
  displayName?: string;
}

// =============================================================================
// Component
// =============================================================================

export const SeenBySheet = memo(function SeenBySheet({
  visible,
  onClose,
  seenByUids,
  currentUid,
  messageTimestamp,
}: SeenBySheetProps) {
  const theme = useTheme();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user profiles
  useEffect(() => {
    if (!visible || seenByUids.length === 0) return;

    setLoading(true);
    Promise.all(
      seenByUids.map(async (uid) => {
        try {
          const profile = await getUserProfileByUid(uid);
          return {
            uid,
            username: profile?.username,
            displayName: profile?.displayName,
          };
        } catch {
          return { uid };
        }
      }),
    )
      .then(setUsers)
      .finally(() => setLoading(false));
  }, [visible, seenByUids]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
        {/* Handle bar */}
        <View
          style={[
            styles.handleBar,
            { backgroundColor: theme.colors.outlineVariant },
          ]}
        />

        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Seen by {seenByUids.length}
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.uid}
            renderItem={({ item }) => {
              const isMe = item.uid === currentUid;
              const name = isMe
                ? "You"
                : item.username || item.displayName || item.uid.substring(0, 8);

              return (
                <View
                  style={[
                    styles.userRow,
                    {
                      borderBottomColor: theme.dark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.06)",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: theme.colors.primaryContainer },
                    ]}
                  >
                    <Text style={styles.avatarText}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text
                      style={[
                        styles.userName,
                        { color: theme.colors.onSurface },
                        isMe && { fontWeight: "700" },
                      ]}
                    >
                      {name}
                    </Text>
                  </View>
                  <Text
                    style={[styles.seenIcon, { color: theme.colors.primary }]}
                  >
                    ✓✓
                  </Text>
                </View>
              );
            }}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </Modal>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "50%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.xl + 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  loadingContainer: {
    paddingVertical: Spacing.xxxl,
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: Spacing.md,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "600",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: "500",
  },
  seenIcon: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default SeenBySheet;
