/**
 * ChatScreen (DM) - Refactored (UNI-05)
 *
 * This screen handles direct message conversations between two users.
 * Refactored to use unified abstractions achieving ~400 lines from ~1,700.
 *
 * Extractions Made:
 * - useSnapCapture: Snap/photo capture and upload logic
 * - DMMessageItem: Message rendering component
 * - messageAdapters: V1↔V2 message conversion utilities
 *
 * Enhanced Features:
 * - Message highlight animation when navigating to replied messages
 * - Jump-back button after scrolling to a reply target
 */

import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { Badge, IconButton, Menu, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Auth & notifications
import { useAuth } from "@/store/AuthContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";

// Unified chat hooks (UNI-04, UNI-05)
import { usePresence } from "@/hooks/usePresence";
import { useReadReceipts } from "@/hooks/useReadReceipts";
import { useSnapCapture } from "@/hooks/useSnapCapture";
import { useTypingStatus } from "@/hooks/useTypingStatus";
import { useUnifiedChatScreen } from "@/hooks/useUnifiedChatScreen";

// Chat components
import {
  ChatComposer,
  ChatGameInvites,
  ChatMessageList,
  MessageActionsSheet,
  TypingIndicator,
} from "@/components/chat";
import { CameraLongPressButton } from "@/components/chat/CameraLongPressButton";
import type { ChatMessageListRef } from "@/components/chat/ChatMessageList";
import { ChatSkeleton } from "@/components/chat/ChatSkeleton";
import { ScrollReturnButton } from "@/components/chat/ScrollReturnButton";

// UI components
import BlockUserModal from "@/components/BlockUserModal";
import { DMMessageItem, MessageWithProfile } from "@/components/DMMessageItem";
import ReportUserModal from "@/components/ReportUserModal";
import ScheduleMessageModal from "@/components/ScheduleMessageModal";
import { EmptyState, PresenceIndicator } from "@/components/ui";

// Services
import { blockUser } from "@/services/blocking";
import { getOrCreateChat } from "@/services/chat";
import { retryFailedMessage as retryFailedMessageV2 } from "@/services/chatV2";
import { getUserProfileByUid } from "@/services/friends";
import { submitReport } from "@/services/reporting";
import {
  getScheduledMessagesForChat,
  scheduleMessage,
} from "@/services/scheduledMessages";

// Game Picker
import { GamePickerModal } from "@/components/games/GamePickerModal";
import { GAME_SCREEN_MAP } from "@/config/gameCategories";
import { ExtendedGameType } from "@/types/games";

// Call buttons
import { CallButtonGroup } from "@/components/calls";

// Types & Utils
import type { ReplyToMetadata } from "@/types/messaging";
import type { ReportReason, ScheduledMessage } from "@/types/models";
import {
  messageV2ToWithProfile,
  messageWithProfileToV2,
} from "@/utils/messageAdapters";
import { DEBUG_CHAT_V2, SHOW_V2_BADGE } from "../../../constants/featureFlags";
import { Spacing } from "../../../constants/theme";

// ==========================================================================
// Constants
// ==========================================================================

const DEBUG_CHAT = DEBUG_CHAT_V2;

// ==========================================================================
// Types
// ==========================================================================

interface InitialChatData {
  chatId?: string;
  friendName?: string;
  friendAvatar?: string | null;
  friendAvatarConfig?: any;
}

interface ChatScreenParams {
  friendUid: string;
  initialData?: InitialChatData;
}

// ==========================================================================
// ChatScreen Component
// ==========================================================================

export default function ChatScreen({
  route,
  navigation,
}: NativeStackScreenProps<any, "ChatDetail">) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const { setCurrentChatId } = useInAppNotifications();
  const uid = currentFirebaseUser?.uid;

  // OPTIMIZATION: Extract initial data passed from inbox for instant display
  const { friendUid, initialData } = route.params as ChatScreenParams;

  // ==========================================================================
  // Screen State
  // ==========================================================================

  // OPTIMIZATION: Initialize with cached data to prevent flicker
  const [chatId, setChatId] = useState<string | null>(
    initialData?.chatId || null,
  );
  const [friendProfile, setFriendProfile] = useState<any>(
    initialData
      ? {
          username: initialData.friendName,
          avatar: initialData.friendAvatar,
          avatarConfig: initialData.friendAvatarConfig,
        }
      : null,
  );
  const messageListRef = React.useRef<ChatMessageListRef>(null);

  // Modal state
  const [menuVisible, setMenuVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [gamePickerVisible, setGamePickerVisible] = useState(false);

  // Message actions state
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] =
    useState<MessageWithProfile | null>(null);

  // Scheduled messages
  const [scheduledMessages, setScheduledMessages] = useState<
    ScheduledMessage[]
  >([]);

  // Reply navigation state (highlight + jump-back)
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [showReturnButton, setShowReturnButton] = useState(false);
  const returnIndexRef = useRef<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // ==========================================================================
  // Unified Hooks (UNI-04, UNI-05)
  // ==========================================================================

  const screen = useUnifiedChatScreen({
    scope: "dm",
    conversationId: chatId || "",
    currentUid: uid || "",
    currentUserName:
      currentFirebaseUser?.displayName || currentFirebaseUser?.email || "User",
    enableVoice: false,
    enableAttachments: false,
    enableMentions: false,
    enableScheduledMessages: true,
    onSchedulePress: () => setScheduleModalVisible(true),
    debug: DEBUG_CHAT,
  });

  const snap = useSnapCapture({
    uid,
    friendUid,
    chatId,
    debug: DEBUG_CHAT,
  });

  // Typing indicator
  const typing = useTypingStatus({
    scope: "dm",
    conversationId: chatId || "",
    currentUid: uid || "",
    otherUid: friendUid,
    debug: DEBUG_CHAT,
  });

  // Presence (online status, last seen)
  const presence = usePresence({
    userId: friendUid,
    currentUserId: uid,
    debug: DEBUG_CHAT,
  });

  // Read receipts
  const readReceipts = useReadReceipts({
    chatId: chatId || "",
    currentUid: uid || "",
    otherUid: friendUid,
    debug: DEBUG_CHAT,
  });

  // ==========================================================================
  // Derived State
  // ==========================================================================

  const displayMessages: MessageWithProfile[] = useMemo(
    () =>
      chatId
        ? screen.messages.map((msg) => {
            const converted = messageV2ToWithProfile(
              msg,
              friendUid,
              friendProfile,
            );
            // Apply read receipt status for messages sent by current user
            if (msg.senderId === uid && converted.serverReceivedAt) {
              // Exclude "read" from status check since getMessageStatus will determine it
              const baseStatus =
                converted.status !== "read" ? converted.status : "delivered";
              converted.status = readReceipts.getMessageStatus(
                converted.serverReceivedAt,
                baseStatus,
              );
            }
            return converted;
          })
        : [],
    [chatId, screen.messages, friendUid, friendProfile, uid, readReceipts],
  );

  const selectedMessageAsV2 = useMemo(
    () => messageWithProfileToV2(selectedMessage, chatId, uid, friendProfile),
    [selectedMessage, chatId, uid, friendProfile],
  );

  // ==========================================================================
  // Initialization
  // ==========================================================================

  // NOTE: Tab bar visibility is now handled at the navigator level
  // in RootNavigator.tsx using getFocusedRouteNameFromRoute.
  // This eliminates flicker during navigation transitions.

  // Initialize chat - OPTIMIZATION: Skip Firestore calls if we have cached data
  useFocusEffect(
    useCallback(() => {
      const initializeChat = async () => {
        if (!uid) return;

        try {
          // OPTIMIZATION: If we have both chatId and friendProfile from initialData,
          // only fetch fresh data in background (non-blocking)
          if (chatId && friendProfile) {
            setCurrentChatId(chatId);

            // Background refresh - don't block
            getUserProfileByUid(friendUid)
              .then(setFriendProfile)
              .catch(console.warn);
            return;
          }

          // OPTIMIZATION: Parallelize fetch operations
          const promises: [Promise<string>, Promise<any>] = [
            chatId ? Promise.resolve(chatId) : getOrCreateChat(uid, friendUid),
            getUserProfileByUid(friendUid),
          ];

          const [resolvedChatId, profile] = await Promise.all(promises);

          setChatId(resolvedChatId);
          setCurrentChatId(resolvedChatId);
          setFriendProfile(profile);
        } catch (error: any) {
          console.error("❌ [ChatScreen] Init error:", error);
          Alert.alert("Error", error.message || "Failed to initialize chat");
          if (error.message?.includes("Cannot chat with this user")) {
            navigation.goBack();
          }
        }
      };

      initializeChat();
      return () => setCurrentChatId(null);
    }, [uid, friendUid, chatId, friendProfile, setCurrentChatId, navigation]),
  );

  // Load scheduled messages
  useEffect(() => {
    if (!uid || !chatId) return;
    getScheduledMessagesForChat(uid, chatId)
      .then(setScheduledMessages)
      .catch(console.error);
  }, [uid, chatId]);

  // Update header
  useEffect(() => {
    if (!friendProfile) return;

    // Determine header subtitle based on presence
    const getSubtitle = () => {
      if (typing.isOtherUserTyping && typing.typingIndicatorsEnabled) {
        return "typing...";
      }
      if (presence.shouldShowOnlineIndicator && presence.isOnline) {
        return "Online";
      }
      if (presence.shouldShowLastSeen && presence.lastSeen) {
        return `Last seen ${presence.lastSeenFormatted}`;
      }
      return undefined;
    };

    const subtitle = getSubtitle();

    navigation.setOptions({
      headerTitle: () => (
        <View style={{ alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {presence.shouldShowOnlineIndicator && (
              <PresenceIndicator
                online={presence.isOnline}
                size={8}
                position="inline"
              />
            )}
            <Text
              style={{
                fontSize: 17,
                fontWeight: "600",
                color: theme.colors.onSurface,
              }}
            >
              {friendProfile.username}
            </Text>
          </View>
          {subtitle && (
            <Text
              style={{
                fontSize: 12,
                color:
                  typing.isOtherUserTyping && typing.typingIndicatorsEnabled
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant,
                marginTop: 2,
              }}
            >
              {subtitle}
            </Text>
          )}
        </View>
      ),
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Call buttons */}
          <CallButtonGroup
            recipientId={friendUid}
            recipientName={friendProfile?.username || "Friend"}
            conversationId={chatId || ""}
            scope="dm"
            size={22}
            iconColor={theme.colors.onSurface}
          />
          {SHOW_V2_BADGE && (
            <Badge
              size={20}
              style={{ backgroundColor: "#4CAF50", marginRight: 8 }}
            >
              V2
            </Badge>
          )}
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={24}
                onPress={() => setMenuVisible(true)}
              />
            }
            contentStyle={{ backgroundColor: theme.colors.surface }}
          >
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate("ChatSettings", {
                  chatId,
                  chatType: "dm",
                  chatName: friendProfile?.username,
                });
              }}
              title="Settings"
              leadingIcon="cog-outline"
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                setBlockModalVisible(true);
              }}
              title="Block User"
              leadingIcon="block-helper"
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                setReportModalVisible(true);
              }}
              title="Report User"
              leadingIcon="flag"
            />
          </Menu>
        </View>
      ),
    });
  }, [
    friendProfile,
    navigation,
    menuVisible,
    theme.colors.surface,
    theme.colors.onSurface,
    theme.colors.onSurfaceVariant,
    theme.colors.primary,
    chatId,
    presence,
    typing,
  ]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleTextChange = useCallback(
    (text: string) => {
      screen.composer.setText(text);
      // Update typing status
      typing.setTyping(text.length > 0);
    },
    [screen.composer, typing],
  );

  const handleSendMessage = useCallback(async () => {
    if (!uid || !chatId || !screen.composer.text.trim()) return;
    try {
      // Clear typing indicator when sending
      typing.setTyping(false);
      await screen.composer.send();
    } catch (error) {
      console.error("❌ [ChatScreen] Send error:", error);
    }
  }, [uid, chatId, screen.composer, typing]);

  const handleReply = useCallback(
    (replyMetadata: ReplyToMetadata) => {
      screen.chat.setReplyTo(replyMetadata);
    },
    [screen.chat],
  );

  const handleCancelReply = useCallback(() => {
    screen.chat.clearReplyTo();
  }, [screen.chat]);

  const handleMessageLongPress = useCallback((message: MessageWithProfile) => {
    setSelectedMessage(message);
    setActionsSheetVisible(true);
  }, []);

  const handleRetryMessage = useCallback(async (msg: MessageWithProfile) => {
    await retryFailedMessageV2(msg.id);
  }, []);

  // Enhanced scroll-to-message with highlight animation
  const scrollToMessage = useCallback(
    (messageId: string) => {
      const targetIndex = displayMessages.findIndex((m) => m.id === messageId);
      if (targetIndex === -1 || !messageListRef.current) return;

      // Clear any existing highlight timeout
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }

      // Store current position for return navigation (rough estimate from visible messages)
      // In inverted list, index 0 is at the bottom
      returnIndexRef.current = 0;
      setShowReturnButton(true);

      // Scroll to target message
      messageListRef.current.scrollToIndex(targetIndex, true);

      // Highlight the target message after scroll settles
      setTimeout(() => {
        setHighlightedMessageId(messageId);

        // Auto-clear highlight after animation
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedMessageId(null);
        }, 2100); // Match animation duration
      }, 300); // Wait for scroll to settle
    },
    [displayMessages],
  );

  // Handle return button press
  const handleReturnToReply = useCallback(() => {
    if (returnIndexRef.current !== null && messageListRef.current) {
      messageListRef.current.scrollToIndex(returnIndexRef.current, true);
    }
    setShowReturnButton(false);
    returnIndexRef.current = null;
  }, []);

  // Auto-hide return button callback
  const handleReturnButtonAutoHide = useCallback(() => {
    setShowReturnButton(false);
    returnIndexRef.current = null;
  }, []);

  const handleNavigateToGame = useCallback(
    (
      gameId: string,
      gameType: string,
      options?: {
        inviteId?: string;
        spectatorMode?: boolean;
        liveSessionId?: string;
      },
    ) => {
      // For spectators, navigate to SpectatorView screen
      if (options?.spectatorMode && options?.liveSessionId) {
        navigation.navigate("MainTabs", {
          screen: "Play",
          params: {
            screen: "SpectatorView",
            params: {
              liveSessionId: options.liveSessionId,
              gameType: gameType,
            },
          },
        });
        return;
      }

      const screen = GAME_SCREEN_MAP[gameType as keyof typeof GAME_SCREEN_MAP];
      if (screen) {
        // Navigate through MainTabs -> Play tab -> specific game screen
        navigation.navigate("MainTabs", {
          screen: "Play",
          params: {
            screen,
            params: {
              matchId: gameId,
              inviteId: options?.inviteId,
              spectatorMode: options?.spectatorMode,
              spectatorInviteId: options?.inviteId, // For single-player spectator sessions
              liveSessionId: options?.liveSessionId, // For live spectator sessions
              entryPoint: "chat",
              conversationId: chatId,
              conversationType: "dm" as const,
            },
          },
        });
      } else {
        console.warn(
          `[ChatScreen] No screen mapping for gameType: ${gameType}`,
        );
      }
    },
    [navigation, chatId],
  );

  // Game button press handler - Opens game picker modal
  const handleGamePress = useCallback(() => {
    setGamePickerVisible(true);
  }, []);

  // Handle single-player game selection - navigate directly to game
  // Optionally receives a spectatorInviteId and liveSessionId if the player wants to invite spectators
  const handleSinglePlayerGame = useCallback(
    (
      gameType: ExtendedGameType,
      spectatorInviteId?: string,
      liveSessionId?: string,
    ) => {
      const screen = GAME_SCREEN_MAP[gameType];
      if (screen) {
        // Navigate through MainTabs -> Play tab -> specific game screen
        navigation.navigate("MainTabs", {
          screen: "Play",
          params: {
            screen,
            params: {
              entryPoint: "chat",
              spectatorInviteId, // Pass spectator invite ID
              liveSessionId, // Pass live session ID for real-time spectator updates
              conversationId: chatId, // Pass conversation context
              conversationType: "dm" as const,
            },
          },
        });
      }
    },
    [navigation, chatId],
  );

  // Handle multiplayer invite creation
  const handleInviteCreated = useCallback(() => {
    // Invite will appear via ChatGameInvites subscription
    // Optionally show a toast or haptic feedback here
  }, []);

  // Handle spectator invite creation
  const handleSpectatorInviteCreated = useCallback(() => {
    // Spectator invite created - navigation happens in GamePickerModal
    // Optionally show a toast or haptic feedback here
  }, []);

  const handleBlockConfirm = async (reason?: string) => {
    if (!uid) return;
    try {
      await blockUser(uid, friendUid, reason);
      setBlockModalVisible(false);
      Alert.alert(
        "User Blocked",
        `${friendProfile?.username || "User"} has been blocked.`,
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to block user");
    }
  };

  const handleReportSubmit = async (
    reason: ReportReason,
    description?: string,
  ) => {
    if (!uid) return;
    try {
      await submitReport(uid, friendUid, reason, {
        description,
        relatedContent: { type: "message" },
      });
      setReportModalVisible(false);
      Alert.alert(
        "Report Submitted",
        "Thank you for helping keep our community safe.",
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit report");
    }
  };

  const handleScheduleMessage = async (scheduledFor: Date) => {
    const text = screen.composer.text.trim();
    if (!uid || !chatId || !text) return;
    try {
      const result = await scheduleMessage({
        senderId: uid,
        recipientId: friendUid,
        chatId,
        scope: "dm",
        content: text,
        type: "text",
        scheduledFor,
      });
      if (result) {
        screen.composer.clearText();
        setScheduledMessages((prev) => [...prev, result]);
        Alert.alert(
          "Message Scheduled! ⏰",
          `Your message will be sent ${scheduledFor.toLocaleString()}`,
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to schedule message.");
    }
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  // OPTIMIZATION: Show shell immediately, skeleton only for message area
  // This eliminates UI flicker by always rendering header and composer
  const isInitializing = !chatId || !friendProfile;
  const showSkeleton = screen.loading || isInitializing;

  const renderMessageItem = ({ item }: { item: MessageWithProfile }) => (
    <DMMessageItem
      message={item}
      currentUid={uid}
      chatId={chatId}
      friendProfile={friendProfile}
      onReply={handleReply}
      onLongPress={handleMessageLongPress}
      onScrollToMessage={scrollToMessage}
      onRetry={handleRetryMessage}
      isHighlighted={item.id === highlightedMessageId}
    />
  );

  const cameraButton = (
    <CameraLongPressButton
      onShortPress={snap.handleCapturePhoto}
      onLongPress={snap.showPhotoMenu}
      disabled={screen.sending || snap.uploadingSnap}
      size={40}
    />
  );

  const scheduleButton = screen.composer.text.trim() ? (
    <IconButton
      icon="clock-outline"
      size={22}
      onPress={() => setScheduleModalVisible(true)}
      disabled={screen.sending || snap.uploadingSnap}
      style={styles.scheduleButton}
    />
  ) : null;

  return (
    <>
      <View
        style={[
          styles.container,
          { backgroundColor: theme.dark ? "#000" : theme.colors.background },
        ]}
      >
        {/* Game Invites Section - only show when ready */}
        {chatId && uid && !showSkeleton && (
          <ChatGameInvites
            conversationId={chatId}
            currentUserId={uid}
            currentUserName={
              currentFirebaseUser?.displayName ||
              currentFirebaseUser?.email ||
              "User"
            }
            onNavigateToGame={handleNavigateToGame}
            compact
          />
        )}

        {/* OPTIMIZATION: Show skeleton during initialization, messages when ready */}
        {showSkeleton ? (
          <ChatSkeleton bubbleCount={8} />
        ) : (
          <ChatMessageList
            ref={messageListRef}
            data={displayMessages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            listBottomInset={screen.keyboard.listBottomInset}
            staticBottomInset={60 + insets.bottom + 16}
            isKeyboardOpen={screen.keyboard.isKeyboardOpen}
            ListHeaderComponent={
              screen.chat.pagination.isLoadingOlder ? (
                <View style={styles.loadMoreContainer}>
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                  />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                icon="chat-outline"
                title="No messages yet"
                subtitle="Send a message or snap to start the conversation!"
              />
            }
            flatListProps={{
              onEndReached: screen.loadOlder,
              onEndReachedThreshold: 0.3,
            }}
          />
        )}

        {/* Typing Indicator */}
        <TypingIndicator
          userName={friendProfile?.username}
          visible={typing.isOtherUserTyping && typing.typingIndicatorsEnabled}
        />

        {/* Jump-back button for reply navigation */}
        <ScrollReturnButton
          visible={showReturnButton}
          onPress={handleReturnToReply}
          onAutoHide={handleReturnButtonAutoHide}
          autoHideDelay={5000}
        />

        <ChatComposer
          scope="dm"
          value={screen.composer.text}
          onChangeText={handleTextChange}
          onSend={handleSendMessage}
          sendDisabled={!screen.canSend || snap.uploadingSnap || showSkeleton}
          isSending={screen.sending}
          placeholder="Message..."
          leftAccessory={cameraButton}
          additionalRightAccessory={scheduleButton}
          replyTo={screen.chat.replyTo}
          onCancelReply={handleCancelReply}
          currentUid={uid}
          onGamePress={handleGamePress}
          keyboardHeight={screen.keyboard.keyboardHeight}
          safeAreaBottom={insets.bottom}
          absolutePosition={true}
        />
      </View>

      <BlockUserModal
        visible={blockModalVisible}
        username={friendProfile?.username || "User"}
        onCancel={() => setBlockModalVisible(false)}
        onConfirm={handleBlockConfirm}
      />

      <ReportUserModal
        visible={reportModalVisible}
        username={friendProfile?.username || "User"}
        onSubmit={handleReportSubmit}
        onCancel={() => setReportModalVisible(false)}
      />

      <ScheduleMessageModal
        visible={scheduleModalVisible}
        messagePreview={screen.composer.text}
        onSchedule={handleScheduleMessage}
        onClose={() => setScheduleModalVisible(false)}
      />

      <MessageActionsSheet
        visible={actionsSheetVisible}
        message={selectedMessageAsV2}
        currentUid={uid || ""}
        onClose={() => setActionsSheetVisible(false)}
        onReply={handleReply}
        onEdited={() => {}}
        onDeleted={() => {}}
      />

      <GamePickerModal
        visible={gamePickerVisible}
        onDismiss={() => setGamePickerVisible(false)}
        context="dm"
        conversationId={chatId || ""}
        conversationName={friendProfile?.username}
        recipientId={friendUid}
        recipientName={friendProfile?.username}
        recipientAvatar={friendProfile?.avatar}
        onSinglePlayerGame={handleSinglePlayerGame}
        onInviteCreated={handleInviteCreated}
        onSpectatorInviteCreated={handleSpectatorInviteCreated}
        onError={(error) => Alert.alert("Error", error)}
      />
    </>
  );
}

// ==========================================================================
// Styles
// ==========================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadMoreContainer: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  scheduleButton: {
    margin: 0,
    width: 40,
    height: 40,
  },
});
