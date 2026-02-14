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
import type { FriendRequestWithUser } from "@/hooks/useFriendRequests";
import { useFriendRequests } from "@/hooks/useFriendRequests";
import { useInboxData } from "@/hooks/useInboxData";
import { blockUser } from "@/services/blocking";
import { getPendingInvites } from "@/services/groups";
import { submitReport } from "@/services/reporting";
import { useAuth } from "@/store/AuthContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { InboxConversation } from "@/types/messaging";
import type { GroupInvite, ReportReason } from "@/types/models";
import { log } from "@/utils/log";
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

// Components
import BlockUserModal from "@/components/BlockUserModal";
import ReportUserModal from "@/components/ReportUserModal";
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
import { acceptGroupInvite, declineGroupInvite } from "@/services/groups";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/chat/ChatListScreenV2");
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

  // Actions from useConversationActions hook
  // Pass refresh callback to trigger UI update after actions
  const actions = useConversationActions(uid, { onActionComplete: refresh });

  // Local state
  const [pendingInvites, setPendingInvites] = useState<GroupInvite[]>([]);

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

  // Block user modal state
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [blockTargetUser, setBlockTargetUser] = useState<{
    userId: string;
    username: string;
  } | null>(null);
  const [blockLoading, setBlockLoading] = useState(false);

  // Report user modal state
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTargetUser, setReportTargetUser] = useState<{
    userId: string;
    username: string;
  } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Friend requests from useFriendRequests hook
  const {
    requests: friendRequests,
    loading: requestsLoading,
    acceptRequest,
    declineRequest,
  } = useFriendRequests(uid);

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
  // Load Friend Requests / Invites
  // =============================================================================

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;

      const loadInvites = async () => {
        try {
          logger.info("[ChatListScreen] Loading group invites for uid:", uid);
          const invites = await getPendingInvites(uid);
          logger.info(
            "[ChatListScreen] Loaded group invites:",
            invites.length,
            invites,
          );
          setPendingInvites(invites);
        } catch (e) {
          logger.error("[ChatListScreen] Error loading group invites:", e);
          log.warn("Could not fetch group invites", {
            data: { error: e instanceof Error ? e.message : String(e) },
          });
        }
      };

      loadInvites();
    }, [uid]),
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
        await acceptRequest(requestId);
      } catch (e) {
        log.error("Failed to accept friend request", e);
      }
    },
    [acceptRequest],
  );

  const handleDeclineRequest = useCallback(
    async (requestId: string) => {
      try {
        await declineRequest(requestId);
      } catch (e) {
        log.error("Failed to decline friend request", e);
      }
    },
    [declineRequest],
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
      if (!uid) return;
      try {
        await acceptGroupInvite(invite.id, uid);
        // Remove from local state
        setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
        // Navigate to the group
        navigation.navigate("GroupChat", {
          groupId: invite.groupId,
          groupName: invite.groupName,
        });
      } catch (e) {
        log.error("Failed to accept group invite", e);
      }
    },
    [uid, navigation],
  );

  const handleDeclineGroupInvite = useCallback(
    async (invite: GroupInvite) => {
      if (!uid) return;
      try {
        await declineGroupInvite(invite.id, uid);
        // Remove from local state
        setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id));
      } catch (e) {
        log.error("Failed to decline group invite", e);
      }
    },
    [uid],
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

  const handleConfirmBlock = useCallback(
    async (reason?: string) => {
      if (!blockTargetUser || !uid) return;

      setBlockLoading(true);
      try {
        await blockUser(uid, blockTargetUser.userId, reason);
        // Refresh the inbox after blocking
        refresh();
      } catch (error) {
        log.error("Failed to block user", error);
      } finally {
        setBlockLoading(false);
        setBlockModalVisible(false);
        setBlockTargetUser(null);
      }
    },
    [blockTargetUser, uid, refresh],
  );

  const handleCloseBlockModal = useCallback(() => {
    setBlockModalVisible(false);
    setBlockTargetUser(null);
  }, []);

  const handleSubmitReport = useCallback(
    async (reason: ReportReason, description?: string) => {
      if (!reportTargetUser || !uid) return;

      setReportLoading(true);
      try {
        await submitReport(uid, reportTargetUser.userId, reason, {
          description,
        });
      } catch (error) {
        log.error("Failed to submit report", error);
      } finally {
        setReportLoading(false);
        setReportModalVisible(false);
        setReportTargetUser(null);
      }
    },
    [reportTargetUser, uid],
  );

  const handleCloseReportModal = useCallback(() => {
    setReportModalVisible(false);
    setReportTargetUser(null);
  }, []);

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
          requestsCount={friendRequests.length + pendingInvites.length}
        />
      )}

      {/* Requests List (Friend Requests + Group Invites when Requests tab is active) */}
      {showRequestsTab ? (
        friendRequests.length === 0 && pendingInvites.length === 0 ? (
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
            data={[
              // Group invites section header
              ...(pendingInvites.length > 0
                ? [{ type: "header" as const, title: "Group Invites" }]
                : []),
              // Group invites
              ...pendingInvites.map((invite) => ({
                type: "invite" as const,
                data: invite,
              })),
              // Friend requests section header
              ...(friendRequests.length > 0
                ? [{ type: "header" as const, title: "Friend Requests" }]
                : []),
              // Friend requests
              ...friendRequests.map((request) => ({
                type: "request" as const,
                data: request,
              })),
            ]}
            renderItem={({ item }) => {
              if (item.type === "header") {
                return (
                  <View
                    style={[
                      styles.sectionHeader,
                      { backgroundColor: colors.background },
                    ]}
                    accessibilityRole="header"
                  >
                    <Text
                      style={[
                        styles.sectionHeaderText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {item.title}
                    </Text>
                  </View>
                );
              }
              if (item.type === "invite") {
                const invite = item.data as GroupInvite;
                return (
                  <GroupInviteItem
                    invite={invite}
                    onAccept={() => handleAcceptGroupInvite(invite)}
                    onDecline={() => handleDeclineGroupInvite(invite)}
                  />
                );
              }
              // Friend request
              const request = item.data as FriendRequestWithUser;
              return (
                <FriendRequestItem
                  request={request}
                  onAccept={() => handleAcceptRequest(request.id)}
                  onDecline={() => handleDeclineRequest(request.id)}
                  onPress={() => handleRequestPress(request)}
                />
              );
            }}
            keyExtractor={(item) => {
              if (item.type === "header") {
                return `header-${item.title}`;
              }
              if (item.type === "invite") {
                return `invite-${(item.data as GroupInvite).id}`;
              }
              return `request-${(item.data as FriendRequestWithUser).id}`;
            }}
            refreshing={requestsLoading}
            onRefresh={refresh}
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

      {/* Block User Modal */}
      <BlockUserModal
        visible={blockModalVisible}
        username={blockTargetUser?.username ?? ""}
        onConfirm={handleConfirmBlock}
        onCancel={handleCloseBlockModal}
        loading={blockLoading}
      />

      {/* Report User Modal */}
      <ReportUserModal
        visible={reportModalVisible}
        username={reportTargetUser?.username ?? ""}
        onSubmit={handleSubmitReport}
        onCancel={handleCloseReportModal}
        loading={reportLoading}
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 16,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
