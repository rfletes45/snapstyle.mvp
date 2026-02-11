/**
 * ProfilePreviewModal Component
 *
 * A bottom sheet modal that shows a quick preview of a user's profile.
 * Displays avatar, name, username, friendship stats, and quick actions.
 *
 * @module components/chat/inbox/ProfilePreviewModal
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { getFriends } from "@/services/friends";
import { getUserProfile } from "@/services/users";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation";
import type { User } from "@/types/models";
import {
  createSlideDownAnimation,
  createSlideUpAnimation,
} from "@/utils/animations";
import * as haptics from "@/utils/haptics";
import { log } from "@/utils/log";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Divider,
  IconButton,
  Text,
} from "react-native-paper";
import { BorderRadius, Spacing } from "@/constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface ProfilePreviewModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** The user ID to show the profile for */
  userId: string | null;
  /** Called when the modal should close */
  onClose: () => void;
  /** Called when mute is pressed - passes userId */
  onMute?: (userId: string) => void;
  /** Called when report is pressed - passes userId and username */
  onReport?: (userId: string, username: string) => void;
  /** Called when block is pressed - passes userId and username */
  onBlock?: (userId: string, username: string) => void;
}

interface ProfileData extends User {
  friendsSince?: number;
  streakDays?: number;
  profilePicture?: { url: string; updatedAt?: number };
  avatarDecoration?: { decorationId: string; equippedAt?: number };
}

// =============================================================================
// Component
// =============================================================================

export function ProfilePreviewModal({
  visible,
  userId,
  onClose,
  onMute,
  onReport,
  onBlock,
}: ProfilePreviewModalProps) {
  const { colors, isDark } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  // State
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  // =============================================================================
  // Effects
  // =============================================================================

  // Load profile data when modal opens
  useEffect(() => {
    if (!visible || !userId || !currentFirebaseUser?.uid) {
      setProfile(null);
      setError(null);
      return;
    }

    const loadProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch user profile
        const userProfile = await getUserProfile(userId);

        if (!userProfile) {
          setError("Profile not found");
          setLoading(false);
          return;
        }

        // Try to find friendship info
        let friendsSince: number | undefined;
        let streakDays: number | undefined;

        try {
          const friends = await getFriends(currentFirebaseUser.uid);
          const friendship = friends.find((f) => f.users.includes(userId));

          if (friendship) {
            friendsSince = friendship.createdAt;
            streakDays = friendship.streakCount;
          }
        } catch {
          // Friendship info not critical, ignore errors
        }

        setProfile({
          ...userProfile,
          friendsSince,
          streakDays,
        });
      } catch (err) {
        log.error("Error loading profile", err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [visible, userId, currentFirebaseUser?.uid]);

  // Slide animation
  useEffect(() => {
    if (visible) {
      haptics.modalOpen();
      createSlideUpAnimation(slideAnim).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [visible, slideAnim]);

  // =============================================================================
  // Handlers
  // =============================================================================

  const handleCloseWithCallback = useCallback(
    (callback?: () => void) => {
      haptics.modalClose();
      createSlideDownAnimation(slideAnim).start(() => {
        onClose();
        // Execute callback after modal is fully closed
        callback?.();
      });
    },
    [onClose, slideAnim],
  );

  // Simple close handler for onPress events
  const handleClose = useCallback(() => {
    handleCloseWithCallback();
  }, [handleCloseWithCallback]);

  const handleMessage = useCallback(() => {
    if (!userId) return;

    handleCloseWithCallback(() => {
      // Navigate to DM chat - we're already in InboxStack, so just navigate directly
      navigation.navigate("ChatDetail", { friendUid: userId });
    });
  }, [userId, handleCloseWithCallback, navigation]);

  const handleFullProfile = useCallback(() => {
    if (!userId) return;

    handleCloseWithCallback(() => {
      // Navigate to the full UserProfile screen
      navigation.navigate("UserProfile", { userId });
    });
  }, [userId, handleCloseWithCallback, navigation]);

  const handleMute = useCallback(() => {
    if (!userId) return;

    haptics.muteToggle();
    handleCloseWithCallback(() => {
      // Call the parent's mute handler after modal is closed
      if (onMute) {
        onMute(userId);
      }
    });
  }, [userId, handleCloseWithCallback, onMute]);

  const handleReport = useCallback(() => {
    if (!userId || !profile) return;

    haptics.buttonPress();
    handleCloseWithCallback(() => {
      // Call the parent's report handler after modal is closed
      if (onReport) {
        onReport(userId, profile.username);
      }
    });
  }, [userId, profile, handleCloseWithCallback, onReport]);

  const handleBlock = useCallback(() => {
    if (!userId || !profile) return;

    haptics.warning();
    handleCloseWithCallback(() => {
      // Call the parent's block handler after modal is closed
      if (onBlock) {
        onBlock(userId, profile.username);
      }
    });
  }, [userId, profile, handleCloseWithCallback, onBlock]);

  // =============================================================================
  // Helpers
  // =============================================================================

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
    };
    return date.toLocaleDateString(undefined, options);
  };

  // =============================================================================
  // Render
  // =============================================================================

  if (!visible) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 300],
    outputRange: [0, 300],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modal,
                {
                  backgroundColor: colors.surface,
                  transform: [{ translateY }],
                },
              ]}
            >
              {/* Handle bar */}
              <View style={styles.handleBar}>
                <View
                  style={[
                    styles.handle,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                />
              </View>

              {/* Close button */}
              <IconButton
                icon="close"
                size={24}
                style={styles.closeButton}
                onPress={handleClose}
                iconColor={colors.text}
              />

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.text }]}>
                    Loading profile...
                  </Text>
                </View>
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Text style={[styles.errorText, { color: colors.error }]}>
                    {error}
                  </Text>
                  <Button mode="outlined" onPress={handleClose}>
                    Close
                  </Button>
                </View>
              ) : profile ? (
                <>
                  {/* Avatar */}
                  <View style={styles.avatarContainer}>
                    <ProfilePictureWithDecoration
                      pictureUrl={profile.profilePicture?.url || null}
                      name={profile.displayName}
                      decorationId={
                        profile.avatarDecoration?.decorationId || null
                      }
                      size={96}
                    />
                  </View>

                  {/* Name & Username */}
                  <Text style={[styles.displayName, { color: colors.text }]}>
                    {profile.displayName}
                  </Text>
                  <Text
                    style={[styles.username, { color: colors.textSecondary }]}
                  >
                    @{profile.username}
                  </Text>

                  {/* Stats */}
                  <View style={styles.statsContainer}>
                    {profile.friendsSince && (
                      <Text
                        style={[styles.stat, { color: colors.textSecondary }]}
                      >
                        Friends since {formatDate(profile.friendsSince)}
                      </Text>
                    )}

                    {profile.streakDays != null && profile.streakDays > 0 && (
                      <View style={styles.streakContainer}>
                        <Text
                          style={[styles.streak, { color: colors.primary }]}
                        >
                          🔥 {profile.streakDays} day streak
                        </Text>
                      </View>
                    )}
                  </View>

                  <Divider style={styles.divider} />

                  {/* Primary Actions */}
                  <View style={styles.actions}>
                    <Button
                      mode="contained"
                      icon="account"
                      onPress={handleFullProfile}
                      style={styles.actionButton}
                      contentStyle={styles.actionButtonContent}
                    >
                      View Profile
                    </Button>
                    <Button
                      mode="outlined"
                      icon="message"
                      onPress={handleMessage}
                      style={styles.actionButton}
                      contentStyle={styles.actionButtonContent}
                    >
                      Message
                    </Button>
                  </View>

                  {/* Secondary Actions */}
                  <View style={styles.secondaryActions}>
                    <IconButton
                      icon="bell-off"
                      size={24}
                      onPress={handleMute}
                      iconColor={colors.textSecondary}
                    />
                    <IconButton
                      icon="flag"
                      size={24}
                      onPress={handleReport}
                      iconColor={colors.textSecondary}
                    />
                    <IconButton
                      icon="account-off"
                      size={24}
                      onPress={handleBlock}
                      iconColor={colors.error}
                    />
                  </View>
                </>
              ) : (
                <View style={styles.errorContainer}>
                  <Text
                    style={[styles.errorText, { color: colors.textSecondary }]}
                  >
                    Profile not found
                  </Text>
                </View>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxxl,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    minHeight: 350,
  },
  handleBar: {
    width: "100%",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  closeButton: {
    position: "absolute",
    top: Spacing.xs,
    right: Spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 250,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
    gap: Spacing.lg,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  avatarContainer: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  displayName: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  username: {
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  statsContainer: {
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  stat: {
    fontSize: 14,
    marginBottom: Spacing.xs,
  },
  streakContainer: {
    marginTop: Spacing.xs,
  },
  streak: {
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    width: "80%",
    marginVertical: Spacing.lg,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    minWidth: 120,
  },
  actionButtonContent: {
    paddingVertical: Spacing.xs,
  },
  secondaryActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
});

export default ProfilePreviewModal;
