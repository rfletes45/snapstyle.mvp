/**
 * GiftModal Component
 *
 * Modal for sending gifts to friends.
 * Allows selecting recipient and writing a message.
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.2
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Button, Text } from "react-native-paper";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BorderRadius, Spacing } from "@/constants/theme";
import { useAppTheme } from "@/store/ThemeContext";

// =============================================================================
// Types
// =============================================================================

export interface Friend {
  uid: string;
  displayName: string;
  photoURL?: string;
}

export interface GiftModalProps {
  /** Whether modal is visible */
  visible: boolean;

  /** Close modal handler */
  onClose: () => void;

  /** Send gift handler */
  onSend: (recipientUid: string, message: string) => Promise<void>;

  /** Item being gifted */
  item: {
    id: string;
    name: string;
    imagePath: string;
    price: string;
  };

  /** List of friends to gift to */
  friends: Friend[];

  /** Loading state */
  loading?: boolean;

  /** Error message */
  error?: string | null;
}

// =============================================================================
// Component
// =============================================================================

function GiftModalBase({
  visible,
  onClose,
  onSend,
  item,
  friends,
  loading = false,
  error = null,
}: GiftModalProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  // State
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"select" | "message">("select");

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setSelectedFriend(null);
    setMessage("");
    setStep("select");
    onClose();
  }, [onClose]);

  // Handle friend selection
  const handleSelectFriend = useCallback((friend: Friend) => {
    setSelectedFriend(friend);
    setStep("message");
  }, []);

  // Handle back to friend selection
  const handleBack = useCallback(() => {
    setStep("select");
  }, []);

  // Handle send
  const handleSend = useCallback(async () => {
    if (!selectedFriend) return;

    await onSend(selectedFriend.uid, message.trim() || "Enjoy this gift! 🎁");
  }, [selectedFriend, message, onSend]);

  // Render friend item
  const renderFriendItem = useCallback(
    ({ item: friend }: { item: Friend }) => (
      <Pressable
        style={({ pressed }) => [
          styles.friendItem,
          { backgroundColor: colors.surface },
          pressed && styles.friendItemPressed,
        ]}
        onPress={() => handleSelectFriend(friend)}
      >
        {friend.photoURL ? (
          <Image
            source={{ uri: friend.photoURL }}
            style={styles.friendAvatar}
          />
        ) : (
          <View
            style={[
              styles.friendAvatarPlaceholder,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <MaterialCommunityIcons
              name="account"
              size={24}
              color={colors.textSecondary}
            />
          </View>
        )}
        <Text style={[styles.friendName, { color: colors.text }]}>
          {friend.displayName}
        </Text>
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color={colors.textSecondary}
        />
      </Pressable>
    ),
    [colors, handleSelectFriend],
  );

  // Render empty state
  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons
          name="account-multiple-outline"
          size={48}
          color={colors.textSecondary}
        />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No friends to gift to.{"\n"}Add some friends first!
        </Text>
      </View>
    ),
    [colors],
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          style={[
            styles.modal,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + Spacing.md,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            {step === "message" && (
              <Pressable onPress={handleBack} style={styles.backButton}>
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={24}
                  color={colors.text}
                />
              </Pressable>
            )}
            <Text
              variant="titleLarge"
              style={[styles.title, { color: colors.text }]}
            >
              {step === "select" ? "Send as Gift" : "Add a Message"}
            </Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.text}
              />
            </Pressable>
          </View>

          {/* Item Preview */}
          <View
            style={[styles.itemPreview, { backgroundColor: colors.surface }]}
          >
            <View style={styles.itemImageContainer}>
              <Text style={styles.itemImage}>{item.imagePath}</Text>
            </View>
            <View style={styles.itemInfo}>
              <Text variant="titleMedium" style={{ color: colors.text }}>
                {item.name}
              </Text>
              <Text variant="bodyMedium" style={{ color: colors.primary }}>
                {item.price}
              </Text>
            </View>
          </View>

          {/* Error Message */}
          {error && (
            <View
              style={[
                styles.errorContainer,
                { backgroundColor: colors.errorContainer },
              ]}
            >
              <MaterialCommunityIcons
                name="alert-circle"
                size={20}
                color={colors.error}
              />
              <Text style={[styles.errorText, { color: colors.error }]}>
                {error}
              </Text>
            </View>
          )}

          {step === "select" ? (
            /* Friend Selection */
            <FlatList
              data={friends}
              keyExtractor={(friend) => friend.uid}
              renderItem={renderFriendItem}
              ListEmptyComponent={renderEmptyState}
              contentContainerStyle={styles.friendList}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            /* Message Input */
            <View style={styles.messageContainer}>
              {/* Selected Friend */}
              <View
                style={[
                  styles.selectedFriend,
                  { backgroundColor: colors.surface },
                ]}
              >
                {selectedFriend?.photoURL ? (
                  <Image
                    source={{ uri: selectedFriend.photoURL }}
                    style={styles.selectedAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.selectedAvatarPlaceholder,
                      { backgroundColor: colors.surfaceVariant },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="account"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                )}
                <Text style={{ color: colors.text }}>
                  Sending to{" "}
                  <Text style={{ fontWeight: "600" }}>
                    {selectedFriend?.displayName}
                  </Text>
                </Text>
              </View>

              {/* Message Input */}
              <TextInput
                style={[
                  styles.messageInput,
                  {
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Add a personal message (optional)"
                placeholderTextColor={colors.textSecondary}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={200}
                numberOfLines={4}
              />
              <Text style={[styles.charCount, { color: colors.textSecondary }]}>
                {message.length}/200
              </Text>

              {/* Send Button */}
              <Button
                mode="contained"
                onPress={handleSend}
                loading={loading}
                disabled={loading}
                style={styles.sendButton}
                contentStyle={styles.sendButtonContent}
                icon="gift"
              >
                {loading ? "Sending..." : "Send Gift"}
              </Button>

              <Text
                style={[styles.disclaimer, { color: colors.textSecondary }]}
              >
                This purchase is non-refundable. The recipient will receive a
                notification about this gift.
              </Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modal: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "85%",
    paddingTop: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: Spacing.md,
    padding: Spacing.xs,
  },
  title: {
    fontWeight: "600",
  },
  closeButton: {
    position: "absolute",
    right: Spacing.md,
    padding: Spacing.xs,
  },
  itemPreview: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  itemImageContainer: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  itemImage: {
    fontSize: 32,
  },
  itemInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
  },
  friendList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  friendItemPressed: {
    opacity: 0.7,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  friendAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  friendName: {
    flex: 1,
    marginLeft: Spacing.md,
    fontSize: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
  },
  emptyText: {
    marginTop: Spacing.md,
    textAlign: "center",
    lineHeight: 22,
  },
  messageContainer: {
    paddingHorizontal: Spacing.md,
  },
  selectedFriend: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  selectedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: Spacing.sm,
  },
  selectedAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: Spacing.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: 16,
    textAlignVertical: "top",
    minHeight: 100,
  },
  charCount: {
    textAlign: "right",
    marginTop: Spacing.xs,
    fontSize: 12,
  },
  sendButton: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  sendButtonContent: {
    paddingVertical: Spacing.xs,
  },
  disclaimer: {
    marginTop: Spacing.md,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});

// =============================================================================
// Export
// =============================================================================

export const GiftModal = memo(GiftModalBase);
export default GiftModal;
