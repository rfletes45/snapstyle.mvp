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
 */

import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import { Badge, IconButton, Menu, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Auth & notifications
import { useAuth } from "@/store/AuthContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";

// Unified chat hooks (UNI-04, UNI-05)
import { useSnapCapture } from "@/hooks/useSnapCapture";
import { useUnifiedChatScreen } from "@/hooks/useUnifiedChatScreen";

// Chat components
import {
  ChatComposer,
  ChatGameInvites,
  ChatMessageList,
  MessageActionsSheet,
} from "@/components/chat";
import { CameraLongPressButton } from "@/components/chat/CameraLongPressButton";
import type { ChatMessageListRef } from "@/components/chat/ChatMessageList";

// UI components
import BlockUserModal from "@/components/BlockUserModal";
import { DMMessageItem, MessageWithProfile } from "@/components/DMMessageItem";
import ReportUserModal from "@/components/ReportUserModal";
import ScheduleMessageModal from "@/components/ScheduleMessageModal";
import { EmptyState, LoadingState } from "@/components/ui";

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
  const { friendUid } = route.params as { friendUid: string };

  // ==========================================================================
  // Screen State
  // ==========================================================================

  // Core state
  const [chatId, setChatId] = useState<string | null>(null);
  const [friendProfile, setFriendProfile] = useState<any>(null);
  const messageListRef = React.useRef<ChatMessageListRef>(null);

  // Modal state
  const [menuVisible, setMenuVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);

  // Message actions state
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] =
    useState<MessageWithProfile | null>(null);

  // Scheduled messages
  const [scheduledMessages, setScheduledMessages] = useState<
    ScheduledMessage[]
  >([]);

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

  // ==========================================================================
  // Derived State
  // ==========================================================================

  const displayMessages: MessageWithProfile[] = useMemo(
    () =>
      chatId
        ? screen.messages.map((msg) =>
            messageV2ToWithProfile(msg, friendUid, friendProfile),
          )
        : [],
    [chatId, screen.messages, friendUid, friendProfile],
  );

  const selectedMessageAsV2 = useMemo(
    () => messageWithProfileToV2(selectedMessage, chatId, uid, friendProfile),
    [selectedMessage, chatId, uid, friendProfile],
  );

  // ==========================================================================
  // Initialization
  // ==========================================================================

  // Hide tab bar when focused
  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: "none" } });
      return () => {
        navigation.getParent()?.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation]),
  );

  // Initialize chat
  useFocusEffect(
    useCallback(() => {
      const initializeChat = async () => {
        if (!uid) return;

        try {
          const id = await getOrCreateChat(uid, friendUid);
          setChatId(id);
          setCurrentChatId(id);

          const profile = await getUserProfileByUid(friendUid);
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
    }, [uid, friendUid, setCurrentChatId, navigation]),
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

    navigation.setOptions({
      title: friendProfile.username,
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
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
  }, [friendProfile, navigation, menuVisible, theme.colors.surface, chatId]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleSendMessage = useCallback(async () => {
    if (!uid || !chatId || !screen.composer.text.trim()) return;
    try {
      await screen.composer.send();
    } catch (error) {
      console.error("❌ [ChatScreen] Send error:", error);
    }
  }, [uid, chatId, screen.composer]);

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

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const index = displayMessages.findIndex((m) => m.id === messageId);
      if (index !== -1 && messageListRef.current) {
        messageListRef.current.scrollToIndex(index, true);
      }
    },
    [displayMessages],
  );

  const handleNavigateToGame = useCallback(
    (gameId: string, gameType: string) => {
      const screenMap: Record<string, string> = {
        tic_tac_toe: "TicTacToeGame",
        checkers: "CheckersGame",
        chess: "ChessGame",
        crazy_eights: "CrazyEightsGame",
      };
      const screen = screenMap[gameType];
      if (screen) {
        navigation.navigate(screen, { matchId: gameId });
      }
    },
    [navigation],
  );

  // Game button press handler - TODO: Open game picker modal
  const handleGamePress = useCallback(() => {
    // TODO: Implement game picker modal
    console.log("[ChatScreen] Game button pressed");
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

  if (screen.loading) {
    return <LoadingState message="Loading chat..." />;
  }

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

  const scheduleButton = (
    <IconButton
      icon="clock-outline"
      size={22}
      onPress={() => setScheduleModalVisible(true)}
      disabled={
        !screen.composer.text.trim() || screen.sending || snap.uploadingSnap
      }
      style={styles.iconButton}
    />
  );

  return (
    <>
      <View style={styles.container}>
        {/* Game Invites Section */}
        {chatId && uid && (
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
                <ActivityIndicator size="small" color={theme.colors.primary} />
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

        <ChatComposer
          scope="dm"
          value={screen.composer.text}
          onChangeText={screen.composer.setText}
          onSend={handleSendMessage}
          sendDisabled={!screen.canSend || snap.uploadingSnap}
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
  iconButton: {
    margin: 0,
    width: 40,
    height: 40,
  },
});
