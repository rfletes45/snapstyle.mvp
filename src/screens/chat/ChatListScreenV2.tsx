/**
 * ChatListScreen (Messages) - V2
 *
 * Snapchat-inspired Messages screen with:
 * - MessagesHeader with avatar, search, games, settings
 * - InboxTabs for filtering (All/Unread/Groups/DMs/Archived)
 * - Pinned conversations section
 * - Swipeable conversation items
 * - Long-press context menu
 * - FAB with multiple actions
 */

import {
  useConversationActions,
  type MuteDuration,
} from "@/hooks/useConversationActions";
import { useInboxData } from "@/hooks/useInboxData";
import { useInboxTyping } from "@/hooks/useInboxTyping";
import { usePendingFriendRequestCount } from "@/hooks/usePendingFriendRequestCount";
import {
  getGroupBackgroundStateSnapshot,
  resolveGroupBackgroundUrl,
} from "@/services/chat/groupBackgroundState";
import {
  describeRemoteUrlForLog,
  getPreparedGroupChatData,
  rememberPreparedGroupChatData,
  traceGroupWallpaper,
} from "@/services/chat/groupWallpaperDebug";
import {
  prepareDmThreadEntry,
  prepareGroupChatNavigation,
} from "@/services/chat/threadIdentityWarmup";
import { setArchived } from "@/services/chatMembers";
import { setGroupArchived } from "@/services/groupMembers";
import { useAuth } from "@/store/AuthContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { InboxConversation } from "@/types/messaging";
import {
  prefetchImages,
  usePrefetchProfileImages,
} from "@/utils/imagePrefetch";
import { isDebugEnabled, log } from "@/utils/log";
import { normalizeRemoteImageUrl } from "@/utils/remoteImageSource";
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

// Components
import {
  ConversationContextMenu,
  ConversationItem,
  DeleteConfirmDialog,
  EmptyState,
  InboxFAB,
  InboxHeader,
  InboxTabs,
  MuteOptionsSheet,
  NewMessageModal,
  PinnedSection,
  SwipeableConversation,
} from "@/components/chat/inbox";
import { SearchSheet } from "@/components/chat/search";
import { ErrorState, LoadingState } from "@/components/ui";
import { ContactsEnablementBanner } from "@/components/ui/ContactsEnablementBanner";
import { CONTACTS_DISCOVERY_ENABLED } from "@/constants/featureFlags";
import { useContactsDiscovery } from "@/hooks/useContactsDiscovery";
import { useContactsPermission } from "@/hooks/useContactsPermission";
// Theme

const interactionLog = log.child("InboxInteraction");

// =============================================================================
// Types
// =============================================================================

interface ContextMenuState {
  visible: boolean;
  position: { x: number; y: number };
  conversation: InboxConversation | null;
}

interface InboxConversationRowProps {
  conversation: InboxConversation;
  isTyping: boolean;
  onTogglePin: (conversation: InboxConversation) => void;
  onDeleteRequest: (conversation: InboxConversation) => void;
  onMute: (conversation: InboxConversation) => void;
  onConversationPress: (conversation: InboxConversation) => void;
  onConversationPressIn: (conversation: InboxConversation) => void;
  onAvatarPress: (conversation: InboxConversation) => void;
  onLongPress: (
    conversation: InboxConversation,
    event?: { pageX: number; pageY: number },
  ) => void;
}

const InboxConversationRow = React.memo(function InboxConversationRow({
  conversation,
  isTyping,
  onTogglePin,
  onDeleteRequest,
  onMute,
  onConversationPress,
  onConversationPressIn,
  onAvatarPress,
  onLongPress,
}: InboxConversationRowProps) {
  const handlePin = useCallback(
    () => onTogglePin(conversation),
    [conversation, onTogglePin],
  );
  const handleDelete = useCallback(
    () => onDeleteRequest(conversation),
    [conversation, onDeleteRequest],
  );
  const handleMute = useCallback(
    () => onMute(conversation),
    [conversation, onMute],
  );
  const handlePress = useCallback(
    () => onConversationPress(conversation),
    [conversation, onConversationPress],
  );
  const handlePressIn = useCallback(
    () => onConversationPressIn(conversation),
    [conversation, onConversationPressIn],
  );
  const handleAvatarPress = useCallback(
    () => onAvatarPress(conversation),
    [conversation, onAvatarPress],
  );
  const handleLongPress = useCallback(
    (event?: { pageX: number; pageY: number }) =>
      onLongPress(conversation, event),
    [conversation, onLongPress],
  );

  return (
    <SwipeableConversation
      conversation={conversation}
      onPin={handlePin}
      onDelete={handleDelete}
      onMute={handleMute}
      onLongPress={handleLongPress}
    >
      <ConversationItem
        conversation={conversation}
        isTyping={isTyping}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onAvatarPress={handleAvatarPress}
        onLongPress={handleLongPress}
      />
    </SwipeableConversation>
  );
});

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
  const pendingFriendRequestCount = usePendingFriendRequestCount(uid);

  // ── Contacts enablement banner state ────────────────────────────────
  const contactsPerm = useContactsPermission();
  const contactsDiscovery = useContactsDiscovery(uid || undefined);

  // Data from useInboxData hook
  const {
    pinnedConversations,
    regularConversations,
    allConversations,
    loading,
    error,
    totalUnread,
    filter,
    setFilter,
    refresh,
    markConversationReadOptimistic,
    togglePinOptimistic,
  } = useInboxData(uid);

  // "New user" = account created < 14 days ago
  const isNewUser = useMemo(() => {
    const creationTime = currentFirebaseUser?.metadata?.creationTime;
    if (!creationTime) return false;
    const age = Date.now() - new Date(creationTime).getTime();
    return age < 14 * 24 * 60 * 60 * 1000;
  }, [currentFirebaseUser?.metadata?.creationTime]);

  // Show contacts banner when:
  // - Feature enabled
  // - User is new or has few conversations
  // - Permission not fully granted
  // - Banner not dismissed (within cooldown)
  const showContactsBanner = useMemo(() => {
    if (!CONTACTS_DISCOVERY_ENABLED) return false;
    if (!contactsPerm.ready) return false;
    if (contactsPerm.permState === "granted_all") return false;
    if (contactsPerm.messagesBannerDismissed) return false;
    // Show for new users, or users with ≤ 3 conversations
    const hasConversations = (regularConversations?.length ?? 0) > 3;
    return isNewUser || !hasConversations;
  }, [
    contactsPerm.ready,
    contactsPerm.permState,
    contactsPerm.messagesBannerDismissed,
    isNewUser,
    regularConversations?.length,
  ]);

  // Prominent layout for truly empty inbox; compact otherwise
  const contactsBannerProminent =
    (regularConversations?.length ?? 0) === 0 &&
    (pinnedConversations?.length ?? 0) === 0;

  const handleContactsBannerEnable = useCallback(async () => {
    const status = await contactsPerm.handleEnableContacts();
    if (status === "granted" || status === "limited") {
      contactsDiscovery.syncContacts();
    }
  }, [contactsPerm, contactsDiscovery]);

  // Re-check permission after returning from Settings
  useFocusEffect(
    useCallback(() => {
      if (contactsPerm.ready) {
        void contactsPerm.refreshPermission();
      }
    }, [contactsPerm.ready, contactsPerm.refreshPermission]),
  );

  // In-app notifications context (for tracking last viewed chat)
  const {
    consumeLastViewedConversation,
    registerNotificationPressHandler,
    setCurrentScreen,
  } = useInAppNotifications();

  React.useEffect(() => {
    if (!__DEV__) return;
    interactionLog.debug("Messages screen mounted", {
      data: { hasUid: !!uid },
    });
    return () => {
      interactionLog.debug("Messages screen unmounted", {
        data: { hasUid: !!uid },
      });
    };
  }, [uid]);

  React.useEffect(() => {
    const requestedFilter = route.params?.initialFilter;
    if (requestedFilter) {
      if (requestedFilter !== filter) {
        setFilter(requestedFilter);
      }
      navigation.setParams({ initialFilter: undefined });
    }
  }, [route.params?.initialFilter, filter, navigation, setFilter]);

  // Warm image cache for conversation avatars. Memoize the input so the
  // prefetch hook does not need to diff freshly-created arrays on unrelated
  // screen renders.
  const avatarPrefetchProfiles = useMemo(
    () =>
      [...(pinnedConversations || []), ...(regularConversations || [])].map(
        (c) =>
          ({
            avatarUrl: c.avatarUrl,
            profilePictureUrl: c.profilePictureUrl,
          }) as {
            avatarUrl?: string | null;
            profilePictureUrl?: string | null;
          },
      ),
    [pinnedConversations, regularConversations],
  );
  usePrefetchProfileImages(avatarPrefetchProfiles);

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
  const {
    togglePin: togglePinAction,
    mute: muteAction,
    unmute: unmuteAction,
    deleteConversation: deleteConversationAction,
    markUnread: markUnreadAction,
    markRead: markReadAction,
  } = actions;

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    position: { x: 0, y: 0 },
    conversation: null,
  });
  const suppressPressAfterLongPressRef = useRef<{
    key: string;
    expiresAt: number;
  } | null>(null);
  const pendingPinMutationKeysRef = useRef<Set<string>>(new Set());
  const suppressPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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

  // New message compose modal state
  const [newMessageModalVisible, setNewMessageModalVisible] = useState(false);

  React.useEffect(() => {
    if (!isDebugEnabled("CHAT")) return;
    interactionLog.debug("overlay state changed", {
      data: {
        contextMenuVisible: contextMenu.visible,
        contextConversationId: contextMenu.conversation?.id ?? null,
        contextConversationType: contextMenu.conversation?.type ?? null,
        muteSheetVisible,
        muteConversationId: muteTargetConversation?.id ?? null,
        deleteDialogVisible,
        deleteConversationId: deleteTargetConversation?.id ?? null,
        searchSheetVisible,
        newMessageModalVisible,
      },
    });
  }, [
    contextMenu.conversation?.id,
    contextMenu.conversation?.type,
    contextMenu.visible,
    deleteDialogVisible,
    deleteTargetConversation?.id,
    muteSheetVisible,
    muteTargetConversation?.id,
    newMessageModalVisible,
    searchSheetVisible,
  ]);

  React.useEffect(() => {
    return () => {
      if (suppressPressTimerRef.current) {
        clearTimeout(suppressPressTimerRef.current);
        suppressPressTimerRef.current = null;
      }
    };
  }, []);

  const getConversationInteractionKey = useCallback(
    (conversation: InboxConversation) =>
      `${conversation.type}:${conversation.id}`,
    [],
  );

  const armSuppressPressAfterLongPress = useCallback(
    (conversation: InboxConversation) => {
      const key = getConversationInteractionKey(conversation);
      suppressPressAfterLongPressRef.current = {
        key,
        expiresAt: Date.now() + 900,
      };
      if (suppressPressTimerRef.current) {
        clearTimeout(suppressPressTimerRef.current);
      }
      suppressPressTimerRef.current = setTimeout(() => {
        if (suppressPressAfterLongPressRef.current?.key === key) {
          suppressPressAfterLongPressRef.current = null;
        }
        suppressPressTimerRef.current = null;
      }, 900);
    },
    [getConversationInteractionKey],
  );

  const consumeSuppressedPress = useCallback(
    (conversation: InboxConversation, source: "row" | "avatar") => {
      const pending = suppressPressAfterLongPressRef.current;
      if (!pending) return false;

      const isMatch =
        pending.key === getConversationInteractionKey(conversation);
      const isFresh = Date.now() <= pending.expiresAt;
      if (!isMatch || !isFresh) {
        if (!isFresh) suppressPressAfterLongPressRef.current = null;
        return false;
      }

      suppressPressAfterLongPressRef.current = null;
      if (suppressPressTimerRef.current) {
        clearTimeout(suppressPressTimerRef.current);
        suppressPressTimerRef.current = null;
      }

      if (__DEV__) {
        interactionLog.debug("press suppressed after long-press", {
          data: {
            conversationId: conversation.id,
            type: conversation.type,
            source,
          },
        });
      }
      return true;
    },
    [getConversationInteractionKey],
  );

  useFocusEffect(
    useCallback(() => {
      if (isDebugEnabled("PERF")) {
        interactionLog.debug("Messages screen focused", {
          data: {
            filter,
            regularCount: regularConversations.length,
            pinnedCount: pinnedConversations.length,
            contextMenuVisible: contextMenu.visible,
            muteSheetVisible,
            deleteDialogVisible,
            searchSheetVisible,
          },
        });
      }

      return () => {
        if (isDebugEnabled("PERF")) {
          interactionLog.debug("Messages screen blurred", {
            data: { filter },
          });
        }
      };
    }, [filter]),
  );

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
      if (__DEV__) {
        interactionLog.debug("press-in warmup callback", {
          data: {
            conversationId: conversation.id,
            type: conversation.type,
            hasOtherUserId: !!conversation.otherUserId,
          },
        });
      }

      if (conversation.type === "dm") {
        prepareDmThreadEntry({
          avatarUrl: conversation.profilePictureUrl || conversation.avatarUrl,
          decorationId: conversation.decorationId,
        }).catch(() => {});
      } else {
        const prepared = getPreparedGroupChatData(
          conversation.id,
          "chat-list-press-in",
        );
        const trustedBackgroundState = getGroupBackgroundStateSnapshot(
          conversation.id,
        );
        const hasConversationBackground = Object.prototype.hasOwnProperty.call(
          conversation,
          "backgroundUrl",
        );
        const resolvedBackgroundUrl = resolveGroupBackgroundUrl(
          conversation.id,
          hasConversationBackground ? conversation.backgroundUrl : null,
          {
            source: "chat-list-press-in",
            candidateAuthority: "helper",
          },
        );
        const resolvedAvatarUrl = normalizeRemoteImageUrl(
          conversation.avatarUrl ?? prepared?.avatarUrl,
        );

        rememberPreparedGroupChatData(
          conversation.id,
          {
            name: conversation.name,
            avatarUrl: resolvedAvatarUrl ?? undefined,
            backgroundUrl: resolvedBackgroundUrl ?? null,
          },
          "chat-list-press-in",
        );

        if (__DEV__) {
          traceGroupWallpaper(conversation.id, "chat-list-press-in", {
            hasConversationBackground: !!conversation.backgroundUrl,
            hasTrustedBackgroundState: !!trustedBackgroundState,
            preparedBackground: !!prepared?.backgroundUrl,
            resolvedBackgroundKey: describeRemoteUrlForLog(
              resolvedBackgroundUrl,
            ).key,
            helperBackgroundBlocked:
              !!conversation.backgroundUrl && !resolvedBackgroundUrl,
          });
        }

        // Start background image prefetch immediately — this is the earliest
        // possible moment to get the image into expo-image's memory cache
        // so it paints on GroupChatScreen's very first frame.
        // Normalize the URL so the cache key matches what warmRemoteImage uses.
        if (resolvedBackgroundUrl) {
          void prefetchImages([resolvedBackgroundUrl]).then((success) => {
            if (__DEV__) {
              traceGroupWallpaper(
                conversation.id,
                "chat-list-press-in-prefetch-finish",
                {
                  success,
                },
              );
            }
          });
        }

        void prepareGroupChatNavigation({
          groupId: conversation.id,
          groupName: conversation.name || prepared?.name || undefined,
          groupAvatarUrl: resolvedAvatarUrl ?? null,
          backgroundUrl: resolvedBackgroundUrl ?? null,
        })
          .then((navParams) => {
            rememberPreparedGroupChatData(
              conversation.id,
              navParams.initialGroupData ?? {},
              "chat-list-press-in-nav-ready",
            );
            if (__DEV__) {
              traceGroupWallpaper(
                conversation.id,
                "chat-list-press-in-navigation-ready",
                {
                  backgroundReady: !!navParams.initialGroupData?.backgroundUrl,
                },
              );
            }
          })
          .catch(() => {});
      }
    },
    [],
  );

  const handleConversationPress = useCallback(
    (conversation: InboxConversation) => {
      if (consumeSuppressedPress(conversation, "row")) {
        return;
      }

      if (__DEV__) {
        interactionLog.debug("tap callback received", {
          data: {
            conversationId: conversation.id,
            type: conversation.type,
            hasOtherUserId: !!conversation.otherUserId,
          },
        });
      }

      try {
        // Optimistically mark as read in local state (immediate UI update)
        markConversationReadOptimistic(conversation.id, conversation.type);

        // Also persist to Firestore (background operation)
        void markReadAction(conversation).catch((error) => {
          interactionLog.warn("mark-read failed after tap", {
            data: {
              conversationId: conversation.id,
              type: conversation.type,
              error,
            },
          });
        });

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

          if (__DEV__) {
            interactionLog.debug("navigation attempt", {
              data: {
                route: "ChatDetail",
                conversationId: conversation.id,
                type: conversation.type,
                hasFriendUid: !!conversation.otherUserId,
              },
            });
          }

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
          const prepared = getPreparedGroupChatData(
            conversation.id,
            "chat-list-press",
          );
          const trustedBackgroundState = getGroupBackgroundStateSnapshot(
            conversation.id,
          );
          const hasConversationBackground =
            Object.prototype.hasOwnProperty.call(conversation, "backgroundUrl");
          const initialGroupData = {
            name: conversation.name || prepared?.name || "",
            avatarUrl:
              normalizeRemoteImageUrl(
                conversation.avatarUrl ?? prepared?.avatarUrl,
              ) ?? null,
            backgroundUrl: resolveGroupBackgroundUrl(
              conversation.id,
              hasConversationBackground ? conversation.backgroundUrl : null,
              {
                source: "chat-list-press",
                candidateAuthority: "helper",
              },
            ),
            backgroundTrusted: !!trustedBackgroundState,
          };

          rememberPreparedGroupChatData(
            conversation.id,
            {
              name: initialGroupData.name,
              avatarUrl: initialGroupData.avatarUrl,
              backgroundUrl: initialGroupData.backgroundUrl,
            },
            "chat-list-press",
          );

          if (__DEV__) {
            traceGroupWallpaper(conversation.id, "chat-list-press", {
              hasConversationBackground: !!conversation.backgroundUrl,
              hasTrustedBackgroundState: !!trustedBackgroundState,
              preparedBackground: !!prepared?.backgroundUrl,
              navigatedBackground: !!initialGroupData.backgroundUrl,
              helperBackgroundBlocked:
                !!conversation.backgroundUrl && !initialGroupData.backgroundUrl,
            });
          }

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
              backgroundTrusted: boolean;
            };
          } = {
            groupId: conversation.id,
            groupName: initialGroupData.name || conversation.name,
            initialGroupData,
          };

          if (__DEV__) {
            interactionLog.debug("navigation attempt", {
              data: {
                route: "GroupChat",
                conversationId: conversation.id,
                type: conversation.type,
                hasGroupId: !!navParams.groupId,
              },
            });
          }

          navigation.navigate("GroupChat", navParams);

          // Warm identity assets in background (non-blocking)
          void prepareGroupChatNavigation({
            groupId: conversation.id,
            groupName: initialGroupData.name || undefined,
            groupAvatarUrl: initialGroupData.avatarUrl,
            backgroundUrl: initialGroupData.backgroundUrl,
          }).catch((err) => {
            log.warn("[Inbox] Background group warmup failed", { err });
          });
        }
      } catch (error) {
        interactionLog.error("tap callback failed", error, {
          data: {
            conversationId: conversation.id,
            type: conversation.type,
          },
        });
        throw error;
      }
    },
    [
      consumeSuppressedPress,
      navigation,
      markReadAction,
      markConversationReadOptimistic,
    ],
  );

  const handleAvatarPress = useCallback(
    (conversation: InboxConversation) => {
      if (consumeSuppressedPress(conversation, "avatar")) {
        return;
      }

      if (conversation.type === "dm" && conversation.otherUserId) {
        navigation.navigate("UserProfile", {
          userId: conversation.otherUserId,
        });
      }
    },
    [consumeSuppressedPress, navigation],
  );

  const handleLongPress = useCallback(
    (
      conversation: InboxConversation,
      event?: { pageX: number; pageY: number },
    ) => {
      if (__DEV__) {
        interactionLog.debug("long-press callback received", {
          data: {
            conversationId: conversation.id,
            type: conversation.type,
            hasPosition: !!event,
            pageX: event?.pageX,
            pageY: event?.pageY,
          },
        });
      }

      armSuppressPressAfterLongPress(conversation);

      // Show context menu at touch position
      const position = event
        ? { x: event.pageX, y: event.pageY }
        : { x: 100, y: 200 }; // fallback position

      if (__DEV__) {
        interactionLog.debug("context-menu open attempt", {
          data: {
            conversationId: conversation.id,
            type: conversation.type,
            x: position.x,
            y: position.y,
          },
        });
      }

      setContextMenu({
        visible: true,
        position,
        conversation,
      });
    },
    [armSuppressPressAfterLongPress],
  );

  const handleCloseContextMenu = useCallback(() => {
    if (__DEV__) {
      interactionLog.debug("context-menu close", {
        data: {
          conversationId: contextMenu.conversation?.id ?? null,
          type: contextMenu.conversation?.type ?? null,
        },
      });
    }
    setContextMenu({
      visible: false,
      position: { x: 0, y: 0 },
      conversation: null,
    });
  }, [contextMenu.conversation?.id, contextMenu.conversation?.type]);

  const handleSearchPress = useCallback(() => {
    if (__DEV__) {
      interactionLog.debug("search sheet open requested");
    }
    setSearchSheetVisible(true);
  }, []);

  const handleSearchDismiss = useCallback(() => {
    if (__DEV__) {
      interactionLog.debug("search sheet dismissed");
    }
    setSearchSheetVisible(false);
  }, []);

  const handleNewMessagePress = useCallback(() => {
    if (__DEV__) {
      interactionLog.debug("new message modal open requested");
    }
    setNewMessageModalVisible(true);
  }, []);

  const handleNewMessageDismiss = useCallback(() => {
    if (__DEV__) {
      interactionLog.debug("new message modal dismissed");
    }
    setNewMessageModalVisible(false);
  }, []);

  // =============================================================================
  // Swipe Action Handlers
  // =============================================================================

  const handleMute = useCallback(
    (conversation: InboxConversation) => {
      // If already muted, unmute. Otherwise show mute options sheet.
      if (conversation.memberState.mutedUntil) {
        unmuteAction(conversation);
      } else {
        setMuteTargetConversation(conversation);
        setMuteSheetVisible(true);
      }
    },
    [unmuteAction],
  );

  const handleMuteDurationSelect = useCallback(
    (duration: MuteDuration) => {
      if (muteTargetConversation) {
        muteAction(muteTargetConversation, duration);
      }
      setMuteSheetVisible(false);
      setMuteTargetConversation(null);
    },
    [muteTargetConversation, muteAction],
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
      await deleteConversationAction(deleteTargetConversation);
    } finally {
      setDeleteLoading(false);
      setDeleteDialogVisible(false);
      setDeleteTargetConversation(null);
    }
  }, [deleteTargetConversation, deleteConversationAction]);

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogVisible(false);
    setDeleteTargetConversation(null);
  }, []);

  // =============================================================================
  // Context Menu Action Handlers
  // =============================================================================

  const handlePinToggleRequest = useCallback(
    (conversation: InboxConversation, source: "context-menu" | "swipe") => {
      const mutationKey = getConversationInteractionKey(conversation);
      if (pendingPinMutationKeysRef.current.has(mutationKey)) {
        if (__DEV__) {
          interactionLog.debug("pin toggle ignored while mutation pending", {
            data: {
              conversationId: conversation.id,
              type: conversation.type,
              source,
            },
          });
        }
        return;
      }

      const wasPinned = !!conversation.memberState.pinnedAt;
      if (__DEV__) {
        interactionLog.debug("pin toggle requested", {
          data: {
            conversationId: conversation.id,
            type: conversation.type,
            source,
            fromPinned: wasPinned,
          },
        });
      }

      pendingPinMutationKeysRef.current.add(mutationKey);
      togglePinOptimistic(conversation.id, conversation.type);
      void togglePinAction(conversation)
        .then(() => {
          if (__DEV__) {
            interactionLog.debug("pin toggle completed", {
              data: {
                conversationId: conversation.id,
                type: conversation.type,
                source,
                toPinned: !wasPinned,
              },
            });
          }
        })
        .catch((error) => {
          interactionLog.error(
            "pin toggle failed; rolling back optimistic UI",
            {
              data: {
                conversationId: conversation.id,
                type: conversation.type,
                source,
                error,
              },
            },
          );
          togglePinOptimistic(conversation.id, conversation.type);
        })
        .finally(() => {
          pendingPinMutationKeysRef.current.delete(mutationKey);
        });
    },
    [getConversationInteractionKey, togglePinAction, togglePinOptimistic],
  );

  const handleContextMenuPin = useCallback(() => {
    const conversation = contextMenu.conversation;
    handleCloseContextMenu();
    if (conversation) {
      handlePinToggleRequest(conversation, "context-menu");
    }
  }, [
    contextMenu.conversation,
    handleCloseContextMenu,
    handlePinToggleRequest,
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
      markUnreadAction(contextMenu.conversation);
    }
    handleCloseContextMenu();
  }, [markUnreadAction, contextMenu.conversation, handleCloseContextMenu]);

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

  const handleContextMenuArchive = useCallback(async () => {
    const conversation = contextMenu.conversation;
    handleCloseContextMenu();
    if (!conversation || !uid) return;

    const isArchived = !!conversation.memberState.archived;
    try {
      if (conversation.type === "dm") {
        await setArchived(conversation.id, uid, !isArchived);
      } else {
        await setGroupArchived(conversation.id, uid, !isArchived);
      }
    } catch (e) {
      log.error("Failed to toggle archive", e);
    }
    refresh();
  }, [contextMenu.conversation, handleCloseContextMenu, uid, refresh]);

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
      case "archived":
        return "noArchived";
      default:
        return "noConversations";
    }
  }, [filter]);

  // =============================================================================
  // Render Functions
  // =============================================================================

  const handleTogglePin = useCallback(
    (conversation: InboxConversation) => {
      handlePinToggleRequest(conversation, "swipe");
    },
    [handlePinToggleRequest],
  );

  const renderConversationItem = useCallback(
    ({ item }: { item: InboxConversation }) => (
      <InboxConversationRow
        conversation={item}
        isTyping={inboxTyping.get(item.id)?.isTyping || false}
        onTogglePin={handleTogglePin}
        onDeleteRequest={handleDeleteRequest}
        onMute={handleMute}
        onConversationPress={handleConversationPress}
        onConversationPressIn={handleConversationPressIn}
        onAvatarPress={handleAvatarPress}
        onLongPress={handleLongPress}
      />
    ),
    [
      handleTogglePin,
      inboxTyping,
      handleConversationPress,
      handleConversationPressIn,
      handleAvatarPress,
      handleLongPress,
      handleMute,
      handleDeleteRequest,
    ],
  );

  const renderPinnedConversationRow = useCallback(
    (conversation: InboxConversation, isTyping: boolean) => (
      <InboxConversationRow
        conversation={conversation}
        isTyping={isTyping}
        onTogglePin={handleTogglePin}
        onDeleteRequest={handleDeleteRequest}
        onMute={handleMute}
        onConversationPress={handleConversationPress}
        onConversationPressIn={handleConversationPressIn}
        onAvatarPress={handleAvatarPress}
        onLongPress={handleLongPress}
      />
    ),
    [
      handleTogglePin,
      handleDeleteRequest,
      handleMute,
      handleConversationPress,
      handleConversationPressIn,
      handleAvatarPress,
      handleLongPress,
    ],
  );

  // Use useMemo to produce a JSX element (not a function component).
  // Passing a function to ListHeaderComponent causes FlatList to treat it
  // as a component *type*; any dependency change swaps the type, forcing
  // React to unmount/remount the entire header, which drops in-progress
  // touch events and makes buttons appear unresponsive.
  const listHeaderElement = useMemo(() => {
    if (!showContactsBanner && pinnedConversations.length === 0) return null;

    return (
      <View>
        {/* Contacts enablement banner — above pinned conversations */}
        {showContactsBanner && (
          <ContactsEnablementBanner
            permState={contactsPerm.permState}
            onEnable={handleContactsBannerEnable}
            onDismiss={contactsPerm.dismissMessagesBanner}
            loading={contactsPerm.loading}
            prominent={contactsBannerProminent}
          />
        )}

        {/* Pinned conversations */}
        {pinnedConversations.length > 0 && (
          <PinnedSection
            conversations={pinnedConversations}
            typingMap={inboxTyping}
            onConversationPress={handleConversationPress}
            onConversationPressIn={handleConversationPressIn}
            onAvatarPress={handleAvatarPress}
            onLongPress={handleLongPress}
            renderConversationRow={renderPinnedConversationRow}
          />
        )}
      </View>
    );
  }, [
    showContactsBanner,
    contactsPerm.permState,
    contactsPerm.loading,
    contactsPerm.dismissMessagesBanner,
    contactsBannerProminent,
    handleContactsBannerEnable,
    pinnedConversations,
    inboxTyping,
    handleConversationPress,
    handleConversationPressIn,
    handleAvatarPress,
    handleLongPress,
    renderPinnedConversationRow,
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <InboxHeader
        onSearchPress={handleSearchPress}
        pendingFriendRequestCount={pendingFriendRequestCount}
      />

      {/* Tabs */}
      <InboxTabs
        activeTab={filter}
        onTabChange={setFilter}
        unreadCount={totalUnread}
      />

      {/* Conversation List */}
      <FlatList
        data={regularConversations}
        renderItem={renderConversationItem}
        ListHeaderComponent={listHeaderElement}
        ListEmptyComponent={ListEmptyComponent}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        contentContainerStyle={
          regularConversations.length === 0 && pinnedConversations.length === 0
            ? styles.emptyContainer
            : undefined
        }
        refreshing={false}
        onRefresh={refresh}
      />

      {/* FAB */}
      <InboxFAB visible={isFocused} onNewMessagePress={handleNewMessagePress} />

      {/* New Message Modal */}
      <NewMessageModal
        visible={newMessageModalVisible}
        onDismiss={handleNewMessageDismiss}
      />

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
          onArchive={handleContextMenuArchive}
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
        allConversations={allConversations}
        inboxReady={!loading}
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
});
