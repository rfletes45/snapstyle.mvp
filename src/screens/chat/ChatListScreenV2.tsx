/**
 * ChatListScreen (Inbox) - V2
 *
 * Redesigned inbox screen with:
 * - InboxHeader with avatar, search, settings
 * - InboxTabs for filtering (All/Unread/Groups/DMs/Requests)
 * - Pinned conversations section
 * - Swipeable conversation items
 * - Long-press context menu
 * - Friend requests in Requests tab
 * - FAB with multiple actions
 * - Profile preview modal
 */

import {
  useConversationActions,
  type MuteDuration,
} from "@/hooks/useConversationActions";
import { useInboxData } from "@/hooks/useInboxData";
import {
  useUnifiedInboxRequests,
} from "@/hooks/useUnifiedInboxRequests";
import type { FriendRequestWithUser } from "@/hooks/useFriendRequests";
import { useAuth } from "@/store/AuthContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { InboxConversation } from "@/types/messaging";
import type { GroupInvite } from "@/types/models";
import { usePrefetchProfileImages } from "@/utils/imagePrefetch";
import { log } from "@/utils/log";
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

// Components
import {
  ConversationContextMenu,
  ConversationItem,
  DeleteConfirmDialog,
  EmptyState,
  FriendRequestItem,
  GroupInviteItem,
  InboxFAB,
  InboxHeader,
  InboxTabs,
  MuteOptionsSheet,
  PinnedSection,
  SwipeableConversation,
} from "@/components/chat/inbox";
import { ErrorState, LoadingState } from "@/components/ui";
import {
  getUnifiedRequestsCount,
  isRequestsTabEmpty,
} from "./requestsTabUtils";
// Theme

// =============================================================================
// Types
// =============================================================================

interface ContextMenuState {
  visible: boolean;
  position: { x: number; y: number };
  conversation: InboxConversation | null;
}

// =============================================================================
// Component
// =============================================================================

export default function ChatListScreen() {
  const { colors } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const navigation = useNavigation<any>();
  const uid = currentFirebaseUser?.uid ?? "";
  const isFocused = useIsFocused();

  // In-app notifications context (for tracking last viewed chat)
  const {
    consumeLastViewedChatId,
    registerNotificationPressHandler,
    setCurrentScreen,
  } = useInAppNotifications();

  // Data from useInboxData hook
  const {
    pinnedConversations,
    regularConversations,
    loading,
    error,
    totalUnread,
    filter,
    setFilter,
    showArchived,
    setShowArchived,
    refresh,
    markConversationReadOptimistic,
  } = useInboxData(uid);

  // Warm image cache for conversation avatars
  usePrefetchProfileImages(
    [...(pinnedConversations || []), ...(regularConversations || [])].map(
      (c) =>
        ({
          avatarUrl: c.avatarUrl,
          profilePictureUrl: c.profilePictureUrl,
        }) as { avatarUrl?: string | null; profilePictureUrl?: string | null },
    ),
  );

  // Actions from useConversationActions hook
  // Pass refresh callback to trigger UI update after actions
  const actions = useConversationActions(uid, { onActionComplete: refresh });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    position: { x: 0, y: 0 },
    conversation: null,
  });

  // Mute sheet state
  const [muteSheetVisible, setMuteSheetVisible] = useState(false);
  const [muteTargetConversation, setMuteTargetConversation] =
    useState<InboxConversation | null>(null);

  // Delete dialog state
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleteTargetConversation, setDeleteTargetConversation] =
    useState<InboxConversation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Unified inbox requests (friend requests + group invites + message requests)
  const {
    items: requestItems,
    loading: requestsLoading,
    error: requestsError,
    friendRequests,
    groupInvites,
    messageRequests,
    refresh: refreshUnifiedRequests,
    acceptFriendRequest,
    declineFriendRequest,
    acceptGroupInviteRequest,
    declineGroupInviteRequest,
    acceptMessageRequest,
    declineMessageRequest,
  } = useUnifiedInboxRequests(uid);

  // =============================================================================
  // Register Notification Press Handler
  // =============================================================================

  // Register a handler to mark conversations as read when notification is clicked
  // This allows the inbox to update immediately when a notification is pressed
  React.useEffect(() => {
    const unsubscribe = registerNotificationPressHandler((chatId: string) => {
      log.debug("[Inbox] Notification pressed - optimistic read", {
        data: { chatId },
      });
      markConversationReadOptimistic(chatId);
    });

    return unsubscribe;
  }, [registerNotificationPressHandler, markConversationReadOptimistic]);

  // =============================================================================
  // Track Current Screen for Notification Suppression
  // =============================================================================

  // Tell the notification system we're on the inbox so message notifications
  // are suppressed while the user can already see the list.
  useFocusEffect(
    useCallback(() => {
      setCurrentScreen("ChatList");
      return () => setCurrentScreen(null);
    }, [setCurrentScreen]),
  );

  // =============================================================================
  // Mark Last Viewed Chat as Read (for notification navigation)
  // =============================================================================

  // When returning to inbox from a chat opened via notification,
  // optimistically mark that conversation as read in local state.
  // This handles the case where the chat was opened via notification
  // (not through handleConversationPress which already does this).
  useFocusEffect(
    useCallback(() => {
      const lastChatId = consumeLastViewedChatId();
      if (lastChatId) {
        log.debug("[Inbox] Focus returned - optimistic read", {
          data: { chatId: lastChatId },
        });
        markConversationReadOptimistic(lastChatId);
      }
    }, [consumeLastViewedChatId, markConversationReadOptimistic]),
  );

  // =============================================================================
  // Navigation Handlers
  // =============================================================================

  const handleConversationPress = useCallback(
    (conversation: InboxConversation) => {
      // Optimistically mark as read in local state (immediate UI update)
      markConversationReadOptimistic(conversation.id);

      // Also persist to Firestore (background operation)
      actions.markRead(conversation);

      if (conversation.type === "dm") {
        navigation.navigate("ChatDetail", {
          friendUid: conversation.otherUserId,
          // OPTIMIZATION: Pass cached data for instant display
          // This eliminates refetching when opening a chat
          initialData: {
            chatId: conversation.id,
            friendName: conversation.name,
            friendAvatar: conversation.avatarUrl,
            friendAvatarConfig: conversation.avatarConfig,
          },
        });
      } else {
        navigation.navigate("GroupChat", {
          groupId: conversation.id,
          groupName: conversation.name,
          // OPTIMIZATION: Pass cached group data for instant display
          initialGroupData: {
            name: conversation.name,
            avatarUrl: conversation.avatarUrl,
          },
        });
      }
    },
    [navigation, actions, markConversationReadOptimistic],
  );

  const handleAvatarPress = useCallback(
    (conversation: InboxConversation) => {
      if (conversation.type === "dm" && conversation.otherUserId) {
        navigation.navigate("UserProfile", {
          userId: conversation.otherUserId,
        });
      }
    },
    [navigation],
  );

  const handleLongPress = useCallback(
    (
      conversation: InboxConversation,
      event?: { pageX: number; pageY: number },
    ) => {
      // Show context menu at touch position
      const position = event
        ? { x: event.pageX, y: event.pageY }
        : { x: 100, y: 200 }; // fallback position

      setContextMenu({
        visible: true,
        position,
        conversation,
      });
    },
    [],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({
      visible: false,
      position: { x: 0, y: 0 },
      conversation: null,
    });
  }, []);

  const handleSearchPress = useCallback(() => {
    navigation.navigate("InboxSearch");
  }, [navigation]);

  const handleSettingsPress = useCallback(() => {
    navigation.navigate("InboxSettings");
  }, [navigation]);

  // =============================================================================
  // Friend Request Handlers
  // =============================================================================

  const handleAcceptRequest = useCallback(
    async (requestId: string) => {
      try {
        await acceptFriendRequest(requestId);
      } catch (e) {
        log.error("Failed to accept friend request", e);
      }
    },
    [acceptFriendRequest],
  );

  const handleDeclineRequest = useCallback(
    async (requestId: string) => {
      try {
        await declineFriendRequest(requestId);
      } catch (e) {
        log.error("Failed to decline friend request", e);
      }
    },
    [declineFriendRequest],
  );

  const handleRequestPress = useCallback(
    (request: FriendRequestWithUser) => {
      // Navigate to the requesting user's full profile
      navigation.navigate("UserProfile", { userId: request.fromUserId });
    },
    [navigation],
  );

  // =============================================================================
  // Group Invite Handlers
  // =============================================================================

  const handleAcceptGroupInvite = useCallback(
    async (invite: GroupInvite) => {
      try {
        await acceptGroupInviteRequest(invite);
        // Navigate to the group
        navigation.navigate("GroupChat", {
          groupId: invite.groupId,
          groupName: invite.groupName,
        });
      } catch (e) {
        log.error("Failed to accept group invite", e);
      }
    },
    [acceptGroupInviteRequest, navigation],
  );

  const handleDeclineGroupInvite = useCallback(
    async (invite: GroupInvite) => {
      try {
        await declineGroupInviteRequest(invite);
      } catch (e) {
        log.error("Failed to decline group invite", e);
      }
    },
    [declineGroupInviteRequest],
  );

  const handleAcceptMessageRequest = useCallback(
    async (chatId: string) => {
      try {
        await acceptMessageRequest(chatId);
      } catch (e) {
        log.error("Failed to accept message request", e);
      }
    },
    [acceptMessageRequest],
  );

  const handleDeclineMessageRequest = useCallback(
    async (chatId: string) => {
      try {
        await declineMessageRequest(chatId, false);
      } catch (e) {
        log.error("Failed to decline message request", e);
      }
    },
    [declineMessageRequest],
  );

  // =============================================================================
  // Swipe Action Handlers
  // =============================================================================

  const handleMute = useCallback(
    (conversation: InboxConversation) => {
      // If already muted, unmute. Otherwise show mute options sheet.
      if (conversation.memberState.mutedUntil) {
        actions.unmute(conversation);
      } else {
        setMuteTargetConversation(conversation);
        setMuteSheetVisible(true);
      }
    },
    [actions],
  );

  const handleMuteDurationSelect = useCallback(
    (duration: MuteDuration) => {
      if (muteTargetConversation) {
        actions.mute(muteTargetConversation, duration);
      }
      setMuteSheetVisible(false);
      setMuteTargetConversation(null);
    },
    [muteTargetConversation, actions],
  );

  const handleCloseMuteSheet = useCallback(() => {
    setMuteSheetVisible(false);
    setMuteTargetConversation(null);
  }, []);

  // =============================================================================
  // Delete Confirmation Handlers
  // =============================================================================

  const handleDeleteRequest = useCallback((conversation: InboxConversation) => {
    setDeleteTargetConversation(conversation);
    setDeleteDialogVisible(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTargetConversation) return;

    setDeleteLoading(true);
    try {
      await actions.deleteConversation(deleteTargetConversation);
    } finally {
      setDeleteLoading(false);
      setDeleteDialogVisible(false);
      setDeleteTargetConversation(null);
    }
  }, [deleteTargetConversation, actions]);

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogVisible(false);
    setDeleteTargetConversation(null);
  }, []);

  const handleRequestsRefresh = useCallback(() => {
    refreshUnifiedRequests().catch((e) => {
      log.error("Failed to refresh inbox requests", e);
    });
  }, [refreshUnifiedRequests]);

  // =============================================================================
  // Context Menu Action Handlers
  // =============================================================================

  const handleContextMenuPin = useCallback(() => {
    if (contextMenu.conversation) {
      actions.togglePin(contextMenu.conversation);
    }
    handleCloseContextMenu();
  }, [actions, contextMenu.conversation, handleCloseContextMenu]);

  const handleContextMenuMute = useCallback(() => {
    const conversation = contextMenu.conversation;
    handleCloseContextMenu();
    if (conversation) {
      // Delay slightly to let context menu close first
      setTimeout(() => {
        handleMute(conversation);
      }, 100);
    }
  }, [contextMenu.conversation, handleMute, handleCloseContextMenu]);

  const handleContextMenuMarkUnread = useCallback(() => {
    if (contextMenu.conversation) {
      actions.markUnread(contextMenu.conversation);
    }
    handleCloseContextMenu();
  }, [actions, contextMenu.conversation, handleCloseContextMenu]);

  const handleContextMenuArchive = useCallback(() => {
    if (contextMenu.conversation) {
      actions.toggleArchive(contextMenu.conversation);
    }
    handleCloseContextMenu();
  }, [actions, contextMenu.conversation, handleCloseContextMenu]);

  const handleContextMenuViewProfile = useCallback(() => {
    const conversation = contextMenu.conversation;
    handleCloseContextMenu();
    if (conversation?.type === "dm" && conversation.otherUserId) {
      navigation.navigate("UserProfile", { userId: conversation.otherUserId });
    }
  }, [contextMenu.conversation, handleCloseContextMenu, navigation]);

  const handleContextMenuDelete = useCallback(() => {
    const conversation = contextMenu.conversation;
    handleCloseContextMenu();
    if (conversation) {
      // Delay slightly to let context menu close first
      setTimeout(() => {
        handleDeleteRequest(conversation);
      }, 100);
    }
  }, [contextMenu.conversation, handleDeleteRequest, handleCloseContextMenu]);

  // =============================================================================
  // Empty State Logic
  // =============================================================================

  const emptyStateType = useMemo(() => {
    if (showArchived) return "archiveEmpty";

    switch (filter) {
      case "unread":
        return "allCaughtUp";
      case "groups":
        return "noGroups";
      case "dms":
        return "noDMs";
      case "requests":
        return "noRequests";
      default:
        return "noConversations";
    }
  }, [filter, showArchived]);

  // =============================================================================
  // Render Functions
  // =============================================================================

  const renderConversationItem = useCallback(
    ({ item }: { item: InboxConversation }) => (
      <SwipeableConversation
        conversation={item}
        onPin={() => actions.togglePin(item)}
        onArchive={() => actions.toggleArchive(item)}
        onDelete={() => handleDeleteRequest(item)}
        onMute={() => handleMute(item)}
      >
        <ConversationItem
          conversation={item}
          onPress={() => handleConversationPress(item)}
          onAvatarPress={() => handleAvatarPress(item)}
          onLongPress={(event?: { pageX: number; pageY: number }) =>
            handleLongPress(item, event)
          }
        />
      </SwipeableConversation>
    ),
    [
      actions,
      handleConversationPress,
      handleAvatarPress,
      handleLongPress,
      handleMute,
      handleDeleteRequest,
    ],
  );

  const ListHeaderComponent = useCallback(() => {
    if (pinnedConversations.length === 0) return null;

    return (
      <PinnedSection
        conversations={pinnedConversations}
        onConversationPress={handleConversationPress}
        onAvatarPress={handleAvatarPress}
        onLongPress={handleLongPress}
      />
    );
  }, [
    pinnedConversations,
    handleConversationPress,
    handleAvatarPress,
    handleLongPress,
  ]);

  const ListEmptyComponent = useCallback(
    () => (
      <EmptyState
        type={emptyStateType}
        showAction={filter === "all" && !showArchived}
        onAction={() => navigation.navigate("Connections")}
        actionLabel="Find Friends"
      />
    ),
    [emptyStateType, filter, showArchived, navigation],
  );

  // =============================================================================
  // Loading / Error States
  // =============================================================================

  if (loading) {
    return <LoadingState message="Loading inbox..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Something went wrong"
        message={error.message}
        onRetry={refresh}
      />
    );
  }

  // =============================================================================
  // Main Render
  // =============================================================================

  // Determine if we're showing requests tab
  const showRequestsTab = filter === "requests";
  const requestsRefreshing = requestsLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <InboxHeader
        onSearchPress={handleSearchPress}
        onSettingsPress={handleSettingsPress}
        showArchived={showArchived}
        onArchiveToggle={() => setShowArchived(!showArchived)}
      />

      {/* Tabs */}
      {!showArchived && (
        <InboxTabs
          activeTab={filter}
          onTabChange={setFilter}
          unreadCount={totalUnread}
          requestsCount={getUnifiedRequestsCount({
            friendRequestsCount: friendRequests.length,
            groupInvitesCount: groupInvites.length,
            messageRequestsCount: messageRequests.length,
          })}
        />
      )}

      {/* Requests List (friend + group + message requests) */}
      {showRequestsTab ? (
        requestsLoading && requestItems.length === 0 ? (
          <LoadingState message="Loading requests..." />
        ) : requestsError && requestItems.length === 0 ? (
          <ErrorState
            title="Could not load requests"
            message={requestsError.message}
            onRetry={handleRequestsRefresh}
          />
        ) : isRequestsTabEmpty(requestItems.length) ? (
          <View style={styles.emptyContainer}>
            <EmptyState
              type="noRequests"
              showAction={true}
              onAction={() => navigation.navigate("Connections")}
              actionLabel="Find Friends"
            />
          </View>
        ) : (
          <FlatList
            data={requestItems}
            renderItem={({ item }) => {
              if (item.kind === "group_invite") {
                return (
                  <GroupInviteItem
                    invite={item.groupInvite}
                    onAccept={() => handleAcceptGroupInvite(item.groupInvite)}
                    onDecline={() => handleDeclineGroupInvite(item.groupInvite)}
                  />
                );
              }

              if (item.kind === "friend_request") {
                return (
                  <FriendRequestItem
                    request={item.friendRequest}
                    onAccept={() => handleAcceptRequest(item.friendRequest.id)}
                    onDecline={() => handleDeclineRequest(item.friendRequest.id)}
                    onPress={() => handleRequestPress(item.friendRequest)}
                  />
                );
              }

              const request = item.messageRequest;
              return (
                <View
                  style={[styles.requestRow, { backgroundColor: colors.surface }]}
                >
                  <View style={styles.requestRowContent}>
                    <Text style={[styles.requestTitle, { color: colors.text }]}>
                      {request.requesterName}
                    </Text>
                    <Text
                      style={[
                        styles.requestSubtitle,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={2}
                    >
                      {request.messagePreview || "Sent you a message request"}
                    </Text>
                  </View>
                  <View style={styles.requestActions}>
                    <Button
                      mode="contained"
                      compact
                      onPress={() => handleAcceptMessageRequest(request.chatId)}
                    >
                      Accept
                    </Button>
                    <Button
                      mode="outlined"
                      compact
                      onPress={() => handleDeclineMessageRequest(request.chatId)}
                    >
                      Decline
                    </Button>
                  </View>
                </View>
              );
            }}
            keyExtractor={(item) => `${item.kind}:${item.id}`}
            refreshing={requestsRefreshing}
            onRefresh={handleRequestsRefresh}
          />
        )
      ) : (
        /* Conversation List */
        <FlatList
          data={regularConversations}
          renderItem={renderConversationItem}
          ListHeaderComponent={ListHeaderComponent}
          ListEmptyComponent={ListEmptyComponent}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={
            regularConversations.length === 0 &&
            pinnedConversations.length === 0
              ? styles.emptyContainer
              : undefined
          }
          refreshing={false}
          onRefresh={refresh}
        />
      )}

      {/* FAB */}
      <InboxFAB visible={isFocused && !showArchived} />

      {/* Context Menu */}
      {contextMenu.conversation && (
        <ConversationContextMenu
          visible={contextMenu.visible}
          position={contextMenu.position}
          conversation={contextMenu.conversation}
          onClose={handleCloseContextMenu}
          onPin={handleContextMenuPin}
          onMute={handleContextMenuMute}
          onMarkUnread={handleContextMenuMarkUnread}
          onArchive={handleContextMenuArchive}
          onViewProfile={handleContextMenuViewProfile}
          onDelete={handleContextMenuDelete}
        />
      )}

      {/* Mute Options Sheet */}
      <MuteOptionsSheet
        visible={muteSheetVisible}
        onClose={handleCloseMuteSheet}
        onSelectDuration={handleMuteDurationSelect}
        conversationName={muteTargetConversation?.name ?? ""}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        visible={deleteDialogVisible}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        conversationName={deleteTargetConversation?.name ?? ""}
        isGroup={deleteTargetConversation?.type === "group"}
        loading={deleteLoading}
      />
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
  emptyContainer: {
    flex: 1,
  },
  requestRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  requestRowContent: {
    marginBottom: 10,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  requestSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
});
