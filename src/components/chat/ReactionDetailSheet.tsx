/**
 * ReactionDetailSheet Component
 *
 * Shows who reacted with each emoji on a message.
 * Displayed when a user taps on a reaction summary bubble.
 *
 * Features:
 * - Tab-like emoji selector at top
 * - Scrollable list of users who reacted
 * - Current user's reactions highlighted
 * - Tap reaction to toggle (add/remove)
 *
 * @module components/chat/ReactionDetailSheet
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { getUserProfileByUid } from "@/services/friends";
import {
  formatReactionCount,
  getReactions,
  ReactionSummary,
  toggleReaction,
} from "@/services/reactions";
import React, { memo, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";

import { createLogger } from "@/utils/log";
const logger = createLogger("ReactionDetailSheet");

// =============================================================================
// Types
// =============================================================================

interface ReactionDetailSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Called when the sheet should close */
  onClose: () => void;
  /** Message scope */
  scope: "dm" | "group";
  /** Conversation ID */
  conversationId: string;
  /** Message ID */
  messageId: string;
  /** Current user ID */
  currentUid: string;
  /** Pre-loaded reaction summary from the message (optional, for instant display) */
  initialReactions?: ReactionSummary[];
}

interface UserProfile {
  uid: string;
  username?: string;
  displayName?: string;
}

// =============================================================================
// Component
// =============================================================================

export const ReactionDetailSheet = memo(function ReactionDetailSheet({
  visible,
  onClose,
  scope,
  conversationId,
  messageId,
  currentUid,
  initialReactions,
}: ReactionDetailSheetProps) {
  const theme = useTheme();

  const [reactions, setReactions] = useState<ReactionSummary[]>(
    initialReactions || [],
  );
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>(
    {},
  );
  const [loading, setLoading] = useState(true);

  // Load reactions from Firestore
  useEffect(() => {
    if (!visible || !messageId) return;

    setLoading(true);
    getReactions(scope, conversationId, messageId, currentUid)
      .then((result) => {
        setReactions(result);
        // Select the first emoji by default
        if (result.length > 0 && !selectedEmoji) {
          setSelectedEmoji(result[0].emoji);
        }
      })
      .catch((err) => {
        logger.error("Failed to load reactions:", err);
      })
      .finally(() => setLoading(false));
  }, [visible, scope, conversationId, messageId, currentUid]);

  // Load user profiles for the selected reaction
  useEffect(() => {
    if (!selectedEmoji || !visible) return;

    const selected = reactions.find((r) => r.emoji === selectedEmoji);
    if (!selected) return;

    // Load profiles for users we don't have cached
    const unknownUids = selected.userIds.filter((uid) => !userProfiles[uid]);
    if (unknownUids.length === 0) return;

    Promise.all(
      unknownUids.map(async (uid) => {
        try {
          const profile = await getUserProfileByUid(uid);
          return {
            uid,
            username: profile?.username,
            displayName: profile?.displayName,
          };
        } catch {
          return { uid, username: uid.substring(0, 8) };
        }
      }),
    ).then((profiles) => {
      const newProfiles: Record<string, UserProfile> = {};
      profiles.forEach((p) => {
        newProfiles[p.uid] = p;
      });
      setUserProfiles((prev) => ({ ...prev, ...newProfiles }));
    });
  }, [selectedEmoji, reactions, visible]);

  // Reset state when closing
  useEffect(() => {
    if (!visible) {
      setSelectedEmoji(null);
      setLoading(true);
    }
  }, [visible]);

  const selectedReaction = reactions.find((r) => r.emoji === selectedEmoji);

  const handleToggle = useCallback(
    async (emoji: string) => {
      try {
        await toggleReaction({
          scope,
          conversationId,
          messageId,
          emoji,
          uid: currentUid,
        });
        // Refresh reactions
        const updated = await getReactions(
          scope,
          conversationId,
          messageId,
          currentUid,
        );
        setReactions(updated);
      } catch (err) {
        logger.error("Failed to toggle reaction:", err);
      }
    },
    [scope, conversationId, messageId, currentUid],
  );

  const renderUser = useCallback(
    ({ item: uid }: { item: string }) => {
      const profile = userProfiles[uid];
      const displayName =
        uid === currentUid
          ? "You"
          : profile?.username || profile?.displayName || uid.substring(0, 8);
      const isMe = uid === currentUid;

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
          <View style={styles.userInfo}>
            <View
              style={[
                styles.userAvatar,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Text style={styles.userAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text
              style={[
                styles.userName,
                { color: theme.colors.onSurface },
                isMe && { fontWeight: "700" },
              ]}
            >
              {displayName}
            </Text>
          </View>
        </View>
      );
    },
    [userProfiles, currentUid, theme],
  );

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
          Reactions
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : reactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text
              style={[
                styles.emptyText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              No reactions yet
            </Text>
          </View>
        ) : (
          <>
            {/* Emoji tabs */}
            <View style={styles.emojiTabs}>
              {reactions.map((reaction) => (
                <TouchableOpacity
                  key={reaction.emoji}
                  style={[
                    styles.emojiTab,
                    selectedEmoji === reaction.emoji && {
                      backgroundColor: theme.colors.primaryContainer,
                      borderColor: theme.colors.primary,
                    },
                  ]}
                  onPress={() => setSelectedEmoji(reaction.emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiTabEmoji}>{reaction.emoji}</Text>
                  <Text
                    style={[
                      styles.emojiTabCount,
                      {
                        color:
                          selectedEmoji === reaction.emoji
                            ? theme.colors.primary
                            : theme.colors.onSurfaceVariant,
                      },
                    ]}
                  >
                    {formatReactionCount(reaction.count)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* User list */}
            <FlatList
              data={selectedReaction?.userIds || []}
              keyExtractor={(uid) => uid}
              renderItem={renderUser}
              style={styles.userList}
              contentContainerStyle={styles.userListContent}
            />
          </>
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
    maxHeight: "60%",
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
  emptyContainer: {
    paddingVertical: Spacing.xxxl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
  },
  emojiTabs: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  emojiTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 4,
  },
  emojiTabEmoji: {
    fontSize: 20,
  },
  emojiTabCount: {
    fontSize: 14,
    fontWeight: "600",
  },
  userList: {
    flex: 1,
  },
  userListContent: {
    paddingHorizontal: Spacing.md,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: "600",
  },
  userName: {
    fontSize: 15,
    fontWeight: "500",
  },
});

export default ReactionDetailSheet;
