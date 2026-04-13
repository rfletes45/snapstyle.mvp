/**
 * ChatListScreen (Messages) - V2
 *
 * Snapchat-inspired Messages screen with:
 * - MessagesHeader with avatar, search, games, settings
 * - InboxTabs for filtering (All/Unread/Groups/DMs/Requests)
 * - Pinned conversations section
 * - Swipeable conversation items
 * - Long-press context menu
 * - Friend requests in Requests tab
 * - FAB with multiple actions
 */

import {
  useConversationActions,
  type MuteDuration,
} from "@/hooks/useConversationActions";
import type { FriendRequestWithUser } from "@/hooks/useFriendRequests";
import { useInboxData } from "@/hooks/useInboxData";
import { useInboxTyping } from "@/hooks/useInboxTyping";
import { useUnifiedInboxRequests } from "@/hooks/useUnifiedInboxRequests";
import {
  prepareDmThreadEntry,
  prepareGroupChatNavigation,
} from "@/services/chat/threadIdentityWarmup";
import { markNotificationsReadByTypes } from "@/services/userNotifications";
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
  useRoute,
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
import { SearchSheet } from "@/components/chat/search";
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
  const route = useRoute<any>();
  const uid = currentFirebaseUser?.uid ?? "";
  const isFocused = useIsFocused();

  // In-app notifications context (for tracking last viewed chat)
  const {
    consumeLastViewedConversation,
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
    refresh,
    markConversationReadOptimistic,
    togglePinOptimistic,
  } = useInboxData(uid);

  React.useEffect(() => {
    const requestedFilter = route.params?.initialFilter;
    if (requestedFilter) {
      if (requestedFilter !== filter) {
        setFilter(requestedFilter);
      }
      navigation.setParams({ initialFilter: undefined });
    }
  }, [route.params?.initialFilter, filter, navigation, setFilter]);

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

  // Per-conversation typing indicators for inbox rows
  const inboxConvSpecs = useMemo(
    () =>
      [...(pinnedConversations || []), ...(regularConversations || [])].map(
        (c) => ({ id: c.id, type: c.type }),
      ),
    [pinnedConversations, regularConversations],
  );
  const inboxTyping = useInboxTyping(uid, inboxConvSpecs);

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

  // Search sheet state
  const [searchSheetVisible, setSearchSheetVisible] = useState(false);

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
    const unsubscribe = registerNotificationPressHandler(
      (conversationId: string, scope: "dm" | "group" | null) => {
        log.debug("[Inbox] Notification pressed - optimistic read", {
          data: { conversationId, scope },
        });
        markConversationReadOptimistic(conversationId, scope ?? undefined);
      },
    );

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

  useFocusEffect(
    useCallback(() => {
      if (!uid || filter !== "requests") return;
      markNotificationsReadByTypes(uid, ["message_request"]).catch((error) => {
        log.warn("[Inbox] Failed to mark message request notifications read", {
          data: { error },
        });
      });
    }, [uid, filter]),
  );

  // =============================================================================
  // Mark Last Viewed Conversation as Read (for notification navigation)
  // =============================================================================

  // When returning to inbox from a chat opened via notification,
  // optimistically mark that conversation as read in local state.
  // This handles the case where the chat was opened via notification
  // (not through handleConversationPress which already does this).
  useFocusEffect(
    useCallback(() => {
      const lastViewedConversation = consumeLastViewedConversation();
      if (lastViewedConversation) {
        log.debug("[Inbox] Focus returned - optimistic read", {
          data: lastViewedConversation,
        });
        markConversationReadOptimistic(
          lastViewedConversation.conversationId,
          lastViewedConversation.scope ?? undefined,
        );
      }
    }, [consumeLastViewedConversation, markConversationReadOptimistic]),
  );

  // =============================================================================
  // Navigation Handlers
  // =============================================================================

  /**
   * Press-in warmup: fires identity asset preloading on finger-down,
   * giving ~150-300ms head start before the actual tap completes.
   *
   * NOTE: navigation.preload() was attempted here but crashes because
   * ChatDetail and GroupChat screens use render callbacks (children)
   * instead of the `component` prop. NativeStackView.native cannot
   * create a valid descriptor for preloaded routes defined that way.
   * The identity asset warming below is sufficient.
   *
   * Errors are silently swallowed — this is purely opportunistic.
   */
  const handleConversationPressIn = useCallback(
    (conversation: InboxConversation) => {
      if (conversation.type === "dm") {
        prepareDmThreadEntry({
          avatarUrl: conversation.profilePictureUrl || conversation.avatarUrl,
          decorationId: conversation.decorationId,
        }).catch(() => {});
      } else {
        prepareGroupChatNavigation({
          groupId: conversation.id,
          groupName: conversation.name,
          groupAvatarUrl: conversation.avatarUrl,
          backgroundUrl: conversation.backgroundUrl,
        }).catch(() => {});
      }
    },
    [],
  );

  const handleConversationPress = useCallback(
    (conversation: InboxConversation) => {
      // Optimistically mark as read in local state (immediate UI update)
      markConversationReadOptimistic(conversation.id, conversation.type);

      // Also persist to Firestore (background operation)
      actions.markRead(conversation);

      if (conversation.type === "dm") {
        // OPTIMIZATION: Navigate immediately, warm identity assets in background.
        // Previously this awaited prepareDmThreadEntry before navigating,
        // adding 100-300ms of delay before the screen transition even started.
        prepareDmThreadEntry({
          avatarUrl: conversation.profilePictureUrl || conversation.avatarUrl,
          decorationId: conversation.decorationId,
        }).catch((error) => {
          log.warn("[Inbox] Failed to warm DM thread identity", { error });
        });

        navigation.navigate("ChatDetail", {
          friendUid: conversation.otherUserId,
          // OPTIMIZATION: Pass cached data for instant display
          // This eliminates refetching when opening a chat
          initialData: {
            chatId: conversation.id,
            friendName: conversation.name,
            friendAvatar:
              conversation.profilePictureUrl || conversation.avatarUrl,
            friendAvatarConfig: conversation.avatarConfig,
            friendDecorationId: conversation.decorationId,
          },
        });
      } else {
        // OPTIMIZATION: Navigate immediately with data we already have,
        // rather than awaiting prepareGroupChatNavigation which performs
        // Firestore reads and image prefetching before navigation starts.
        // The group screen will load full data via its own subscriptions.
        const navParams: {
          groupId: string;
          groupName?: string;
          initialGroupData?: {
            name: string;
            avatarUrl: string | null;
            backgroundUrl: string | null;
          };
        } = {
          groupId: conversation.id,
          groupName: conversation.name,
          initialGroupData: {
            name: conversation.name || "",
            avatarUrl: conversation.avatarUrl ?? null,
            backgroundUrl: conversation.backgroundUrl ?? null,
          },
        };
        navigation.navigate("GroupChat", navParams);

        // Warm identity assets in background (non-blocking)
        prepareGroupChatNavigation({
          groupId: conversation.id,
          groupName: conversation.name,
          groupAvatarUrl: conversation.avatarUrl,
          backgroundUrl: conversation.backgroundUrl,
        }).catch((err) => {
          log.warn("[Inbox] Background group warmup failed", { err });
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
    setSearchSheetVisible(true);
  }, []);

  const handleSearchDismiss = useCallback(() => {
    setSearchSheetVisible(false);
  }, []);

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
        // Navigate to the group with warmed background
        const navParams = await prepareGroupChatNavigation({
          groupId: invite.groupId,
          groupName: invite.groupName,
        });
        navigation.navigate("GroupChat", navParams);
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
      togglePinOptimistic(
        contextMenu.conversation.id,
        contextMenu.conversation.type,
      );
      actions.togglePin(contextMenu.conversation);
    }
    handleCloseContextMenu();
  }, [
    actions,
    contextMenu.conversation,
    handleCloseContextMenu,
    togglePinOptimistic,
  ]);

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
  }, [filter]);

  // =============================================================================
  // Render Functions
  // =============================================================================

  const renderConversationItem = useCallback(
    ({ item }: { item: InboxConversation }) => (
      <SwipeableConversation
        conversation={item}
        onPin={() => {
          togglePinOptimistic(item.id, item.type);
          actions.togglePin(item);
        }}
        onDelete={() => handleDeleteRequest(item)}
        onMute={() => handleMute(item)}
      >
        <ConversationItem
          conversation={item}
          isTyping={inboxTyping.get(item.id)?.isTyping || false}
          onPress={() => handleConversationPress(item)}
          onPressIn={() => handleConversationPressIn(item)}
          onAvatarPress={() => handleAvatarPress(item)}
          onLongPress={(event?: { pageX: number; pageY: number }) =>
            handleLongPress(item, event)
          }
        />
      </SwipeableConversation>
    ),
    [
      actions,
      togglePinOptimistic,
      inboxTyping,
      handleConversationPress,
      handleConversationPressIn,
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
        typingMap={inboxTyping}
        onConversationPress={handleConversationPress}
        onAvatarPress={handleAvatarPress}
        onLongPress={handleLongPress}
      />
    );
  }, [
    pinnedConversations,
    inboxTyping,
    handleConversationPress,
    handleAvatarPress,
    handleLongPress,
  ]);

  const ListEmptyComponent = useCallback(
    () => (
      <EmptyState
        type={emptyStateType}
        showAction={filter === "all"}
        onAction={() => navigation.navigate("Friends")}
        actionLabel="Find Friends"
      />
    ),
    [emptyStateType, filter, navigation],
  );

  // =============================================================================
  // Loading / Error States
  // =============================================================================

  if (loading) {
    return <LoadingState message="Loading messages..." />;
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
      <InboxHeader onSearchPress={handleSearchPress} />

      {/* Tabs */}
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
              onAction={() => navigation.navigate("Friends")}
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
                    onDecline={() =>
                      handleDeclineRequest(item.friendRequest.id)
                    }
                    onPress={() => handleRequestPress(item.friendRequest)}
                  />
                );
              }

              const request = item.messageRequest;
              return (
                <View
                  style={[
                    styles.requestRow,
                    { backgroundColor: colors.background },
                  ]}
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
                      onPress={() =>
                        handleDeclineMessageRequest(request.chatId)
                      }
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
      <InboxFAB visible={isFocused} />

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

      {/* Search Sheet */}
      <SearchSheet
        visible={searchSheetVisible}
        onDismiss={handleSearchDismiss}
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
